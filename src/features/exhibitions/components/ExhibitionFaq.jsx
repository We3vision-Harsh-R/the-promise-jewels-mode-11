import { useRef, useState } from "react";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";

/**
 * FAQ accordion. Paired with the FAQPage JSON-LD in ExhibitionSchema, this
 * is the section most likely to win long-tail search traffic — people search
 * the literal questions below ("is IIJS open to the public", "where is GGJS
 * held"), and the answers can surface directly in results.
 *
 * Answers are rendered in the DOM at all times (only their height animates),
 * so crawlers read them whether or not a panel is open.
 */
export default function ExhibitionFaq({ faqs }) {
  const sectionRef = useRef(null);
  const [open, setOpen] = useState(0);
  const panelRefs = useRef([]);

  useGSAP(
    () => {
      gsap.from(".js-faq-head", {
        y: 26,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.inOut",
        scrollTrigger: { trigger: sectionRef.current, start: "top 82%" },
      });

      gsap.from(".js-faq-row", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        delay: 0.12,
        ease: "power3.inOut",
        scrollTrigger: { trigger: sectionRef.current, start: "top 82%" },
      });
    },
    sectionRef,
    []
  );

  const toggle = (index) => {
    const next = open === index ? -1 : index;
    setOpen(next);

    panelRefs.current.forEach((panel, panelIndex) => {
      if (!panel) return;
      gsap.to(panel, {
        height: panelIndex === next ? "auto" : 0,
        opacity: panelIndex === next ? 1 : 0,
        duration: 0.55,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });
  };

  return (
    <section
      ref={sectionRef}
      id="faq"
      aria-labelledby="faq-heading"
      className="w-full scroll-mt-[90px] bg-white px-[8%] py-[80px] max-[1024px]:py-[60px] max-[479px]:px-[6%] max-[479px]:py-[46px]"
    >
      <div className="mx-auto w-full max-w-[900px]">
        <span className="js-faq-head mb-[16px] flex items-center gap-[12px]">
          <span className="h-px w-[34px] bg-[#C9A15A]" />
          <span className="font-ticker text-[0.68rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#C9A15A]">
            Before You Visit
          </span>
        </span>

        <h2
          id="faq-heading"
          className="js-faq-head m-0 mb-[36px] font-ticker text-[2.4rem] font-light leading-[1.15] text-[#01383B] max-[1024px]:text-[2rem] max-[479px]:text-[1.6rem]"
        >
          Frequently asked <strong className="font-semibold">questions</strong>
        </h2>

        <div className="flex flex-col">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className="js-faq-row border-b-[1px] border-[#DCEAE7]"
            >
              <h3 className="m-0">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={open === index}
                  className="flex w-full cursor-pointer items-start justify-between gap-[20px] bg-transparent py-[22px] text-left"
                >
                  <span className="font-ticker text-[1.05rem] font-medium leading-[1.45] text-[#01383B] max-[479px]:text-[0.95rem]">
                    {faq.question}
                  </span>
                  <span
                    className={`mt-[4px] shrink-0 text-[#C9A15A] [transition:rotate_0.45s_cubic-bezier(0.22,1,0.36,1)] ${
                      open === index ? "rotate-45" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
              </h3>

              <div
                ref={(node) => {
                  panelRefs.current[index] = node;
                }}
                className={`overflow-hidden ${index === 0 ? "" : "h-0 [opacity:0]"}`}
              >
                <p className="m-0 max-w-[760px] pb-[24px] text-[0.96rem] leading-[1.75] text-[#0B5B5D]/85 max-[479px]:text-[0.9rem]">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
