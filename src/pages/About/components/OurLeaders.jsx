import { useMemo, useRef, useState } from "react";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import useTeamSection from "@/features/team/hooks/useTeamSection.js";
import CategoryTabs from "@/features/team/components/CategoryTabs.jsx";
import TeamGrid from "@/features/team/components/TeamGrid.jsx";
import { DEFAULT_CATEGORY } from "@/features/team/categories.js";

// Stand in only while nobody has been added in Admin > Our Team at all.
const PLACEHOLDERS = [
  {
    id: "placeholder-1",
    name: "Bharat Jogani",
    designation: "Founder",
    bio: "Leading with vision, building trust, and crafting excellence in every creation.",
    photoUrl: "/images/OurLeaders/image_142.webp",
  },
  {
    id: "placeholder-2",
    name: "Bharat Jogani",
    designation: "Founder",
    bio: "Leading with vision, building trust, and crafting excellence in every creation.",
    photoUrl: "/images/OurLeaders/image_143.webp",
  },
  {
    id: "placeholder-3",
    name: "Bharat Jogani",
    designation: "Founder",
    bio: "Leading with vision, building trust, and crafting excellence in every creation.",
    photoUrl: "/images/OurLeaders/image_144.webp",
  },
];

// Bundled copy — the fallback, and the list of keys this section reads.
// `hiddenIds` is the people whose eye is closed for this section in the Editor.
const LEADERS_TEXT = {
  heading: "Our Leaders",
  headingColor: "#01383B",
  emptyText: "Our leaders will be introduced here soon.",
  hiddenIds: "",
};

/**
 * "Our Leaders" on the About page.
 *
 * The people are the ones Admin > Our Team files as leaders, switched between
 * Promise Jewels and Netram; the Editor decides which of them this section
 * shows (an open eye shows them, a closed eye hides them from this section
 * only). They are drawn with the same card as every other team section.
 */
export default function OurLeaders() {
  const text = useSectionContent("about", "leaders", LEADERS_TEXT);
  const [headingLead, ...headingTail] = (text.heading || "").split(" ");
  const headingRest = headingTail.join(" ");

  const { members, everyone, loading } = useTeamSection("leader", text.hiddenIds);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);

  const nobodyYet = !loading && everyone.length === 0;

  const leaders = useMemo(
    () => (nobodyYet ? PLACEHOLDERS : members.filter((member) => member.category === category)),
    [members, nobodyYet, category]
  );

  const sectionRef = useRef(null);
  useReveal(sectionRef);

  return (
    <section
      id="team"
      ref={sectionRef}
      className="w-full overflow-hidden bg-white pt-[70px] pb-[100px] max-[767px]:pt-[50px] max-[767px]:pb-[64px]"
    >
      {/* The design sets the first word light and the rest semibold. The
          heading is one editable string, so it is split on the first space. */}
      <h2
        data-reveal
        style={{
          backgroundImage: `linear-gradient(180deg, ${text.headingColor} 0%, #286F6F 100%)`,
          ...typeStyle(text, "heading"),
        }}
        className="js-leaders-head mb-[40px] text-center font-ticker text-[48px] font-light leading-none bg-clip-text text-transparent [-webkit-text-fill-color:transparent] max-[767px]:mb-[28px] max-[767px]:text-[32px]"
      >
        {headingLead}
        {headingRest ? <span className="font-semibold font-ticker"> {headingRest}</span> : null}
      </h2>

      {!nobodyYet && <CategoryTabs value={category} onChange={setCategory} label="Leaders by company" />}

      {/* Keyed by tab so a switch replays the fade-in. */}
      <div key={category} className="[animation:pj-tab-in_0.45s_ease_both]">
        {leaders.length === 0 && !loading ? (
          <p className="m-0 py-[30px] text-center font-ticker text-[1.05rem] text-[#2F6B6B]">{text.emptyText}</p>
        ) : (
          <TeamGrid members={leaders} />
        )}
      </div>
    </section>
  );
}
