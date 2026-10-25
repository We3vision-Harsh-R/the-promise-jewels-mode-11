import { TEAM_CATEGORIES } from '@/features/team/categories.js'

/**
 * The Promise Jewels / Netram switch above a list of people. Controlled: the
 * section owns which tab is active and filters its own list with it.
 */
export default function CategoryTabs({ value, onChange, label = 'Company' }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mx-auto mb-[40px] flex w-fit max-w-full items-center gap-[6px] rounded-full border border-[#DCEAE7] bg-white p-[5px] shadow-[0_10px_30px_-18px_rgba(1,56,59,0.45)] max-[479px]:mb-[28px]"
    >
      {TEAM_CATEGORIES.map((category) => {
        const active = category.key === value

        return (
          <button
            key={category.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(category.key)}
            className={`rounded-full px-[26px] py-[10px] font-ticker text-[0.92rem] font-medium tracking-[0.02em] transition-colors duration-300 max-[479px]:px-[16px] max-[479px]:py-[8px] max-[479px]:text-[0.8rem] ${
              active
                ? 'bg-[#01383B] text-white shadow-[0_8px_18px_-8px_rgba(1,56,59,0.7)]'
                : 'text-[#2F6B6B] hover:text-[#01383B]'
            }`}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}
