import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface StandingRow {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  tier: number;
  weekly_xp: number;
  is_me: boolean;
}

/** Pull a readable message out of whatever the RPC threw (Supabase errors aren't Error instances). */
function describe(e: unknown): string {
  if (!e) return 'Could not load league';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = e as any;
  return a.message || a.error_description || a.hint || a.details || String(a);
}

/**
 * Loads the caller's weekly-league standings.
 * Ensures membership (promotion/relegation handled server-side) then fetches the bracket.
 * The new RPCs aren't in the generated Supabase types, so we call them untyped.
 */
export function useLeague() {
  const { user } = useAuth();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [myTier, setMyTier] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = (supabase as any).rpc.bind(supabase);

      const join = await rpc('lq_join_league');
      if (join.error) throw join.error;
      const joinRow = Array.isArray(join.data) ? join.data[0] : join.data;
      if (joinRow?.tier !== undefined) setMyTier(joinRow.tier as number);

      const res = await rpc('lq_standings');
      if (res.error) throw res.error;
      const rows = (res.data ?? []) as StandingRow[];
      setStandings(rows);
      const mine = rows.find(r => r.is_me);
      if (mine) setMyTier(mine.tier);
    } catch (e) {
      console.error('League load failed:', e);
      setError(describe(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { standings, myTier, loading, error, refresh: load };
}
