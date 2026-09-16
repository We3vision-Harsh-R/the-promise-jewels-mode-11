/**
 * What each operations module looks like, as data.
 *
 * Nine of the ten modules are the same screen: a list of rows, a form to add
 * one, the same form to edit it, and a delete. Writing nine of those by hand
 * would be nine places for a bug to differ and nine forms to keep consistent
 * with the server's validation. They are declared here instead and rendered by
 * one component.
 *
 * `kind` is the API path segment AND the key in the API response, so a
 * module needs no wiring beyond this entry.
 *
 * `slug` is what appears in the address bar. They differ where the API name
 * is not what a person would type: inventory -> stock, appointments ->
 * meetings, logs -> log. Renaming a table should not rename a bookmark.
 *
 * Field types map to real controls in OpsTable.jsx:
 *   text · textarea · select · date · datetime · time · number
 *   money  — a decimal string, never a JS number (see below)
 *   weight — the same, to three places
 *   check  — a boolean
 *   user / collection — a picker filled from the server's options
 *
 * MONEY AND WEIGHT STAY STRINGS ALL THE WAY.
 *
 * They are typed as strings, held in state as strings, sent as strings and
 * stored as Postgres `decimal`. The moment one becomes a JS number it is a
 * double, and a double cannot hold 0.1. For a business reconciling gold to the
 * milligram that is not a rounding artefact, it is missing stock.
 */

export const MODULES = [
  {
    kind: 'leads',
    slug: 'leads',
    label: 'Leads',
    blurb:
      'The buyers met at the stall. This is why you exhibit — everything else on this screen is in service of it.',
    addLabel: 'Add a lead',
    empty: 'Nobody captured yet.',
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'company', label: 'Company' },
      { key: 'city', label: 'City' },
      { key: 'rating', label: 'Rating', badge: true },
      { key: 'stage', label: 'Stage', badge: true },
      { key: 'estimatedValue', label: 'Value', money: true, align: 'right' },
      { key: 'assignedTo', label: 'With', user: true },
      { key: 'followUpAt', label: 'Follow up', date: true },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { key: 'company', label: 'Company', type: 'text', max: 160 },
      { key: 'city', label: 'City', type: 'text', max: 80 },
      { key: 'country', label: 'Country', type: 'text', max: 80 },
      { key: 'phone', label: 'Phone', type: 'text', max: 40 },
      { key: 'email', label: 'Email', type: 'text', max: 160 },
      {
        key: 'interest',
        label: 'What they were looking at',
        type: 'textarea',
        max: 1000,
        hint: 'Free text — "22k light-weight bangles" beats any dropdown.',
        full: true,
      },
      { key: 'rating', label: 'Rating', type: 'select', options: 'leadRatings' },
      { key: 'stage', label: 'Stage', type: 'select', options: 'leadStages' },
      { key: 'estimatedValue', label: 'Roughly worth', type: 'money' },
      { key: 'assignedToId', label: 'Assigned to', type: 'user' },
      { key: 'followUpAt', label: 'Follow up on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', max: 5000, full: true },
    ],
    blank: { name: '', rating: 'WARM', stage: 'NEW' },
  },

  {
    kind: 'costs',
    slug: 'costs',
    label: 'Costs',
    blurb: 'What the show was budgeted to cost and what it actually cost, line by line.',
    addLabel: 'Add a cost',
    empty: 'No costs recorded.',
    columns: [
      { key: 'label', label: 'What', primary: true },
      { key: 'category', label: 'Category', badge: true },
      { key: 'vendor', label: 'Vendor' },
      { key: 'plannedAmount', label: 'Planned', money: true, align: 'right' },
      { key: 'actualAmount', label: 'Actual', money: true, align: 'right' },
      { key: 'isPaid', label: 'Paid', bool: true },
    ],
    fields: [
      { key: 'label', label: 'What is it', type: 'text', required: true, max: 160 },
      { key: 'category', label: 'Category', type: 'select', options: 'costCategories' },
      { key: 'vendor', label: 'Vendor', type: 'text', max: 160 },
      { key: 'plannedAmount', label: 'Planned', type: 'money' },
      { key: 'actualAmount', label: 'Actual', type: 'money' },
      { key: 'isPaid', label: 'Paid', type: 'check' },
      { key: 'paidAt', label: 'Paid on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', max: 2000, full: true },
    ],
    blank: { label: '', category: 'OTHER', isPaid: false },
  },

  {
    kind: 'inventory',
    slug: 'stock',
    label: 'Stock',
    blurb:
      'What went to the stall and what came back. Fill in the "back" figures and the line counts itself as reconciled — the report only totals lines that have been counted.',
    addLabel: 'Add a stock line',
    empty: 'Nothing listed as carried.',
    columns: [
      { key: 'itemName', label: 'Item', primary: true },
      { key: 'sku', label: 'SKU' },
      { key: 'piecesOut', label: 'Pcs out', align: 'right' },
      { key: 'piecesBack', label: 'Pcs back', align: 'right' },
      { key: 'netWeightOut', label: 'Net out', weight: true, align: 'right' },
      { key: 'netWeightBack', label: 'Net back', weight: true, align: 'right' },
      { key: 'reconciledAt', label: 'Counted', date: true },
    ],
    fields: [
      { key: 'itemName', label: 'Item', type: 'text', required: true, max: 200 },
      { key: 'sku', label: 'SKU', type: 'text', max: 80 },
      { key: 'collectionId', label: 'Collection', type: 'collection' },
      { key: '__out', label: 'What went', type: 'heading' },
      { key: 'piecesOut', label: 'Pieces', type: 'number' },
      { key: 'grossWeightOut', label: 'Gross weight', type: 'weight' },
      { key: 'netWeightOut', label: 'Net weight', type: 'weight' },
      { key: 'valueOut', label: 'Value', type: 'money' },
      {
        key: '__back',
        label: 'What came back',
        type: 'heading',
        hint: 'Leave empty until it is counted. Empty is not the same as zero — zero means it all sold.',
      },
      { key: 'piecesBack', label: 'Pieces', type: 'number', nullable: true },
      { key: 'grossWeightBack', label: 'Gross weight', type: 'weight' },
      { key: 'netWeightBack', label: 'Net weight', type: 'weight' },
      { key: 'valueBack', label: 'Value', type: 'money' },
      { key: 'notes', label: 'Notes', type: 'textarea', max: 2000, full: true },
    ],
    blank: { itemName: '', piecesOut: 0 },
  },

  {
    kind: 'crew',
    slug: 'crew',
    label: 'Crew',
    blurb:
      'Who is going. A person does not need a panel account to be on this list — a karigar or a driver still travels.',
    addLabel: 'Add a person',
    empty: 'Nobody assigned.',
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'role', label: 'Role' },
      { key: 'phone', label: 'Phone' },
      { key: 'travelFrom', label: 'From', date: true },
      { key: 'travelTo', label: 'To', date: true },
      { key: 'shifts', label: 'Shifts', count: true, align: 'right' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { key: 'userId', label: 'Panel account', type: 'user', hint: 'Optional.' },
      { key: 'role', label: 'Role', type: 'text', max: 80 },
      { key: 'phone', label: 'Phone', type: 'text', max: 40 },
      { key: 'travelFrom', label: 'Travelling from', type: 'date' },
      { key: 'travelTo', label: 'Travelling back', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', max: 2000, full: true },
    ],
    blank: { name: '' },
    hasShifts: true,
  },

  {
    kind: 'tasks',
    slug: 'tasks',
    label: 'Tasks',
    blurb: 'What has to happen before, during and after the show.',
    addLabel: 'Add a task',
    empty: 'Nothing on the list.',
    columns: [
      { key: 'title', label: 'Task', primary: true },
      { key: 'stage', label: 'Stage', badge: true },
      { key: 'owner', label: 'Owner', user: true },
      { key: 'dueAt', label: 'Due', date: true },
      { key: 'doneAt', label: 'Done', date: true },
    ],
    fields: [
      { key: 'title', label: 'Task', type: 'text', required: true, max: 200 },
      { key: 'stage', label: 'Stage', type: 'select', options: 'taskStages' },
      { key: 'ownerId', label: 'Owner', type: 'user' },
      { key: 'dueAt', label: 'Due', type: 'date' },
      { key: 'detail', label: 'Detail', type: 'textarea', max: 2000, full: true },
    ],
    blank: { title: '', stage: 'TODO' },
  },

  {
    kind: 'appointments',
    slug: 'meetings',
    label: 'Meetings',
    blurb: 'Buyer meetings booked into the show diary.',
    addLabel: 'Add a meeting',
    empty: 'Nothing booked.',
    columns: [
      { key: 'buyerName', label: 'Who', primary: true },
      { key: 'company', label: 'Company' },
      { key: 'scheduledAt', label: 'When', datetime: true },
      { key: 'durationMins', label: 'Mins', align: 'right' },
      { key: 'stage', label: 'Stage', badge: true },
    ],
    fields: [
      { key: 'buyerName', label: 'Who', type: 'text', required: true, max: 120 },
      { key: 'company', label: 'Company', type: 'text', max: 160 },
      { key: 'phone', label: 'Phone', type: 'text', max: 40 },
      { key: 'scheduledAt', label: 'When', type: 'datetime', required: true },
      { key: 'durationMins', label: 'Minutes', type: 'number' },
      { key: 'stage', label: 'Stage', type: 'select', options: 'appointmentStages' },
      {
        key: 'leadId',
        label: 'Same person as a lead?',
        type: 'lead',
        hint: 'Link it and the two stop being two half-records of one buyer.',
      },
      { key: 'notes', label: 'Notes', type: 'textarea', max: 2000, full: true },
    ],
    blank: { buyerName: '', durationMins: 30, stage: 'SCHEDULED' },
  },

  {
    kind: 'documents',
    slug: 'files',
    label: 'Files',
    blurb: 'Stall allotment letter, invoices, passes, insurance.',
    addLabel: 'Add a file',
    empty: 'No files.',
    noEdit: true,
    columns: [
      { key: 'title', label: 'File', primary: true, link: 'fileUrl' },
      { key: 'kind', label: 'Kind' },
      { key: 'uploadedBy', label: 'Added by', user: true },
      { key: 'createdAt', label: 'Added', date: true },
    ],
    fields: [
      { key: 'title', label: 'Name', type: 'text', required: true, max: 200 },
      { key: 'kind', label: 'Kind', type: 'text', max: 60, hint: 'Invoice, pass, letter…' },
      { key: 'fileUrl', label: 'File', type: 'file', required: true, full: true },
      { key: 'notes', label: 'Notes', type: 'textarea', max: 1000, full: true },
    ],
    blank: { title: '', fileUrl: '' },
  },

  {
    kind: 'logs',
    slug: 'log',
    label: 'Daily log',
    blurb: 'What happened on each day of the show.',
    addLabel: 'Add a note',
    empty: 'Nothing logged.',
    columns: [
      { key: 'onDate', label: 'Day', date: true, primary: true },
      { key: 'note', label: 'Note', wide: true },
      { key: 'author', label: 'By', user: true },
    ],
    fields: [
      { key: 'onDate', label: 'Day', type: 'date', required: true },
      { key: 'note', label: 'What happened', type: 'textarea', max: 5000, required: true, full: true },
    ],
    blank: { onDate: '', note: '' },
  },

  {
    kind: 'fields',
    slug: 'fields',
    label: 'Custom fields',
    blurb:
      'Anything the tabs above did not anticipate — a meter reading, a docket number, whatever next year needs. No developer required. These are notes you can find again, not numbers the report understands.',
    addLabel: 'Add a field',
    empty: 'Nothing added.',
    columns: [
      { key: 'group', label: 'Group', badge: true },
      { key: 'label', label: 'Field', primary: true },
      { key: 'value', label: 'Value', wide: true },
      { key: 'displayOrder', label: 'Order', align: 'right' },
    ],
    fields: [
      { key: 'group', label: 'Group', type: 'text', max: 60 },
      { key: 'label', label: 'Field name', type: 'text', required: true, max: 120 },
      { key: 'value', label: 'Value', type: 'textarea', max: 4000, full: true },
      { key: 'displayOrder', label: 'Order', type: 'number' },
    ],
    blank: { group: 'General', label: '', value: '', displayOrder: 0 },
  },
]

/** Colours for the badge columns, so a stage reads at a glance. */
export const BADGE_TONE = {
  HOT: 'bg-rose/15 text-rose',
  WARM: 'bg-brass-500/15 text-brass-700',
  COLD: 'bg-ink-100 text-ink-400',

  NEW: 'bg-brass-500/15 text-brass-700',
  CONTACTED: 'bg-brass-500/15 text-brass-700',
  QUOTED: 'bg-brass-500/15 text-brass-700',
  WON: 'bg-emerald-600/15 text-emerald-600',
  LOST: 'bg-ink-100 text-ink-400',

  TODO: 'bg-ink-100 text-ink-400',
  DOING: 'bg-brass-500/15 text-brass-700',
  DONE: 'bg-emerald-600/15 text-emerald-600',

  SCHEDULED: 'bg-brass-500/15 text-brass-700',
  MET: 'bg-emerald-600/15 text-emerald-600',
  NO_SHOW: 'bg-rose/15 text-rose',
  CANCELLED: 'bg-ink-100 text-ink-400',

  PLANNED: 'bg-ink-100 text-ink-400',
  BOOKED: 'bg-brass-500/15 text-brass-700',
  LIVE: 'bg-emerald-600/15 text-emerald-600',
  CONCLUDED: 'bg-ink-100 text-ink-400',
}

/** Turns SCREAMING_SNAKE into something a person reads. */
export function pretty(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}
