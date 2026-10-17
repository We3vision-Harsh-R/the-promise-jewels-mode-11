// Writes src/assets/styles/bootstrap.pruned.css: bootstrap.min.css without the
// class rules nothing in src/ (or index.html) can use. Rules with no class in
// the selector (reboot: html, body, :root, @keyframes...) are always kept.
// A class is kept if its name appears as a word anywhere in the source.
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const root = process.cwd()
const src = path.join(root, 'src')
const tokens = new Set()
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?|tsx?|html|css)$/.test(e.name) && !e.name.includes('bootstrap.pruned')) {
      for (const t of fs.readFileSync(p, 'utf8').match(/[A-Za-z0-9_-]+/g) || []) tokens.add(t)
    }
  }
}
walk(src)
for (const t of fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/[A-Za-z0-9_-]+/g) || []) tokens.add(t)

const css = fs.readFileSync(path.join(root, 'node_modules/bootstrap/dist/css/bootstrap.min.css'), 'utf8')
const ast = postcss.parse(css)
let kept = 0, dropped = 0
const droppedSelectors = []
const keepSel = (sel) => {
  const classes = [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])
  return classes.every((c) => tokens.has(c))
}
ast.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
  droppedSelectors.push(...rule.selectors.filter((x) => !keepSel(x)))
  const sels = rule.selectors.filter(keepSel)
  if (!sels.length) { rule.remove(); dropped++ } else { rule.selectors = sels; kept++ }
})
ast.walkAtRules((a) => { if (a.nodes && !a.nodes.length) a.remove() })
const out = ast.toString()
fs.writeFileSync(path.join(src, 'assets/styles/bootstrap.pruned.css'), out)
if (process.env.DROPPED_OUT) fs.writeFileSync(process.env.DROPPED_OUT, JSON.stringify(droppedSelectors))
console.log({ kept, dropped, inKB: (css.length / 1024) | 0, outKB: (out.length / 1024) | 0 })
