import { useEffect, useState } from 'react'

import * as brandService from '@/features/brands/brand.api.js'
import TeamVisibility from '@/features/team/components/TeamVisibility.jsx'

// For each brand, which people from Our Team stand behind it. Stored as one
// JSON object, { brandId: "personId,personId" }, so a brand added tomorrow needs
// no new field. A brand with nobody ticked shows no team section on its page.

function parse(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export default function BrandTeamsControl({ value, disabled, onChange }) {
  const [brands, setBrands] = useState(null)
  const [error, setError] = useState('')
  const chosen = parse(value)

  useEffect(() => {
    let alive = true
    brandService
      .listBrands()
      .then((rows) => alive && setBrands(rows || []))
      .catch((err) => alive && setError(err.message || 'Could not load the brands.'))
    return () => {
      alive = false
    }
  }, [])

  function change(brandId, ids) {
    const next = { ...chosen }
    if (ids) next[brandId] = ids
    else delete next[brandId]
    onChange(JSON.stringify(next))
  }

  if (error) return <p className="m-0 text-xs text-rose">{error}</p>
  if (!brands) return <p className="m-0 text-xs text-ink-400">Loading brands…</p>
  if (brands.length === 0) {
    return <p className="m-0 text-xs text-ink-400">No brands yet. Add a brand under Brands first.</p>
  }

  return (
    <div className="space-y-5">
      {brands.map((brand) => (
        <div key={brand.id} className="rounded-xl border border-ink-100 bg-white p-3">
          <p className="m-0 mb-2 text-sm font-semibold text-emerald-600">{brand.name}</p>
          <TeamVisibility
            value={chosen[brand.id] || ''}
            disabled={disabled}
            mode="show"
            kind="all"
            onChange={(ids) => change(brand.id, ids)}
          />
        </div>
      ))}
    </div>
  )
}
