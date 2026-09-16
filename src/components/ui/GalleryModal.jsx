import { Trash2, ImagePlus } from 'lucide-react'
import Modal from '@/components/ui/Modal.jsx'
import Button from '@/components/ui/Button.jsx'

export default function GalleryModal({ open, onClose, title, subtitle, images = [], uploading, onUpload, onDelete }) {
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = ''
  }

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} size="lg" footer={<Button variant="ghost" size="sm" onClick={onClose}>Done</Button>}>
      <div className="space-y-4">
        <div className="relative rounded-md border border-dashed border-ink-100 p-6 text-center hover:border-ink-300 transition-colors">
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={handleFileChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <div className="flex flex-col items-center gap-1.5">
            <ImagePlus size={18} className="text-ink-400" />
            <p className="text-sm text-ink-600">{uploading ? 'Uploading…' : 'Click or drop an image to add it'}</p>
            <p className="text-xs text-ink-400">PNG, JPG, WEBP up to 5MB</p>
          </div>
        </div>

        {images.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">No gallery images yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md border border-ink-100">
                <img src={img.image_url} alt={img.alt_text || ''} className="h-full w-full object-cover" />
                <button
                  onClick={() => onDelete(img.id)}
                  aria-label="Delete image"
                  className="absolute top-1.5 right-1.5 rounded-md bg-ink-900/70 p-1.5 text-white opacity-100 group-hover:opacity-100 transition-opacity hover:bg-rose"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}