import EditorPage from '@/features/page-content/pages/EditorPage.jsx'

/**
 * Editor > Footer.
 *
 * Same reasoning as the Header screen beside it: the footer sits on every
 * page, so it is edited once here rather than repeated across the page tabs
 * where six copies could drift apart.
 */
export default function FooterPage() {
  return (
    <EditorPage
      area="footer"
      title="Footer"
      subtitle="The footer at the bottom of the website — its links, its colours and the scrolling line across the very bottom. It is the same footer on every page, so a change here shows everywhere."
    />
  )
}
