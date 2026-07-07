import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useGame, type Task } from '@/context/GameContext';
import { useQuickCapture } from '@/context/QuickCaptureContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Minimal add-task input, reachable from any page (spec §4: "quick-capture").
 * Deliberately trimmed down compared to the full Tasks.tsx editor — just a title,
 * saved with sensible defaults (medium priority, no deadline/tags).
 */
export function QuickCapture() {
  const { dispatch } = useGame();
  const { state, close } = useQuickCapture();
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (state.isOpen) setTitle('');
  }, [state.isOpen]);

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const task: Task = {
      id: crypto.randomUUID(),
      title: trimmed,
      completed: false,
      priority: 'medium',
      subject: state.prefillSubject || undefined,
      subjectColor: state.prefillSubject ? 'other' : undefined,
      tags: [],
      createdAt: new Date().toISOString(),
      subtasks: [],
    };
    dispatch({ type: 'ADD_TASK', task });
    toast.success('Task added! ✅');
    close();
  };

  return (
    <Dialog open={state.isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Quick add
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 pt-1">
          <Input
            autoFocus
            placeholder={state.prefillSubject ? `${state.prefillSubject} task…` : 'What do you need to do?'}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
          />
          <Button onClick={save} disabled={!title.trim()}>Add</Button>
        </div>
        {state.prefillSubject && (
          <p className="text-xs text-muted-foreground">
            Tagged with subject: <span className="font-medium text-foreground">{state.prefillSubject}</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QuickCapture;
