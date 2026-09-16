import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check, ExternalLink, FileText, MessageSquare, Pencil, Plus, Save, Trash2, X,
} from 'lucide-react'

import * as blogApi from '@/features/blog/blog.api.js'
import { uploadAsset } from '@/features/media/media.api.js'
import RichTextEditor from '@/features/blog/components/RichTextEditor.jsx'
import { useToast } from '@/components/feedback/Toast.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import Card from '@/components/ui/Card.jsx'
import Button from '@/components/ui/Button.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Modal from '@/components/ui/Modal.jsx'
import { Field, ImageInput, Input, Textarea } from '@/components/forms/Field.jsx'
import { classNames } from '@/utils/helpers.js'

// Kept in step with slugify() on the server (blog.constants.ts). Both sides
// need the same answer: this previews the address while the title is typed,
// and the server derives the real one on save.
function slugify(input) {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const EMPTY = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverUrl: '',
  authorName: '',
  tags: [],
  status: 'draft',
  metaTitle: '',
  metaDescription: '',
  ogImageUrl: '',
  canonicalUrl: '',
  noindex: false,
}

function formatDate(value) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Marketing > Blog.
 *
 * Three things on one screen because they are one job: the posts, the form
 * that writes them, and the comments waiting on a decision. Splitting the
 * moderation queue onto its own page would hide it, and a queue nobody looks
 * at is the same as having no moderation.
 */
export default function BlogPage() {
  const { notify } = useToast()

  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [tab, setTab] = useState('posts')
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(null) // null | 'new' | post id
  const [draft, setDraft] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, queue] = await Promise.all([
        blogApi.listPosts(),
        blogApi.listComments(),
      ])
      setPosts(rows ?? [])
      setComments(queue ?? [])
    } catch (err) {
      notify(err.message || 'Could not load the blog.', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    load()
  }, [load])

  const pending = useMemo(
    () => comments.filter((c) => c.status === 'pending').length,
    [comments]
  )

  // ---- Post form ----

  function openNew() {
    setDraft(EMPTY)
    setEditing('new')
  }

  async function openEdit(post) {
    try {
      const full = await blogApi.getPost(post.id)
      setDraft({
        ...EMPTY,
        ...full,
        excerpt: full.excerpt ?? '',
        coverUrl: full.coverUrl ?? '',
        authorName: full.authorName ?? '',
        metaTitle: full.metaTitle ?? '',
        metaDescription: full.metaDescription ?? '',
        ogImageUrl: full.ogImageUrl ?? '',
        canonicalUrl: full.canonicalUrl ?? '',
        tags: full.tags ?? [],
      })
      setEditing(post.id)
    } catch (err) {
      notify(err.message || 'Could not open that post.', { tone: 'error' })
    }
  }

  function set(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save(status) {
    if (!draft.title.trim()) {
      notify('Give the post a title first.', { tone: 'error' })
      return
    }

    const payload = { ...draft, status: status ?? draft.status }

    setSaving(true)
    try {
      if (editing === 'new') {
        await blogApi.createPost(payload)
        notify(status === 'published' ? 'Post published.' : 'Draft saved.')
      } else {
        await blogApi.updatePost(editing, payload)
        notify(status === 'published' ? 'Post published.' : 'Post saved.')
      }
      setEditing(null)
      await load()
    } catch (err) {
      notify(err.message || 'Could not save the post.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function removePost(post) {
    try {
      await blogApi.deletePost(post.id)
      notify('Post deleted.')
      await load()
    } catch (err) {
      notify(err.message || 'Could not delete that post.', { tone: 'error' })
    } finally {
      setConfirm(null)
    }
  }

  // ---- Comments ----

  async function moderate(comment, status) {
    try {
      await blogApi.setCommentStatus(comment.id, status)
      setComments((current) =>
        current.map((c) => (c.id === comment.id ? { ...c, status } : c))
      )
    } catch (err) {
      notify(err.message || 'Could not update that comment.', { tone: 'error' })
    }
  }

  async function removeComment(comment) {
    try {
      await blogApi.deleteComment(comment.id)
      setComments((current) => current.filter((c) => c.id !== comment.id))
      notify('Comment deleted.')
    } catch (err) {
      notify(err.message || 'Could not delete that comment.', { tone: 'error' })
    } finally {
      setConfirm(null)
    }
  }

  const previewSlug = draft.slug || slugify(draft.title) || 'post'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Blog</h1>
          <p className="text-sm text-ink-400">
            Write and publish posts, and approve the comments readers leave on
            them.
          </p>
        </div>

        <Button onClick={openNew} icon={Plus}>
          New post
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('posts')}
            className={classNames(
              'rounded-xl border px-4 py-2 text-sm transition-colors',
              tab === 'posts'
                ? 'border-brass-500 bg-brass-500/10 font-medium text-ink-900'
                : 'border-ink-100 text-ink-600 hover:bg-ink-50'
            )}
          >
            Posts
            <span className="ml-2 text-[11px] text-ink-400">{posts.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('comments')}
            className={classNames(
              'rounded-xl border px-4 py-2 text-sm transition-colors',
              tab === 'comments'
                ? 'border-brass-500 bg-brass-500/10 font-medium text-ink-900'
                : 'border-ink-100 text-ink-600 hover:bg-ink-50'
            )}
          >
            Comments
            {pending > 0 && (
              <span className="ml-2 rounded-full bg-brass-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {pending}
              </span>
            )}
          </button>

          <a
            href="/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 self-center text-sm text-brass-700 underline-offset-4 hover:underline"
          >
            View the blog
            <ExternalLink size={12} />
          </a>
        </div>
      </Card>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-ink-400">Loading…</p>
        </Card>
      ) : tab === 'posts' ? (
        <PostList
          posts={posts}
          onEdit={openEdit}
          onDelete={(post) =>
            setConfirm({
              kind: 'post',
              target: post,
              title: 'Delete this post?',
              body: `“${post.title}” and every comment on it will be removed. This cannot be undone.`,
            })
          }
          onNew={openNew}
        />
      ) : (
        <CommentQueue
          comments={comments}
          onModerate={moderate}
          onDelete={(comment) =>
            setConfirm({
              kind: 'comment',
              target: comment,
              title: 'Delete this comment?',
              body: 'It will be removed permanently.',
            })
          }
        />
      )}

      <Modal
        open={editing !== null}
        onClose={() => (saving ? null : setEditing(null))}
        title={editing === 'new' ? 'New post' : 'Edit post'}
        subtitle={`/blog/${previewSlug}`}
        icon={FileText}
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => save('draft')} loading={saving}>
              Save as draft
            </Button>
            <Button onClick={() => save('published')} loading={saving} icon={Save}>
              Publish
            </Button>
          </div>
        }
      >
        <PostForm draft={draft} set={set} disabled={saving} previewSlug={previewSlug} />
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title}
        description={confirm?.body}
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm?.kind === 'post'
            ? removePost(confirm.target)
            : removeComment(confirm.target)
        }
      />
    </div>
  )
}

/** The list of posts, drafts included. */
function PostList({ posts, onEdit, onDelete, onNew }) {
  if (posts.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-100 py-12 text-center">
          <FileText size={22} className="text-ink-400" />
          <p className="mt-2 text-sm font-medium text-ink-900">No posts yet</p>
          <p className="max-w-md text-sm text-ink-400">
            Write the first one — it will appear on the blog as soon as you
            publish it.
          </p>
          <Button className="mt-4" onClick={onNew} icon={Plus}>
            New post
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <div className="space-y-2">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 p-3"
          >
            <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-ivory-100">
              {post.coverUrl && (
                <img src={post.coverUrl} alt="" className="h-full w-full object-cover" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-900">
                {post.title}
              </span>
              <span className="block truncate text-xs text-ink-400">
                /blog/{post.slug} · {formatDate(post.publishedAt ?? post.createdAt)}
                {post._count?.comments ? ` · ${post._count.comments} comments` : ''}
              </span>
            </span>

            <Badge tone={post.status === 'published' ? 'emerald' : 'ink'}>
              {post.status}
            </Badge>

            <span className="flex gap-1.5">
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(post)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={() => onDelete(post)}
              >
                Delete
              </Button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Comments waiting on a decision, and the ones already decided. */
function CommentQueue({ comments, onModerate, onDelete }) {
  if (comments.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-100 py-12 text-center">
          <MessageSquare size={22} className="text-ink-400" />
          <p className="mt-2 text-sm font-medium text-ink-900">No comments yet</p>
          <p className="max-w-md text-sm text-ink-400">
            Comments left on a post appear here first. Nothing shows on the site
            until you approve it.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-xl border border-ink-100 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink-900">{comment.name}</span>
              {comment.email && (
                <span className="text-xs text-ink-400">{comment.email}</span>
              )}
              <Badge
                tone={
                  comment.status === 'approved'
                    ? 'emerald'
                    : comment.status === 'spam'
                      ? 'rose'
                      : 'amber'
                }
              >
                {comment.status}
              </Badge>
              <span className="ml-auto text-xs text-ink-400">
                on “{comment.post?.title}” · {formatDate(comment.createdAt)}
              </span>
            </div>

            {/* Rendered as text, never as markup — the body is stored as plain
                text and stays that way here. */}
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">
              {comment.body}
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {comment.status !== 'approved' && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Check}
                  onClick={() => onModerate(comment, 'approved')}
                >
                  Approve
                </Button>
              )}
              {comment.status !== 'spam' && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => onModerate(comment, 'spam')}
                >
                  Mark as spam
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={() => onDelete(comment)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** The post form: the writing, then the settings, then the SEO. */
function PostForm({ draft, set, disabled, previewSlug }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Title" className="md:col-span-2">
          <Input
            value={draft.title}
            maxLength={200}
            disabled={disabled}
            onChange={(event) => set('title', event.target.value)}
          />
        </Field>

        <Field
          label="Web address"
          hint={`Leave empty to use /blog/${previewSlug}`}
        >
          <Input
            value={draft.slug}
            maxLength={80}
            placeholder={previewSlug}
            disabled={disabled}
            onChange={(event) => set('slug', event.target.value)}
          />
        </Field>

        <Field label="Author">
          <Input
            value={draft.authorName}
            maxLength={120}
            disabled={disabled}
            onChange={(event) => set('authorName', event.target.value)}
          />
        </Field>

        <Field
          label="Summary"
          hint="Shown on the blog list and used as the search description if you leave that empty."
          className="md:col-span-2"
        >
          <Textarea
            rows={2}
            value={draft.excerpt}
            maxLength={400}
            disabled={disabled}
            onChange={(event) => set('excerpt', event.target.value)}
          />
        </Field>

        <Field label="Cover photograph">
          <ImageInput
            value={draft.coverUrl}
            fallback=""
            disabled={disabled}
            onPick={async (file) => {
              const asset = await uploadAsset(file)
              set('coverUrl', asset.url)
            }}
            onClear={() => set('coverUrl', '')}
          />
        </Field>

        <Field label="Tags" hint="Separated by commas.">
          <Input
            value={(draft.tags ?? []).join(', ')}
            disabled={disabled}
            onChange={(event) =>
              set(
                'tags',
                event.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 12)
              )
            }
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brass-700">
          The post
        </p>
        <RichTextEditor
          value={draft.content}
          disabled={disabled}
          onChange={(html) => set('content', html)}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brass-700">
          Search engines
        </p>
        <p className="mb-3 text-sm text-ink-400">
          How this post appears in search results and when someone shares its
          link. Leave a field empty and the post&apos;s own title and summary
          are used.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Search title" hint="Around 60 characters reads best.">
            <Input
              value={draft.metaTitle}
              maxLength={200}
              placeholder={draft.title}
              disabled={disabled}
              onChange={(event) => set('metaTitle', event.target.value)}
            />
          </Field>

          <Field label="Canonical address" hint="Only if this was published elsewhere first.">
            <Input
              value={draft.canonicalUrl}
              maxLength={500}
              disabled={disabled}
              onChange={(event) => set('canonicalUrl', event.target.value)}
            />
          </Field>

          <Field
            label="Search description"
            hint="Around 155 characters reads best."
            className="md:col-span-2"
          >
            <Textarea
              rows={2}
              value={draft.metaDescription}
              maxLength={320}
              placeholder={draft.excerpt}
              disabled={disabled}
              onChange={(event) => set('metaDescription', event.target.value)}
            />
          </Field>

          <Field
            label="Sharing image"
            hint="Shown when the link is posted to social media. Defaults to the cover."
          >
            <ImageInput
              value={draft.ogImageUrl}
              fallback={draft.coverUrl}
              disabled={disabled}
              onPick={async (file) => {
                const asset = await uploadAsset(file)
                set('ogImageUrl', asset.url)
              }}
              onClear={() => set('ogImageUrl', '')}
            />
          </Field>

          <Field label="Hide from search engines">
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={Boolean(draft.noindex)}
                disabled={disabled}
                onChange={(event) => set('noindex', event.target.checked)}
                className="h-4 w-4 accent-brass-500"
              />
              Ask search engines not to list this post
            </label>
          </Field>
        </div>
      </div>
    </div>
  )
}
