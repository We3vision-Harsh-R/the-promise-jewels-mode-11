import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import usePublicSettings from "@/features/settings/hooks/usePublicSettings.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import { CHROME } from "@/pages/Home/homeChrome.js";

// Custom glyphs drawn for this section rather than a stock icon set — the
// installed lucide-react (1.x) dropped its brand icons anyway. All three are
// built on the same rules so they read as one family: a 24px box, 1.3
// stroke, round caps/joins, and the mark inset to ~7px from centre so each
// sits optically level inside its diamond frame.
const GLYPH_PROPS = {
  width: "17",
  height: "17",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.3",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function LinkedInIcon() {
  return (
    <svg {...GLYPH_PROPS} aria-hidden="true">
      <line x1="6.4" y1="10.2" x2="6.4" y2="17.6" />
      <circle cx="6.4" cy="6.9" r="1.05" fill="currentColor" stroke="none" />
      <path d="M10.6 17.6v-7.4" />
      <path d="M10.6 13.1c0-1.9 1.2-3.1 2.9-3.1s2.9 1.2 2.9 3.4v4.2" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg {...GLYPH_PROPS} aria-hidden="true">
      <path d="M14.6 6.6h-1.5c-1.5 0-2.4 1-2.4 2.5v2.1" />
      <line x1="10.7" y1="11.2" x2="10.7" y2="17.8" />
      <line x1="8.2" y1="11.2" x2="13.4" y2="11.2" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg {...GLYPH_PROPS} aria-hidden="true">
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="3.6" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="15.5" cy="8.6" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Icon + which key to read off the settings payload. The URLs themselves are
// NOT hardcoded here any more: this section used to keep its own copy, so it
// ignored whatever was saved in /admin/settings while the footer honoured it.
const SOCIAL_LINKS = [
  { Icon: LinkedInIcon, key: "linkedin", label: "LinkedIn" },
  { Icon: FacebookIcon, key: "facebook", label: "Facebook" },
  { Icon: InstagramIcon, key: "instagram", label: "Instagram" },
];

// Copy bundled with the site. Admin > Editor > Home page overrides these at
// runtime; anything not overridden — or a failed request — keeps exactly what
// is written here.
//
// The headline is three fields rather than one so the emphasised company name
// can be styled (and animated) as its own words, which is how the design
// renders it.
const WELCOME_TEXT = {
  eyebrow: "Est. Excellence",
  headlineStart: "Welcome to",
  headlineAccent: "Promise Group of Companies,",
  headlineEnd:
    "a leading name in the jewelry industry, where craftsmanship meets innovation.",
  bodyStart:
    "With a legacy rooted in excellence and a vision aimed at national prominence,",
  bodyAccent:
    "Promise Group encompasses three distinctive sub-brands: CLARICUTS AND LUXIFINE.",
  ctaLabel: "About Us",

  // One shade per string, matching what the Editor declares beside each field.
  // useSectionContent reads only the keys this object lists, so a colour left
  // out here never reaches the component.
  eyebrowColor: "#C9A15A",
  headlineColor: "#01383B",
  headlineAccentColor: "#C9A15A",
  headlineAccentColorTo: "#A87F3D",
  bodyStartColor: "#0E4238",
  bodyAccentColor: "#01383B",
  ctaLabelColor: "#FFFFFF",
  ctaBgColor: "#01383B",
  ctaBgColorTo: "#0E4238",
};

// One entry per word. Each is rendered inside its own clipping mask so the
// reveal can slide words up from behind their own baseline.
function splitHeadline(text) {
  // The headline is three separately editable pieces, so each carries its
  // own typeface, size, weight and spacing down to every word split out of
  // it — otherwise setting a size on the highlighted words would silently
  // do nothing, because by render time they are individual spans.
  return [
    { text: text.headlineStart, accent: false, type: typeStyle(text, "headlineStart") },
    { text: text.headlineAccent, accent: true, type: typeStyle(text, "headlineAccent") },
    { text: text.headlineEnd, accent: false, type: typeStyle(text, "headlineEnd") },
  ].flatMap((segment, segmentIndex) =>
    segment.text
      .split(" ")
      .filter(Boolean)
      .map((word, wordIndex) => ({
        id: `${segmentIndex}-${wordIndex}`,
        word,
        accent: segment.accent,
        type: segment.type,
      }))
  );
}

// Diamond frame shared by the three social links. The anchor itself is
// rotated 45deg to form the lozenge (echoing the divider's centre mark) and
// the glyph inside is counter-rotated so it stays upright.
const SOCIAL_FRAME =
  "js-action group flex h-[46px] w-[46px] rotate-45 items-center justify-center rounded-[12px] " +
  "border-[1px] border-[var(--pj-accent)]/50 bg-white text-[var(--pj-body)] no-underline " +
  "shadow-[0_6px_16px_rgba(1,56,59,0.07)] " +
  "[transition:background-color_0.45s_ease,color_0.45s_ease,border-color_0.45s_ease,box-shadow_0.45s_ease,translate_0.45s_cubic-bezier(0.22,1,0.36,1)] " +
  "hover:-translate-y-[4px] hover:border-[var(--pj-accent)] hover:bg-[var(--pj-heading)] hover:text-white " +
  "hover:shadow-[0_14px_28px_rgba(1,56,59,0.22)] " +
  "max-[479px]:h-[40px] max-[479px]:w-[40px] max-[479px]:rounded-[10px]";

export default function BrandsSection() {
  const { social } = usePublicSettings();
  const text = useSectionContent("home", "welcome", WELCOME_TEXT);
  // Re-split only when the copy actually changes — the word list feeds the
  // stagger below, and rebuilding it every render would churn the refs GSAP
  // animates.
  const headlineWords = useMemo(() => splitHeadline(text), [text]);
  const sectionRef = useRef(null);

  useGSAP(
    () => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: { trigger: sectionRef.current, start: "top 72%" },
      });

      timeline
        .from(".js-eyebrow-rule", { scaleX: 0, duration: 0.9, ease: "power2.inOut" })
        .from(".js-eyebrow-text", { opacity: 0, y: 10, duration: 0.6 }, "-=0.6")
        // The headline reveal. Each word sits in an overflow-hidden mask, so
        // translating it 110% down puts it fully out of sight; sliding it back
        // to 0 reads as the line writing itself in rather than a plain fade.
        // power4.out + a 0.035s stagger is what keeps a 17-word headline from
        // feeling either sluggish or machine-gunned.
        .from(
          ".js-word",
          { yPercent: 110, duration: 1, stagger: 0.035, ease: "power4.out" },
          "-=0.35"
        )
        .from(".js-divider", { scaleX: 0, duration: 1, ease: "power2.inOut" }, "-=0.7")
        .from(".js-body", { opacity: 0, y: 24, duration: 0.9 }, "-=0.75")
        // Diamonds settle in with a turn — rotation is animated on top of the
        // 45deg the frame already carries, so they arrive spinning into place.
        .from(
          ".js-action",
          {
            opacity: 0,
            y: 20,
            scale: 0.9,
            rotation: -25,
            duration: 0.7,
            stagger: 0.09,
            ease: "back.out(1.6)",
          },
          "-=0.5"
        );
    },
    sectionRef,
    [headlineWords]
  );

  return (
    <section
      ref={sectionRef}
      style={{
        ...CHROME,
        "--w-eyebrow": text.eyebrowColor,
        "--w-headline": text.headlineColor,
        "--w-accent-from": text.headlineAccentColor,
        "--w-accent-to": text.headlineAccentColorTo,
        "--w-body": text.bodyStartColor,
        "--w-body-accent": text.bodyAccentColor,
        "--w-cta-text": text.ctaLabelColor,
        "--w-cta-from": text.ctaBgColor,
        "--w-cta-to": text.ctaBgColorTo,
      }}
      className="relative w-full overflow-hidden bg-gradient-to-b from-white via-[#FDFBF7] to-white pt-[100px] px-[8%] pb-[110px] max-[991px]:px-[40px] max-[991px]:pt-[70px] max-[991px]:pb-[80px] max-[479px]:px-[20px] max-[479px]:pt-[50px] max-[479px]:pb-[60px]"
    >
      {/* Faint gold bloom behind the headline — depth without a visible panel */}
      <span className="pointer-events-none absolute left-1/2 top-[-120px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(201,161,90,0.10)_0%,rgba(201,161,90,0)_70%)]" />

      <div className="relative mx-auto max-w-[1100px]">
        {/* Eyebrow — gold rules flanking a letterspaced label */}
        <div className="mb-[38px] flex items-center justify-center gap-[18px] max-[479px]:mb-[26px] max-[479px]:gap-[10px]">
          <span className="js-eyebrow-rule h-px w-[70px] origin-right bg-gradient-to-r from-transparent to-[var(--w-eyebrow)] max-[479px]:w-[34px]" />
          <span
            style={typeStyle(text, "eyebrow")}
            className="js-eyebrow-text text-[0.72rem] font-medium tracking-[0.34em] uppercase text-[var(--w-eyebrow)] max-[479px]:text-[0.69rem] max-[479px]:tracking-[0.2em]"
          >
            {text.eyebrow}
          </span>
          <span className="js-eyebrow-rule h-px w-[70px] origin-left bg-gradient-to-l from-transparent to-[var(--w-eyebrow)] max-[479px]:w-[34px]" />
        </div>

        <h2 className="mx-auto max-w-[1000px] text-center font-ticker text-[46px] font-light leading-[1.55] text-[var(--w-headline)] max-[991px]:text-[30px] max-[991px]:leading-[1.5] max-[479px]:text-[20px] max-[479px]:leading-[1.55]">
          {headlineWords.map(({ id, word, accent, type }) => (
            // Mask wrapper. The padding/negative-margin pair keeps descenders
            // (g, y, p) from being clipped by the same overflow that hides the
            // word before it slides in.
            <span
              key={id}
              className="mr-[0.26em] inline-block overflow-hidden pb-[0.16em] align-bottom -mb-[0.16em]"
            >
              <span
                style={type}
                className={`js-word inline-block will-change-transform ${
                  accent
                    ? "font-semibold bg-gradient-to-b from-[var(--w-accent-from)] to-[var(--w-accent-to)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
                    : ""
                }`}
              >
                {word}
              </span>
            </span>
          ))}
        </h2>

        {/* Gold rule with a centre lozenge */}
        <div className="js-divider mx-auto mt-[54px] flex w-[260px] items-center gap-[12px] max-[479px]:mt-[34px] max-[479px]:w-[170px]">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--pj-accent)]/70" />
          <span className="h-[7px] w-[7px] rotate-45 bg-[var(--pj-accent)]" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--pj-accent)]/70" />
        </div>

        <div className="mx-auto mt-[54px] max-w-[760px] text-center max-[479px]:mt-[36px]">
          <p
            style={typeStyle(text, "bodyStart")}
            className="js-body font-ticker text-[19px] leading-[1.85] text-[var(--w-body)]/85 max-[479px]:text-[14px] max-[479px]:leading-[1.7]"
          >
            {text.bodyStart}{" "}
            <strong
              style={typeStyle(text, "bodyAccent")}
              className="font-semibold font-ticker text-[var(--w-body-accent)]"
            >
              {text.bodyAccent}
            </strong>
          </p>

          {/* gap is wider than it looks — rotated squares need room for the
              diagonal, which is ~1.41x the side length. */}
          <div className="mt-[42px] flex flex-wrap items-center justify-center gap-[26px] max-[479px]:mt-[30px] max-[479px]:gap-[20px]">
            {SOCIAL_LINKS.map(({ Icon, key, label }) => (
              <a
                key={label}
                href={social[key]}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={SOCIAL_FRAME}
              >
                <span className="-rotate-45">
                  <Icon />
                </span>
              </a>
            ))}

            {/* Routed with react-router's Link so it's an in-app SPA
                navigation. "/AboutPage" is the real route in AppRoutes.jsx
                (Footer.jsx's "/about" is stale and 404s). */}
            <Link
              to="/AboutPage"
              style={typeStyle(text, "ctaLabel")}
              className="js-action ml-[14px] rounded-full border-[1px] border-[var(--pj-accent)]/50 bg-gradient-to-b from-[var(--w-cta-from)] to-[var(--w-cta-to)] px-[34px] py-[14px] font-ticker text-[15px] font-semibold text-[var(--w-cta-text)] no-underline shadow-[0_12px_26px_rgba(1,56,59,0.22)] [transition:box-shadow_0.45s_ease,translate_0.45s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:shadow-[0_18px_34px_rgba(1,56,59,0.3)] max-[479px]:ml-0 max-[479px]:px-[24px] max-[479px]:py-[11px] max-[479px]:text-[13px]"
            >
              {text.ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
