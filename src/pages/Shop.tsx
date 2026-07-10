import { useState } from 'react';
import { useGame, SHOP_ITEMS, EARNABLE_BADGES, type ShopItem, type ShopTier, type ThemeId, type ActiveBoost } from '@/context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, ShoppingBag, Zap, Palette, Award, Check, ShieldCheck, Lock, Sparkles, Clock, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AvatarsTab } from '@/components/shop/AvatarsTab';
import { useCountUp } from '@/hooks/useCountUp';
import { springReveal } from '@/lib/motion';
import { prefersReducedMotion } from '@/lib/utils';

const CATEGORIES = [
  { id: 'powerup' as const,  label: 'Power-Ups', icon: Zap },
  { id: 'theme' as const,    label: 'Themes',    icon: Palette },
  { id: 'badges' as const,   label: 'Badges',    icon: Award },
  { id: 'avatars' as const,  label: 'Avatars',   icon: Sparkles },
];

type Category = typeof CATEGORIES[number]['id'];

const TIER_META: Record<ShopTier, { label: string; blurb: string }> = {
  consumable: { label: 'Consumables',    blurb: 'Cheap, one-shot helpers.' },
  powerup:    { label: 'Power-Ups',      blurb: 'Meaningful boosts for a study session.' },
  premium:    { label: 'Premium',        blurb: 'Save toward these — big impact.' },
};

const MYSTERY_PRICE = 120;
type MysteryReward =
  | { kind: 'coins'; amount: number; label: string; icon: string }
  | { kind: 'boost'; boostId: string; label: string; icon: string }
  | { kind: 'jackpot'; amount: number; label: string; icon: string };

function rollMysteryBox(): MysteryReward {
  const roll = Math.random();
  // 70% coins, 25% boost, 5% jackpot
  if (roll < 0.70) {
    // Coin payout: 40–200 (median ~110, slightly around cost)
    const amount = Math.floor(Math.random() * 161) + 40;
    return { kind: 'coins', amount, label: `${amount} coins`, icon: '🪙' };
  }
  if (roll < 0.95) {
    const pool = [
      { id: 'xp_2x_mini',   label: '2× XP · next task',       icon: '✨' },
      { id: 'coin_2x_mini', label: '2× Coins · next task',    icon: '🪙' },
      { id: 'focus_boost',  label: '2× Focus XP · next session', icon: '🧠' },
      { id: 'xp_daily',     label: '+50% XP for 24 hours',    icon: '🌟' },
    ];
    const p = pool[Math.floor(Math.random() * pool.length)];
    return { kind: 'boost', boostId: p.id, label: p.label, icon: p.icon };
  }
  return { kind: 'jackpot', amount: 500, label: 'JACKPOT · 500 coins!', icon: '💰' };
}


function formatTimeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function isBoostActive(boost: ActiveBoost): boolean {
  if (boost.remainingTasks !== undefined) return boost.remainingTasks > 0;
  if (boost.expiresAt) return new Date(boost.expiresAt).getTime() > Date.now();
  return false;
}

export default function Shop() {
  const { state, dispatch } = useGame();
  const [activeCategory, setActiveCategory] = useState<Category>('powerup');
  const [mysteryReward, setMysteryReward] = useState<MysteryReward | null>(null);
  const [mysterySpinning, setMysterySpinning] = useState(false);
  const displayCoins = useCountUp(state.coins);
  const reduced = prefersReducedMotion();
  const container = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: reduced ? {} : { staggerChildren: 0.06 } },
  };
  const item = reduced
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: springReveal } };

  const filteredItems = SHOP_ITEMS.filter(i => i.category === activeCategory);

  const isPurchased = (itemId: string) => state.purchasedItems.includes(itemId);
  const isEquippedTheme = (itemId: string) => {
    const themeId = itemId.replace('theme_', '') as ThemeId;
    return state.activeTheme === themeId;
  };
  const isEquippedBadge = (badgeId: string) => state.equippedBadge === badgeId;
  const isBadgeEarned = (badgeId: string) => state.earnedBadges.includes(badgeId);

  const handlePurchase = (shopItem: ShopItem) => {
    if (shopItem.oneTime && isPurchased(shopItem.id)) {
      if (shopItem.category === 'theme') {
        if (isEquippedTheme(shopItem.id)) return;
        const themeId = shopItem.id.replace('theme_', '') as ThemeId;
        dispatch({ type: 'SET_THEME', themeId });
        toast.success(`${shopItem.name} theme equipped! ${shopItem.icon}`);
      }
      return;
    }
    if (state.coins < shopItem.price) {
      toast.error('Not enough coins!', { description: 'Complete more tasks to earn coins.' });
      return;
    }

    // Mystery Box — custom reveal flow
    if (shopItem.id === 'mystery_box') {
      dispatch({ type: 'ADD_COINS', amount: -shopItem.price });
      setMysteryReward(null);
      setMysterySpinning(true);
      setTimeout(() => {
        const reward = rollMysteryBox();
        setMysterySpinning(false);
        setMysteryReward(reward);
        if (reward.kind === 'coins' || reward.kind === 'jackpot') {
          dispatch({ type: 'ADD_COINS', amount: reward.amount });
        } else {
          // Apply as a timed/consumable boost via existing PURCHASE_ITEM plumbing, minus cost
          // We refund the shop item's price so only the box price is spent.
          const boostItem = SHOP_ITEMS.find(i => i.id === reward.boostId);
          if (boostItem) {
            dispatch({ type: 'ADD_COINS', amount: boostItem.price });
            dispatch({ type: 'PURCHASE_ITEM', item: boostItem });
          }
        }
      }, 1600);
      return;
    }

    dispatch({ type: 'PURCHASE_ITEM', item: shopItem });

    if (shopItem.id === 'lucky_spin') {
      toast.success('🎰 Jackpot spun!', { description: 'Check your coin balance for your winnings!' });
    } else if (shopItem.id === 'xp_daily') {
      toast.success(`${shopItem.name} activated! ${shopItem.icon}`, {
        description: '+50% XP on all tasks for the next 24 hours.',
      });
    } else if (shopItem.id === 'focus_boost') {
      toast.success(`${shopItem.name} activated! ${shopItem.icon}`, {
        description: 'Your next focus session grants 2× XP.',
      });
    } else if (shopItem.id === 'streak_shield') {
      toast.success(`${shopItem.name} equipped! ${shopItem.icon}`, {
        description: '+2 streak freeze charges added.',
      });
    } else if (shopItem.category === 'powerup') {
      toast.success(`${shopItem.name} activated! ${shopItem.icon}`, { description: shopItem.description });
    } else {
      toast.success(`${shopItem.name} unlocked! ${shopItem.icon}`);
    }
  };


  const getButtonState = (shopItem: ShopItem) => {
    if (shopItem.oneTime && isPurchased(shopItem.id)) {
      if (shopItem.category === 'theme') {
        return isEquippedTheme(shopItem.id)
          ? { label: 'Active',  variant: 'secondary' as const, disabled: true }
          : { label: 'Equip',   variant: 'outline'   as const, disabled: false };
      }
      return { label: 'Owned', variant: 'secondary' as const, disabled: true };
    }
    return {
      label: `${shopItem.price}`,
      variant: state.coins >= shopItem.price ? ('default' as const) : ('outline' as const),
      disabled: state.coins < shopItem.price,
    };
  };

  // Use isBoostActive so time-based boosts (xp_daily, focus_boost) appear correctly.
  const activeBoosts = state.activeBoosts.filter(isBoostActive);


  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <ShoppingBag className="h-8 w-8 text-primary" /> Shop
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Spend coins on power-ups & themes. Earn badges through milestones!</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg coin-gradient flex items-center justify-center">
            <Coins className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tabular-nums">{displayCoins}</span>
        </div>
      </div>

      {/* Active Boosts Banner */}
      <AnimatePresence>
        {activeBoosts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 border-primary/30 bg-primary/5"
          >
            <h3 className="mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Active Boosts
            </h3>
            <div className="flex gap-3 flex-wrap">
              {activeBoosts.map((boost, i) => {
                const icons: Record<string, string> = {
                  xp_3x: '🔮', xp_2x: '⚡', coin_2x: '💎',
                  xp_daily: '🌟', focus_boost: '🧠',
                };
                const labels: Record<string, string> = {
                  xp_3x: '3× XP', xp_2x: '2× XP', coin_2x: '2× Coins',
                  xp_daily: '+50% XP Today', focus_boost: '2× Focus XP',
                };
                const icon = icons[boost.type] || '✨';
                const label = labels[boost.type] || boost.type;
                const detail = boost.remainingTasks !== undefined
                  ? `${boost.remainingTasks} task${boost.remainingTasks !== 1 ? 's' : ''} left`
                  : boost.expiresAt ? formatTimeLeft(boost.expiresAt) : '';
                return (
                  <div key={`${boost.type}-${i}`} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
                    <span>{icon}</span>
                    <span className="font-medium">{label}</span>
                    {detail && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        {boost.expiresAt ? <Clock className="h-3 w-3" /> : '·'} {detail}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {state.streakFreezes > 0 && (
        <div className="glass-card p-3 flex items-center gap-3 text-sm">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-medium">Streak Freezes: {state.streakFreezes}</span>
          <span className="text-muted-foreground">— Covers {state.streakFreezes} missed day{state.streakFreezes > 1 ? 's' : ''}!</span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            <cat.icon className="h-4 w-4" />
            {cat.label}
          </button>
        ))}
      </div>

      {activeCategory === 'avatars'  && <AvatarsTab />}

      {/* Badges */}
      {activeCategory === 'badges' && (
        <motion.div key="badges" variants={container} initial="hidden" animate="show" className="space-y-4">
          <p className="text-sm text-muted-foreground">Badges are earned by hitting milestones — not bought. Keep grinding! 💪</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {EARNABLE_BADGES.map(badge => {
              const earned = isBadgeEarned(badge.id);
              const equipped = isEquippedBadge(badge.id);
              return (
                <motion.div
                  key={badge.id}
                  variants={item}
                  whileHover={{ scale: 1.02 }}
                  className={`glass-card p-5 flex flex-col gap-3 relative overflow-hidden transition-shadow ${earned ? 'ring-1 ring-primary/20' : 'opacity-60'}`}
                >
                  {earned && <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>}
                  {!earned && <div className="absolute top-3 right-3"><Lock className="h-4 w-4 text-muted-foreground" /></div>}
                  <div className="flex items-start gap-3">
                    <span className={`text-3xl ${!earned ? 'grayscale' : ''}`}>{badge.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      {earned ? '✅ Earned' : `🎯 ${badge.requirement}`}
                    </span>
                    {earned && (
                      <Button
                        size="sm"
                        variant={equipped ? 'secondary' : 'outline'}
                        onClick={() => {
                          const newBadge = equipped ? null : badge.id;
                          dispatch({ type: 'EQUIP_BADGE', badgeId: newBadge });
                          toast.success(newBadge ? `${badge.name} equipped!` : 'Badge unequipped');
                        }}
                      >
                        {equipped ? 'Unequip' : 'Equip'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {(activeCategory === 'powerup' || activeCategory === 'theme') && (() => {
        const renderCard = (shopItem: ShopItem) => {
          const btnState = getButtonState(shopItem);
          const owned = shopItem.oneTime && isPurchased(shopItem.id);
          const themeActive = activeCategory === 'theme' && owned && isEquippedTheme(shopItem.id);
          const isMystery = shopItem.id === 'mystery_box';
          return (
            <motion.div key={shopItem.id} variants={item} whileHover={{ scale: 1.02 }}
              className={`glass-card p-5 flex flex-col gap-3 relative overflow-hidden transition-shadow ${themeActive ? 'ring-2 ring-primary' : owned ? 'ring-1 ring-primary/20' : isMystery ? 'ring-1 ring-primary/40 bg-primary/5' : 'hover:shadow-lg'}`}>
              {owned && <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>}
              <div className="flex items-start gap-3">
                <span className="text-3xl">{shopItem.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="">{shopItem.name}</h3>
                  <p className="text-sm text-muted-foreground">{shopItem.description}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between">
                {!owned && <div className="flex items-center gap-1 text-coin font-bold text-sm"><Coins className="h-4 w-4" />{shopItem.price}</div>}
                {owned && <span className="text-xs text-primary font-medium">{themeActive ? 'Equipped' : 'Owned'}</span>}
                <Button size="sm" variant={btnState.variant} disabled={btnState.disabled} onClick={() => handlePurchase(shopItem)} className="ml-auto">
                  {!owned && <Coins className="h-3 w-3 mr-1" />}
                  {btnState.label}
                </Button>
              </div>
            </motion.div>
          );
        };

        if (activeCategory === 'theme') {
          const isDefaultActive = state.activeTheme === 'default';
          return (
            <motion.div key="theme" variants={container} initial="hidden" animate="show" className="space-y-4">
              <p className="text-sm text-muted-foreground">Aspirational cosmetics — save up and treat yourself.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <motion.div
                  key="theme_default" variants={item} whileHover={{ scale: 1.02 }}
                  className={`glass-card p-5 flex flex-col gap-3 relative overflow-hidden transition-shadow ${isDefaultActive ? 'ring-2 ring-primary' : 'ring-1 ring-primary/20'}`}
                >
                  {isDefaultActive && <div className="absolute top-3 right-3"><Check className="h-5 w-5 text-primary" /></div>}
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">✨</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="">Default</h3>
                      <p className="text-sm text-muted-foreground">The classic Questify look — light & dark modes included</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs text-primary font-medium">Free</span>
                    <Button size="sm" variant={isDefaultActive ? 'secondary' : 'outline'} disabled={isDefaultActive}
                      onClick={() => { dispatch({ type: 'SET_THEME', themeId: 'default' }); toast.success('Default theme activated! ✨'); }}
                      className="ml-auto">
                      {isDefaultActive ? 'Active' : 'Equip'}
                    </Button>
                  </div>
                </motion.div>
                {filteredItems.map(renderCard)}
              </div>
            </motion.div>
          );
        }

        // Power-Ups: grouped by price ladder tier
        const tierOrder: ShopTier[] = ['consumable', 'powerup', 'premium'];
        return (
          <motion.div key="powerup" variants={container} initial="hidden" animate="show" className="space-y-6">
            {tierOrder.map(tier => {
              const items = filteredItems.filter(i => (i.tier ?? 'powerup') === tier);
              if (items.length === 0) return null;
              const meta = TIER_META[tier];
              const minPrice = Math.min(...items.map(i => i.price));
              const maxPrice = Math.max(...items.map(i => i.price));
              return (
                <div key={tier} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <h2 className="">{meta.label}</h2>
                      <p className="text-xs text-muted-foreground">{meta.blurb}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium tabular-nums">
                      {minPrice === maxPrice ? `${minPrice}🪙` : `${minPrice}–${maxPrice}🪙`}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {items.map(renderCard)}
                  </div>
                </div>
              );
            })}
          </motion.div>
        );
      })()}

      {/* Mystery Box reveal dialog */}
      <Dialog open={mysterySpinning || mysteryReward !== null} onOpenChange={(open) => { if (!open) { setMysteryReward(null); setMysterySpinning(false); } }}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Mystery Box
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center gap-4">
            <AnimatePresence mode="wait">
              {mysterySpinning ? (
                <motion.div key="spin" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.4, ease: 'linear' }} className="text-6xl">
                  🎁
                </motion.div>
              ) : mysteryReward ? (
                <motion.div key="reveal" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="text-6xl">
                  {mysteryReward.icon}
                </motion.div>
              ) : null}
            </AnimatePresence>
            {!mysterySpinning && mysteryReward && (
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="font-bold text-xl">
                {mysteryReward.kind === 'jackpot' ? '🎉 JACKPOT!' : 'You got:'}
                <span className="block mt-1 text-base font-medium">{mysteryReward.label}</span>
              </motion.p>
            )}
            {mysterySpinning && <p className="text-muted-foreground">Opening your box…</p>}
          </div>
          {!mysterySpinning && mysteryReward && (
            <Button onClick={() => { setMysteryReward(null); }}>
              Nice! 🎉
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

