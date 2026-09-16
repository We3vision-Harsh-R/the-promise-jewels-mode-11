import { useRef } from "react";
import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import { formatRange, getRange, getStatus } from "@/features/exhibitions/data/exhibitions.js";

/**
 * At-a-glance schedule table, directly under the hero.
 *
 * This exists for the visitor who arrives from search wanting one thing:
 * "where can I meet them, and when". Answering that above the fold — before
 * the long per-show sections — is also what keeps the page from reading as
 * three brochures stacked on top of each other.
 */
export default function ExhibitionSchedule({ exhibitions }) {
  const sectionRef = useRef(null);

  useGSAP(
    () => {
      gsap.from(".js-sched-head", {
        y: 26,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.inOut",
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%" },
      });

      gsap.from(".js-sched-row", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        delay: 0.15,
        ease: "power3.inOut",
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%" },
      });
    },
    sectionRef,
    []
  );

  return (
    <section
      ref={sectionRef}
      id="schedule"
      aria-labelledby="schedule-heading"
      className="w-full scroll-mt-[90px] bg-[#F6FAF9] px-[8%] py-[80px] max-[1024px]:py-[60px] max-[479px]:px-[6%] max-[479px]:py-[46px]"
    >
      <div className="mx-auto w-full max-w-[1240px]">
        <span className="js-sched-head mb-[16px] flex items-center gap-[12px]">
          <span className="h-px w-[34px] bg-[#C9A15A]" />
          <span className="font-ticker text-[0.68rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#C9A15A]">
            2026 – 2027 Season
          </span>
        </span>

        <h2
          id="schedule-heading"
          className="js-sched-head m-0 max-w-[760px] font-ticker text-[2.6rem] font-light leading-[1.15] text-[#01383B] max-[1024px]:text-[2.1rem] max-[479px]:text-[1.7rem]"
        >
          Where to meet{" "}
          <strong className="font-semibold">Promise Jewels</strong>
        </h2>

        <p className="js-sched-head mt-[16px] max-w-[680px] text-[1rem] leading-[1.75] text-[#0B5B5D]/80 max-[479px]:text-[0.92rem]">
          We exhibit at India's major gem and jewellery trade shows through the
          year. Every show below is business-to-business — bring your trade
          credentials, and book a slot in advance so we can set aside time.
        </p>

        <div className="mt-[42px] overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b-[1px] border-[#DCEAE7]">
                {["Exhibition", "Dates", "City & Venue", "Status"].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="pb-[14px] font-ticker text-[0.64rem] max-[479px]:text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#0B5B5D]/55"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exhibitions.map((exhibition) => {
                const status = getStatus(exhibition);
                const { start, end } = getRange(exhibition);

                return (
                  <tr
                    key={exhibition.id}
                    className="js-sched-row border-b-[1px] border-[#E8F0EE] align-top"
                  >
                    <th scope="row" className="py-[20px] pr-[24px] font-normal">
                      <a
                        href={`#${exhibition.id}`}
                        className="font-ticker text-[1.02rem] font-medium text-[#01383B] no-underline [transition:color_0.4s_ease] hover:text-[#C9A15A]"
                      >
                        {exhibition.name}
                      </a>
                      <span className="mt-[4px] block text-[0.76rem] text-[#7E9694]">
                        {exhibition.edition}
                      </span>
                    </th>

                    <td className="py-[20px] pr-[24px] text-[0.92rem] text-[#0B5B5D]">
                      <time dateTime={start.toISOString().slice(0, 10)}>
                        {formatRange(start, end)}
                      </time>
                      {!exhibition.datesConfirmed && (
                        <span className="mt-[4px] block text-[0.72rem] text-[#B23A2E]">
                          To be confirmed
                        </span>
                      )}
                    </td>

                    <td className="py-[20px] pr-[24px] text-[0.92rem] text-[#0B5B5D]">
                      <span className="block font-medium text-[#01383B]">
                        {exhibition.city}
                      </span>
                      {exhibition.venues.map((venue) => (
                        <span key={venue.name} className="block text-[0.82rem] text-[#7E9694]">
                          {venue.name}
                        </span>
                      ))}
                    </td>

                    <td className="py-[20px] text-[0.92rem]">
                      <span
                        className={`inline-block rounded-full border-[1px] px-[12px] py-[5px] text-[0.64rem] max-[479px]:text-[0.7rem] font-medium uppercase tracking-[0.14em] ${
                          status.key === "live"
                            ? "border-[#C9A15A] bg-[#C9A15A] text-white"
                            : status.key === "past"
                            ? "border-[#E1E7E6] bg-[#F2F4F4] text-[#7C8F8C]"
                            : "border-[#D3E6E2] bg-white text-[#0B5B5D]"
                        }`}
                      >
                        {status.key === "upcoming"
                          ? `In ${status.days} days`
                          : status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
