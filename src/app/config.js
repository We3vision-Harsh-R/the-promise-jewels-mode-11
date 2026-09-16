// App-level configuration, read once from the single .env at the project root.
// Only VITE_* keys reach the browser; every other key in that file stays
// server-side. The website and the admin panel both read from here.

// The API is same-origin now (one node server hosts the site, the admin panel
// and the API), so a relative base is the correct default — no host, no port,
// no CORS, and the HttpOnly auth cookies travel with every request.
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api/v1'

export const SITE_NAME = import.meta.env?.VITE_SITE_NAME || 'Promise Jewels'

// Where the admin panel is mounted in src/app/routes/AppRoutes.jsx.
export const ADMIN_BASE_PATH = '/admin'

export const IS_DEV = import.meta.env?.DEV ?? false
export const IS_PROD = import.meta.env?.PROD ?? true
