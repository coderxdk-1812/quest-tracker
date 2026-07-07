import { createContext, useContext, useState, ReactNode } from 'react';

interface QuickCapturePrefill {
  subject?: string;
}

interface QuickCaptureState {
  isOpen: boolean;
  prefillSubject?: string;
}

interface QuickCaptureContextValue {
  state: QuickCaptureState;
  open: (prefill?: QuickCapturePrefill) => void;
  close: () => void;
}

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

/**
 * Lets any page trigger the minimal quick-add-task dialog (spec §4: "quick-capture"),
 * optionally pre-filled with a subject — used by the header "+" button and the
 * timetable nudge on the dashboard.
 */
export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuickCaptureState>({ isOpen: false });

  const open = (prefill?: QuickCapturePrefill) => {
    setState({ isOpen: true, prefillSubject: prefill?.subject });
  };
  const close = () => setState(s => ({ ...s, isOpen: false }));

  return (
    <QuickCaptureContext.Provider value={{ state, open, close }}>
      {children}
    </QuickCaptureContext.Provider>
  );
}

export function useQuickCapture() {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) throw new Error('useQuickCapture must be used within QuickCaptureProvider');
  return ctx;
}
