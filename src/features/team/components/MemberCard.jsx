import { useState } from 'react'

/** "Bharat Jogani" -> "BJ". Shown when a person has no photograph. */
function initialsOf(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('') || '•'
  )
}

/**
 * One person: photograph, role, name and an optional line about them, inside
 * the same gold hairline and teal scrim as the Leaders and Collection cards, so
 * the page reads as part of the same site.
 */
export default function MemberCard({ member }) {
  // A saved address that no longer resolves must not show the browser's broken
  // picture glyph — fall back to the initials instead.
  const [failed, setFailed] = useState(false)
  const showPhoto = Boolean(member.photoUrl) && !failed

  return (
    <article
      data-reveal
      className="group relative w-[calc((100%-78px)/4)] max-[1199px]:w-[calc((100%-52px)/3)] max-[991px]:w-[calc((100%-20px)/2)] max-[479px]:w-[calc((100%-12px)/2)] overflow-hidden rounded-[26px] bg-[#01383B] [aspect-ratio:3/4] shadow-[0_24px_50px_-18px_rgba(1,56,59,0.5)] [transition:box-shadow_0.55s_ease,translate_0.55s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[6px] hover:shadow-[0_34px_62px_-18px_rgba(1,56,59,0.6)] max-[479px]:rounded-[18px]"
    >
      {showPhoto ? (
        <img
          src={member.photoUrl}
          alt={`${member.name}, ${member.designation}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover object-top [transition:transform_0.9s_cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#2F6B6B_0%,#01484C_55%,#01383B_100%)] font-ticker text-[4.2rem] font-light tracking-[0.08em] text-[#E8CB92]/80 max-[479px]:text-[3rem]"
        >
          {initialsOf(member.name)}
        </span>
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#01383B] via-[#01383B]/65 to-transparent" />
      <span className="pointer-events-none absolute inset-[13px] rounded-[17px] border-[1px] border-[#C9A15A]/35 max-[479px]:inset-[9px] max-[479px]:rounded-[12px]" />

      <div className="absolute inset-x-0 bottom-0 p-[26px] max-[767px]:p-[22px] max-[479px]:p-[16px]">
        <span className="flex items-center gap-[10px]">
          <span className="h-px w-[22px] shrink-0 bg-[#C9A15A]" />
          <span className="font-ticker text-[0.62rem] font-medium uppercase tracking-[0.24em] text-[#E8CB92] max-[479px]:text-[0.56rem]">
            {member.designation}
          </span>
        </span>

        <h3 className="m-0 mt-[9px] font-ticker text-[1.35rem] font-medium leading-[1.2] text-white max-[767px]:text-[1.2rem] max-[479px]:text-[1.02rem]">
          {member.name}
        </h3>

        {member.bio ? (
          <p className="m-0 mt-[9px] font-ticker text-[0.82rem] leading-[1.55] text-white/75 max-[479px]:hidden">
            {member.bio}
          </p>
        ) : null}
      </div>
    </article>
  )
}
