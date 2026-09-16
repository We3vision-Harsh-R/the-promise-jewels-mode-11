import request from '@/services/api/client.js'

// The blog.
//
// No mock branch: this feature was built against the real backend and only
// makes sense against it — the posts, the comments and the uploaded images
// all live in the database.

// ---- Public (used by the website, no auth) ----

/** Published posts, newest first. */
export function listPublicPosts() {
  return request('/blog/public')
}

/** One published post, with its approved comments. */
export function getPublicPost(slug) {
  return request(`/blog/public/${encodeURIComponent(slug)}`)
}

/** Leaves a comment. It is held for approval, so it will not appear at once. */
export function addComment(slug, payload) {
  return request(`/blog/public/${encodeURIComponent(slug)}/comments`, {
    method: 'POST',
    body: payload,
  })
}

// ---- Admin ----

/** Every post including drafts. Pass a status to narrow it. */
export function listPosts(status) {
  return request(status ? `/blog?status=${encodeURIComponent(status)}` : '/blog')
}

export function getPost(id) {
  return request(`/blog/${id}`)
}

export function createPost(payload) {
  return request('/blog', { method: 'POST', body: payload })
}

export function updatePost(id, payload) {
  return request(`/blog/${id}`, { method: 'PUT', body: payload })
}

export function deletePost(id) {
  return request(`/blog/${id}`, { method: 'DELETE' })
}

// ---- Admin: comment moderation ----

export function listComments(status) {
  return request(
    status ? `/blog/comments?status=${encodeURIComponent(status)}` : '/blog/comments'
  )
}

export function setCommentStatus(id, status) {
  return request(`/blog/comments/${id}`, { method: 'PUT', body: { status } })
}

export function deleteComment(id) {
  return request(`/blog/comments/${id}`, { method: 'DELETE' })
}
