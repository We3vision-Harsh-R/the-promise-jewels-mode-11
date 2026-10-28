/**
 * Logos are often uploaded as a big square with the mark floating in a sea of
 * white. This trims the empty margin (transparent or near-white pixels) and
 * gives back a cropped copy as a data address, so the mark itself fills the
 * space it is drawn in. If the picture cannot be read (a host that does not
 * allow it) or has nothing to trim, the original address is returned.
 *
 * Results are remembered per address, so a logo is measured once.
 */
const trimmed = new Map();

export function trimMargin(src) {
  if (trimmed.has(src)) return trimmed.get(src);

  const job = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
        const w = Math.max(1, Math.round(image.naturalWidth * scale));
        const h = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        let left = w, top = h, right = -1, bottom = -1;
        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 4;
            const solid = data[i + 3] > 24 && (data[i] < 215 || data[i + 1] < 215 || data[i + 2] < 215);
            if (!solid) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }

        if (right < 0) return resolve(src);

        const pad = Math.round(Math.max(w, h) * 0.02);
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(w - 1, right + pad);
        bottom = Math.min(h - 1, bottom + pad);

        const cw = right - left + 1;
        const ch = bottom - top + 1;
        // Barely any margin to remove — keep the original.
        if (cw * ch > w * h * 0.8) return resolve(src);

        const out = document.createElement("canvas");
        out.width = cw;
        out.height = ch;
        out.getContext("2d").drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL("image/png"));
      } catch {
        resolve(src);
      }
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });

  trimmed.set(src, job);
  return job;
}
