import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Plus, Trash2, CalendarClock, BarChart3, Brain } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { useAcademics } from '@/hooks/useAcademics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  daysUntil, examUrgency, countdownLabel, goalProgress, effortForSubjects,
  nextConfidence, CONFIDENCE_HSL, type Confidence,
} from '@/lib/academics';

const URGENCY_CLASS: Record<string, string> = {
  past: 'text-muted-foreground', today: 'text-destructive', urgent: 'text-destructive',
  soon: 'text-medium', far: 'text-muted-foreground',
};

export default function Academics() {
  const { state } = useGame();
  const { goals, confidence, loading, error, addGoal, deleteGoal, setTopic, deleteTopic } = useAcademics();

  const [gTitle, setGTitle] = useState('');
  const [gSubject, setGSubject] = useState('');
  const [gDate, setGDate] = useState('');
  const [cSubject, setCSubject] = useState('');
  const [cTopic, setCTopic] = useState('');

  // Subjects the user cares about: task subjects + task tags + goal/confidence subjects.
  const subjects = useMemo(() => {
    const s = new Set<string>();
    state.tasks.forEach(t => {
      if (t.subject) s.add(t.subject);
      (t.tags || []).forEach(tag => tag && s.add(tag));
    });
    goals.forEach(g => g.subject && s.add(g.subject));
    confidence.forEach(c => s.add(c.subject));
    return Array.from(s).sort();
  }, [state.tasks, goals, confidence]);

  // Effort counts a task toward a subject by its subject field OR its tags.
  const effort = useMemo(() => effortForSubjects(state.tasks, subjects), [state.tasks, subjects]);

  const confidenceBySubject = useMemo(() => {
    const map = new Map<string, typeof confidence>();
    confidence.forEach(c => { const a = map.get(c.subject) || []; a.push(c); map.set(c.subject, a); });
    return [...map.entries()];
  }, [confidence]);

  const submitGoal = () => {
    if (!gTitle.trim()) return;
    addGoal(gTitle, gSubject.trim() || undefined, gDate || undefined);
    setGTitle(''); setGSubject(''); setGDate('');
  };
  const submitTopic = () => {
    if (!cSubject.trim() || !cTopic.trim()) return;
    setTopic(cSubject.trim(), cTopic.trim(), 'red');
    setCTopic('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Target className="h-7 w-7 text-primary" /> Academics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your goals, exam countdowns, effort and confidence — no grades, works for any curriculum.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* GOALS */}
      <section className="glass-card p-5">
        <h2 className="font-display font-bold text-lg mb-3">Goals</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          <Input placeholder='Goal, e.g. "Do well in Chemistry this term"' value={gTitle}
            onChange={e => setGTitle(e.target.value)} className="flex-1 min-w-[200px]" />
          <Input placeholder="Subject (optional)" value={gSubject} onChange={e => setGSubject(e.target.value)}
            list="acad-subjects" className="w-40" />
          <Input type="date" value={gDate} onChange={e => setGDate(e.target.value)} className="w-40"
            title="Optional exam / target date" />
          <Button onClick={submitGoal} disabled={!gTitle.trim()} className="gap-1"><Plus className="h-4 w-4" />Add</Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No goals yet — add what you're working toward.</p>
        ) : (
          <div className="space-y-3">
            {goals.map(g => {
              const prog = goalProgress(state.tasks, g.subject);
              const days = g.target_date ? daysUntil(g.target_date) : null;
              const urg = days !== null ? examUrgency(days) : null;
              return (
                <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{g.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {g.subject && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{g.subject}</span>}
                        {days !== null && (
                          <span className={`text-[11px] font-medium inline-flex items-center gap-1 ${URGENCY_CLASS[urg!]}`}>
                            <CalendarClock className="h-3 w-3" /> {countdownLabel(days)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteGoal(g.id)} className="p-1 rounded hover:bg-destructive/10 shrink-0" aria-label="Delete goal">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                  {g.subject && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>{prog.completed}/{prog.total} {g.subject} tasks done</span>
                        <span>{prog.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full xp-gradient" style={{ width: `${prog.pct}%` }} />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* EFFORT */}
      <section className="glass-card p-5">
        <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Effort by subject
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          What you've actually put in — tasks count by their subject <em>or</em> a matching tag. ({state.focusSessionsCompleted} focus sessions all-time)
        </p>
        {effort.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Add a subject or tag to your tasks to see effort here.</p>
        ) : (
          <div className="space-y-2">
            {effort.map(e => (
              <div key={e.subject} className="flex items-center gap-3">
                <span className="text-sm w-28 truncate shrink-0">{e.subject}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full xp-gradient" style={{ width: `${e.total ? (e.completed / e.total) * 100 : 0}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{e.completed}/{e.total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CONFIDENCE */}
      <section className="glass-card p-5">
        <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" /> Confidence
        </h2>
        <p className="text-xs text-muted-foreground mb-3">Tap a topic to cycle red → amber → green as you get readier.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Input placeholder="Subject" value={cSubject} onChange={e => setCSubject(e.target.value)} list="acad-subjects" className="w-40" />
          <Input placeholder="Topic, e.g. Trigonometry" value={cTopic} onChange={e => setCTopic(e.target.value)} className="flex-1 min-w-[160px]" />
          <Button onClick={submitTopic} disabled={!cSubject.trim() || !cTopic.trim()} className="gap-1"><Plus className="h-4 w-4" />Add</Button>
        </div>

        {confidenceBySubject.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No topics yet — add a few to track how ready you feel.</p>
        ) : (
          <div className="space-y-3">
            {confidenceBySubject.map(([subject, topics]) => (
              <div key={subject}>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">{subject}</p>
                <div className="flex flex-wrap gap-2">
                  {topics.map(t => {
                    const color = `hsl(${CONFIDENCE_HSL[t.level as Confidence]})`;
                    return (
                      <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full border pl-2.5 pr-1 py-0.5 text-xs"
                        style={{ borderColor: color }}>
                        <button onClick={() => setTopic(t.subject, t.topic, nextConfidence(t.level as Confidence))}
                          className="inline-flex items-center gap-1.5" title="Cycle confidence">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                          {t.topic}
                        </button>
                        <button onClick={() => deleteTopic(t.id)} className="p-0.5 rounded hover:bg-destructive/10" aria-label="Remove topic">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <datalist id="acad-subjects">
        {subjects.map(s => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
