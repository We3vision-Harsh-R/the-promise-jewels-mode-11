import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Providers from '@/app/providers.jsx'
import AdminRoutes from '@/app/routes/AdminRoutes.jsx'

import '@/assets/styles/globals.css'
import { preloadAdminPage } from '@/app/routes/adminPageLoaders.js'
import { getSession } from '@/features/auth/auth.api.js'

// Do not wait for the sign-in check to find out what is needed next: fetch the
// code of the screen being opened and the session (who is signed in and what they may do, one request) now,
// side by side with it. Without a session these just fail quietly.
if (!window.location.pathname.startsWith('/admin/login')) {
  preloadAdminPage(window.location.pathname)
  getSession()
}

// The admin panel's own entry (admin.html). The public website's entry
// (main.jsx) and everything only it needs - the page transitions, smooth scroll,
// home sections - are not part of this page, so opening /admin downloads only
// what the panel uses.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
        </Routes>
      </Providers>
    </BrowserRouter>
  </StrictMode>,
)
