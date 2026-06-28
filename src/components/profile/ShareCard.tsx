import { useMemo } from 'react';
import { Share2, Copy, Download, Flame, CheckSquare, Brain, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { getRank } from '@/lib/progression';
import { totalReached } from '@/lib/milestones';
import { buildShareText, buildShareSvg, type ShareStats } from '@/lib/shareCard';
import { RankBadge } from '@/components/progression/RankBadge';
import { Button } from '@/components/ui/button';

/**
 * Public, shareable accomplishment card (spec §6). Designed to be proud of and posted
 * externally — copy a caption, copy a profile link, or download a standalone image.
 */
export function ShareCard() {
  const { state } = useGame();
  const { user } = useAuth();

  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (meta.full_name as string) || (meta.name as string)
      || (user?.email ? user.email.split('@')[0] : 'Student');
  }, [user]);

  const rank = getRank(state.level);
  const stats: ShareStats = {
    displayName,
    level: state.level,
    rankTitle: rank.title,
    rankHsl: rank.hsl,
    streak: state.streak,
    tasksCompleted: state.totalTasksCompleted,
    focusSessions: state.focusSessionsCompleted,
    milestonesReached: totalReached({
      totalTasksCompleted: state.totalTasksCompleted,
      focusSessionsCompleted: state.focusSessionsCompleted,
      streak: state.streak,
      level: state.level,
    }),
  };

  const copyText = async () => {
    try { await navigator.clipboard.writeText(buildShareText(stats)); toast.success('Caption copied!'); }
    catch { toast.error('Could not copy'); }
  };

  const copyLink = async () => {
    const url = user?.id ? `${window.location.origin}/profile/${user.id}` : window.location.origin;
    try { await navigator.clipboard.writeText(url); toast.success('Profile link copied!'); }
    catch { toast.error('Could not copy'); }
  };

  const downloadCard = () => {
    const blob = new Blob([buildShareSvg(stats)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `level-up-quest-${displayName.toLowerCase().replace(/\s+/g, '-')}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success('Card downloaded!');
  };

  const accent = `hsl(${rank.hsl})`;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-5 w-5 text-primary" />
        <h2 className="font-display font-bold text-lg">Show off your progress</h2>
      </div>

      {/* Visual preview (mirrors the downloadable SVG) */}
      <div className="rounded-xl p-5 mb-4" style={{ background: '#0e1116', borderTop: `4px solid ${accent}` }}>
        <p className="text-[11px] tracking-[2px] text-gray-500 font-bold">LEVEL UP QUEST</p>
        <p className="text-2xl font-display font-extrabold text-white mt-1 truncate">{displayName}</p>
        <div className="mt-2"><RankBadge level={state.level} size="md" /></div>
        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          {[
            { icon: Flame, label: 'Streak', value: state.streak },
            { icon: CheckSquare, label: 'Tasks', value: state.totalTasksCompleted },
            { icon: Brain, label: 'Focus', value: state.focusSessionsCompleted },
            { icon: Trophy, label: 'Badges', value: stats.milestonesReached },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: accent }} />
              <p className="text-xl font-bold text-white leading-none">{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={copyText}>
          <Copy className="h-3.5 w-3.5" /> Copy caption
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={copyLink}>
          <Link2 className="h-3.5 w-3.5" /> Copy link
        </Button>
        <Button size="sm" className="gap-1.5 flex-1" onClick={downloadCard}>
          <Download className="h-3.5 w-3.5" /> Download card
        </Button>
      </div>
    </div>
  );
}

export default ShareCard;
