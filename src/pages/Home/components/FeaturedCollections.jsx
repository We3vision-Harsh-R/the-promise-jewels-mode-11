import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const captionRef = useRef(null);
  const progressRef = useRef(null);
  const autoplayRef = useRef(null);
  const previousIndex = useRef(0);

  const goTo = useCallback((next) => {
    setIndex((current) => {
      previousIndex.current = current;
      return (next + COLLECTIONS.length) % COLLECTIONS.length;
    });
  }, []);

  // Slide transition. The incoming frame is revealed with a clip-path wipe
  // while its photo settles from a slight over-scale — the outgoing frame
  // stays put underneath so the wipe has something to wipe over, which is
  // what makes it read as a reveal rather than a crossfade.
  useEffect(() => {
    slideRefs.current.forEach((slide, slideIndex) => {
      if (!slide) return;
      const image = slide.querySelector("img");

      if (slideIndex === index) {
        gsap.set(slide, { zIndex: 2, autoAlpha: 1 });

        gsap.fromTo(
          slide,
          { clipPath: "inset(0% 0% 0% 100%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.15,
            ease: "power3.inOut",
            overwrite: "auto",
          }
        );

        // Settle, then a slow drift that runs for the rest of the hold.
        gsap.fromTo(
          image,
          { scale: 1.16 },
          { scale: 1, duration: 1.4, ease: "power3.out", overwrite: "auto" }
        );
        gsap.to(image, {
          scale: 1.07,
          duration: SLIDE_SECONDS,
          ease: "none",
          delay: 1.4,
        });
      } else if (slideIndex === previousIndex.current) {
        // Held visible underneath the wipe, then dropped once it has passed.
        gsap.set(slide, { zIndex: 1 });
        gsap.to(slide, { autoAlpha: 0, duration: 0.35, delay: 1.05 });
      } else {
        gsap.set(slide, { zIndex: 0, autoAlpha: 0 });
      }
    });

    // Caption re-reveals from behind its own mask on every slide.
    gsap.fromTo(
      captionRef.current?.querySelectorAll(".js-caption-line") ?? [],
      { yPercent: 115 },
      {
        yPercent: 0,
        duration: 0.9,
        stagger: 0.08,
        delay: 0.35,
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

  const active = collections[index];

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
        <div data-reveal
          className="js-stage relative aspect-[16/9] w-full overflow-hidden rounded-[30px] bg-[var(--pj-heading)] shadow-[0_34px_70px_rgba(1,56,59,0.24)] max-[767px]:aspect-[4/5] max-[479px]:rounded-[20px]">
          {collections.map((item, slideIndex) => (
            <div
              key={item.name}
              ref={(node) => {
                slideRefs.current[slideIndex] = node;
              }}
              className="absolute inset-0 overflow-hidden will-change-[clip-path]"
              style={{ opacity: slideIndex === 0 ? 1 : 0 }}
            >
              <img
                src={item.image}
                alt={item.name}
                loading={slideIndex === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover will-change-transform"
              />
            </div>
          ))}

          {/* Scrim keeps the caption legible. Confined to the lower band and
              kept light — a full-frame wash muted the photography. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[52%] bg-gradient-to-t from-[var(--pj-heading)]/80 via-[var(--pj-heading)]/28 to-transparent" />

          {/* Gold hairline inset, drawn inside the frame */}
          <span className="pointer-events-none absolute inset-[16px] z-[4] rounded-[20px] border-[1px] border-white/15 max-[479px]:inset-[10px] max-[479px]:rounded-[14px]" />

          {/* Name lives inside the stage, re-revealing on every slide */}
          <div
            ref={captionRef}
            className="pointer-events-none absolute bottom-0 left-0 z-[5] p-[46px] text-left max-[991px]:p-[30px] max-[479px]:p-[20px]"
          >
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
                style={{ color: active.nameColor, ...active.nameType }}
                className="js-caption-line block font-ticker text-[2.6rem] font-medium leading-[1.15] max-[991px]:text-[2rem] max-[479px]:text-[1.4rem]"
              >
                {active.name}
              </span>
            </span>
          </div>
        </div>

        {/* Control bar — counter, progress, arrows */}
        <div data-reveal className="js-controls mt-[34px] flex items-center gap-[30px] max-[767px]:flex-col max-[767px]:gap-[20px] max-[479px]:mt-[22px]">
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
