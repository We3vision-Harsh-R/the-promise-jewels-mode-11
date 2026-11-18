import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * How much extra smoothing a scroll-linked (scrubbed) animation adds.
 *
 * Where Lenis is running (a mouse or trackpad, motion allowed) the scroll
 * position is already eased, so scrubbing smooths it a SECOND time: the
 * animation trails the scroll by two lags stacked, which reads as floaty and
 * different from the sections that do not scrub. There the animation follows the
 * eased position directly (`true`). On touch, where scrolling is native and has
 * no easing of its own, a short scrub gives the same softness.
 */
export const SCRUB =
  typeof window !== "undefined" &&
  !window.matchMedia("(pointer: coarse)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? true
    : 0.6;

export { gsap, ScrollTrigger };
