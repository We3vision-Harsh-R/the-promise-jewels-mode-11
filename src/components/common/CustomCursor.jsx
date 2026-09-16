import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap } from "@/lib/gsap.js";

// Above everything. The navbar sits at z-[99999] and its open menu rides on
// top of that, which is what put the cursor underneath the menu. This is the
// maximum 32-bit z-index, so nothing in the app can out-stack it.
const CURSOR_Z = 2147483647;

// The dot sits exactly on the pointer; the ring trails it. The gap between
// them at rest is what reads as "a dot with a circle around it" — the ring is
// deliberately much larger than the dot so the margin is obvious.
const DOT_SIZE = 6;
const RING_SIZE = 34;

// How quickly each element catches up to the pointer, per frame. The dot is
// near-instant so clicking still feels precise; the ring lags, which is what
// creates the trailing feel.
const DOT_EASE = 0.35;
const RING_EASE = 0.14;

// Elements that should make the ring react. Anything clickable.
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]';

// Cursor colours at rest, and the contrast floor they have to clear against
// whatever is behind them.
const DOT_COLOR = [201, 161, 90]; // #C9A15A gold
const RING_COLOR = [11, 91, 93]; // #0B5B5D teal
// WCAG-style contrast ratio. 2.2 is well below text-legibility thresholds on
// purpose — a cursor only has to be *findable*, and demanding 4.5 would flip
// it to inverted over backgrounds where the brand colours still read fine.
const MIN_CONTRAST = 2.2;
// Sampling every frame would mean a getComputedStyle + layout read at 60fps.
// Every 6th frame is ~10 checks a second, which no one can perceive as lag.
const SAMPLE_EVERY = 6;

function relativeLuminance([r, g, b]) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (light + 0.05) / (dark + 0.05);
}

function parseRgb(value) {
  const match = value?.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return null;
  // A fully transparent colour tells us nothing about what is behind it.
  if (match.length > 3 && Number(match[3]) === 0) return null;
  return [Number(match[0]), Number(match[1]), Number(match[2])];
}

/**
 * What is actually behind the cursor at this point.
 *
 * Returns a solid colour when one can be read, or "image" when the pixel is
 * covered by a photo/gradient/video — cases where the colour is unknowable
 * without reading pixels, and where inverting is always the safe answer.
 */
function backdropAt(x, y) {
  // The cursor elements are pointer-events:none, so this returns the page
  // element underneath rather than the cursor itself.
  let element = document.elementFromPoint(x, y);

  while (element && element !== document.documentElement) {
    if (element.tagName === "IMG" || element.tagName === "VIDEO") return "image";

    const style = getComputedStyle(element);
    if (style.backgroundImage && style.backgroundImage !== "none") return "image";

    const color = parseRgb(style.backgroundColor);
    if (color) return color;

    element = element.parentElement;
  }

  return parseRgb(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255];
}

/**
 * Custom cursor: a small dot with a ring trailing behind it.
 *
 * Positions are written with gsap.set inside a single rAF loop rather than by
 * re-rendering React — a cursor that goes through React state re-renders the
 * tree on every mouse move and is the classic way this effect ends up making
 * a site feel slower, not nicer.
 *
 * Never mounted on touch devices (there is no pointer to follow) or when the
 * visitor prefers reduced motion.
 */
export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (isTouch || prefersReduced) return undefined;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return undefined;

    // Start off-screen so neither element flashes at 0,0 before first move.
    const pointer = { x: -100, y: -100 };
    const dotPos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let visible = false;

    const onMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;

      if (!visible) {
        visible = true;
        // Jump both to the pointer on first sight, then fade in — otherwise
        // they visibly fly in from the corner.
        dotPos.x = ringPos.x = pointer.x;
        dotPos.y = ringPos.y = pointer.y;
        gsap.to([dot, ring], { opacity: 1, duration: 0.3, overwrite: true });
      }
    };

    const onLeave = () => {
      visible = false;
      gsap.to([dot, ring], { opacity: 0, duration: 0.25, overwrite: true });
    };

    // Grow the ring and shrink the dot over anything clickable. Colour is
    // only touched when NOT inverted — while inverted the elements have to
    // stay white for difference blending to read as a clean invert.
    const onOver = (event) => {
      if (!event.target.closest?.(INTERACTIVE)) return;
      gsap.to(ring, {
        scale: 1.6,
        ...(inverted ? {} : { borderColor: "#C9A15A" }),
        duration: 0.35,
        ease: "power3.out",
        overwrite: "auto",
      });
      gsap.to(dot, { scale: 0.5, duration: 0.35, ease: "power3.out", overwrite: "auto" });
    };

    const onOut = (event) => {
      if (!event.target.closest?.(INTERACTIVE)) return;
      gsap.to(ring, {
        scale: 1,
        ...(inverted ? {} : { borderColor: "#0B5B5D" }),
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
      });
      gsap.to(dot, { scale: 1, duration: 0.4, ease: "power3.out", overwrite: "auto" });
    };

    const onDown = () => gsap.to(ring, { scale: 0.85, duration: 0.2, overwrite: "auto" });
    const onUp = () => gsap.to(ring, { scale: 1, duration: 0.3, overwrite: "auto" });

    // Flips the cursor to difference-blend when the brand colours would be
    // lost against what is behind them. Difference blending renders the
    // cursor as the mathematical inverse of the backdrop, so it is guaranteed
    // to be visible on any colour, photo or gradient — including the exact
    // case of gold-on-gold or teal-on-teal.
    let inverted = false;

    const setInverted = (next) => {
      if (next === inverted) return;
      inverted = next;

      // Blend mode is toggled directly rather than tweened; there is no
      // meaningful in-between state to animate through.
      [dot, ring].forEach((element) => {
        element.style.mixBlendMode = next ? "difference" : "normal";
      });

      // Under difference blending the element's own colour is what gets
      // inverted, so both go white — white minus backdrop is a clean invert.
      gsap.to(dot, {
        backgroundColor: next ? "#FFFFFF" : "#C9A15A",
        duration: 0.25,
        overwrite: "auto",
      });
      gsap.to(ring, {
        borderColor: next ? "#FFFFFF" : "#0B5B5D",
        duration: 0.25,
        overwrite: "auto",
      });
    };

    let frame = 0;

    // One loop, driven by GSAP's ticker so it shares a frame with Lenis and
    // every other animation on the page.
    const tick = () => {
      dotPos.x += (pointer.x - dotPos.x) * DOT_EASE;
      dotPos.y += (pointer.y - dotPos.y) * DOT_EASE;
      ringPos.x += (pointer.x - ringPos.x) * RING_EASE;
      ringPos.y += (pointer.y - ringPos.y) * RING_EASE;

      gsap.set(dot, { x: dotPos.x, y: dotPos.y });
      gsap.set(ring, { x: ringPos.x, y: ringPos.y });

      // Throttled backdrop check — see SAMPLE_EVERY.
      frame += 1;
      if (visible && frame % SAMPLE_EVERY === 0) {
        const backdrop = backdropAt(pointer.x, pointer.y);

        if (backdrop === "image") {
          // Unknown pixel colour: invert, which cannot be wrong.
          setInverted(true);
        } else {
          // Invert as soon as EITHER element would be hard to find — they
          // travel together, so splitting them would look like a fault.
          setInverted(
            contrastRatio(DOT_COLOR, backdrop) < MIN_CONTRAST ||
              contrastRatio(RING_COLOR, backdrop) < MIN_CONTRAST
          );
        }
      }
    };

    gsap.ticker.add(tick);
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    document.documentElement.classList.add("has-custom-cursor");

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, []);

  // Portalled to <body> rather than rendered inside .web-theme. A z-index
  // only competes within its own stacking context, so being a descendant of
  // the app tree meant any ancestor that creates a context (the navbar sets
  // transform: translateZ(0)) could trap the cursor beneath it. As the last
  // child of <body> it is always painted last.
  return createPortal(
    <>
      {/* The negative margins centre each element on the pointer, so the
          gsap x/y above can be the raw clientX/clientY. */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 rounded-full border-[1px] border-[#0B5B5D] [opacity:0] max-[1024px]:hidden"
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          marginLeft: -RING_SIZE / 2,
          marginTop: -RING_SIZE / 2,
          zIndex: CURSOR_Z,
          willChange: "transform",
        }}
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 rounded-full bg-[#C9A15A] [opacity:0] max-[1024px]:hidden"
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          marginLeft: -DOT_SIZE / 2,
          marginTop: -DOT_SIZE / 2,
          zIndex: CURSOR_Z,
          willChange: "transform",
        }}
      />
    </>,
    document.body
  );
}
