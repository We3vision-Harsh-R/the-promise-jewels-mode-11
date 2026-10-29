import { useState } from 'react'
import prepareImage from '@/utils/prepareImage.js'

const MAX_BYTES = 5 * 1024 * 1024

// The dashed "click or drop" picker used by the admin's image forms. Each picked
// file is shrunk in the browser first (see prepareImage), then handed to
// `onFiles`; a file that is not an image or is still over 5 MB is named in an
// error instead of failing silently later.
export default function ImageDrop({ label, multiple = false, onFiles }) {
  const [error, setError] = useState('')

  async function pick(event) {
    const input = event.target
    const chosen = Array.from(input.files || [])
    input.value = ''
    if (!chosen.length) return

    const ready = []
    const problems = []
    for (const file of chosen) {
      if (!file.type.startsWith('image/')) {
        problems.push(`${file.name} is not an image.`)
        continue
      }
      const prepared = await prepareImage(file)
      if (prepared.size > MAX_BYTES) problems.push(`${file.name} is over 5 MB.`)
      else ready.push(prepared)
    }

    setError(problems.join(' '))
    if (ready.length) onFiles(ready)
  }

  return (
    <div>
      <div className="relative rounded-3xl border border-dashed border-white/25 bg-white/10 p-6 text-center backdrop-blur-sm transition-colors hover:border-[#D8C287B3]">
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={pick}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <p className="text-sm text-ink-600">{label}</p>
        <p className="mt-1 text-xs text-brass-700">PNG, JPG, WEBP up to 5MB</p>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose">{error}</p>}
    </div>
  )
}
