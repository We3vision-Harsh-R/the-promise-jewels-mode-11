import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import { CHROME } from "@/pages/Home/homeChrome.js";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import usePublicBrands from "@/features/brands/hooks/usePublicBrands.js";
import { trimMargin } from "@/utils/trimLogo.js";

// Fallback only. Every brand shown normally comes from Admin > Brands — see
// usePublicBrands.js. These keep the section from going blank before the request
// resolves, if it fails, or while no brand has been added yet.
const BUNDLED_BRANDS = [
  {
    name: "CLARICUTS",
    image: "/images/brands/claricuts-bg.webp",
    description: "A short paragraph introducing the brand, the pieces it is known for, and the customer it is made for.",
  },
  {
    name: "Luxifine",
    image: "/images/brands/luxifine-bg.webp",
    description: "A short paragraph introducing the brand, the pieces it is known for, and the customer it is made for.",
  },
  {
    name: "Netram Jewels",
    image: "/images/brands/netram-bg.webp",
    description: "A short paragraph introducing the brand, the pieces it is known for, and the customer it is made for.",
  },
];

// The words and shades of this section, editable from Admin > Editor > Home
// page > Our Brands. The cards themselves are brand RECORDS (Admin > Brands).
const BRANDS_TEXT = {
  titleLight: "Our",
  titleBold: "Brands",
  intro: "The names we manufacture for and stand behind — each with its own collections and its own story.",
  exploreLabel: "Explore brand",
  allLabel: "View all brands",

  titleLightColor: "#01383B",
  titleLightColorTo: "#3E9C86",
  titleBoldColor: "#01383B",
  titleBoldColorTo: "#3E9C86",
  brandNameColor: "#01383B",
  brandIndexColor: "#C9A15A",
  brandBodyColor: "#0E4238",
};

/**
 * One brand as a card: its picture and logo on top, its name, a few lines about
 * it and a way in underneath. The whole card is the link (the name carries it),
 * so a visitor can tap anywhere on it. Every field is optional and simply drops
 * out when the admin has not filled it in, so a brand with only a name still
 * reads as a finished card.
 */
function BrandCard({ brand, index, exploreLabel }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const showImage = brand.image && !imageFailed;
  const showLogo = brand.logoUrl && !logoFailed && brand.logoUrl !== brand.image;

  // Logos are often a big square with a small mark in the middle; the badge
  // shows the mark itself, with the empty margin trimmed away.
  const [trim, setTrim] = useState({ from: null, src: null });
  const logoSrc = trim.from === brand.logoUrl && trim.src ? trim.src : brand.logoUrl;
  useEffect(() => {
    let live = true;
    if (brand.logoUrl) trimMargin(brand.logoUrl).then((src) => live && setTrim({ from: brand.logoUrl, src }));
    return () => {
      live = false;
    };
  }, [brand.logoUrl]);
  const href = brand.slug ? `/our-brand/${brand.slug}` : null;

  const name = href ? (
    <Link
      to={href}
      className="text-inherit no-underline outline-none after:absolute after:inset-0 after:z-[2] after:content-[''] focus-visible:after:rounded-[26px] focus-visible:after:ring-2 focus-visible:after:ring-[var(--pj-accent)]"
    >
      {brand.name}
    </Link>
  ) : (
    brand.name
  );

  return (
    <article
      data-reveal
      className="group relative flex w-full flex-col overflow-hidden rounded-[26px] border border-[#DCEAE7] bg-white shadow-[0_18px_44px_-24px_rgba(1,56,59,0.35)] [transition:box-shadow_0.5s_ease,translate_0.5s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[6px] hover:shadow-[0_32px_64px_-26px_rgba(1,56,59,0.5)] max-[479px]:rounded-[20px]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F4F8F7]">
        {showImage ? (
          <img
            src={brand.image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-[20px] text-center font-ticker text-[1.3rem] text-[var(--pj-heading)]/30">
            {brand.name}
          </span>
        )}

        {showLogo && (
          <span className="absolute left-[16px] top-[16px] flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full bg-white/95 shadow-[0_8px_20px_rgba(1,56,59,0.2)] backdrop-blur-sm max-[479px]:left-[12px] max-[479px]:top-[12px] max-[479px]:h-[44px] max-[479px]:w-[44px]">
            <img
              src={logoSrc}
              alt=""
              loading="lazy"
              onError={() => setLogoFailed(true)}
              className="max-h-[62%] max-w-[68%] object-contain"
            />
          </span>
        )}

        <span className="absolute right-[16px] top-[16px] rounded-full bg-white/90 px-[11px] py-[4px] font-ticker text-[0.72rem] font-medium tabular-nums tracking-[0.12em] text-[var(--b-index)] shadow-[0_6px_16px_rgba(1,56,59,0.14)] max-[479px]:right-[12px] max-[479px]:top-[12px]">
          {String(index + 1).padStart(2, "0")}
        </span>

        <span className="pointer-events-none absolute inset-[10px] rounded-[18px] border border-[#01383B]/10 max-[479px]:inset-[8px] max-[479px]:rounded-[14px]" />
      </div>

      <div className="flex flex-1 flex-col p-[26px] max-[479px]:p-[20px]">
        <h3 className="m-0 font-ticker text-[1.6rem] font-medium leading-[1.2] text-[var(--b-name)] max-[479px]:text-[1.35rem]">
          {name}
        </h3>

        <span className="mt-[14px] block h-px w-[54px] bg-gradient-to-r from-[var(--pj-accent)] to-[var(--pj-accent)]/0" />

        {brand.description ? (
          <p className="m-0 mt-[14px] line-clamp-3 text-[0.98rem] leading-[1.7] text-[var(--b-body)]/75 max-[479px]:text-[0.92rem]">
            {brand.description}
          </p>
        ) : null}

        {href ? (
          <span className="mt-auto inline-flex items-center gap-[8px] pt-[22px] text-[0.9rem] font-medium text-[var(--pj-heading)] [transition:gap_0.35s_ease,color_0.35s_ease] group-hover:gap-[13px] group-hover:text-[var(--pj-accent)]">
            {exploreLabel}
            <span aria-hidden="true">&#8594;</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}

/**
 * "Our Brands" on the Home page: a heading, a line of introduction and one card
 * per brand, in as many columns as fit (three on a wide screen, two on a tablet,
 * one on a phone), with a way through to the full list.
 */
export default function HomeBrands() {
  const text = useSectionContent("home", "brands", BRANDS_TEXT);
  const { brands: liveBrands } = usePublicBrands();

  // Whatever is in Admin > Brands wins; the bundled trio only stands in until
  // the request lands or while no brand has been added.
  const brands = useMemo(() => (liveBrands.length ? liveBrands : BUNDLED_BRANDS), [liveBrands]);

  const sectionRef = useRef(null);
  // Re-run when the live brands swap in, or their cards would stay hidden.
  useReveal(sectionRef, { deps: [brands] });

  return (
    <section
      ref={sectionRef}
      style={{
        ...CHROME,
        "--b-name": text.brandNameColor,
        "--b-index": text.brandIndexColor,
        "--b-body": text.brandBodyColor,
      }}
      className="w-full bg-white px-[8%] py-[84px] max-[1024px]:py-[64px] max-[479px]:px-[6%] max-[479px]:py-[48px]"
    >
      <div data-reveal className="mx-auto mb-[52px] max-w-[760px] text-center max-[1024px]:mb-[40px] max-[479px]:mb-[30px]">
        <h2 className="m-0 text-[4rem] font-light leading-[1.1] font-ticker max-[1024px]:text-[3.2rem] max-[479px]:text-[2rem]">
          <span
            className="bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
            style={{
              ...typeStyle(text, "titleLight"),
              backgroundImage: `linear-gradient(180deg, ${text.titleLightColor} 0%, ${text.titleLightColorTo} 100%)`,
            }}
          >
            {text.titleLight}
          </span>{" "}
          <span
            className="font-semibold font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
            style={{
              ...typeStyle(text, "titleBold"),
              backgroundImage: `linear-gradient(180deg, ${text.titleBoldColor} 0%, ${text.titleBoldColorTo} 100%)`,
            }}
          >
            {text.titleBold}
          </span>
        </h2>

        {text.intro ? (
          <p className="m-0 mx-auto mt-[18px] max-w-[620px] font-ticker text-[1.08rem] leading-[1.7] text-[var(--b-body)]/75 max-[479px]:mt-[12px] max-[479px]:text-[0.95rem]">
            {text.intro}
          </p>
        ) : null}
      </div>

      {/* Three across on a wide screen, two on a tablet, one on a phone; a short
          list stays centred instead of leaving an empty column. */}
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap justify-center gap-[28px] max-[479px]:gap-[20px]">
        {brands.map((brand, index) => (
          <div
            key={brand.id ?? brand.name}
            className="flex w-[calc((100%-56px)/3)] max-w-[420px] max-[1099px]:w-[calc((100%-28px)/2)] max-[639px]:w-full"
          >
            <BrandCard brand={brand} index={index} exploreLabel={text.exploreLabel} />
          </div>
        ))}
      </div>

      {text.allLabel ? (
        <div data-reveal className="mt-[48px] text-center max-[479px]:mt-[34px]">
          <Link
            to="/our-brand"
            className="inline-flex items-center gap-[10px] rounded-full border border-[var(--pj-accent)] px-[28px] py-[12px] font-ticker text-[0.92rem] font-medium text-[var(--pj-heading)] transition-colors duration-300 hover:bg-[var(--pj-accent)] hover:text-white"
          >
            {text.allLabel}
            <span aria-hidden="true">&#8594;</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
