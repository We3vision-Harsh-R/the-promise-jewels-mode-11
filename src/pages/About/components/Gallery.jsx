import { useRef, forwardRef, useMemo } from "react";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";

// Row 1 — scrolls right→left. Using the actual files from
// /images/jewellery/ — swap the `name` labels for the real product names
// whenever you have them (these are placeholder labels for now).
const ROW_1 = [
  { name: "Black Beaded Necklace", image: "/images/jewellery/image_252.webp" },
  { name: "Diamond Chandelier Earrings", image: "/images/jewellery/image_245.webp" },
  { name: "Diamond Cluster Cocktail Ring", image: "/images/jewellery/image_244.webp" },
  { name: "Layered Gold Chain Necklace", image: "/images/jewellery/image_247.webp" },
  { name: "Diamond Drop Earrings", image: "/images/jewellery/image_253.webp" },
];

// Row 2 — scrolls left→right.
const ROW_2 = [
  { name: "Emerald Statement Necklace", image: "/images/jewellery/image_248.webp" },
  { name: "Diamond Statement Necklace", image: "/images/jewellery/image_249.webp" },
  { name: "Yellow Gold Band Ring", image: "/images/jewellery/image_250.webp" },
  { name: "Diamond Dangle Earrings", image: "/images/jewellery/image_251.webp" },
  { name: "Turquoise Pendant Necklace", image: "/images/jewellery/image_254.webp" },
];

// Bundled pictures — the fallback, and what fixes each row's length.
const GALLERY_TEXT = {
  heading: "Gallery",
  headingColor: "#01383B",
  captionColor: "#2F6B6B",
  ...Object.fromEntries(ROW_1.flatMap((it, i) => [[`row1.${i + 1}`, it.image], [`row1.${i + 1}.name`, it.name]])),
  ...Object.fromEntries(ROW_2.flatMap((it, i) => [[`row2.${i + 1}`, it.image], [`row2.${i + 1}.name`, it.name]])),
};

const LOOP_SECONDS = 42;

// Same card system as the Leaders / Brands / Collections cards: teal scrim,
// gold hairline inset, gold rule above the label.
function GalleryCard({ name, image, nameType }) {
  return (
    <div className="group relative h-[500px] w-[340px] shrink-0 overflow-hidden rounded-[28px] bg-[#01383B] shadow-[0_22px_46px_-14px_rgba(1,56,59,0.42)] [transition:box-shadow_0.55s_ease] hover:shadow-[0_32px_60px_-14px_rgba(1,56,59,0.55)] min-[768px]:max-[1024px]:h-[400px] min-[768px]:max-[1024px]:w-[270px] max-[767px]:h-[330px] max-[767px]:w-[224px] max-[767px]:rounded-[22px]">
      <img
        src={image}
        alt={name}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
      />

      {/* Teal scrim — the old black one sat outside the palette */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#01383B] via-[#01383B]/58 to-transparent" />

      {/* Gold hairline inset */}
      <div className="pointer-events-none absolute inset-[13px] rounded-[18px] border-[1px] border-[#C9A15A]/35 max-[767px]:inset-[10px] max-[767px]:rounded-[14px]" />

      <div className="absolute inset-x-0 bottom-0 p-[26px] max-[767px]:p-[18px]">
        <span className="mb-[10px] block h-px w-[26px] bg-[#C9A15A] max-[767px]:mb-[7px] max-[767px]:w-[18px]" />
        <p
          style={nameType}
          className="font-ticker text-[1rem] font-medium leading-[1.35] text-white max-[767px]:text-[0.82rem]"
        >
          {name}
        </p>
      </div>
    </div>
  );
}

// Duplicate each row's items so the strip is twice as long as the visible
// track — that's what makes the GSAP xPercent(-50) loop below seamless
// (once it's shifted exactly one full copy's width, it snaps back to 0
// with the duplicate now sitting where the original started).
const Row = forwardRef(function Row({ items }, ref) {
  const doubled = [...items, ...items];
  return (
    <div ref={ref} className="flex w-max gap-[34px] max-[767px]:gap-[18px]">
      {doubled.map((item, index) => (
        <GalleryCard key={`${item.name}-${index}`} {...item} />
      ))}
    </div>
  );
});

export default function Gallery() {
  // Both rows of photographs, and their captions, from the Editor.
  const text = useSectionContent("about", "gallery", GALLERY_TEXT);
  const rowOne = useMemo(
    () =>
      ROW_1.map((item, i) => ({
        ...item,
        image: text[`row1.${i + 1}`] || item.image,
        name: text[`row1.${i + 1}.name`] || item.name,
        nameType: typeStyle(text, `row1.${i + 1}.name`),
      })),
    [text]
  );
  const rowTwo = useMemo(
    () =>
      ROW_2.map((item, i) => ({
        ...item,
        image: text[`row2.${i + 1}`] || item.image,
        name: text[`row2.${i + 1}.name`] || item.name,
        nameType: typeStyle(text, `row2.${i + 1}.name`),
      })),
    [text]
  );

  const sectionRef = useRef(null);
  const row1Ref = useRef(null);
  const row2Ref = useRef(null);
  const marqueesRef = useRef([]);

  useReveal(sectionRef);

  useGSAP(
    () => {
      marqueesRef.current = [];

      // Row 1 scrolls right→left continuously (standard marquee direction).
      if (row1Ref.current) {
        marqueesRef.current.push(
          gsap.to(row1Ref.current, {
            xPercent: -50,
            duration: LOOP_SECONDS,
            ease: "none",
            repeat: -1,
          })
        );
      }

      // Row 2 scrolls left→right — starts already shifted -50% and animates
      // back up to 0%, then GSAP's repeat resets it to -50% instantly for
      // the next loop, so it always visually travels in the opposite
      // direction from Row 1.
      if (row2Ref.current) {
        gsap.set(row2Ref.current, { xPercent: -50 });
        marqueesRef.current.push(
          gsap.to(row2Ref.current, {
            xPercent: 0,
            duration: LOOP_SECONDS,
            ease: "none",
            repeat: -1,
          })
        );
      }

    },
    sectionRef,
    []
  );

  // Easing the marquee to a stop rather than hard-pausing it — a marquee
  // that stops dead under the cursor reads as a bug, not a feature.
  const setMarqueeSpeed = (value) => {
    marqueesRef.current.forEach((tween) => {
      if (tween) gsap.to(tween, { timeScale: value, duration: 0.6, ease: "power2.out" });
    });
  };

  return (
    <section
      ref={sectionRef}
      className="w-full overflow-hidden bg-white pt-[70px] pb-[90px] max-[767px]:pt-[50px] max-[767px]:pb-[60px]"
    >
      <h2
        data-reveal
        style={{ color: text.headingColor, ...typeStyle(text, "heading") }}
        className="js-gallery-head mb-[10px] text-center font-ticker text-[55px] font-medium leading-none max-[767px]:text-[34px]"
      >
        {text.heading}
      </h2>
      <p data-reveal className="js-gallery-head mb-[45px] text-center font-ticker text-[20px] italic text-[#B08D57] max-[767px]:mb-[30px] max-[767px]:text-[13px]">
        Every Piece Reflects Precision, Elegance &amp; Timeless Craftsmanship.
      </p>

      <div
        className="relative"
        onMouseEnter={() => setMarqueeSpeed(0.15)}
        onMouseLeave={() => setMarqueeSpeed(1)}
      >
        <div className="flex flex-col gap-[34px] max-[767px]:gap-[18px]">
          <div data-reveal className="js-gallery-row">
            <Row items={rowOne} ref={row1Ref} />
          </div>
          <div data-reveal className="js-gallery-row">
            <Row items={rowTwo} ref={row2Ref} />
          </div>
        </div>

        {/* Edge fades so cards dissolve into the page instead of being
            sliced off at the viewport edge. */}
        <span className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-[9%] bg-gradient-to-r from-white to-transparent max-[767px]:w-[12%]" />
        <span className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-[9%] bg-gradient-to-l from-white to-transparent max-[767px]:w-[12%]" />
      </div>
    </section>
  );
}
