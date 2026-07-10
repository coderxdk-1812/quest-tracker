import { useGame } from '@/context/GameContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Coins, TrendingUp, Brain, Trophy } from 'lucide-react';
import { DailyQuests } from '@/components/dashboard/DailyQuests';
import { TodaySchedule } from '@/components/dashboard/TodaySchedule';
import { StudyHeatmap } from '@/components/dashboard/StudyHeatmap';

import { ProgressionHud } from '@/components/progression/ProgressionHud';
import { NextMoveCard } from '@/components/dashboard/NextMoveCard';
import { StreakStatusBanner } from '@/components/dashboard/StreakStatusBanner';
import { DailyCue } from '@/components/dashboard/DailyCue';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { MilestonesCard } from '@/components/dashboard/MilestonesCard';
import { MasteryCard } from '@/components/dashboard/MasteryCard';
import { PerfectWeekCard } from '@/components/dashboard/PerfectWeekCard';
import { useCountUp } from '@/hooks/useCountUp';
import { Reveal } from '@/components/motion/Reveal';
import { Magnetic } from '@/components/motion/Magnetic';
import { TiltCard } from '@/components/motion/TiltCard';
import { springReveal } from '@/lib/motion';
import { prefersReducedMotion } from '@/lib/utils';

export default function Dashboard() {
  const { state } = useGame();
  const todayTasks = state.tasks;
  const completedToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const unlockedAchievements = state.achievements.filter(a => a.unlockedAt);

  const reduced = prefersReducedMotion();
  const container = { hidden: { opacity: 1 }, show: { opacity: 1, transition: reduced ? {} : { staggerChildren: 0.09, delayChildren: 0.02 } } };
  const item = reduced
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: springReveal } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-8">
      {/* Hero zone — the one clear focal point, an oversized progression card beside a compact next-action */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <TiltCard className="lg:col-span-2">
          <ProgressionHud />
        </TiltCard>
        <div className="lg:col-span-1">
          <NextMoveCard />
        </div>
      </motion.div>

      <motion.div variants={item}><OnboardingChecklist /></motion.div>
      <motion.div variants={item}><StreakStatusBanner /></motion.div>
      <motion.div variants={item}><DailyCue /></motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Magnetic strength={5}><StatCard icon={<Coins className="h-5 w-5" />} label="Coins" value={state.coins} /></Magnetic>
        <Magnetic strength={5}><StatCard icon={<TrendingUp className="h-5 w-5" />} label="Tasks Done" value={state.totalTasksCompleted} /></Magnetic>
        <Magnetic strength={5}><StatCard icon={<Brain className="h-5 w-5" />} label="Focus Sessions" value={state.focusSessionsCompleted} /></Magnetic>
        <Magnetic strength={5}><StatCard icon={<Trophy className="h-5 w-5" />} label="Achievements" value={unlockedAchievements.length} /></Magnetic>
      </motion.div>

      {/* Below the fold from here — sections pace themselves in as you scroll, rather than dumping all at once */}
      <div className="grid lg:grid-cols-5 gap-5">
        <Reveal direction="left" className="lg:col-span-3"><TodaySchedule /></Reveal>
        <Reveal direction="right" delay={0.06} className="lg:col-span-2"><DailyQuests /></Reveal>
      </div>

      <Reveal direction="scale"><MasteryCard /></Reveal>

      <div className="grid lg:grid-cols-5 gap-5">
        <Reveal direction="left" className="lg:col-span-3"><MilestonesCard /></Reveal>
        <Reveal direction="right" delay={0.06} className="lg:col-span-2"><PerfectWeekCard /></Reveal>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Reveal direction="up">
          <div className="glass-card p-6">
            <h2 className="mb-4 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" /> Today's Tasks
            </h2>
            {totalToday === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing queued up yet — future you will thank present you for adding one.{' '}
                <Link to="/tasks" className="text-primary hover:underline font-medium">Add a task →</Link>
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl font-bold text-primary">{completionRate}%</span>
                  <span className="text-sm text-muted-foreground">{completedToday}/{totalToday} done</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full xp-gradient rounded-full" initial={{ width: 0 }} animate={{ width: `${completionRate}%` }} transition={{ duration: 0.8 }} />
                </div>
                <div className="mt-4 space-y-2">
                  {todayTasks.filter(t => !t.completed).slice(0, 3).map(task => (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${task.priority === 'easy' ? 'bg-easy' : task.priority === 'medium' ? 'bg-medium' : 'bg-hard'}`} />
                      <span>{task.title}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Reveal>
        <Reveal direction="up" delay={0.06}>
          <div className="glass-card p-6">
            <h2 className="mb-4">🏆 Recent Achievements</h2>
            {unlockedAchievements.length === 0 ? (
              <p className="text-muted-foreground text-sm">Complete tasks to unlock achievements!</p>
            ) : (
              <div className="space-y-3">
                {unlockedAchievements.slice(-4).reverse().map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <span className="text-2xl">{a.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      <Reveal direction="up"><StudyHeatmap /></Reveal>
    </motion.div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number; }) {
  const display = useCountUp(value);
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold leading-tight tabular-nums">{display}</p>
      </div>
    </div>
  );
}
