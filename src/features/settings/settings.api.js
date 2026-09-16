import request, { USE_MOCK_SETTINGS, mockDelay } from '@/services/api/client.js'
import { mockSettings } from '@/services/mock/data.js'

let store = { ...mockSettings }

export async function getSettings() {
  if (USE_MOCK_SETTINGS) return mockDelay({ ...store })
  return request('/settings')
}

export async function updateSettings(payload) {
  if (USE_MOCK_SETTINGS) {
    store = { ...store, ...payload }
    return mockDelay({ ...store })
  }
  return request('/settings', { method: 'PUT', body: payload })
}

export async function changePassword({ currentPassword, newPassword }) {
  if (USE_MOCK_SETTINGS) {
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.')
    return mockDelay(null)
  }
  return request('/settings/password', { method: 'PUT', body: { currentPassword, newPassword } })
}
