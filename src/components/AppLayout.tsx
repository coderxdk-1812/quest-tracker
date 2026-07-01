import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useGame } from '@/context/GameContext';
import { NotificationScheduler } from '@/hooks/useNotificationScheduler';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AuroraBackground } from '@/components/AuroraBackground';
import { useScrollReveal } from '@/hooks/useScrollReveal';

export function AppLayout({ children }: { children: ReactNode }) {
  const { state, dispatch } = useGame();
  const location = useLocation();
  useScrollReveal();

  return (
    <SidebarProvider>
      <NotificationScheduler />
      <AuroraBackground />
      <div className="relative z-10 min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-3">
              <button
                onClick={() => dispatch({ type: 'SET_DARK_MODE', enabled: !state.darkMode })}
                className="text-xl hover:scale-110 transition-transform"
                title={state.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {state.darkMode ? '☀️' : '🌙'}
              </button>
              <ThemeSwitcher />
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="text-lg">🔥</span>
                <span className="text-streak font-bold">{state.streak}</span>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="text-lg">🪙</span>
                <span className="text-coin font-bold">{state.coins}</span>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-sm font-bold">
                <span className="text-level">Lv.{state.level}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
