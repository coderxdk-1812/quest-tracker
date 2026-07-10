// Client-side Web Push helpers: register SW, subscribe, save to backend.
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

function subToJSON(sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return {
    endpoint: json.endpoint || sub.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
  };
}

export async function enableWebPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isWebPushSupported()) return { ok: false, error: 'Push not supported in this browser.' };
    if (!VAPID_PUBLIC) return { ok: false, error: 'VAPID public key missing.' };

    const perm = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'Notification permission denied.' };

    const reg = await getRegistration();
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer,
      });
    }

    const { endpoint, p256dh, auth } = subToJSON(sub);
    if (!endpoint || !p256dh || !auth) return { ok: false, error: 'Invalid subscription.' };

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 300),
        },
        { onConflict: 'endpoint' }
      );
    if (error) return { ok: false, error: error.message };

    // Immediate local confirmation notification so user knows it works
    try {
      await reg.showNotification('Notifications on ✅', {
        body: 'Zenith will nudge you at the right moments — never spam.',
        icon: '/zenith-logo.svg',
        badge: '/zenith-logo.svg',
        tag: 'questify-test',
      });
    } catch {}

    // Fire an end-to-end push through the edge function as a real test
    try {
      await supabase.functions.invoke('send-push', {
        body: { test: true },
      });
    } catch {}

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to enable push.' };
  }
}

export async function disableWebPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isWebPushSupported()) return { ok: true };
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    let endpoint: string | undefined;
    if (sub) {
      endpoint = sub.endpoint;
      try { await sub.unsubscribe(); } catch {}
    }
    if (endpoint) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
    } else {
      // Fallback: clear all subs for this user on this device
      await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to disable push.' };
  }
}

export async function isWebPushActive(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}
