import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Confidence } from '@/lib/academics';

export interface AcademicGoal {
  id: string;
  title: string;
  subject: string | null;
  target_date: string | null;
  archived: boolean;
  created_at: string;
}

export interface TopicConfidence {
  id: string;
  subject: string;
  topic: string;
  level: Confidence;
  updated_at: string;
}

/**
 * Loads & mutates academic goals and topic confidence.
 * The new tables aren't in the generated Supabase types, so calls are untyped.
 */
export function useAcademics() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<AcademicGoal[]>([]);
  const [confidence, setConfidence] = useState<TopicConfidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const g = await sb.from('academic_goals').select('*').eq('user_id', user.id)
        .eq('archived', false).order('created_at', { ascending: true });
      if (g.error) throw g.error;
      const c = await sb.from('topic_confidence').select('*').eq('user_id', user.id);
      if (c.error) throw c.error;
      setGoals((g.data || []) as AcademicGoal[]);
      setConfidence((c.data || []) as TopicConfidence[]);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any)?.message || 'Could not load academics');
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const addGoal = async (title: string, subject?: string, targetDate?: string) => {
    if (!user || !title.trim()) return;
    const { data } = await sb.from('academic_goals').insert({
      user_id: user.id, title: title.trim(), subject: subject || null, target_date: targetDate || null,
    }).select().single();
    if (data) setGoals(p => [...p, data as AcademicGoal]);
  };

  const deleteGoal = async (id: string) => {
    await sb.from('academic_goals').delete().eq('id', id);
    setGoals(p => p.filter(x => x.id !== id));
  };

  const setTopic = async (subject: string, topic: string, level: Confidence) => {
    if (!user || !subject.trim() || !topic.trim()) return;
    const { data } = await sb.from('topic_confidence').upsert({
      user_id: user.id, subject: subject.trim(), topic: topic.trim(), level,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,subject,topic' }).select().single();
    if (data) {
      setConfidence(p => [
        ...p.filter(x => !(x.subject === (data as TopicConfidence).subject && x.topic === (data as TopicConfidence).topic)),
        data as TopicConfidence,
      ]);
    }
  };

  const deleteTopic = async (id: string) => {
    await sb.from('topic_confidence').delete().eq('id', id);
    setConfidence(p => p.filter(x => x.id !== id));
  };

  return { goals, confidence, loading, error, addGoal, deleteGoal, setTopic, deleteTopic, refresh: load };
}
