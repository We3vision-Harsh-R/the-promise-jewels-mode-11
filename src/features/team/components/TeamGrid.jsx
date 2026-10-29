import MemberCard from '@/features/team/components/MemberCard.jsx'

/** Equal-width cards: four across on a desktop, two on a tablet, one on a phone (gap is 28px). */
export const TEAM_CARD_WIDTH =
  'w-[calc((100%-84px)/4)] max-[1099px]:w-[calc((100%-28px)/2)] max-[639px]:w-full max-[639px]:max-w-[340px]'

/**
 * Every team section on the site — Our Leaders, Meet Our Team, the Our Team
 * page, a brand's team — draws its people through this, so a profile looks the
 * same wherever it appears. Cards are equal width, four to a row on a desktop, and
 * stay centred when there are fewer.
 */
export default function TeamGrid({ members, className = '' }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-[1320px] flex-wrap justify-center gap-[28px] px-[6%] max-[479px]:gap-[18px] ${className}`}
    >
      {members.map((member) => (
        <div key={member.id} className={TEAM_CARD_WIDTH}>
          <MemberCard member={member} />
        </div>
      ))}
    </div>
  )
}
