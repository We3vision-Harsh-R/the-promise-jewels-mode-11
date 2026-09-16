import { useRef } from "react";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import { SocialLinks } from "@/components/common/SocialIcons.jsx";
import { classNames } from "@/utils/helpers.js";

/**
 * Outer circle: 18 cards, 20deg apart.
 * Same ring/angles/z-index as the homepage GrowthSection — just without
 * any of the scroll-tied scale/zoom logic, and not pinned (sticky).
 */
const OUTER_ITEMS = [
  { deg: 0, z: 8 },
  { deg: 20, z: 7 },
  { deg: 40, z: 6 },
  { deg: 60, z: 5 },
  { deg: 80, z: 4 },
  { deg: 100, z: 3 },
  { deg: 120, z: 2 },
  { deg: 140, z: 1 },
  { deg: 160, z: undefined },
  { deg: 180, z: undefined },
  { deg: 200, z: undefined },
  { deg: 220, z: undefined },
  { deg: 240, z: undefined },
  { deg: 260, z: undefined },
  { deg: 280, z: undefined },
  { deg: 300, z: undefined },
  { deg: 320, z: undefined },
  { deg: 340, z: undefined },
];

// Swap these for your own product photography — keep 18 entries for the ring
// (repeats are fine).
const DEFAULT_OUTER_IMAGES = [
  "/images/jewellery/image_20_1.webp",
  "/images/jewellery/image_22.webp",
  "/images/jewellery/image_56.webp",
  "/images/jewellery/image_77.webp",
  "/images/jewellery/image_78.webp",
  "/images/jewellery/image_79.webp",
  "/images/jewellery/image_80.webp",
  "/images/jewellery/image_81.webp",
  "/images/jewellery/image_82.webp",
  "/images/jewellery/image_83.webp",
  "/images/jewellery/image_84.webp",
  "/images/jewellery/image_86.webp",
  "/images/jewellery/image_89.webp",
  "/images/jewellery/image_90.webp",
  "/images/jewellery/image_91.webp",
  "/images/jewellery/image_92.webp",
  "/images/jewellery/image_93.webp",
  "/images/jewellery/image_94.webp",
];

const DEFAULT_TICKER_ITEMS = ["Claricuts", "Luxifine", "Netram"];

// How long one full 360deg loop takes, in seconds. Lower = faster spin.
// Constant speed, always clockwise — nothing here reacts to scroll at all.
const OUTER_LOOP_SECONDS = 40;

// Both CTAs share their shape and padding so they read as one pair and stay
// the same height at every breakpoint; only the fill differs below.
const CTA_BASE =
  "rounded-full cursor-pointer font-semibold border-0 px-[55px] py-[22px] text-[1rem] " +
  "min-[768px]:max-[1024px]:px-[30px] min-[768px]:max-[1024px]:py-[13px] min-[768px]:max-[1024px]:text-[0.75rem] " +
  "max-[430px]:px-[27px] max-[430px]:py-[12px] max-[430px]:text-[0.72rem]";

const CTA_PRIMARY =
  "text-white bg-gradient-to-b from-[#01383B] to-[#286F6F]";

// Outlined rather than filled, so it reads as the lesser of the two actions.
// Fills with the primary's teal on hover instead of introducing a new colour.
//
// The outline is an INSET SHADOW, not a border. Neither button has a fixed
// height, so a real border would make this one 2px taller than the primary —
// and matching it by bordering the primary too would nudge that button on
// every other page this hero is used on. A shadow takes up no space.
const CTA_SECONDARY =
  "bg-transparent text-[#01383B] shadow-[inset_0_0_0_1px_rgba(1,56,59,0.35)] " +
  "[transition:background-color_0.45s_ease,color_0.45s_ease,box-shadow_0.45s_ease] " +
  "hover:shadow-[inset_0_0_0_1px_#01383B] hover:bg-[#01383B] hover:text-white";

/**
 * Reusable hero circle + ticker, used at the top of every page (not just
 * the homepage). Pass eyebrow/title/subtitle/cta text per page — the
 * circle, ticker, and all responsive behavior stay identical everywhere.
 *
 * `logoUrl` and `socialLinks` are optional: pass them on pages whose design
 * puts the brand mark and a social row in the hero (the collection pages)
 * and leave them off everywhere else, where the plain text title is used.
 *
 * `showOuterRing` / `showTicker` (both default true) — set either to false
 * to drop that piece entirely. Used on the "Our Collection" page hero,
 * whose Figma has just the logo/tagline/CTA block and skips straight to
 * the brand tabs below it — no rotating jewelry ring, no scrolling
 * Claricuts/Luxifine/Netram ticker.
 *
 * `secondaryCtaText` / `onSecondaryCtaClick` are optional and render a second,
 * outlined button beside the primary one. Pass BOTH to get it; leaving either
 * off renders the single-button hero every other page already had, unchanged.
 *
 * Usage:
 *   <PageHeroCircle
 *     eyebrow="About"
 *     title="Promise Jewels"
 *     subtitle="Promise Jewels Private Limited delivers..."
 *     ctaText="Get Started"
 *     onCtaClick={() => navigate("/contact")}
 *     secondaryCtaText="View Collection"
 *     onSecondaryCtaClick={() => navigate("/our-collection")}
 *   />
 */
export default function PageHeroCircle({
  eyebrow,
  title,
  subtitle,
  ctaText = "Get Started",
  onCtaClick,
  secondaryCtaText,
  onSecondaryCtaClick,
  logoUrl,
  socialLinks,
  outerImages = DEFAULT_OUTER_IMAGES,
  tickerItems = DEFAULT_TICKER_ITEMS,
  showOuterRing = true,
  showTicker = true,
  // The whole section object from the Editor.
  //
  // Six pages were already passing eyebrowColorFrom, titleColorFrom,
  // subtitleColor and ctaTextColor into this component. It never declared
  // them and never used them — the shades below were hard-coded — so every
  // hero colour in the Editor did nothing at all on any of those pages.
  // Taking the section itself means the colours and the typography both
  // arrive together, and a field added to the hero schema tomorrow needs no
  // new prop here.
  content,
}) {
  const c = content ?? {};

  // Defaults are the shades the design shipped with, so a page that passes
  // nothing renders exactly as it always did.
  const gradient = (key, from, to) =>
    `linear-gradient(180deg, ${c[`${key}Color`] ?? from} 0%, ${c[`${key}ColorTo`] ?? to} 100%)`;

  const outerRef = useRef(null);
  const tickerRef = useRef(null);

  // Just a plain infinite rotation — no scroll listener, no speed changes,
  // no scale changes. The circle spins at a constant rate and otherwise
  // behaves like any other content on the page (scrolls normally with it).
  useGSAP(
    () => {
      if (showOuterRing && outerRef.current) {
        gsap.to(outerRef.current, {
          rotation: "+=360",
          duration: OUTER_LOOP_SECONDS,
          ease: "none",
          repeat: -1,
        });
      }

      // Infinite scrolling brand ticker — same technique as the homepage:
      // the track holds the text TWICE back to back, then slides left by
      // exactly 50% of its own width on a loop, so the moment it finishes
      // it looks identical to the start — a seamless, endless scroll.
      if (showTicker && tickerRef.current) {
        gsap.to(tickerRef.current, {
          xPercent: -50,
          duration: 18,
          ease: "none",
          repeat: -1,
        });
      }
    },
    outerRef,
    [showOuterRing, showTicker]
  );

  const tickerBlock = (i) => (
    <div key={i} className="flex items-center">
      {tickerItems.map((item, idx) => (
        <span key={idx} className="flex items-center">
          <span className="mr-[60px] text-[10rem] min-[768px]:max-[1024px]:mr-[36px] min-[768px]:max-[1024px]:text-[4.5rem] max-[430px]:mr-[20px] max-[430px]:text-[2.6rem] font-normal font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent] bg-gradient-to-b from-[#01383B] to-[#286F6F]">
            {item}
          </span>
          <span className="mr-[60px] text-[10rem] min-[768px]:max-[1024px]:mr-[36px] min-[768px]:max-[1024px]:text-[4.5rem] max-[430px]:mr-[20px] max-[430px]:text-[2.6rem] font-normal font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent] bg-[linear-gradient(180deg,#00373F_0%,#13464e_30%,#5cc8d4_60%,#21C5D8_100%)]">
            ✦
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <section className="relative overflow-clip bg-white">
      <div
        className={classNames(
          "relative overflow-hidden h-[var(--hero-height)]",
          showOuterRing
            ? `
              [--hero-height:clamp(820px,95vh,1000px)]
              [--outer-ring-h:clamp(14rem,34vmin,28rem)]
              [--outer-card-w:clamp(3.8rem,9vmin,7rem)]
              [--outer-card-h:clamp(4.5rem,10vmin,8rem)]
              [--outer-item-w:var(--outer-card-w)]
              min-[768px]:max-[1024px]:[--hero-height:600px]
              min-[768px]:max-[1024px]:[--outer-ring-h:17.5rem]
              min-[768px]:max-[1024px]:[--outer-card-w:5rem]
              min-[768px]:max-[1024px]:[--outer-card-h:5.5rem]
              max-[430px]:[--hero-height:750px]
              max-[430px]:[--outer-ring-h:10.7rem]
              max-[430px]:[--outer-card-w:2.6rem]
              max-[430px]:[--outer-card-h:3rem]
            `
            // No ring to leave room for below the content, so the hero can
            // be much shorter — sized to the content block instead of the
            // 95vh the ring needed.
            : `
              [--hero-height:clamp(480px,58vh,620px)]
              min-[768px]:max-[1024px]:[--hero-height:420px]
              max-[430px]:[--hero-height:400px]
            `
        )}
      >
        <div className="relative w-full h-full">
          {/* Outer circle */}
          {showOuterRing && (
            <div className="absolute left-1/2 top-full z-[2] max-[430px]:top-1/2 max-[430px]:[transform:translateY(-50%)]">
              <div className="relative z-[2] scale-[1.4] min-[768px]:max-[1024px]:scale-100 max-[430px]:scale-100">
                <div ref={outerRef} className="relative flex items-center justify-center">
                  {OUTER_ITEMS.map((item, i) => (
                    <div
                      key={i}
                      className="absolute origin-center [perspective:1000px] rounded-full w-[var(--outer-item-w)] h-[var(--outer-ring-h)]"
                      style={{
                        transform: `rotate(${item.deg}deg)`,
                        zIndex: item.z,
                      }}
                    >
                      <div className="absolute w-[var(--outer-card-w)] h-[var(--outer-card-h)] [inset:-125%_auto_auto]">
                        <img
                          src={outerImages[i % outerImages.length]}
                          alt=""
                          loading="lazy"
                          className="block w-full h-full object-cover rounded-[10px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Center content */}
          <div
            className={classNames(
              "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] flex items-center justify-center w-full text-[2.3rem]",
              showOuterRing
                ? "top-[70%] min-[768px]:max-[1024px]:top-[65%] max-[430px]:top-1/2"
                : "top-1/2"
            )}
          >
            <div className="flex flex-col justify-start items-center relative z-[6] text-center px-[1rem] text-[2.3rem]">
              <p
                style={{ backgroundImage: gradient("eyebrow", "#01383B", "#286F6F"), ...typeStyle(c, "eyebrow") }}
                className="mt-0 mb-[40px] text-[25px] font-[350] tracking-[0.1em] uppercase font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent] min-[768px]:max-[1024px]:text-[20px] min-[768px]:max-[1024px]:mb-[20px] max-[430px]:text-[18px] max-[430px]:mb-[15px]"
              >
                {eyebrow}
              </p>
              {logoUrl ? (
                <h1 className="mt-0 mb-[16px] min-[768px]:max-[1024px]:mb-[20px] max-[430px]:mb-[10px]">
                  <img
                    src={logoUrl}
                    alt={title || "Promise Jewels"}
                    width={210}
                    height={210}
                    className="mx-auto block w-[210px] h-auto min-[768px]:max-[1024px]:w-[150px] max-[430px]:w-[110px]"
                  />
                </h1>
              ) : (
                <h1
                  style={{ backgroundImage: gradient("title", "#01383B", "#286F6F"), ...typeStyle(c, "title") }}
                  className="mt-0 mb-[16px] text-[3.5rem] leading-[1.1] font-semibold font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent] min-[768px]:max-[1024px]:text-[3rem] min-[768px]:max-[1024px]:mb-[20px] max-[430px]:text-[2.5rem] max-[430px]:mb-[10px]"
                >
                  {title}
                </h1>
              )}
              <p
                style={{ color: c.subtitleColor ?? "#2F6B6B", ...typeStyle(c, "subtitle") }}
                className="mt-0 mb-[24px] max-w-[54rem] text-[1.1rem] leading-[29px] opacity-100 font-ticker font-extralight min-[768px]:max-[1024px]:text-[0.8rem] min-[768px]:max-[1024px]:max-w-[37rem] min-[768px]:max-[1024px]:mb-[25px] min-[768px]:max-[1024px]:leading-[1rem] max-[430px]:text-[0.72rem] max-[430px]:max-w-[30.7rem] max-[430px]:mb-[13px] max-[430px]:leading-[1rem]">
                {subtitle}
              </p>
              {socialLinks ? (
                <SocialLinks
                  links={socialLinks}
                  variant="solid"
                  className="gap-[14px] max-[430px]:gap-[10px]"
                  itemClassName="w-[36px] h-[36px] min-[768px]:max-[1024px]:w-[32px] min-[768px]:max-[1024px]:h-[32px] max-[430px]:w-[28px] max-[430px]:h-[28px]"
                />
              ) : null}
              {/* The top margin lives on this row, not on the buttons, so a
                  hero with only a primary CTA sits exactly where it always
                  did. Wraps to a second line when both buttons are present
                  and the viewport is narrow. */}
              <div className="mt-[50px] flex flex-wrap items-center justify-center gap-[16px] min-[768px]:max-[1024px]:mt-[6px] min-[768px]:max-[1024px]:gap-[12px] max-[430px]:mt-[8px] max-[430px]:gap-[10px]">
                <button
                  onClick={onCtaClick}
                  style={{ color: c.ctaLabelColor ?? undefined, ...typeStyle(c, "ctaLabel") }}
                  className={classNames(CTA_BASE, CTA_PRIMARY)}
                >
                  {ctaText}
                </button>

                {secondaryCtaText && onSecondaryCtaClick ? (
                  <button
                    onClick={onSecondaryCtaClick}
                    className={classNames(CTA_BASE, CTA_SECONDARY)}
                  >
                    {secondaryCtaText}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 z-[2] h-[150%] bg-white/25" />
      </div>

      {showTicker && (
        <div className="w-full overflow-clip whitespace-nowrap bg-white pb-2">
          <div ref={tickerRef} className="flex w-max items-center [will-change:transform]">
            {[...Array(4)].map((_, i) => tickerBlock(i))}
          </div>
        </div>
      )}
    </section>
  );
}