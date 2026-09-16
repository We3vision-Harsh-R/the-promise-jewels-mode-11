import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import { gsap, ScrollTrigger } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import { scrollToTarget } from "@/utils/scroll.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";

const PILLARS = [
  {
    title: "Innovation",
    icon: "/images/icons/innovation.svg",
    description:
      "We continuously develop new jewelry designs, advanced manufacturing techniques, and modern production processes to meet evolving market trends.",
  },
  {
    title: "Customer Satisfaction",
    icon: "/images/icons/Customer satisfaction.svg",
    description:
      "Every piece of jewelry is crafted with precision to ensure superior quality, timely delivery, and complete customer satisfaction.",
  },
  {
    title: "Superior Quality",
    icon: "/images/icons/Superior Quality.svg",
    description:
      "As a trusted gold jewelry manufacturer, we maintain strict quality standards using premium materials, skilled craftsmanship, and advanced manufacturing technology.",
  },
  {
    title: "Transparency & Ethics",
    icon: "/images/icons/Transparency & Ethics.svg",
    description:
      "We believe in honest business practices, ethical sourcing, and long-term partnerships built on trust and integrity.",
  },
  {
    title: "Employee Well-being",
    icon: "/images/icons/Employee well-being.svg",
    description:
      "Our people are our greatest strength. We foster a safe, collaborative, and growth-oriented workplace that encourages innovation and excellence.",
  },
];

const COUNT = PILLARS.length;

// Bundled copy — the fallback, and the list of keys this section reads.
const VALUES_TEXT = {
  titleColor: "#01383B",
  bodyColor: "#2F6B6B",
  iconColor: "#C9A15A",
  ...Object.fromEntries(
    PILLARS.flatMap((p, i) => [
      [`items.${i + 1}.title`, p.title],
      [`items.${i + 1}.description`, p.description],
      [`items.${i + 1}.icon`, p.icon],
    ])
  ),
};
const DIAL_BREAKPOINT = 768;

// Dial geometry is DERIVED from the measured box rather than hardcoded — a
// fixed radius is what made the old version distort at sizes it wasn't
// designed at. Radius scales with the dial's height, the circle's rightmost
// point is pinned to the dial's right edge, and the angle between pillars is
// solved from the arc length so the five always fill the available height.
const RADIUS_FACTOR = 1.25;
const RADIUS_MIN = 380;
// Where the arc's rightmost point sits inside the dial box. The labels grow
// rightward from their dot, so this has to leave the full column width for
// the longest title ("Customer Satisfaction") — parking the arc on the right
// edge instead pushes that text straight into the copy beside it.
const ARC_RIGHT = 26;

export default function OurPillars() {
  // Every value on this list — its words, its icon and the three shades — is
  // Editor content (Admin > Editor > About page > What we stand for). PILLARS
  // below stays as the fallback and fixes how many values there are.
  const text = useSectionContent("about", "values", VALUES_TEXT);
  const pillars = useMemo(
    () =>
      PILLARS.map((pillar, index) => ({
        ...pillar,
        title: text[`items.${index + 1}.title`] || pillar.title,
        description: text[`items.${index + 1}.description`] || pillar.description,
        icon: text[`items.${index + 1}.icon`] || pillar.icon,
        // Each value's heading and copy carry their own typography.
        titleType: typeStyle(text, `items.${index + 1}.title`),
        descriptionType: typeStyle(text, `items.${index + 1}.description`),
      })),
    [text]
  );

  const [active, setActive] = useState(0);

  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const dialRef = useRef(null);
  const circleRef = useRef(null);
  const labelRefs = useRef([]);
  const contentRef = useRef(null);
  // Continuous 0..1 scroll position through the section. Kept in a ref, not
  // state: it updates every scroll frame and re-rendering at that rate would
  // stutter. Only the rounded `active` index goes through state.
  const progress = useRef(0);

  const layoutDial = useCallback(() => {
    const dial = dialRef.current;
    if (!dial) return;

    const { height } = dial.getBoundingClientRect();
    if (!height) return;

    const radius = Math.max(height * RADIUS_FACTOR, RADIUS_MIN);
    // Circle centre sits far off to the left so only a gentle arc shows,
    // with its rightmost point landing at ARC_RIGHT inside the box.
    const centreX = ARC_RIGHT - radius;
    const centreY = height / 2;

    // Arc length between neighbours -> angle, so spacing stays even at any
    // height instead of bunching up or running off the top and bottom.
    const spacing = height / (COUNT + 0.6);
    const step = spacing / radius;

    gsap.set(circleRef.current, {
      width: radius * 2,
      height: radius * 2,
      x: centreX - radius,
      y: centreY - radius,
    });

    const head = progress.current * (COUNT - 1);

    labelRefs.current.forEach((label, index) => {
      if (!label) return;

      const theta = (index - head) * step;
      const distance = Math.abs(index - head);

      gsap.set(label, {
        x: centreX + radius * Math.cos(theta),
        y: centreY + radius * Math.sin(theta),
        yPercent: -50,
        rotation: (theta * 180) / Math.PI,
        transformOrigin: "0% 50%",
        opacity: Math.max(0.16, 1 - distance * 0.34),
        scale: Math.max(0.76, 1 - distance * 0.1),
      });
    });
  }, []);

  useGSAP(
    () => {
      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: () =>
          "+=" +
          window.innerHeight *
            (COUNT - 1) *
            (window.innerWidth >= DIAL_BREAKPOINT ? 0.85 : 0.65),
        pin: pinRef.current,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: layoutDial,
        onUpdate: (self) => {
          progress.current = self.progress;
          // Written straight to the DOM on each frame — the dial tracks the
          // scrollbar 1:1, which is what makes the rotation feel continuous
          // rather than stepped.
          layoutDial();

          const index = Math.round(self.progress * (COUNT - 1));
          setActive((current) => (current === index ? current : index));
        },
      });

      layoutDial();
      return () => trigger.kill();
    },
    sectionRef,
    []
  );

  // Re-solve the geometry whenever the box can have changed.
  useEffect(() => {
    const dial = dialRef.current;
    if (!dial || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", layoutDial);
      return () => window.removeEventListener("resize", layoutDial);
    }

    const observer = new ResizeObserver(layoutDial);
    observer.observe(dial);
    return () => observer.disconnect();
  }, [layoutDial]);

  // Content swap.
  useEffect(() => {
    if (!contentRef.current) return;

    gsap.fromTo(
      contentRef.current.querySelectorAll(".js-pillar-copy"),
      { y: 22, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        overwrite: "auto",
      }
    );
  }, [active]);

  const goTo = useCallback((index) => {
    const start = ScrollTrigger.getAll().find(
      (trigger) => trigger.trigger === sectionRef.current
    );
    if (!start) return;

    const target =
      start.start + (start.end - start.start) * (index / (COUNT - 1));
    scrollToTarget(target);
  }, []);

  const current = PILLARS[active];

  return (
    <section id="story" ref={sectionRef} className="relative w-full bg-white">
      <div
        ref={pinRef}
        className="flex min-h-screen w-full items-center overflow-hidden px-[6%] py-[60px] max-[767px]:px-[7%] max-[767px]:py-[48px]"
      >
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[300px_1fr] items-center gap-[70px] max-[1024px]:grid-cols-[240px_1fr] max-[1024px]:gap-[40px] max-[767px]:grid-cols-1 max-[767px]:gap-[30px]">
          {/* DIAL — measured, so the circle stays a true circle at any size */}
          <div
            ref={dialRef}
            className="relative h-[520px] w-full max-[1024px]:h-[440px] max-[767px]:hidden"
          >
            <div
              ref={circleRef}
              className="pointer-events-none absolute left-0 top-0 rounded-full border-[1px] border-[#01383B]/15"
            />

            {pillars.map((pillar, index) => (
              <button
                key={pillar.title}
                type="button"
                ref={(node) => {
                  labelRefs.current[index] = node;
                }}
                onClick={() => goTo(index)}
                className="absolute left-0 top-0 flex items-center gap-[11px] whitespace-nowrap will-change-transform"
              >
                <span
                  className={`shrink-0 rounded-full [transition:width_0.5s_ease,height_0.5s_ease,background-color_0.5s_ease,box-shadow_0.5s_ease] ${
                    index === active
                      ? "h-[9px] w-[9px] bg-[#C9A15A] shadow-[0_0_12px_rgba(201,161,90,0.75)]"
                      : "h-[5px] w-[5px] bg-[#B7C6C6]"
                  }`}
                />
                <span
                  style={pillar.titleType}
                  className={`font-ticker [transition:color_0.5s_ease,font-size_0.5s_ease] ${
                    index === active
                      ? "text-[19px] font-semibold text-[#01383B]"
                      : "text-[15px] font-normal text-[#7E9694]"
                  }`}
                >
                  {pillar.title}
                </span>
              </button>
            ))}
          </div>

          {/* MOBILE RAIL — the arc needs horizontal room the phone doesn't
              have, so below 768px it becomes a step rail instead of being
              dropped entirely the way the old version did. */}
          <div className="hidden max-[767px]:block">
            <span className="mb-[14px] block font-ticker text-[11px] font-semibold tracking-[0.3em] uppercase text-[#C9A15A]">
              Our Pillars
            </span>
            <div className="flex items-center gap-[8px]">
              {pillars.map((pillar, index) => (
                <button
                  key={pillar.title}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={pillar.title}
                  className={`h-[3px] flex-1 rounded-full [transition:background-color_0.5s_ease] ${
                    index <= active ? "bg-[#C9A15A]" : "bg-[#DCEAE7]"
                  }`}
                />
              ))}
            </div>
            <span className="mt-[10px] block font-ticker text-[12px] tabular-nums text-[#7E9694]">
              {String(active + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
            </span>
          </div>

          {/* CONTENT */}
          <div ref={contentRef} className="min-w-0">
            <span className="js-pillar-copy mb-[22px] flex items-center gap-[12px] max-[767px]:mb-[16px]">
              <span className="h-px w-[34px] bg-[#C9A15A]" />
              <span className="font-ticker text-[11px] font-semibold tracking-[0.3em] uppercase text-[#C9A15A] max-[767px]:hidden">
                Our Pillars
              </span>
            </span>

            <h3 className="js-pillar-copy m-0 font-ticker text-[38px] font-medium leading-[1.15] text-[#01383B] max-[1024px]:text-[30px] max-[767px]:text-[24px]">
              {current.title}
            </h3>

            <p className="js-pillar-copy mt-[20px] max-w-[560px] text-[17px] leading-[1.75] text-[#43605F] max-[1024px]:text-[16px] max-[767px]:mt-[14px] max-[767px]:text-[15px]">
              {current.description}
            </p>

            <div className="js-pillar-copy mt-[34px] flex h-[96px] w-[96px] items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,#01484C_0%,#2F6B6B_100%)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_12px_22px_rgba(0,0,0,0.18),0_0_24px_rgba(201,161,90,0.24)] max-[767px]:mt-[24px] max-[767px]:h-[72px] max-[767px]:w-[72px] max-[767px]:rounded-[18px]">
              <img
                src={current.icon}
                alt=""
                width={46}
                height={46}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
