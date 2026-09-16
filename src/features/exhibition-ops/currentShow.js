/**
 * Which show the operations pages are working on.
 *
 * The ten operations screens are all about ONE exhibition — "Leads" with no
 * show chosen is not a question anyone is asking. But they are sidebar
 * entries now, and a sidebar link cannot ask which show you meant.
 *
 * So the last show opened is remembered, and the sidebar points its
 * operations links at it. The URL still names the show
 * (/admin/exhibitions/<id>/ops/leads) rather than relying on the memory —
 * that keeps a link shareable, a tab bookmarkable and the back button honest.
 * The memory only decides where the SIDEBAR points.
 *
 * In localStorage rather than on the account: it is a preference about one
 * person's last position on one machine, and it is not worth a column.
 * Every access is wrapped because a private window throws on the accessor.
 */
const KEY = 'pj-admin-current-show'

export function readCurrentShow() {
  try {
    return window.localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}

export function rememberCurrentShow(id) {
  try {
    if (id) window.localStorage.setItem(KEY, id)
  } catch {
    // Nothing to do. The operations links fall back to the Shows list, which
    // is where somebody would go to pick one anyway.
  }
}

