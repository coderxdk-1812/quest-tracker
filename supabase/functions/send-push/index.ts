// Scheduled + on-demand Web Push sender.
// - Cron mode: iterates users, sends 24h/2h deadline reminders and evening streak nudges.
// - Test mode ({ test: true }): sends a single confirmation push to the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:notifications@questify.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 },
    );
    return { ok: true, gone: false };
  } catch (err: any) {
    const status = err?.statusCode || 0;
    if (status === 404 || status === 410) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id);
      return { ok: false, gone: true };
    }
    console.error("push error", status, err?.body || err?.message);
    return { ok: false, gone: false };
  }
}

async function sendToUser(userId: string, payload: PushPayload) {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;
  let sent = 0;
  for (const s of subs) {
    const r = await sendToSubscription(s, payload);
    if (r.ok) sent++;
  }
  return sent;
}

/** Record a fire so it never repeats. Returns true if this call was the first (inserted). */
async function firstFire(userId: string, kind: string, refId: string): Promise<boolean> {
  const { error } = await admin
    .from("notification_events")
    .insert({ user_id: userId, kind, ref_id: refId });
  if (error) {
    // Unique violation = already sent
    return false;
  }
  return true;
}

interface Prefs {
  notifyStreaks: boolean;
  notifyDeadlines: boolean;
}

function readPrefs(profile: any): Prefs {
  const p = profile?.notification_settings || {};
  return {
    notifyStreaks: p.notifyStreaks !== false,
    notifyDeadlines: p.notifyDeadlines !== false,
  };
}

async function runCron() {
  const now = new Date();
  const nowMs = now.getTime();
  const in24h = nowMs + 24 * 60 * 60 * 1000;
  const in2h = nowMs + 2 * 60 * 60 * 1000;
  const window = 20 * 60 * 1000; // 20 min tolerance around each mark
  const totals = { deadline24: 0, deadline2: 0, streak: 0 };

  // Get all users who have at least one push subscription
  const { data: subUsers, error: subErr } = await admin
    .from("push_subscriptions")
    .select("user_id");
  if (subErr) throw subErr;
  const userIds = Array.from(new Set((subUsers || []).map((r) => r.user_id)));
  if (userIds.length === 0) return totals;

  // Pull profiles for prefs
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, display_name, notification_settings")
    .in("user_id", userIds);
  const profileMap = new Map<string, any>();
  (profiles || []).forEach((p) => profileMap.set(p.user_id, p));

  // ── Deadline reminders ────────────────────────────────────────────────
  const { data: tasks } = await admin
    .from("tasks")
    .select("id, user_id, title, deadline, completed")
    .in("user_id", userIds)
    .eq("completed", false)
    .not("deadline", "is", null);

  for (const t of tasks || []) {
    const prefs = readPrefs(profileMap.get(t.user_id));
    if (!prefs.notifyDeadlines) continue;
    const dl = new Date(t.deadline).getTime();
    if (isNaN(dl)) continue;
    const diff = dl - nowMs;

    // 24h reminder
    if (Math.abs(dl - in24h) <= window) {
      const first = await firstFire(t.user_id, "task_24h", t.id);
      if (first) {
        const n = await sendToUser(t.user_id, {
          title: "⏰ Due tomorrow",
          body: `${t.title} — you've got this.`,
          url: "/tasks",
          tag: `task-${t.id}-24h`,
        });
        if (n > 0) totals.deadline24++;
      }
    }

    // 2h reminder
    if (Math.abs(dl - in2h) <= window && diff > 0) {
      const first = await firstFire(t.user_id, "task_2h", t.id);
      if (first) {
        const n = await sendToUser(t.user_id, {
          title: "⚡ Due in 2 hours",
          body: `${t.title} — perfect time for a focused sprint.`,
          url: "/tasks",
          tag: `task-${t.id}-2h`,
        });
        if (n > 0) totals.deadline2++;
      }
    }
  }

  // ── Evening streak nudge (fire between 18:00–21:00 UTC-ish; once per day per user) ──
  const hourUtc = now.getUTCHours();
  if (hourUtc >= 18 && hourUtc < 21) {
    const { data: gs } = await admin
      .from("game_state")
      .select("user_id, current_streak")
      .in("user_id", userIds)
      .gt("current_streak", 0);

    const todayStr = now.toISOString().slice(0, 10);
    const startOfDay = new Date(todayStr + "T00:00:00Z").toISOString();

    for (const g of gs || []) {
      const prefs = readPrefs(profileMap.get(g.user_id));
      if (!prefs.notifyStreaks) continue;

      // Any completed task today?
      const { count } = await admin
        .from("task_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", g.user_id)
        .eq("reversed", false)
        .gte("completed_at", startOfDay);

      if ((count || 0) > 0) continue;

      const first = await firstFire(g.user_id, "streak_evening", todayStr);
      if (!first) continue;

      const n = await sendToUser(g.user_id, {
        title: `🔥 Keep your ${g.current_streak}-day streak alive`,
        body: "One tiny task today is enough. You've got this.",
        url: "/tasks",
        tag: `streak-${todayStr}`,
      });
      if (n > 0) totals.streak++;
    }
  }

  return totals;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Test push: authenticated user requesting a self-test
    if (body?.test === true) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "auth required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userRes } = await userClient.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: "invalid session" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sent = await sendToUser(user.id, {
        title: "🎉 Push is live",
        body: "You'll get gentle reminders at just the right moments.",
        url: "/settings",
        tag: "questify-welcome",
      });
      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron mode
    const totals = await runCron();
    return new Response(JSON.stringify({ ok: true, ...totals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-push failed", e?.message, e);
    return new Response(JSON.stringify({ error: e?.message || "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
