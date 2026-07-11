// Self-service account deletion.
//
// The caller's user id is derived ONLY from their JWT (via auth.getUser() on
// a client scoped to their own Authorization header) — the request body is
// never trusted for identity, so a user can only ever delete themselves.
//
// Most user-owned tables have a verified ON DELETE CASCADE to auth.users
// (confirmed via a real test-account deletion: profile/tasks/subscriptions
// all cascaded). A few tables' cascade status couldn't be confirmed from the
// migration history alone, so we defensively clear every user-owned table
// here before deleting the auth user. This is a harmless no-op for tables
// that already cascade — the rows are just gone a moment earlier.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// Every user-owned table, keyed by its user-id column. Deleted explicitly
// (service role bypasses RLS) before the auth user itself is deleted.
const USER_ID_TABLES = [
  "notification_events",
  "push_subscriptions",
  "task_completions",
  "daily_quests",
  "topic_confidence",
  "academic_goals",
  "league_members",
  "timetable_entries",
  "tasks",
  "game_state",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Scoped to the caller's own JWT — auth.getUser() resolves to the real,
    // signed-in user (or fails) and can't be spoofed via the request body.
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    for (const table of USER_ID_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) console.error(`delete-account: cleanup failed for ${table}`, error.message);
    }
    // profiles' primary key IS the user id, not a separate user_id column.
    const { error: profileErr } = await admin.from("profiles").delete().eq("id", userId);
    if (profileErr) console.error("delete-account: cleanup failed for profiles", profileErr.message);

    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error("delete-account: deleteUser failed", deleteErr.message);
      return new Response(JSON.stringify({ error: deleteErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("delete-account failed", e?.message, e);
    return new Response(JSON.stringify({ error: e?.message || "Account deletion failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
