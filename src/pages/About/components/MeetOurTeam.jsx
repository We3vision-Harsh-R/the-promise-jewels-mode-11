import { useMemo, useRef, useState } from "react";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import usePublicTeam from "@/features/team/hooks/usePublicTeam.js";
import MemberCard from "@/features/team/components/MemberCard.jsx";
import CategoryTabs from "@/features/team/components/CategoryTabs.jsx";
import { DEFAULT_CATEGORY } from "@/features/team/categories.js";

// Bundled copy — the fallback, and the list of keys this section reads.
const TEAM_TEXT = {
  heading: "Meet Our Team",
  headingColor: "#01383B",
  emptyText: "Our team will be introduced here soon.",
};

/**
 * "Meet Our Team" on the About page: the people filed as team members (not
 * leaders) in Admin > Our Team, switched between Promise Jewels and Netram.
 * Hidden people are not sent by the server, and the order is the one set there.
 */
export default function MeetOurTeam() {
  const text = useSectionContent("about", "team", TEAM_TEXT);
  const { members, loading } = usePublicTeam();
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const sectionRef = useRef(null);

  useReveal(sectionRef);

  const people = useMemo(
    () => members.filter((member) => member.kind === "team" && member.category === category),
    [members, category]
  );

  const [lead, ...rest] = (text.heading || "").split(" ");

  return (
    <section
      id="meet-team"
      ref={sectionRef}
      className="w-full overflow-hidden bg-white pt-[30px] pb-[100px] max-[767px]:pt-[10px] max-[767px]:pb-[64px]"
    >
      <h2
        data-reveal
        style={{
          backgroundImage: `linear-gradient(180deg, ${text.headingColor} 0%, #286F6F 100%)`,
          ...typeStyle(text, "heading"),
        }}
        className="mb-[40px] text-center font-ticker text-[48px] font-light leading-none bg-clip-text text-transparent [-webkit-text-fill-color:transparent] max-[767px]:mb-[28px] max-[767px]:text-[32px]"
      >
        {lead}
        {rest.length ? <span className="font-semibold"> {rest.join(" ")}</span> : null}
      </h2>

      <CategoryTabs value={category} onChange={setCategory} label="Team by company" />

      <div
        key={category}
        className="mx-auto flex w-full max-w-[1200px] flex-wrap justify-center gap-[26px] px-[8%] [animation:pj-tab-in_0.45s_ease_both] max-[991px]:gap-[20px] max-[479px]:gap-[12px] max-[479px]:px-[6%]"
      >
        {people.length === 0 && !loading ? (
          <p className="m-0 py-[30px] text-center font-ticker text-[1.05rem] text-[#2F6B6B]">{text.emptyText}</p>
        ) : (
          people.map((member) => <MemberCard key={member.id} member={member} />)
        )}
      </div>
    </section>
  );
}
