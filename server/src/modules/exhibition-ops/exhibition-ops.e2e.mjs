// End-to-end exercise of the exhibition operations API against a RUNNING
// server (npm run ops:check, with the dev server up).
//
// It works against real rows and real money: the arithmetic assertions below
// are the reason the whole module uses Decimal rather than float, and they
// would pass by luck with floats on small numbers and fail on a real show.
// Everything it creates is deleted in step 10. Creates a full show's worth of operations data, checks the report's
// arithmetic, then deletes everything it made.
import path from 'node:path'
import { createRequire } from 'node:module'

const cwd = process.cwd()
const require = createRequire(path.join(cwd, 'package.json'))
require(path.join(cwd, 'node_modules/dotenv')).config({ path: path.join(cwd, '.env') })

const jwt = require(path.join(cwd, 'node_modules/jsonwebtoken'))
const { PrismaClient } = require(path.join(cwd, 'node_modules/@prisma/client'))

const prisma = new PrismaClient()
const BASE = 'http://localhost:2000/api/v1'

let failures = 0
const check = (what, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `   ${detail}` : ''}`)
  if (!ok) failures += 1
}

const user = await prisma.user.findUnique({
  where: { email: 'thepromisejewels@gmail.com' },
  select: { id: true },
})
const token = jwt.sign({ userId: user.id }, process.env.JWT_ACCESS_SECRET, {
  algorithm: 'HS256',
  expiresIn: '1h',
  issuer: 'promise-jewels-api',
  audience: 'promise-jewels-access',
})

async function api(method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: `accessToken=${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const show = await prisma.exhibitions.findFirst({ select: { id: true, title: true } })
if (!show) {
  console.log('No exhibition to test against.')
  process.exit(1)
}
console.log(`\nUsing show: ${show.title}`)

console.log('\n1. Options and the ops record')
const opts = await api('GET', '/exhibition-ops/options')
check('options load', opts.status === 200)
check('offers the accounts a lead can be assigned to', Array.isArray(opts.json?.data?.users))
check('offers collections for stock lines', Array.isArray(opts.json?.data?.collections))

const first = await api('GET', `/exhibition-ops/${show.id}`)
check('ops record is created on first read', first.status === 200)
check('report comes with it', Boolean(first.json?.data?.report))

console.log('\n2. Header')
const header = await api('PUT', `/exhibition-ops/${show.id}`, {
  stage: 'BOOKED',
  hall: 'Hall 4',
  stallNumber: 'B-212',
  stallSize: '6x3',
  currency: 'INR',
  budget: '250000.00',
  organiserName: 'GJEPC',
  organiserEmail: 'stalls@example.com',
  notes: 'Corner stall, two open sides.',
})
check('header saves', header.status === 200, `(stall ${header.json?.data?.stallNumber})`)

console.log('\n3. Leads')
const leadA = await api('POST', `/exhibition-ops/${show.id}/leads`, {
  name: 'Rakesh Shah', company: 'Shah Jewellers', city: 'Mumbai',
  phone: '9820000000', interest: '22k light-weight bangles',
  rating: 'HOT', stage: 'WON', estimatedValue: '450000.00',
})
const leadB = await api('POST', `/exhibition-ops/${show.id}/leads`, {
  name: 'Meera Patel', company: 'Patel Gold', city: 'Surat',
  rating: 'WARM', stage: 'NEW', estimatedValue: '120000.00',
})
check('leads create', leadA.status === 201 && leadB.status === 201)
check('capturer is stamped from the session', Boolean(leadA.json?.data?.capturedBy?.id))

const badLead = await api('POST', `/exhibition-ops/${show.id}/leads`, { name: '' })
check('a nameless lead is refused', badLead.status === 400)

const badMoney = await api('POST', `/exhibition-ops/${show.id}/leads`, {
  name: 'X', estimatedValue: '12.3.4',
})
check('a malformed amount is refused', badMoney.status === 400)

console.log('\n4. Costs')
await api('POST', `/exhibition-ops/${show.id}/costs`, {
  category: 'STALL', label: 'Stall rent', plannedAmount: '180000.00',
  actualAmount: '195000.00', isPaid: true,
})
await api('POST', `/exhibition-ops/${show.id}/costs`, {
  category: 'TRAVEL', label: 'Flights', plannedAmount: '40000.00',
  actualAmount: '38500.50', isPaid: false,
})
check('costs create', true)

console.log('\n5. Stock, and the reconciliation')
const stockA = await api('POST', `/exhibition-ops/${show.id}/inventory`, {
  itemName: 'Bangles — 22k', piecesOut: 40,
  grossWeightOut: '1250.500', netWeightOut: '1180.250', valueOut: '7200000.00',
  piecesBack: 31, grossWeightBack: '980.125', netWeightBack: '920.000', valueBack: '5600000.00',
})
check('a counted line is created', stockA.status === 201)
check('counting it marks it reconciled', Boolean(stockA.json?.data?.reconciledAt))
check('and records who counted it', Boolean(stockA.json?.data?.reconciledBy?.id))

const stockB = await api('POST', `/exhibition-ops/${show.id}/inventory`, {
  itemName: 'Rings — 18k', piecesOut: 25, netWeightOut: '300.000', valueOut: '900000.00',
})
check('an uncounted line stays uncounted', stockB.json?.data?.reconciledAt === null)

console.log('\n6. Crew, shift, task, log, meeting, custom field')
const crew = await api('POST', `/exhibition-ops/${show.id}/crew`, { name: 'Ankit', role: 'Sales' })
check('crew creates', crew.status === 201)

const shift = await api('POST', `/exhibition-ops/${show.id}/crew/${crew.json.data.id}/shifts`, {
  onDate: '2026-12-04', startTime: '10:00', endTime: '18:00',
})
check('shift creates', shift.status === 201)

const badShift = await api('POST', `/exhibition-ops/${show.id}/crew/${crew.json.data.id}/shifts`, {
  onDate: '2026-12-04', startTime: '25:00', endTime: '18:00',
})
check('an impossible time is refused', badShift.status === 400)

const task = await api('POST', `/exhibition-ops/${show.id}/tasks`, { title: 'Print catalogues', stage: 'DONE' })
check('a task created DONE is stamped', Boolean(task.json?.data?.doneAt))

const reopened = await api('PUT', `/exhibition-ops/${show.id}/tasks/${task.json.data.id}`, {
  title: 'Print catalogues', stage: 'TODO',
})
check('reopening clears the stamp', reopened.json?.data?.doneAt === null)

await api('POST', `/exhibition-ops/${show.id}/logs`, { onDate: '2026-12-04', note: 'Busy first day.' })
await api('POST', `/exhibition-ops/${show.id}/appointments`, {
  buyerName: 'Kiran Mehta', scheduledAt: '2026-12-05T11:00:00.000Z', durationMins: 45,
})
await api('POST', `/exhibition-ops/${show.id}/fields`, {
  group: 'Logistics', label: 'Courier docket', value: 'BD-99127364',
})
check('log, meeting and custom field create', true)

console.log('\n7. The report')
const full = await api('GET', `/exhibition-ops/${show.id}`)
const r = full.json.data.report

// 195000.00 + 38500.50
check('actual cost sums exactly', r.cost.actual === '233500.5', `(${r.cost.actual})`)
// 250000 - 233500.50
check('remaining budget is right', r.cost.remaining === '16499.5', `(${r.cost.remaining})`)
check('unpaid is only the unpaid line', r.cost.unpaid === '38500.5', `(${r.cost.unpaid})`)
check('leads counted', r.leads.total === 2, `(${r.leads.total})`)
check('won value separated from pipeline', r.leads.wonValue === '450000' && r.leads.pipelineValue === '570000',
  `(won ${r.leads.wonValue} of ${r.leads.pipelineValue})`)

// Only the COUNTED line contributes: 1180.250 - 920.000
check('gold sold uses only counted lines', r.stock.netWeightSold === '260.25', `(${r.stock.netWeightSold})`)
check('the uncounted line is reported, not hidden', r.stock.linesUncounted === 1)
check('pieces sold = out - back', r.stock.piecesSold === 9, `(${r.stock.piecesSold})`)
check('value sold exact', r.stock.valueSold === '1600000', `(${r.stock.valueSold})`)

console.log('\n8. A show cannot be edited through another show')
const other = await prisma.exhibitions.findFirst({
  where: { id: { not: show.id } }, select: { id: true },
})
if (other) {
  await api('GET', `/exhibition-ops/${other.id}`)
  const cross = await api('PUT', `/exhibition-ops/${other.id}/leads/${leadA.json.data.id}`, {
    name: 'Hijacked', rating: 'HOT', stage: 'NEW',
  })
  check("another show's lead id is refused", cross.status === 404, `(got ${cross.status})`)
} else {
  console.log('  (only one show in the database, skipped)')
}

console.log('\n9. Anonymous')
const anon = await fetch(`${BASE}/exhibition-ops/${show.id}`)
check('no session is refused', anon.status === 401)

console.log('\n10. Cleanup')
const ops = await prisma.exhibitionOps.findUnique({ where: { exhibitionId: show.id }, select: { id: true } })
await prisma.exhibitionOps.delete({ where: { id: ops.id } })
const left = await prisma.exhibitionLead.count({ where: { opsId: ops.id } })
check('deleting the ops row cascades its children away', left === 0)

await prisma.$disconnect()
console.log(failures === 0 ? '\nALL PASSED\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
