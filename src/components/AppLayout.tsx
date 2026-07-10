import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useGame } from '@/context/GameContext';
import { useQuickCapture } from '@/context/QuickCaptureContext';
import { useTaskCompleteFx } from '@/context/TaskCompleteFxContext';
import { NotificationScheduler } from '@/hooks/useNotificationScheduler';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AuroraBackground } from '@/components/AuroraBackground';
import { QuickCapture } from '@/components/QuickCapture';
import { TaskCompleteFx } from '@/components/TaskCompleteFx';
import { LevelUpCelebration } from '@/components/progression/LevelUpCelebration';
import { StreakFlame } from '@/components/StreakFlame';
import { StreakSavedMoment } from '@/components/StreakSavedMoment';
import { Magnetic } from '@/components/motion/Magnetic';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useCountUp } from '@/hooks/useCountUp';
import { springReveal } from '@/lib/motion';
import { prefersReducedMotion } from '@/lib/utils';

export function AppLayout({ children }: { children: ReactNode }) {
  const { state, dispatch } = useGame();
  const { open: openQuickCapture } = useQuickCapture();
  const { hudTargetRef } = useTaskCompleteFx();
  const location = useLocation();
  useScrollReveal();
  const streak = useCountUp(state.streak);
  const coins = useCountUp(state.coins);
  const level = useCountUp(state.level);

  return (
    <SidebarProvider>
      <NotificationScheduler />
      <AuroraBackground />
      <QuickCapture />
      <TaskCompleteFx />
      <LevelUpCelebration />
      <StreakSavedMoment />
      <div className="relative z-10 min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-3">
              <Magnetic strength={8}>
                <button
                  onClick={() => openQuickCapture()}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Quick add task"
                  aria-label="Quick add task"
                >
                  <Plus className="h-5 w-5 text-primary" />
                </button>
              </Magnetic>
              <button
                onClick={() => dispatch({ type: 'SET_DARK_MODE', enabled: !state.darkMode })}
                className="text-xl hover:scale-110 transition-transform"
                title={state.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {state.darkMode ? '☀️' : '🌙'}
              </button>
              <ThemeSwitcher />
              <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                <StreakFlame />
                <span className="font-bold tabular-nums">{streak}</span>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                <span className="text-lg">🪙</span>
                <span className="font-bold tabular-nums">{coins}</span>
              </div>
              <div
                ref={(el) => { hudTargetRef.current = el; }}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-sm font-bold text-foreground"
              >
                <span className="tabular-nums">Lv.{level}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={prefersReducedMotion() ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
                animate={prefersReducedMotion() ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion() ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
                transition={prefersReducedMotion() ? { duration: 0.15 } : springReveal}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
