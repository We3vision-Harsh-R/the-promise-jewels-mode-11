import request from '@/services/api/client.js'

// Admin reads for the Visitors screen. The ping the website sends lives in
// tracker.js — it is not an admin call and takes no session.

/** Everyone active in the last two minutes, from the server's memory. */
export function getLiveVisitors() {
  return request('/visitors/live')
}

/** Countries, pages, devices and days for the last `days` days. */
export function getVisitorSummary(days = 7) {
  return request('/visitors/summary', { params: { days } })
}
