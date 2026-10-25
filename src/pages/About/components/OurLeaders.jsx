import { useRef, useMemo, useState } from "react";
import { typeStyle } from "@/features/page-content/typeStyle.js";
import useReveal from "@/hooks/useReveal.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";
import usePublicTeam from "@/features/team/hooks/usePublicTeam.js";
import CategoryTabs from "@/features/team/components/CategoryTabs.jsx";
import { DEFAULT_CATEGORY } from "@/features/team/categories.js";

// Replace with the real leaders / photos — same name repeated 3x here as a
// placeholder since that's what the reference screenshot showed.
const LEADERS = [
  {
    name: "Bharat Jogani",
    title: "Founder",
    description:
      "Leading with vision, building trust, and crafting excellence in every creation.",
    image: "/images/OurLeaders/image_142.webp",
  },
  {
    name: "Bharat Jogani",
    title: "Founder",
    description:
      "Leading with vision, building trust, and crafting excellence in every creation.",
    image: "/images/OurLeaders/image_143.webp",
  },
  {
    name: "Bharat Jogani",
    title: "Founder",
    description:
      "Leading with vision, building trust, and crafting excellence in every creation.",
    image: "/images/OurLeaders/image_144.webp",
  },
];

// Bundled copy — the fallback, and the list of keys this section reads.
const LEADERS_TEXT = {
  heading: "Our Leaders",
  headingColor: "#01383B",
  nameColor: "#01383B",
  roleColor: "#C9A15A",
  bodyColor: "#2F6B6B",
  emptyText: "Our leaders will be introduced here soon.",
};

// The cards used to start stacked and fanned (x/y offsets plus rotation) and
// open into the row on scroll. That timeline was played AND reversed by
// scroll direction, so scrolling through the section quickly could leave the
// cards frozen mid-fan — overlapping and rotated on top of each other.
// Replaced with a straight blur-and-rise reveal: no offsets to get stuck in,
// and identical on every screen size.

function LeaderCard({ leader }) {
  return (
    <div
      data-reveal
      className="group relative shrink-0 overflow-hidden rounded-[28px] bg-[#01383B] shadow-[0_26px_54px_-12px_rgba(1,56,59,0.45)] [transition:box-shadow_0.55s_ease] hover:shadow-[0_34px_66px_-12px_rgba(1,56,59,0.55)] h-[430px] w-[330px] min-[768px]:max-[1024px]:h-[360px] min-[768px]:max-[1024px]:w-[270px] max-[767px]:h-[440px] max-[767px]:w-full max-[767px]:max-w-[360px] max-[767px]:rounded-[24px]"
    >
      {leader.image ? (
        <img
          src={leader.image}
          alt={leader.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-top [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#2F6B6B_0%,#01484C_55%,#01383B_100%)] font-ticker text-[4.2rem] font-light text-[#E8CB92]/80"
        >
          {(leader.name || "•").slice(0, 1).toUpperCase()}
        </span>
      )}

      {/* Teal scrim instead of the old black one — the black read as a stock
          photo overlay and sat outside the palette. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#01383B] via-[#01383B]/62 to-transparent" />

      {/* Gold hairline inset, same treatment as the brand + collection cards */}
      <div className="pointer-events-none absolute inset-[14px] rounded-[18px] border-[1px] border-[#C9A15A]/35 max-[767px]:inset-[11px] max-[767px]:rounded-[15px]" />

      <div className="absolute inset-x-0 bottom-0 p-[30px] max-[767px]:p-[26px]">
        <span className="flex items-center gap-[10px]">
          <span className="h-px w-[24px] bg-[#C9A15A]" />
          <span
            style={leader.titleType}
            className="font-ticker text-[0.62rem] font-medium tracking-[0.26em] uppercase text-[#E8CB92]"
          >
            {leader.title}
          </span>
        </span>

        <p
          style={leader.nameType}
          className="mt-[10px] font-ticker text-[1.4rem] font-medium leading-[1.2] text-white max-[767px]:text-[1.3rem]"
        >
          {leader.name}
        </p>

        {leader.description ? (
          <p
            style={leader.descriptionType}
            className="mt-[12px] font-ticker text-[0.85rem] leading-[1.6] text-white/75 max-[767px]:text-[0.82rem]"
          >
            {leader.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function OurLeaders() {
  // The people, their words and their photographs, from the Editor.
  const text = useSectionContent("about", "leaders", LEADERS_TEXT);
  const [headingLead, ...headingTail] = (text.heading || "").split(" ");
  const headingRest = headingTail.join(" ");

  // The people come from Admin > Our Team, narrowed to the ones ticked under
  // Content > About > Our leaders. The bundled three only stand in while the
  // list loads or when nobody is listed at all.
  const { members, loading } = usePublicTeam();

  // Promise Jewels / Netram. Each tab shows only the leaders filed under it
  // (Admin > Our Team), in the order set there.
  const [category, setCategory] = useState(DEFAULT_CATEGORY);

  // The bundled three only stand in while nobody has been added at all.
  const nobodyYet = !loading && members.length === 0;

  const leaders = useMemo(() => {
    if (nobodyYet) return LEADERS;

    return members
      .filter((member) => member.kind === "leader" && member.category === category)
      .map((member) => ({
        id: member.id,
        name: member.name,
        title: member.designation,
        description: member.bio || "",
        image: member.photoUrl || "",
      }));
  }, [members, nobodyYet, category]);

  const sectionRef = useRef(null);

  // Site-wide reveal — same blur/rise/fade as every other section, driven by
  // hooks/useReveal.js so all pages share one entrance.
  useReveal(sectionRef);

  return (
    <section
      id="team"
      ref={sectionRef}
      className="w-full overflow-hidden bg-white pt-[70px] pb-[100px] max-[767px]:pt-[50px] max-[767px]:pb-[64px]"
    >
      {/* The design sets the first word light and the rest semibold. The
          heading is one editable string, so it is split on the first space
          rather than hard-coded — an admin renaming this section keeps the
          same two-weight treatment instead of losing it. */}
      <h2
        data-reveal
        style={{
          backgroundImage: `linear-gradient(180deg, ${text.headingColor} 0%, #286F6F 100%)`,
          ...typeStyle(text, "heading"),
        }}
        className="js-leaders-head mb-[55px] text-center font-ticker text-[48px] font-light leading-none bg-clip-text text-transparent [-webkit-text-fill-color:transparent] max-[767px]:mb-[34px] max-[767px]:text-[32px]"
      >
        {headingLead}
        {headingRest ? <span className="font-semibold font-ticker"> {headingRest}</span> : null}
      </h2>

      {!nobodyYet && <CategoryTabs value={category} onChange={setCategory} label="Leaders by company" />}

      {/* Keyed by tab so a switch replays the fade-in. */}
      <div
        key={category}
        className="flex flex-wrap items-center justify-center gap-[30px] px-[6%] [animation:pj-tab-in_0.45s_ease_both] max-[1024px]:gap-[20px] max-[767px]:flex-col max-[767px]:gap-[22px] max-[767px]:px-[8%]"
      >
        {leaders.length === 0 && !loading ? (
          <p className="m-0 py-[30px] text-center font-ticker text-[1.05rem] text-[#2F6B6B]">{text.emptyText}</p>
        ) : (
          leaders.map((leader, index) => (
            <LeaderCard key={leader.id ?? `${leader.name}-${index}`} leader={leader} />
          ))
        )}
      </div>
    </section>
  );
}
