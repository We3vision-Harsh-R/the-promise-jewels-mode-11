import { useLayoutEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap.js";
import { REVEAL, revealFrom, revealTo } from "@/utils/motion.js";

/**
 * The site's one scroll-reveal. Elements marked `data-reveal` inside `scope`
 * fade, rise and un-blur in DOM order as the section comes into view.
 *
 * Why this exists rather than a `gsap.from(...)` per section:
 *
 *  1. `gsap.from` with a ScrollTrigger sets the element to opacity 0 and then
 *     depends on the trigger firing. If ScrollTrigger measured the page before
 *     the images and fonts settled, the start point is wrong, the trigger
 *     never fires, and the element stays invisible FOREVER. That is exactly
 *     what was happening on /our-brand, where nine elements sat at opacity 0.
 *     Using `fromTo` makes the end state explicit so it can always be forced.
 *
 *  2. `once: true` — these are entrances, not scrubbed effects. Replaying them
 *     on scroll-up is what made sections flicker when scrolling back.
 *
 *  3. The safety net below: anything still hidden after the page has settled
 *     is completed outright. A missed animation is a bug; invisible content is
 *     a broken page.
 *
 * @param {React.RefObject<HTMLElement>} scope  section root
 * @param {{selector?: string, stagger?: number, deps?: unknown[]}} options
 */
export default function useReveal(scope, options = {}) {
  const { selector = "[data-reveal]", stagger = REVEAL.stagger } = options;

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return undefined;

    const targets = gsap.utils.toArray(selector, root);
    if (!targets.length) return undefined;

    const context = gsap.context(() => {
      const tween = gsap.fromTo(
        targets,
        revealFrom(),
        revealTo({
          stagger,
          scrollTrigger: {
            trigger: root,
            start: REVEAL.start,
            once: true,
            invalidateOnRefresh: true,
          },
        })
      );

      // Safety net. If the trigger has not run by the time the page has
      // settled and the section is on screen, complete it. Covers a stale
      // measurement, a section that starts above the fold, and a route change
      // that mounts a section already scrolled past.
      const rescue = setTimeout(() => {
        const box = root.getBoundingClientRect();
        const onScreen = box.top < window.innerHeight && box.bottom > 0;
        if (onScreen && tween.progress() === 0) tween.progress(1);
      }, 1200);

      return () => clearTimeout(rescue);
    }, root);

    // One refresh after mount so triggers created during a route change
    // measure the finished layout rather than the half-built one.
    const refresh = setTimeout(() => ScrollTrigger.refresh(), 300);

    return () => {
      clearTimeout(refresh);
      context.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, options.deps ?? []);
}
