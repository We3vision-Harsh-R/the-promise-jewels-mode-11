import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import { CHROME } from "@/pages/Home/homeChrome.js";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import usePublicBrands from "@/features/brands/hooks/usePublicBrands.js";

// Fallback only. Every brand on screen normally comes from Admin > Brands
// (Supabase), and the frame below renders whatever is saved there — see
// usePublicBrands.js. These three keep the homepage from going blank before
// the request resolves, if it fails, or while the brands table is empty; the
// images are the ones bundled in /public/images/brands.
const BUNDLED_BRANDS = [
  {
    name: "CLARICUTS",
    image: "/images/brands/claricuts-bg.webp",
    description:
      "Placeholder copy — replace with the real Claricuts description. A short paragraph introducing the brand, the pieces it is known for, and the customer it is made for.",
  },
  {
    name: "Luxifine",
    image: "/images/brands/luxifine-bg.webp",
    description:
      "Placeholder copy — replace with the real Luxifine description. A short paragraph introducing the brand, the pieces it is known for, and the customer it is made for.",
  },
  {
    name: "Netram Jewels",
    image: "/images/brands/netram-bg.webp",
    description:
      "Placeholder copy — replace with the real Netram Jewels description. A short paragraph introducing the brand, the pieces it is known for, and the customer it is made for.",
  },
];

// Section heading copy stays editable from Admin > Editor > Home page. The
// per-brand name/description keys are gone: those now come from the brands
// table, so editing them in two places would let the two drift apart.
const BRANDS_TEXT = {
  titleLight: "Our",
  titleBold: "Brands",

  // Shades, matching what the Editor declares. The rows underneath the
  // heading are brand RECORDS rather than copy, so their three shades are set
  // once for the whole section — one brand styled differently from the next
  // would read as a fault, not a choice.
  titleLightColor: "#01383B",
  titleLightColorTo: "#3E9C86",
  titleBoldColor: "#01383B",
  titleBoldColorTo: "#3E9C86",
  brandNameColor: "#01383B",
  brandIndexColor: "#C9A15A",
  brandBodyColor: "#0E4238",
};

// Only the first few gallery shots go in the strip — the frame has to look
// the same for a brand with two images and a brand with twenty.
const GALLERY_STRIP_LIMIT = 4;

/**
 * ONE brand frame. Every brand renders through this exact component, so a
 * newly added brand is laid out identically to the first one no matter how
 * many there are — that is the whole point of the section.
 *
 * Each field is optional and simply drops out of the layout when the admin
 * has not filled it in, which is why a brand with only a name + description
 * still reads as finished rather than as a frame full of holes.
 */
function BrandFrame({ brand, index }) {
  const galleryStrip = (brand.gallery || []).slice(0, GALLERY_STRIP_LIMIT);
  const hasCta = Boolean(brand.ctaTitle || brand.ctaButtonText);

  // A URL saved in the brands table can still 404 — a file deleted straight
  // out of the Supabase bucket, or an upload that half-failed. Left alone the
  // browser draws its broken-image glyph and the alt text, which looks far
  // worse than the empty frame; these flags fall back to the same treatment a
  // brand with no image at all gets.
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const showImage = brand.image && !imageFailed;
  const showLogo =
    brand.logoUrl && !logoFailed && brand.logoUrl !== brand.image;

  return (
    <article className="js-brand-row relative">
      {/* Hairline between rows — drawn in from the left, so it is a
          divider and not just a static line. Skipped on the first row. */}
      {index > 0 && (
        <span
          data-reveal
          className="js-brand-rule mb-[46px] block h-px w-full origin-left bg-[#DCEAE7] max-[1024px]:mb-[34px] max-[430px]:mb-[26px]"
        />
      )}

      <div className="grid grid-cols-[minmax(0,420px)_1fr] items-center gap-[64px] pb-[46px] max-[1024px]:grid-cols-1 max-[1024px]:gap-[26px] max-[1024px]:pb-[34px] max-[430px]:gap-[20px] max-[430px]:pb-[26px]">
        <div
          data-reveal
          className="js-brand-media relative aspect-[4/3] w-full overflow-hidden rounded-[22px] bg-[#F1F6F5] shadow-[0_22px_46px_rgba(1,56,59,0.14)] max-[430px]:rounded-[16px]"
        >
          {showImage ? (
            /* Scaled past the frame so the parallax drift never exposes
               an edge. */
            <img
              src={brand.image}
              alt={brand.name}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="js-brand-image h-[115%] w-full object-cover will-change-transform"
            />
          ) : (
            /* No banner, no gallery, no logo saved yet. The frame keeps its
               shape rather than collapsing and taking the row's alignment
               with it. */
            <span className="flex h-full w-full items-center justify-center font-ticker text-[1.1rem] text-[var(--pj-heading)]/25">
              {brand.name}
            </span>
          )}

          {/* Logo badge, only when one is uploaded. Sits on the photo so the
              mark and the picture read as one brand card. */}
          {showLogo && (
            <span className="absolute left-[18px] top-[18px] flex h-[54px] w-[54px] items-center justify-center overflow-hidden rounded-full bg-white/95 shadow-[0_8px_20px_rgba(1,56,59,0.18)] backdrop-blur-sm max-[430px]:left-[12px] max-[430px]:top-[12px] max-[430px]:h-[42px] max-[430px]:w-[42px]">
              <img
                src={brand.logoUrl}
                alt={`${brand.name} logo`}
                loading="lazy"
                onError={() => setLogoFailed(true)}
                className="h-[74%] w-[74%] object-contain"
              />
            </span>
          )}

          {/* Hairline inset, same treatment as the collections stage */}
          <span className="pointer-events-none absolute inset-[12px] rounded-[14px] border-[1px] border-white/20 max-[430px]:inset-[8px] max-[430px]:rounded-[10px]" />
        </div>

        <div className="grid grid-cols-[auto_1fr] items-start gap-x-[40px] max-[430px]:gap-x-[18px]">
          <span
            data-reveal
            className="js-brand-copy pt-[6px] text-[0.95rem] font-medium tabular-nums text-[var(--b-index)] max-[430px]:text-[0.8rem]"
          >
            ({String(index + 1).padStart(2, "0")})
          </span>

          <div className="min-w-0">
            <h3
              data-reveal
              className="js-brand-copy m-0 text-[2rem] font-medium font-ticker leading-[1.2] text-[var(--b-name)] max-[1024px]:text-[1.7rem] max-[430px]:text-[1.35rem]"
            >
              {brand.name}
            </h3>

            <span
              data-reveal
              className="js-brand-copy mt-[14px] block h-px w-[54px] origin-left bg-gradient-to-r from-[var(--pj-accent)] to-[var(--pj-accent)]/0 max-[430px]:mt-[10px] max-[430px]:w-[38px]"
            />

            {brand.description && (
              <p
                data-reveal
                className="js-brand-copy mt-[14px] max-w-[560px] text-[1rem] leading-[1.7] text-[var(--b-body)]/75 max-[430px]:mt-[10px] max-[430px]:text-[0.9rem]"
              >
                {brand.description}
              </p>
            )}

            {/* The longer "Brand overview" field. Kept visually lighter than
                the description so the two never compete, and whitespace is
                preserved so paragraph breaks typed in the admin survive. */}
            {brand.overview && (
              <p
                data-reveal
                className="js-brand-copy mt-[14px] max-w-[560px] whitespace-pre-line text-[0.94rem] leading-[1.75] text-[var(--b-body)]/60 max-[430px]:mt-[10px] max-[430px]:text-[0.85rem]"
              >
                {brand.overview}
              </p>
            )}

            {galleryStrip.length > 0 && (
              <div
                data-reveal
                className="js-brand-copy mt-[20px] flex flex-wrap gap-[10px] max-[430px]:mt-[14px] max-[430px]:gap-[8px]"
              >
                {galleryStrip.map((image) => (
                  <span
                    key={image.id}
                    className="h-[64px] w-[64px] overflow-hidden rounded-[10px] bg-[#F1F6F5] shadow-[0_6px_16px_rgba(1,56,59,0.10)] max-[430px]:h-[48px] max-[430px]:w-[48px]"
                  >
                    <img
                      src={image.url}
                      alt={image.alt}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                ))}
              </div>
            )}

            {hasCta && (
              <div
                data-reveal
                className="js-brand-copy mt-[22px] max-[430px]:mt-[16px]"
              >
                {brand.ctaTitle && (
                  <p className="m-0 mb-[10px] font-ticker text-[1.05rem] leading-[1.4] text-[var(--pj-heading)] max-[430px]:text-[0.95rem]">
                    {brand.ctaTitle}
                  </p>
                )}
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-[8px] rounded-full border border-[var(--pj-accent)] px-[22px] py-[10px] text-[0.88rem] font-medium text-[var(--pj-heading)] transition-colors duration-300 hover:bg-[var(--pj-accent)] hover:text-white max-[430px]:px-[18px] max-[430px]:py-[8px] max-[430px]:text-[0.8rem]"
                >
                  {brand.ctaButtonText || "Enquire now"}
                  <span aria-hidden="true">&#8594;</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function OurBrands() {
  const text = useSectionContent("home", "brands", BRANDS_TEXT);
  const { brands: liveBrands } = usePublicBrands();

  // Whatever is in Supabase wins. The bundled trio only stands in while the
  // request is in flight, if it fails, or if no brand has been added yet.
  const brands = useMemo(
    () => (liveBrands.length ? liveBrands : BUNDLED_BRANDS),
    [liveBrands]
  );

  const sectionRef = useRef(null);

  // Entrance is the site-wide reveal (see hooks/useReveal.js). The previous
  // per-row timeline used gsap.from with a ScrollTrigger, which left nine
  // elements stuck at opacity 0 on this page whenever the trigger measured
  // the layout before the photos had loaded.
  //
  // `deps` matters now that rows arrive from an async request: without it the
  // reveal would run once against the fallback rows and every row that
  // replaced them would stay at opacity 0 forever.
  useReveal(sectionRef, { deps: [brands] });

  useGSAP(
    () => {
      // Slow drift on the photo as the row crosses the viewport — the scrub
      // ties it to scroll position so it never runs on its own.
      gsap.utils.toArray(".js-brand-image").forEach((image) => {
        gsap.fromTo(
          image,
          { yPercent: -6 },
          {
            yPercent: 6,
            ease: "none",
            scrollTrigger: {
              trigger: image.closest(".js-brand-row"),
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      });
    },
    sectionRef,
    // Re-created when the live rows swap in, for the same reason as above.
    [brands]
  );

  return (
    <section
      ref={sectionRef}
      style={{
        ...CHROME,
        "--b-name": text.brandNameColor,
        "--b-index": text.brandIndexColor,
        "--b-body": text.brandBodyColor,
      }}
      className="w-full bg-white py-[76px] px-[8%] max-[1024px]:py-[58px] max-[430px]:py-[42px] max-[430px]:px-[6%]"
    >
      <h2 className="mx-auto mb-[48px] max-w-[900px] text-center text-[4rem] font-light leading-[1.1] font-ticker max-[1024px]:mb-[34px] max-[1024px]:text-[3.2rem] max-[430px]:mb-[24px] max-[430px]:text-[1.9rem]">
        <span
          className="bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
          style={{
            ...typeStyle(text, 'titleLight'),
            backgroundImage: `linear-gradient(180deg, ${text.titleLightColor} 0%, ${text.titleLightColorTo} 100%)`,
          }}
        >
          {text.titleLight}
        </span>{" "}
        <span
          className="font-semibold font-ticker bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
          style={{
            ...typeStyle(text, 'titleBold'),
            backgroundImage: `linear-gradient(180deg, ${text.titleBoldColor} 0%, ${text.titleBoldColorTo} 100%)`,
          }}
        >
          {text.titleBold}
        </span>
      </h2>

      <div className="mx-auto w-full max-w-[1320px]">
        {brands.map((brand, index) => (
          <BrandFrame
            key={brand.id ?? brand.name}
            brand={brand}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
