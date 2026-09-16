/**
 * Programmatic scrolling that works whether or not smooth scroll is active.
 *
 * Lenis takes over the scroll position, so `window.scrollTo({behavior:
 * "smooth"})` and `element.scrollIntoView()` stop working once it is running —
 * they either do nothing or fight it. Every place in the app that scrolls the
 * page goes through here instead.
 *
 * Falls back to the native APIs when Lenis is not running (touch devices and
 * reduced-motion visitors), so behaviour is correct everywhere.
 *
 * @param {number|Element} target  Y offset in px, or the element to scroll to.
 * @param {{offset?: number, immediate?: boolean}} options
 *        offset is applied above the target, e.g. to clear the fixed navbar.
 *        immediate jumps instead of easing — required when a caller corrects
 *        the position repeatedly (landing on a #hash while the page is still
 *        settling), because re-issuing an eased scrollTo every frame restarts
 *        the animation each time and it never actually arrives.
 */
export function scrollToTarget(target, options = {}) {
  const { offset = 0, immediate = false } = options;
  const lenis = window.__lenis;

  if (lenis) {
    lenis.scrollTo(target, { offset, immediate });
    return;
  }

  const behavior = immediate ? "auto" : "smooth";

  if (typeof target === "number") {
    window.scrollTo({ top: target + offset, behavior });
    return;
  }

  if (!target) return;

  const top = target.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior });
}

export function scrollToTop() {
  scrollToTarget(0);
}

/**
 * Bring a section with the given id under the fixed navbar, and KEEP it there
 * while the page settles.
 *
 * A single scroll is not enough on these pages: lazy images change the height
 * and SmoothScroll's `ScrollTrigger.refresh()` re-measures the pins shortly
 * after mount, either of which moves the target out from under the landing.
 *
 * Driven by a timer rather than requestAnimationFrame, because rAF is
 * suspended while a tab is backgrounded — a link opened in a background tab
 * would otherwise never scroll once the reader switched to it. For the same
 * reason each correction is `immediate`: the eased path runs on gsap.ticker
 * (also rAF), and re-issuing an eased scroll repeatedly restarts it so it
 * never arrives.
 *
 * @returns {() => void} cancel — call on cleanup.
 */
export function settleToSection(id, options = {}) {
  const { offset = 90, duration = 2600, step = 50, tolerance = 40 } = options;
  const started = Date.now();

  const timer = setInterval(() => {
    const target = document.getElementById(id);

    if (target && Math.abs(target.getBoundingClientRect().top - offset) > tolerance) {
      scrollToTarget(target, { offset: -offset, immediate: true });
    }

    if (Date.now() - started > duration) clearInterval(timer);
  }, step);

  return () => clearInterval(timer);
}
