// Shrinks a picked photograph in the browser before it is uploaded: at most
// MAX_SIDE pixels on the long side, as WEBP. Phone photos are several megabytes
// and can be rejected by the host's request-size limit long before the server
// sees them; a 2000px WEBP is a few hundred KB. A file that cannot be decoded
// (or an SVG) is returned unchanged and the server makes the final call.
const MAX_SIDE = 2000
const QUALITY = 0.85

export default async function prepareImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
    if (!blob || (scale === 1 && blob.size >= file.size)) return file

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}
