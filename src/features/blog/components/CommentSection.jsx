import { useState } from 'react'

import { addComment } from '@/features/blog/blog.api.js'

const FIELD =
  'w-full rounded-[14px] border-[1px] border-[#DCEAE7] bg-white px-[16px] py-[12px] ' +
  'font-ticker text-[0.95rem] text-[#0B5B5D] placeholder:text-[#7E9694] ' +
  'focus:border-[#C9A15A] focus:outline-none [transition:border-color_0.35s_ease]'

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * The comments under a post, and the form to add one.
 *
 * Every comment arrives held for approval, so the form says so rather than
 * appearing to fail — the commonest complaint about a moderated comment box
 * is that people think their comment vanished. Nothing typed here is ever
 * rendered as markup: the server strips it to plain text on the way in, and
 * React escapes it again on the way out.
 */
export default function CommentSection({ slug, comments }) {
  const [form, setForm] = useState({ name: '', email: '', body: '', website: '' })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()

    if (!form.name.trim() || form.body.trim().length < 2) {
      setError('Please add your name and a comment.')
      return
    }

    setSending(true)
    setError('')
    try {
      await addComment(slug, form)
      setForm({ name: '', email: '', body: '', website: '' })
      setDone(true)
    } catch (err) {
      setError(err.message || 'Your comment could not be sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mt-[48px] border-t-[1px] border-[#DCEAE7] pt-[36px]">
      <h2 className="m-0 font-ticker text-[1.8rem] font-medium text-[#01383B] max-[479px]:text-[1.4rem]">
        {comments.length > 0
          ? `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`
          : 'Comments'}
      </h2>

      {comments.length > 0 && (
        <ul className="mt-[26px] flex list-none flex-col gap-[20px] p-0">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-[20px] border-[1px] border-[#DCEAE7] bg-[#FCFDFC] p-[22px]"
            >
              <div className="flex flex-wrap items-baseline gap-x-[12px]">
                <span className="font-ticker text-[1rem] font-semibold text-[#01383B]">
                  {comment.name}
                </span>
                <span className="font-ticker text-[0.78rem] text-[#7E9694]">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              {/* Plain text, rendered as text — see the note above. */}
              <p className="mt-[8px] whitespace-pre-wrap font-ticker text-[0.98rem] leading-[1.7] text-[#43605F]">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {done ? (
        <div className="mt-[26px] rounded-[20px] border-[1px] border-[#C9A15A]/50 bg-[#FCFAF6] p-[24px] text-center">
          <p className="m-0 font-ticker text-[1rem] text-[#01383B]">
            Thank you — your comment has been sent.
          </p>
          <p className="mt-[6px] font-ticker text-[0.88rem] text-[#7E9694]">
            It will appear here once it has been approved.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-[30px]">
          <p className="mb-[16px] font-ticker text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#C9A15A]">
            Leave a comment
          </p>

          <div className="grid grid-cols-2 gap-[14px] max-[639px]:grid-cols-1">
            <input
              className={FIELD}
              placeholder="Your name"
              maxLength={80}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
            />
            <input
              className={FIELD}
              type="email"
              placeholder="Email (not published)"
              maxLength={160}
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
            />
          </div>

          <textarea
            className={`${FIELD} mt-[14px] resize-y`}
            rows={4}
            placeholder="Write your comment…"
            maxLength={2000}
            value={form.body}
            onChange={(event) => set('body', event.target.value)}
          />

          {/* A honeypot. No person sees this, so anything that fills it in is
              automated — the server files those as spam rather than rejecting
              them, which tells a bot nothing. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={form.website}
            onChange={(event) => set('website', event.target.value)}
            className="absolute h-0 w-0 overflow-hidden opacity-0"
          />

          {error && (
            <p className="mt-[10px] font-ticker text-[0.85rem] text-[#B23A2E]" role="alert">
              {error}
            </p>
          )}

          <div className="mt-[18px] flex flex-wrap items-center gap-[16px]">
            <button
              type="submit"
              disabled={sending}
              className="cursor-pointer rounded-full border-0 bg-gradient-to-b from-[#01383B] to-[#286F6F] px-[34px] py-[14px] font-ticker text-[0.95rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sending ? 'Sending…' : 'Post comment'}
            </button>
            <span className="font-ticker text-[0.82rem] text-[#7E9694]">
              Comments are checked before they appear.
            </span>
          </div>
        </form>
      )}
    </section>
  )
}
