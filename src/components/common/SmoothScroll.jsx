import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap.js";

/**
 * Keeps ScrollTrigger's measurements true after the page changes size.
 *
 * Pinned sections are measured once, when they are created. Anything that
 * changes the page's height afterwards — a webfont swapping in and re-wrapping
 * the text, a photograph arriving, a section that loads after the first paint —
 * moves everything below it, and from then on pins start and end in the wrong
 * place: a pillar list that releases early, a band that jumps. So the page's
 * height is watched, and once it has stopped changing for a moment everything
 * is measured again. At most one re-measure a second.
 */
function useRemeasureOnResize() {
  useEffect(() => {
    let settleTimer = 0;
    let lastRefresh = 0;
    let lastHeight = document.documentElement.scrollHeight;

    const remeasure = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        const height = document.documentElement.scrollHeight;
        if (Math.abs(height - lastHeight) < 4) return;

        const wait = 1000 - (Date.now() - lastRefresh);
        if (wait > 0) {
          settleTimer = window.setTimeout(remeasure, wait);
          return;
        }

        lastRefresh = Date.now();
        ScrollTrigger.refresh();
        // The refresh itself resizes the pin spacers; remember the height it
        // settled at so that does not count as a change.
        lastHeight = document.documentElement.scrollHeight;
      }, 300);
    };

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
    observer?.observe(document.body);

    // Fonts are the commonest cause: the first measure is taken in the fallback
    // face, and the real one is a different width.
    document.fonts?.ready.then(() => {
      lastRefresh = Date.now();
      ScrollTrigger.refresh();
      lastHeight = document.documentElement.scrollHeight;
    });

    return () => {
      window.clearTimeout(settleTimer);
      observer?.disconnect();
    };
  }, []);
}

/**
 * Site-wide smooth scrolling.
 *
 * Three things have to be wired together or the pinned sections break:
 *
 *  1. `lenis.on("scroll", ScrollTrigger.update)` — ScrollTrigger listens to
 *     native scroll events, which Lenis suppresses. Without this the pins in
 *     GrowthSection / OurPillars / Ours never update and appear frozen.
 *  2. Lenis is driven from `gsap.ticker` instead of its own RAF loop, so GSAP
 *     and Lenis render on the same frame. Running two independent loops is
 *     what produces the subtle judder people describe as "not smooth".
 *  3. `lagSmoothing(0)` — GSAP otherwise skips ahead after a slow frame,
 *     which desyncs it from Lenis's interpolated position.
 *
 * Deliberately NOT enabled for touch: mobile browsers already have tuned
 * momentum scrolling, and overriding it with JS interpolation is what makes
 * a site feel laggy on a phone rather than smoother. Mobile keeps native
 * scrolling; the scroll-driven animations run identically either way.
 *
 * Honours prefers-reduced-motion by not initialising at all.
 */
export default function SmoothScroll() {
  // Runs on every device, including the touch ones that skip the smoothing below.
  useRemeasureOnResize();

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    if (prefersReduced || isTouch) {
      // Still make sure ScrollTrigger has correct measurements.
      ScrollTrigger.refresh();
      return undefined;
    }

    const lenis = new Lenis({
      // ~1.05s to settle: long enough to read as eased, short enough that
      // the page never feels like it is lagging behind the wheel.
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch is handled natively — see the note above.
      syncTouch: false,
      wheelMultiplier: 1,
    });

    // Exposed so utils/scroll.js can route programmatic scrolls through
    // Lenis. Native scrollTo / scrollIntoView do not work while it runs.
    window.__lenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Bootstrap sets `scroll-behavior: smooth` on :root, which fights Lenis
    // on anchor jumps — the browser animates and Lenis animates the same
    // scroll at once. Lenis owns anchor scrolling now.
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    // In-page anchors (#schedule, #rootz-2026 …) routed through Lenis so
    // they ease instead of jumping.
    const onAnchorClick = (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link) return;

      const id = link.getAttribute("href");
      if (!id || id === "#") return;

      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    };

    document.addEventListener("click", onAnchorClick);

    // Late-loading images change page height; without this the pins end up
    // measured against a stale document.
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);
    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 600);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      window.removeEventListener("load", onLoad);
      clearTimeout(refreshTimer);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      delete window.__lenis;
      root.style.scrollBehavior = previousBehavior;
    };
  }, []);

  return null;
}
