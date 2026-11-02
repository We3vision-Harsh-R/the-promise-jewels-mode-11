import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "@/lib/gsap.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import { CHROME } from "@/pages/Home/homeChrome.js";
import { typeStyle } from "@/features/page-content/typeStyle.js";

// Slide photography. The NAMES are editable from Admin > Editor > Home page;
// these stay as the fallback, and the photo for each slide is still bundled
// with the site and keyed by position.
const COLLECTIONS = [
  { name: "Eternal Bloom", image: "/images/Featured-collection/image_70.webp" },
  { name: "Golden Hour", image: "/images/Featured-collection/image_68.webp" },
  { name: "Soft Glam", image: "/images/Featured-collection/image_63.webp" },
  { name: "Midnight Sapphire", image: "/images/Featured-collection/image_71.webp" },
  { name: "Rose Whisper", image: "/images/Featured-collection/image_72.webp" },
];

// Copy bundled with the site — see the note on COLLECTIONS above.
const COLLECTIONS_TEXT = {
  ...Object.fromEntries(COLLECTIONS.map((item, i) => [`img.${i + 1}`, item.image])),
  titleLight: "Featured",
  titleBold: "Collections",
  eyebrow: "Collection",
  ...Object.fromEntries(
    COLLECTIONS.map((item, index) => [`items.${index + 1}.name`, item.name])
  ),

  // Shades, one per string, matching the Editor. Listed here because
  // useSectionContent reads only the keys the fallback declares.
  titleLightColor: "#01383B",
  titleLightColorTo: "#3E9C86",
  titleBoldColor: "#01383B",
  titleBoldColorTo: "#3E9C86",
  eyebrowColor: "#E8CB92",
  ...Object.fromEntries(
    COLLECTIONS.map((_item, index) => [`items.${index + 1}.nameColor`, "#FFFFFF"])
  ),
};

// Seconds a slide holds before advancing. Drives both the autoplay and the
// progress bar — they are the same tween, so they can never drift apart.
const SLIDE_SECONDS = 5;

// Fades the stage to nothing at both sides, so slides that run past the edge dissolve
// instead of being cut by a hard line.
const STAGE_FADE =
  "linear-gradient(to right, transparent 0%, #000 13%, #000 87%, transparent 100%)";

// Where a slide sits, by how far it is from the current one. The current slide
// is a 3:4 portrait in the middle; the previous and next show beside it, smaller
// and blurred, and the ones past those fade out. `x` is a share of a slide's own
// width, so the layout scales with the card at every screen size.
const POSITIONS = [
  { x: 0, scale: 1, alpha: 1, blur: 0, z: 3 },
  { x: 92, scale: 0.84, alpha: 0.9, blur: 3, z: 2 },
  { x: 158, scale: 0.68, alpha: 0.55, blur: 7, z: 1 },
  { x: 215, scale: 0.55, alpha: 0, blur: 10, z: 0 },
];

/** Signed distance of slide `i` from the current one, going the short way round. */
function offsetOf(i, current, count) {
  let d = (i - current) % count;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  return d;
}

function ChevronIcon({ direction = "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={direction === "left" ? "rotate-180" : ""}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

const ARROW_CLASSES =
  "flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1px] " +
  "border-[var(--pj-accent)]/45 bg-white text-[var(--pj-body)] " +
  "[transition:background-color_0.45s_ease,color_0.45s_ease,border-color_0.45s_ease,translate_0.45s_cubic-bezier(0.22,1,0.36,1)] " +
  "hover:-translate-y-[3px] hover:border-[var(--pj-heading)] hover:bg-[var(--pj-heading)] hover:text-white " +
  "max-[479px]:h-[42px] max-[479px]:w-[42px]";

export default function FeaturedCollections() {
  const text = useSectionContent("home", "collections", COLLECTIONS_TEXT);
  // Names AND photographs come from the Editor, paired by position. The
  // bundled array still fixes how many cards there are.
  const collections = useMemo(
    () =>
      COLLECTIONS.map((item, index) => ({
        ...item,
        name: text[`items.${index + 1}.name`],
        nameColor: text[`items.${index + 1}.nameColor`],
        // Typeface, size, weight and spacing for this slide's own name.
        nameType: typeStyle(text, `items.${index + 1}.name`),
        image: text[`img.${index + 1}`] || item.image,
      })),
    [text]
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const sectionRef = useRef(null);
  const slideRefs = useRef([]);
  const progressRef = useRef(null);
  const autoplayRef = useRef(null);
  const previousOffsets = useRef([]);

  const goTo = useCallback((next) => {
    setIndex((next + COLLECTIONS.length) % COLLECTIONS.length);
  }, []);

  // Slide transition. Every slide glides to the place its distance from the
  // current one gives it (see POSITIONS). A slide that wraps from one end to the
  // other is not dragged across the whole row: it is placed on the far side and
  // faded in, so it appears to arrive from out of sight.
  useLayoutEffect(() => {
    const count = COLLECTIONS.length;

    slideRefs.current.forEach((slide, slideIndex) => {
      if (!slide) return;

      const d = offsetOf(slideIndex, index, count);
      const spot = POSITIONS[Math.min(Math.abs(d), POSITIONS.length - 1)];
      const target = {
        xPercent: -50 + Math.sign(d) * spot.x,
        scale: spot.scale,
        autoAlpha: spot.alpha,
        zIndex: spot.z,
        filter: `blur(${spot.blur}px)`,
      };

      const before = previousOffsets.current[slideIndex];
      const wrapped = before !== undefined && Math.abs(d - before) > count / 2;

      if (before === undefined) {
        gsap.set(slide, target);
      } else if (wrapped) {
        gsap.set(slide, { ...target, autoAlpha: 0 });
        gsap.to(slide, { autoAlpha: spot.alpha, duration: 0.7, delay: 0.25, overwrite: "auto" });
      } else {
        gsap.to(slide, { ...target, duration: 1.1, ease: "power3.inOut", overwrite: "auto" });
      }

      previousOffsets.current[slideIndex] = d;
    });

    // The current card's name re-reveals from behind its own mask.
    gsap.fromTo(
      slideRefs.current[index]?.querySelectorAll(".js-caption-line") ?? [],
      { yPercent: 115 },
      {
        yPercent: 0,
        duration: 0.9,
        stagger: 0.08,
        delay: 0.4,
        ease: "power4.out",
        overwrite: "auto",
      }
    );
  }, [index]);

  // Autoplay AND the progress bar are one tween: the bar cannot fall out of
  // sync with the advance, and pausing is a single call.
  useEffect(() => {
    autoplayRef.current?.kill();

    autoplayRef.current = gsap.fromTo(
      progressRef.current,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: SLIDE_SECONDS,
        ease: "none",
        onComplete: () => goTo(index + 1),
      }
    );

    return () => autoplayRef.current?.kill();
  }, [index, goTo]);

  useEffect(() => {
    if (paused) autoplayRef.current?.pause();
    else autoplayRef.current?.resume();
  }, [paused]);

  // Site-wide reveal. Targets the stage wrapper, never the slides: the
  // transition effect owns every slide's clip-path and opacity and would
  // fight a per-slide entrance.
  useReveal(sectionRef);

  return (
    <section
      ref={sectionRef}
      style={{ ...CHROME, "--c-eyebrow": text.eyebrowColor }}
      className="w-full bg-white px-[8%] pt-0 pb-[110px] max-[991px]:px-[40px] max-[991px]:pt-[70px] max-[991px]:pb-[80px] max-[479px]:px-[20px] max-[479px]:pt-[60px] max-[479px]:pb-[60px]"
    >
      {/* The two words carry their own shades. Each is clipped to its own
          gradient rather than sharing one across the line: on a single line of
          text a vertical gradient per word looks identical to a vertical
          gradient over both, so this reproduces the original exactly while
          letting the light word and the bold word be coloured apart. */}
      <h2 data-reveal className="js-collections-head mt-0 mb-[54px] text-center text-[4rem] font-light font-ticker max-[991px]:mb-[34px] max-[991px]:text-[3rem] max-[479px]:mb-[24px] max-[479px]:text-[1.9rem]">
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

      <div
        className="mx-auto w-full max-w-[1240px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* The stage: the current 3:4 portrait in the middle, its neighbours
            beside it, blurred. The sides fade to nothing instead of being cut off,
            so no hard edge shows; the extra bottom room is for the card shadow. */}
        <div
          data-reveal
          style={{
            WebkitMaskImage: STAGE_FADE,
            maskImage: STAGE_FADE,
          }}
          className="js-stage w-full overflow-x-clip pb-[44px] max-[479px]:pb-[30px]"
        >
          <div className="relative h-[560px] w-full max-[991px]:h-[470px] max-[479px]:h-[350px]">
            {collections.map((item, slideIndex) => {
              const isCurrent = slideIndex === index;
              return (
                <div
                  key={item.name}
                  ref={(node) => {
                    slideRefs.current[slideIndex] = node;
                  }}
                  onClick={isCurrent ? undefined : () => goTo(slideIndex)}
                  role={isCurrent ? undefined : "button"}
                  aria-label={isCurrent ? undefined : `Show ${item.name}`}
                  className={`absolute left-1/2 top-0 aspect-[3/4] h-full overflow-hidden rounded-[26px] bg-[var(--pj-heading)] shadow-[0_30px_60px_rgba(1,56,59,0.22)] will-change-transform max-[479px]:rounded-[18px] ${
                    isCurrent ? "" : "cursor-pointer"
                  }`}
                  style={{ opacity: 0 }}
                >
                  <img
                    src={item.image}
                    alt={isCurrent ? item.name : ""}
                    loading={Math.abs(offsetOf(slideIndex, index, collections.length)) <= 1 ? "eager" : "lazy"}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />

                  {/* The frame travels with its photo: scrim, hairline and name
                      are part of the card, so they glide in and out together. */}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[var(--pj-heading)]/80 via-[var(--pj-heading)]/28 to-transparent" />
                  <span className="pointer-events-none absolute inset-[14px] rounded-[18px] border-[1px] border-white/15 max-[479px]:inset-[9px] max-[479px]:rounded-[12px]" />

                  <div className="pointer-events-none absolute bottom-0 left-0 p-[30px] text-left max-[479px]:p-[20px]">
                    <span className="block overflow-hidden pb-[2px]">
                      <span className="js-caption-line flex items-center gap-[12px]">
                        <span className="h-px w-[34px] bg-[var(--pj-accent)] max-[479px]:w-[20px]" />
                        <span
                          style={typeStyle(text, "eyebrow")}
                          className="text-[0.68rem] font-medium tracking-[0.3em] uppercase text-[var(--c-eyebrow)] max-[479px]:text-[0.69rem] max-[479px]:tracking-[0.18em]"
                        >
                          {text.eyebrow}
                        </span>
                      </span>
                    </span>

                    <span className="mt-[12px] block overflow-hidden pb-[0.14em] max-[479px]:mt-[7px]">
                      <span
                        style={{ color: item.nameColor, ...item.nameType }}
                        className="js-caption-line block font-ticker text-[2.1rem] font-medium leading-[1.15] max-[991px]:text-[1.8rem] max-[479px]:text-[1.4rem]"
                      >
                        {item.name}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Control bar — counter, progress, arrows */}
        <div data-reveal className="js-controls flex items-center gap-[30px] max-[767px]:flex-col max-[767px]:gap-[20px]">
          <span className="shrink-0 font-ticker text-[0.95rem] tabular-nums text-[var(--pj-body)]/70 max-[479px]:text-[0.8rem]">
            <strong className="font-semibold text-[var(--pj-heading)]">
              {String(index + 1).padStart(2, "0")}
            </strong>
            <span className="mx-[8px] text-[var(--pj-accent)]">/</span>
            {String(collections.length).padStart(2, "0")}
          </span>

          <div className="h-px flex-1 bg-[#DCEAE7] max-[767px]:w-full">
            <span
              ref={progressRef}
              className="block h-px w-full origin-left bg-[var(--pj-accent)]"
            />
          </div>

          <div className="flex shrink-0 items-center gap-[12px]">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous collection"
              className={ARROW_CLASSES}
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next collection"
              className={ARROW_CLASSES}
            >
              <ChevronIcon />
            </button>
          </div>
        </div>

        {/* Thumbnail rail */}
        <div className="mt-[26px] flex flex-wrap items-center justify-center gap-[14px] max-[479px]:mt-[18px] max-[479px]:gap-[9px]">
          {collections.map((item, thumbIndex) => (
            <button
              key={item.name}
              type="button"
              onClick={() => goTo(thumbIndex)}
              aria-label={`Show ${item.name}`}
              aria-current={thumbIndex === index}
              className={`h-[74px] w-[58px] shrink-0 overflow-hidden rounded-[12px] [transition:opacity_0.45s_ease,box-shadow_0.45s_ease,translate_0.45s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] max-[479px]:h-[52px] max-[479px]:w-[40px] max-[479px]:rounded-[8px] ${
                thumbIndex === index
                  ? "opacity-100 shadow-[0_0_0_2px_#C9A15A]"
                  : "opacity-45 hover:opacity-80"
              }`}
            >
              <img
                src={item.image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
