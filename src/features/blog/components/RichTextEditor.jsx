import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { FontFamily } from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code, Image as ImageIcon,
  Italic, Link2, Link2Off, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting,
  Strikethrough, Underline as UnderlineIcon, Undo2, MonitorPlay,
} from 'lucide-react'

import { uploadAsset } from '@/features/media/media.api.js'
import { classNames } from '@/utils/helpers.js'

// The fonts the site actually has. Offering the usual web-safe list would let
// someone pick a face the site never loads, which renders as a fallback on
// the public page and looks like a bug rather than a choice.
const FONTS = [
  { label: 'Body (default)', value: '' },
  { label: 'Optika', value: 'Optika, serif' },
  { label: 'Ringtte', value: 'Ringtte, serif' },
  { label: 'System sans', value: 'system-ui, sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
]

// The site's palette, so a post cannot drift away from the brand. Same values
// the Editor's colour swatches use.
const COLORS = [
  { name: 'Deep teal', value: '#01383B' },
  { name: 'Teal', value: '#0B5B5D' },
  { name: 'Mid teal', value: '#286F6F' },
  { name: 'Gold', value: '#C9A15A' },
  { name: 'Bronze', value: '#B08D57' },
  { name: 'Ink', value: '#1A1A1A' },
]

const BLOCKS = [
  { label: 'Paragraph', level: 0 },
  { label: 'Heading 1', level: 1 },
  { label: 'Heading 2', level: 2 },
  { label: 'Heading 3', level: 3 },
  { label: 'Heading 4', level: 4 },
]

function ToolButton({ icon: Icon, label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        'flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40',
        active
          ? 'border-brass-500 bg-brass-500/15 text-ink-900'
          : 'border-transparent text-ink-600 hover:border-ink-100 hover:bg-ink-50'
      )}
    >
      <Icon size={15} />
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-6 w-px shrink-0 bg-ink-100" />
}

/**
 * The post editor.
 *
 * Writes HTML, which is what gets stored — but only after the SERVER has
 * sanitised it (blog.sanitize.ts). Nothing here is a security boundary: the
 * toolbar decides what is convenient to produce, the server decides what is
 * allowed to exist. The two lists are kept deliberately in step, because a
 * button that produces a tag the server strips would silently lose formatting
 * on save.
 *
 * `value` is read once on mount and whenever it changes from OUTSIDE (loading
 * a different post). Feeding every keystroke back in would reset the cursor
 * to the start of the document on every character typed.
 */
export default function RichTextEditor({ value, onChange, disabled }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const lastEmitted = useRef(value)

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Image.configure({ HTMLAttributes: { class: 'rounded-xl' } }),
      Placeholder.configure({ placeholder: 'Write the post…' }),
    ],
    content: value || '',
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML()
      lastEmitted.current = html
      onChange(html)
    },
  })

  // Only push content in when the change came from somewhere other than this
  // editor — see the note on `value` above.
  useEffect(() => {
    if (!editor) return
    if (value === lastEmitted.current) return

    lastEmitted.current = value
    editor.commands.setContent(value || '', { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  const setLink = useCallback(() => {
    if (!editor) return

    const previous = editor.getAttributes('link').href ?? ''
    const url = window.prompt('Link address (https://…)', previous)

    if (url === null) return

    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor])

  /**
   * An embed is inserted as a real <iframe>, which the server will keep only
   * if its host is on the allowlist — so the prompt accepts the URL a person
   * would actually copy (a YouTube watch link) and the server does the
   * translating and the checking.
   */
  const setEmbed = useCallback(() => {
    if (!editor) return

    const url = window.prompt(
      'Paste a YouTube, Vimeo, Instagram, Spotify or Google Maps link'
    )

    if (!url || !url.trim()) return

    editor
      .chain()
      .focus()
      .insertContent(
        `<iframe src="${url.trim().replace(/"/g, '&quot;')}" width="560" height="315" allowfullscreen title="Embedded media"></iframe><p></p>`
      )
      .run()
  }, [editor])

  const pickImage = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file || !editor) return

      setUploading(true)
      try {
        const asset = await uploadAsset(file)
        editor.chain().focus().setImage({ src: asset.url, alt: file.name }).run()
      } catch {
        window.alert('That image could not be uploaded.')
      } finally {
        setUploading(false)
      }
    },
    [editor]
  )

  if (!editor) return null

  const blockValue = BLOCKS.find((b) =>
    b.level === 0
      ? editor.isActive('paragraph')
      : editor.isActive('heading', { level: b.level })
  )

  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-100 bg-ivory-100 p-2">
        <select
          value={blockValue?.level ?? 0}
          disabled={disabled}
          onChange={(event) => {
            const level = Number(event.target.value)
            if (level === 0) editor.chain().focus().setParagraph().run()
            else editor.chain().focus().toggleHeading({ level }).run()
          }}
          className="mr-1 h-8 rounded-md border border-ink-100 bg-white px-2 text-xs text-ink-600"
        >
          {BLOCKS.map((block) => (
            <option key={block.level} value={block.level}>
              {block.label}
            </option>
          ))}
        </select>

        <select
          value={editor.getAttributes('textStyle').fontFamily ?? ''}
          disabled={disabled}
          onChange={(event) => {
            const font = event.target.value
            if (font) editor.chain().focus().setFontFamily(font).run()
            else editor.chain().focus().unsetFontFamily().run()
          }}
          className="mr-1 h-8 rounded-md border border-ink-100 bg-white px-2 text-xs text-ink-600"
        >
          {FONTS.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <Divider />

        <ToolButton icon={Bold} label="Bold" active={editor.isActive('bold')} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton icon={Italic} label="Italic" active={editor.isActive('italic')} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton icon={UnderlineIcon} label="Underline" active={editor.isActive('underline')} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolButton icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolButton icon={Code} label="Code" active={editor.isActive('code')} disabled={disabled} onClick={() => editor.chain().focus().toggleCode().run()} />

        <Divider />

        <ToolButton icon={List} label="Bulleted list" active={editor.isActive('bulletList')} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton icon={ListOrdered} label="Numbered list" active={editor.isActive('orderedList')} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolButton icon={Quote} label="Quote" active={editor.isActive('blockquote')} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolButton icon={Minus} label="Divider" disabled={disabled} onClick={() => editor.chain().focus().setHorizontalRule().run()} />

        <Divider />

        <ToolButton icon={AlignLeft} label="Align left" active={editor.isActive({ textAlign: 'left' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <ToolButton icon={AlignCenter} label="Align centre" active={editor.isActive({ textAlign: 'center' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <ToolButton icon={AlignRight} label="Align right" active={editor.isActive({ textAlign: 'right' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
        <ToolButton icon={AlignJustify} label="Justify" active={editor.isActive({ textAlign: 'justify' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('justify').run()} />

        <Divider />

        <ToolButton icon={Link2} label="Add link" active={editor.isActive('link')} disabled={disabled} onClick={setLink} />
        <ToolButton icon={Link2Off} label="Remove link" disabled={disabled || !editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()} />
        <ToolButton icon={ImageIcon} label={uploading ? 'Uploading…' : 'Insert image'} disabled={disabled || uploading} onClick={() => fileRef.current?.click()} />
        <ToolButton icon={MonitorPlay} label="Embed a video or post" disabled={disabled} onClick={setEmbed} />

        <Divider />

        {/* Text colour, then highlight. Both are limited to the site's palette
            so a post cannot introduce a colour the brand does not use. */}
        <span className="flex items-center gap-1 px-1">
          {COLORS.map((colour) => (
            <button
              key={colour.value}
              type="button"
              title={`Text: ${colour.name}`}
              aria-label={`Text colour ${colour.name}`}
              disabled={disabled}
              onClick={() => editor.chain().focus().setColor(colour.value).run()}
              style={{ backgroundColor: colour.value }}
              className="h-4 w-4 rounded-full border border-ink-100 transition-transform hover:scale-110 disabled:opacity-40"
            />
          ))}
        </span>

        <ToolButton
          icon={RemoveFormatting}
          label="Clear formatting"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        />

        <Divider />

        <ToolButton icon={Undo2} label="Undo" disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <ToolButton icon={Redo2} label="Redo" disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      </div>

      {/* pj-prose is the shared article style — the same one the public post
          page uses — so what is typed here is what appears on the site. */}
      <EditorContent
        editor={editor}
        className="pj-prose max-h-[60vh] min-h-[320px] overflow-y-auto px-5 py-4"
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={pickImage}
      />
    </div>
  )
}
