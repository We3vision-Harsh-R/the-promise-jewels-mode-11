import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { gsap, ScrollTrigger } from "@/lib/gsap.js";
import { EASE, PAGE_IN } from "@/utils/motion.js";

/**
 * Blur-in transition played on every route change, including the first load.
 *
 * Pages used to appear instantly the moment the router swapped them, which
 * made navigation feel like a hard cut while everything inside the page
 * animated smoothly — the two read as different products.
 *
 * Two details matter:
 *
 *  - `filter` is cleared on completion. A lingering `blur(0px)` establishes a
 *    containing block, which would break the fixed navbar's positioning and
 *    keep a compositor layer alive on the whole page for nothing.
 *  - `ScrollTrigger.refresh()` runs after the transition finishes. Section
 *    triggers on the incoming page are created while this wrapper is still
 *    blurred and offset, so their start positions are measured against a
 *    layout that is about to change.
 */
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  const wrapRef = useRef(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: PAGE_IN.y, filter: `blur(${PAGE_IN.blur}px)` },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: PAGE_IN.duration,
        ease: EASE,
        clearProps: "filter,transform",
        onComplete: () => ScrollTrigger.refresh(),
      }
    );

    return () => tween.kill();
  }, [pathname]);

  return <div ref={wrapRef}>{children}</div>;
}
