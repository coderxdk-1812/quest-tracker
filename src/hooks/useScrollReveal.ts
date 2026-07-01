import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Progressive-enhancement scroll reveal: fades + rises .glass-card elements as they
 * enter the viewport, with a light stagger. If JS/observer is unavailable or the user
 * prefers reduced motion, nothing is hidden — content shows normally.
 */
export function useScrollReveal() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const raf = requestAnimationFrame(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('main .glass-card'));
      els.forEach((el, i) => {
        el.classList.add('reveal');
        el.style.transitionDelay = `${Math.min(i, 6) * 45}ms`;
      });
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('reveal-in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
      els.forEach((el) => io.observe(el));
    });

    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);
}
