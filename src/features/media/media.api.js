import request from '@/services/api/client.js'

// Media library + hero frame publishing.
//
// There is no mock branch here: this feature only makes sense against the
// real backend (it uploads files to storage and writes rows the public site
// reads), and it was built after the backend module, so it never had a
// mock phase to keep in step with.

// ---- Library ----

export function listAssets() {
  return request('/media/assets')
}

export function uploadAsset(file) {
  const form = new FormData()
  // Field name must be "image" — that is what upload.single("image") in
  // upload.middleware.ts reads.
  form.append('image', file)

  return request('/media/assets', { method: 'POST', body: form })
}

export function deleteAsset(id) {
  return request(`/media/assets/${id}`, { method: 'DELETE' })
}

// ---- Sections ----

export function listSections() {
  return request('/media/sections')
}

// ---- Frames ----
//
// A frame ("slot") is one numbered picture holder in a hero ring. Frames are
// numbered from 1 and every one of them comes back from listSlots, filled or
// empty, so the admin can work through them in order.

export function listSectionSlots(section) {
  return request(`/media/sections/${section}/slots`)
}

/** Points frame `slot` at an image already in the library. Goes live at once. */
export function setSlotImage(section, slot, assetId) {
  return request(`/media/sections/${section}/slots/${slot}`, {
    method: 'PUT',
    body: { assetId },
  })
}

/** Upload a new file straight into one frame — library add + publish in one call. */
export function uploadToSlot(section, slot, file) {
  const form = new FormData()
  form.append('image', file)

  return request(`/media/sections/${section}/slots/${slot}`, {
    method: 'POST',
    body: form,
  })
}

/** Empties the frame — the site falls back to its bundled photo for it. */
export function clearSlot(section, slot) {
  return request(`/media/sections/${section}/slots/${slot}`, {
    method: 'DELETE',
  })
}

// ---- Public (used by the website, no auth) ----

export function getPublicSections() {
  return request('/media/public/sections')
}
