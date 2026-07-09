import { useEffect, useState } from 'react';
import { QuestMark } from '@/components/QuestMark';

const MESSAGES = [
  'Sharpening pencils…',
  'Dusting off your streak…',
  'Waking up the quest log…',
  'Counting yesterday\'s XP…',
  'Rolling for initiative…',
];

/** Loading state with a touch of personality (spec: personality redesign). */
export function LoadingScreen() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI(prev => (prev + 1) % MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <QuestMark size={64} className="mx-auto mb-4" />
        <p className="text-muted-foreground">{MESSAGES[i]}</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
