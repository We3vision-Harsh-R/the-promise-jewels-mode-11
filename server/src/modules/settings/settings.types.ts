// ---- Shape the ADMIN panel (SettingsPage.jsx) sends/receives ----
// Matches settings.service.js exactly: site_name, contact_email,
// contact_phone, address, social: { instagram, facebook, linkedin }
export interface AdminSettingsDto {
  site_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  business_hours?: string;
  otp_required?: boolean;
  social?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
}

export interface AdminSettingsView {
  site_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  business_hours: string;
  /// Whether signing in needs the emailed one-time code. Admin shape only.
  otp_required: boolean;
  social: {
    instagram: string;
    facebook: string;
    linkedin: string;
  };
}

// ---- Shape the PUBLIC website (Footer.jsx) reads ----
// Matches the DB columns 1:1 — no mapping needed on that side.
export interface PublicSettingsView {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  email: string;
  phone: string;
  address: string;
  businessHours: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
