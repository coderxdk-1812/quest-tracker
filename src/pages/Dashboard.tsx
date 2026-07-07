import { useGame } from '@/context/GameContext';
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

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { state } = useGame();
  const todayTasks = state.tasks;
  const completedToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const unlockedAchievements = state.achievements.filter(a => a.unlockedAt);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-6">
      <motion.div variants={item}>
        <h1 className="text-3xl font-display font-bold text-foreground">Welcome back! 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Let's crush some tasks today.</p>
      </motion.div>

      <motion.div variants={item}><OnboardingChecklist /></motion.div>
      <motion.div variants={item}><StreakStatusBanner /></motion.div>
      <motion.div variants={item}><DailyCue /></motion.div>
      <motion.div variants={item}><ProgressionHud /></motion.div>
      <motion.div variants={item}><NextMoveCard /></motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Coins className="h-5 w-5" />} label="Coins" value={state.coins} gradient="coin-gradient" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Tasks Done" value={state.totalTasksCompleted} gradient="xp-gradient" />
        <StatCard icon={<Brain className="h-5 w-5" />} label="Focus Sessions" value={state.focusSessionsCompleted} gradient="level-gradient" />
        <StatCard icon={<Trophy className="h-5 w-5" />} label="Achievements" value={unlockedAchievements.length} gradient="streak-gradient" />
      </motion.div>

      <motion.div variants={item} className="grid md:grid-cols-2 gap-4">
        <TodaySchedule />
        <DailyQuests />
      </motion.div>

      <motion.div variants={item}><MasteryCard /></motion.div>
      <motion.div variants={item} className="grid md:grid-cols-2 gap-4">
        <MilestonesCard />
        <PerfectWeekCard />
      </motion.div>

      <motion.div variants={item} className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" /> Today's Tasks
          </h2>
          {totalToday === 0 ? (
            <p className="text-muted-foreground text-sm">No tasks yet. Add some in the Tasks tab!</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-4xl font-display font-bold text-primary">{completionRate}%</span>
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
        <div className="glass-card p-6">
          <h2 className="font-display font-bold text-lg mb-4">🏆 Recent Achievements</h2>
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
      </motion.div>

      <motion.div variants={item}><StudyHeatmap /></motion.div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, gradient }: { icon: React.ReactNode; label: string; value: number; gradient: string; }) {
  const display = useCountUp(value);
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center text-primary-foreground shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display font-bold text-lg leading-tight tabular-nums">{display}</p>
      </div>
    </div>
  );
}
