import EditorPage from '@/features/page-content/pages/EditorPage.jsx'

/**
 * Editor > Rings.
 *
 * The spinning photographs behind every page's heading and in the band above
 * the footer are one shared library, edited here instead of once per page. The
 * Home page's two rings are the library; every other page chooses which of
 * those photographs it turns. Each photograph can be replaced, switched off,
 * colour-matched (brightness, contrast, colour strength, hue) and cropped.
 */
export default function RingsPage() {
  return (
    <EditorPage
      area="rings"
      title="Rings"
      subtitle="The spinning photographs on every page. Change a photograph here and it changes on every page that uses it; choose below which photographs each page shows, and whether they come in the same order everywhere or a random order on each page."
    />
  )
}
