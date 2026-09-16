import EditorPage from '@/features/page-content/pages/EditorPage.jsx'

/**
 * Editor > Header.
 *
 * The menu is not part of any one page — it is on all of them — so it gets a
 * screen rather than a seventh tab under Content, where it would have read as
 * belonging to whichever page was selected. Everything else (the form, the
 * saving, the colour swatches) is the same editor; only the slice of the
 * schema differs.
 */
export default function HeaderPage() {
  return (
    <EditorPage
      area="header"
      title="Header"
      subtitle="The menu at the top of the website. It is the same menu on every page, so a change here shows everywhere."
    />
  )
}
