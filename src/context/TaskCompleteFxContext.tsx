import { createContext, useContext, useCallback, useRef, useState, type ReactNode, type MutableRefObject } from 'react';
import { prefersReducedMotion } from '@/lib/utils';

export interface XpFlyEvent {
  id: number;
  originRect: DOMRect;
  xp: number;
}

interface TaskCompleteFxContextValue {
  events: XpFlyEvent[];
  hudTargetRef: MutableRefObject<HTMLElement | null>;
  triggerXpFly: (originEl: HTMLElement, xp: number) => void;
  dismissEvent: (id: number) => void;
}

const TaskCompleteFxContext = createContext<TaskCompleteFxContextValue | null>(null);

let nextId = 0;

/**
 * Task-complete delight moment (spec: "personality" layer 3a). Any completed-task
 * checkbox calls triggerXpFly(originEl, xp); the header HUD's level chip registers
 * itself via hudTargetRef so a single <TaskCompleteFx/> (mounted once in AppLayout)
 * knows where to fly the little "+XP" chip toward. No-ops entirely under
 * prefers-reduced-motion — the XP itself is still granted normally either way,
 * this only skips the decorative animation.
 */
export function TaskCompleteFxProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<XpFlyEvent[]>([]);
  const hudTargetRef = useRef<HTMLElement | null>(null);

  const triggerXpFly = useCallback((originEl: HTMLElement, xp: number) => {
    if (xp <= 0 || prefersReducedMotion()) return;
    const originRect = originEl.getBoundingClientRect();
    setEvents(prev => [...prev, { id: nextId++, originRect, xp }]);
  }, []);

  const dismissEvent = useCallback((id: number) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  return (
    <TaskCompleteFxContext.Provider value={{ events, hudTargetRef, triggerXpFly, dismissEvent }}>
      {children}
    </TaskCompleteFxContext.Provider>
  );
}

export function useTaskCompleteFx() {
  const ctx = useContext(TaskCompleteFxContext);
  if (!ctx) throw new Error('useTaskCompleteFx must be used within TaskCompleteFxProvider');
  return ctx;
}
