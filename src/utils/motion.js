/**
 * Single source of truth for the site's motion.
 *
 * Every section used to hand-roll its own entrance with slightly different
 * values — power3.out / power3.inOut / power2.out / power4.out, durations
 * from 0.7 to 1.1, y offsets from 24 to 60 — so no two sections arrived the
 * same way. These constants are what the shared reveal and the page
 * transition both use, so changing the feel of the whole site is a one-line
 * edit here.
 */

// Ease. `power3.out` reads as a confident settle: fast to start, long tail.
export const EASE = "power3.out";

// Entrance geometry, shared by the page transition and every section reveal.
export const REVEAL = {
  duration: 0.95,
  y: 32,
  blur: 12,
  stagger: 0.09,
  // Fire once the element's top passes this far down the viewport.
  start: "top 88%",
};

// Page transition on route change.
export const PAGE_IN = {
  duration: 0.85,
  y: 18,
  blur: 16,
};

/**
 * The state a reveal animates FROM. Kept as a factory because GSAP mutates
 * the vars object it is handed.
 */
export const revealFrom = () => ({
  opacity: 0,
  y: REVEAL.y,
  filter: `blur(${REVEAL.blur}px)`,
});

/**
 * The state a reveal animates TO. `clearProps` on filter matters: leaving a
 * `blur(0px)` filter behind creates a containing block that breaks `position:
 * fixed` descendants and forces a compositor layer on every revealed element.
 */
export const revealTo = (extra = {}) => ({
  opacity: 1,
  y: 0,
  filter: "blur(0px)",
  duration: REVEAL.duration,
  ease: EASE,
  clearProps: "filter",
  ...extra,
});
