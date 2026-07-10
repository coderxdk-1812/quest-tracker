import { motion, useScroll, useTransform } from 'framer-motion';
import { prefersReducedMotion } from '@/lib/utils';

/** Soft, slow, minimal gradient wash. Purely decorative, adapts to the active theme. */
export function AuroraBackground() {
  const { scrollY } = useScroll();
  const yBlob1 = useTransform(scrollY, [0, 1200], [0, -70]);
  const yBlob2 = useTransform(scrollY, [0, 1200], [0, 60]);
  const yBlob3 = useTransform(scrollY, [0, 1200], [0, -40]);

  const reduced = prefersReducedMotion();

  return (
    <div className="aurora-bg" aria-hidden="true">
      <motion.span className="aurora-blob aurora-blob-1" style={reduced ? undefined : { y: yBlob1 }} />
      <motion.span className="aurora-blob aurora-blob-2" style={reduced ? undefined : { y: yBlob2 }} />
      <motion.span className="aurora-blob aurora-blob-3" style={reduced ? undefined : { y: yBlob3 }} />
    </div>
  );
}

export default AuroraBackground;
