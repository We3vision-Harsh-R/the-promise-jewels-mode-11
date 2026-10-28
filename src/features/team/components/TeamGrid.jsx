import MemberCard from '@/features/team/components/MemberCard.jsx'

/** The width of one card: large enough to read a face and a name, never wider than the screen. */
export const TEAM_CARD_WIDTH = 'w-[300px] max-w-full max-[639px]:w-[340px]'

/**
 * Every team section on the site — Our Leaders, Meet Our Team, the Our Team
 * page, a brand's team — draws its people through this, so a profile looks the
 * same wherever it appears. Cards are large, sit in as many columns as fit, and
 * stay centred when there are only one or two.
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
