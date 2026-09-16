import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import { CHROME } from "@/pages/Home/homeChrome.js";
import { typeStyle } from "@/features/page-content/typeStyle.js";

// Titles and descriptions here are the fallback copy: they are editable from
// Admin > Editor > Home page, and whatever is saved there wins at runtime.
// `image` is a PLACEHOLDER per pillar — swap these for the real artwork;
// nothing else needs to change when you do. `icon` is kept on the data
// (unused by this layout) so the existing SVGs stay referenced.
const PILLARS = [
  {
    title: "Innovation",
    icon: "/images/icons/innovation.svg",
    image: "/images/jewellery/image_22.webp",
    description:
      "We continuously develop new jewelry designs, advanced manufacturing techniques, and modern production processes to meet evolving market trends.",
  },
  {
    title: "Customer Satisfaction",
    icon: "/images/icons/Customer satisfaction.svg",
    image: "/images/jewellery/image_56.webp",
    description:
      "Every piece of jewelry is crafted with precision to ensure superior quality, timely delivery, and complete customer satisfaction.",
  },
  {
    title: "Superior Quality",
    icon: "/images/icons/Superior Quality.svg",
    image: "/images/jewellery/image_100.webp",
    description:
      "As a trusted gold jewelry manufacturer, we maintain strict quality standards using premium materials, skilled craftsmanship, and advanced manufacturing technology.",
  },
  {
    title: "Transparency & Ethics",
    icon: "/images/icons/Transparency & Ethics.svg",
    image: "/images/jewellery/image_101.webp",
    description:
      "We believe in honest business practices, ethical sourcing, and long-term partnerships built on trust and integrity.",
  },
  {
    title: "Employee Well-being",
    icon: "/images/icons/Employee well-being.svg",
    image: "/images/jewellery/image_102.webp",
    description:
      "Our people are our greatest strength. We foster a safe, collaborative, and growth-oriented workplace that encourages innovation and excellence.",
  },
];

const COUNT = PILLARS.length;

// Copy bundled with the site — see the note on PILLARS above.
const PILLARS_TEXT = {
  ...Object.fromEntries(PILLARS.map((item, i) => [`img.${i + 1}`, item.image])),
  ...Object.fromEntries(PILLARS.map((item, i) => [`icon.${i + 1}`, item.icon])),
  titleLight: "Our",
  titleBold: "Pillars",
  ...Object.fromEntries(
    PILLARS.flatMap((pillar, index) => [
      [`items.${index + 1}.title`, pillar.title],
      [`items.${index + 1}.caption`, pillar.description],
    ])
  ),

  // Shades, one per string, matching the Editor. useSectionContent reads only
  // the keys this fallback declares, so every colour has to be listed.
  titleLightColor: "#01383B",
  titleLightColorTo: "#3E9C86",
  titleBoldColor: "#01383B",
  titleBoldColorTo: "#3E9C86",
  ...Object.fromEntries(
    PILLARS.flatMap((_pillar, index) => [
      [`items.${index + 1}.titleColor`, "#01383B"],
      [`items.${index + 1}.captionColor`, "#0E4238"],
    ])
  ),
};

// Left ruler. Ticks are evenly distributed down the column; the ones nearest
// the active row stretch out into a "beam" and the rest stay short.
const TICK_COUNT = 46;
const TICK_MIN_W = 9;
const TICK_MAX_W = 46;
// Falloff radius in px — how far from the active row the beam reaches.
const TICK_SIGMA = 78;

// --- Beam smoothing -------------------------------------------------------
// The beam is driven by a continuous scroll value and eased toward it every
// frame, rather than being set to a finished position when the active row
// changes. That difference is the whole reason it used to snap between rows.
//
// How fast the beam's focus point chases the scroll position. Lower = more
// glide, higher = tighter tracking.
const HEAD_EASE = 0.11;
// Each tick eases toward its own target at its own rate. Ticks near the beam
// react quickly, ones further out lag — which is what makes the light appear
// to travel along the ruler line by line instead of the whole column
// changing at once.
const TICK_EASE_NEAR = 0.26;
const TICK_EASE_FAR = 0.08;

export default function OurPillars() {
  const text = useSectionContent("home", "pillars", PILLARS_TEXT);
  // Words, photographs and icons all come from the Editor, paired by
  // position. The bundled array still fixes how many pillars there are.
  const pillars = useMemo(
    () =>
      PILLARS.map((pillar, index) => ({
        ...pillar,
        title: text[`items.${index + 1}.title`],
        titleColor: text[`items.${index + 1}.titleColor`],
        description: text[`items.${index + 1}.caption`],
        captionColor: text[`items.${index + 1}.captionColor`],
        // Each pillar's heading and caption carry their own typography.
        titleType: typeStyle(text, `items.${index + 1}.title`),
        captionType: typeStyle(text, `items.${index + 1}.caption`),
        image: text[`img.${index + 1}`] || pillar.image,
        icon: text[`icon.${index + 1}`] || pillar.icon,
      })),
    [text]
  );

  const [active, setActive] = useState(0);

  const sectionRef = useRef(null);
  const rulerRef = useRef(null);
  const pointerRef = useRef(null);
  const rowRefs = useRef([]);
  const descRefs = useRef([]);
  const imageRefs = useRef([]);
  const tickRefs = useRef([]);

  // Continuous scroll head (0..COUNT-1) written by ScrollTrigger, and the
  // eased value actually rendered. Two separate numbers is what lets the beam
  // glide: the target can jump, the rendered value never does.
  const headTarget = useRef(0);
  const headCurrent = useRef(0);
  // Per-tick rendered width/opacity, so each line can ease at its own rate.
  const tickState = useRef([]);

  // Renders one frame of the beam. Runs on gsap.ticker, so it shares a frame
  // with Lenis and every other animation, and keeps easing even when the user
  // has stopped scrolling — that continuation is what reads as "smooth".
  const renderBeam = useCallback(() => {
    const ruler = rulerRef.current;
    if (!ruler) return;

    const rulerBox = ruler.getBoundingClientRect();
    if (!rulerBox.height) return;

    // Ease the head toward the scroll position.
    headCurrent.current += (headTarget.current - headCurrent.current) * HEAD_EASE;
    const head = headCurrent.current;

    // Interpolate the focus point BETWEEN row centres rather than snapping to
    // one, so a half-scrolled position puts the beam halfway between rows.
    const centreOf = (index) => {
      const row = rowRefs.current[index];
      if (!row) return rulerBox.height / 2;
      const box = row.getBoundingClientRect();
      return box.top + box.height / 2 - rulerBox.top;
    };

    const lower = Math.max(0, Math.min(COUNT - 1, Math.floor(head)));
    const upper = Math.max(0, Math.min(COUNT - 1, Math.ceil(head)));
    const blend = head - lower;
    const focusY = centreOf(lower) + (centreOf(upper) - centreOf(lower)) * blend;

    gsap.set(pointerRef.current, { y: focusY - 4 });

    // Ticks are absolutely positioned at an even percentage down the ruler,
    // so their centre comes from the ruler height alone — no per-tick rect
    // read, which keeps this cheap enough for every frame.
    const step = rulerBox.height / (TICK_COUNT - 1);

    tickRefs.current.forEach((tick, index) => {
      if (!tick) return;

      const distance = Math.abs(index * step - focusY);
      const falloff = Math.exp(-((distance / TICK_SIGMA) ** 2));

      const targetWidth = TICK_MIN_W + (TICK_MAX_W - TICK_MIN_W) * falloff;
      const targetOpacity = 0.18 + 0.72 * falloff;

      const state = tickState.current[index] ?? {
        width: TICK_MIN_W,
        opacity: 0.18,
      };

      // Near the beam a tick snaps to its value; far from it, it drifts.
      const ease = TICK_EASE_FAR + (TICK_EASE_NEAR - TICK_EASE_FAR) * falloff;
      state.width += (targetWidth - state.width) * ease;
      state.opacity += (targetOpacity - state.opacity) * ease;
      tickState.current[index] = state;

      gsap.set(tick, { width: state.width, opacity: state.opacity });
    });
  }, []);

  // Opens the active description, closes the rest, crossfades the image.
  //
  // Deliberately a plain effect rather than useGSAP: useGSAP reverts its
  // context on every dependency change, which would snap each description
  // shut before re-animating. Tweening from whatever value each element
  // currently holds (overwrite:"auto") is what keeps the transition
  // continuous when the active row changes mid-animation.
  const layout = useCallback(() => {
    descRefs.current.forEach((desc, index) => {
      if (!desc) return;
      const isActive = index === active;

      gsap.to(desc, {
        height: isActive ? "auto" : 0,
        opacity: isActive ? 1 : 0,
        duration: 0.6,
        ease: "power3.out",
        overwrite: "auto",
      });
    });

    imageRefs.current.forEach((image, index) => {
      if (!image) return;
      const isActive = index === active;

      gsap.to(image, {
        opacity: isActive ? 1 : 0,
        scale: isActive ? 1 : 1.06,
        duration: 0.9,
        ease: "power3.out",
        overwrite: "auto",
      });
    });

  }, [active]);

  useEffect(() => {
    layout();
  }, [layout]);

  // The beam re-measures every frame, so a resize needs no handler of its
  // own — ScrollTrigger still refreshes its own geometry.

  // Pin the section and let scroll distance drive which pillar is open, so
  // the page cannot move on until all five have been stepped through.
  //
  // The pin holds one viewport per pillar. `setActive` is guarded against
  // re-firing on the same index — onUpdate runs on every scroll frame and an
  // unguarded setState there would re-render (and restart the tweens) 60x/s.
  useGSAP(
    () => {
      let current = -1;

      // The beam renders every frame, independently of scroll events, so it
      // keeps easing toward its target after the wheel stops.
      gsap.ticker.add(renderBeam);

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: () => "+=" + window.innerHeight * COUNT,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Continuous position for the beam — this is what makes it glide
          // rather than step. The rounded index below is only for which
          // description is open.
          headTarget.current = self.progress * (COUNT - 1);

          const index = Math.min(
            COUNT - 1,
            Math.floor(self.progress * COUNT)
          );

          if (index !== current) {
            current = index;
            setActive(index);
          }
        },
      });

      return () => gsap.ticker.remove(renderBeam);
    },
    sectionRef,
    [renderBeam]
  );

  // Site-wide reveal (hooks/useReveal.js) — same entrance as every section.
  useReveal(sectionRef);

  return (
    <section
      ref={sectionRef}
      style={CHROME}
      className="flex min-h-screen w-full items-center bg-white py-[80px] px-[8%] max-[1024px]:py-[60px] max-[430px]:py-[40px] max-[430px]:px-[6%]"
    >
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-[1fr_minmax(0,500px)] items-center gap-[90px] max-[1280px]:gap-[60px] max-[1024px]:grid-cols-1 max-[1024px]:gap-0">
        {/* Left — ruler + heading + pillar rows */}
        <div className="flex gap-[38px] max-[430px]:gap-[22px]">
          <div
            ref={rulerRef}
            aria-hidden="true"
            className="relative w-[52px] shrink-0 max-[430px]:w-[38px]"
          >
            {Array.from({ length: TICK_COUNT }, (_, index) => (
              <span
                key={index}
                ref={(node) => {
                  tickRefs.current[index] = node;
                }}
                className="js-tick absolute left-0 block h-px rounded-full bg-[var(--pj-body)]"
                style={{
                  top: `${(index / (TICK_COUNT - 1)) * 100}%`,
                  width: TICK_MIN_W,
                }}
              />
            ))}

            {/* Pointer — beam line + dot, slides to the active row */}
            <span
              ref={pointerRef}
              className="pointer-events-none absolute left-0 top-0 flex w-full items-center will-change-transform"
            >
              <span className="h-px flex-1 bg-gradient-to-r from-[var(--pj-accent)]/0 via-[var(--pj-accent)]/70 to-[var(--pj-accent)]" />
              <span className="ml-[3px] h-[8px] w-[8px] shrink-0 rounded-full bg-[var(--pj-accent)] shadow-[0_0_10px_rgba(201,161,90,0.7)]" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h2 data-reveal className="js-pillar-head mt-0 mb-[46px] text-left text-[4rem] font-light font-ticker leading-[1.08] max-[1024px]:text-[3.2rem] max-[1024px]:mb-[36px] max-[430px]:text-[1.9rem] max-[430px]:mb-[28px]">
              <span
                className="bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
                style={{
                  ...typeStyle(text, 'titleLight'),
                  backgroundImage: `linear-gradient(180deg, ${text.titleLightColor} 0%, ${text.titleLightColorTo} 100%)`,
                }}
              >
                {text.titleLight}
              </span>{" "}
              <strong
                className="font-semibold font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
                style={{
                  ...typeStyle(text, 'titleBold'),
                  backgroundImage: `linear-gradient(180deg, ${text.titleBoldColor} 0%, ${text.titleBoldColorTo} 100%)`,
                }}
              >
                {text.titleBold}
              </strong>
            </h2>

            <ul className="flex list-none flex-col gap-[14px] p-0 max-[430px]:gap-[10px]">
              {pillars.map((pillar, index) => {
                const isActive = index === active;

                return (
                  <li
                    key={pillar.title}
                    ref={(node) => {
                      rowRefs.current[index] = node;
                    }}
                    data-reveal
                    className="js-pillar-row"
                  >
                    <button
                      type="button"
                      onClick={() => setActive(index)}
                      aria-expanded={isActive}
                      className={`w-full cursor-pointer rounded-[16px] border-[1px] px-[28px] py-[20px] text-left [transition:border-color_0.55s_ease,background-color_0.55s_ease,box-shadow_0.55s_ease] max-[430px]:rounded-[13px] max-[430px]:px-[18px] max-[430px]:py-[15px] ${
                        isActive
                          ? "border-[var(--pj-accent)] bg-[#FCFAF6] shadow-[0_16px_36px_rgba(1,56,59,0.09)]"
                          : "border-transparent bg-transparent hover:border-[#DCEAE7] hover:bg-[#F6FAF9]"
                      }`}
                    >
                      <span className="flex items-baseline gap-[16px] max-[430px]:gap-[12px]">
                        <span
                          className={`shrink-0 text-[0.95rem] font-medium tabular-nums tracking-[0.12em] [transition:color_0.55s_ease] max-[430px]:text-[0.8rem] ${
                            isActive ? "text-[var(--pj-accent)]" : "text-[var(--pj-body)]/35"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          style={{ ...pillar.titleType, ...(isActive ? { color: pillar.titleColor } : null) }}
                          className={`min-w-0 text-[1.35rem] font-medium font-ticker leading-[1.3] [transition:color_0.55s_ease] max-[1024px]:text-[1.2rem] max-[430px]:text-[1.02rem] ${
                            isActive ? "" : "text-[var(--pj-body)]/45"
                          }`}
                        >
                          {pillar.title}
                        </span>
                      </span>

                      {/* Arbitrary-value [opacity:0], not `opacity-0`:
                          Bootstrap ships `.opacity-0 { opacity: 0 !important }`
                          and !important beats the inline style GSAP writes. */}
                      <span
                        ref={(node) => {
                          descRefs.current[index] = node;
                        }}
                        className="block h-0 overflow-hidden [opacity:0]"
                      >
                        <span
                          style={{ color: pillar.captionColor, ...pillar.captionType }}
                          className="block pt-[14px] pl-[40px] text-[1rem] leading-[1.65] [opacity:0.75] max-[430px]:pl-[30px] max-[430px]:pt-[10px] max-[430px]:text-[0.88rem]"
                        >
                          {pillar.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Right — media. Hidden below 1025px: mobile and tablet show the
            heading boxes only, per the reference. */}
        <div data-reveal className="js-pillar-media relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-[#F1F6F5] shadow-[0_30px_60px_rgba(1,56,59,0.14)] max-[1024px]:hidden">
          {pillars.map((pillar, index) => (
            <img
              key={pillar.title}
              ref={(node) => {
                imageRefs.current[index] = node;
              }}
              src={pillar.image}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
              style={{ opacity: index === 0 ? 1 : 0 }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
