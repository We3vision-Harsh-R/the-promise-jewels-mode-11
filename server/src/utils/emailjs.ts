import { logger } from "./logger.js";

/**
 * Sends the contact-form inquiry to the owner's inbox through EmailJS.
 *
 * It is called from the server, not the browser, so the private key never
 * leaves it and a visitor cannot skip the email by closing the tab. EmailJS
 * must have "Allow EmailJS API for non-browser applications" switched on
 * (Account > Security) for this to be accepted.
 *
 * Environment (all required; with any missing, nothing is sent and one warning
 * is logged at start-up):
 *   EMAILJS_SERVICE_ID    the connected email service, e.g. service_xxxxxxx
 *   EMAILJS_TEMPLATE_ID   the template below, e.g. template_xxxxxxx
 *   EMAILJS_PUBLIC_KEY    Account > General > Public Key
 *   EMAILJS_PRIVATE_KEY   Account > Security > Private Key
 *   INQUIRY_NOTIFY_EMAIL  where inquiries are delivered (passed as {{to_email}})
 *
 * Template variables: {{name}} {{email}} {{phone}} {{company}} {{address}}
 * {{message}} {{submitted_at}} {{to_email}} {{reply_to}}
 */

const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const ATTEMPTS = 3;

export type InquiryMail = {
  name: string;
  email: string;
  phone: string;
  company?: string | null;
  address?: string | null;
  message: string;
};

function config() {
  const c = {
    serviceId: process.env.EMAILJS_SERVICE_ID?.trim(),
    templateId: process.env.EMAILJS_TEMPLATE_ID?.trim(),
    publicKey: process.env.EMAILJS_PUBLIC_KEY?.trim(),
    privateKey: process.env.EMAILJS_PRIVATE_KEY?.trim(),
    to: process.env.INQUIRY_NOTIFY_EMAIL?.trim(),
  };
  return c.serviceId && c.templateId && c.publicKey && c.privateKey && c.to ? (c as Required<typeof c>) : null;
}

export function checkEmailJsConfig(): void {
  if (!config()) {
    logger.warn(
      "[emailjs] not configured — inquiries are saved but NOT emailed. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY and INQUIRY_NOTIFY_EMAIL.",
    );
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Never throws: the visitor's inquiry is already saved, and must not fail over an email. */
export async function sendInquiryEmail(inquiry: InquiryMail): Promise<boolean> {
  const c = config();
  if (!c) return false;

  const body = JSON.stringify({
    service_id: c.serviceId,
    template_id: c.templateId,
    user_id: c.publicKey,
    accessToken: c.privateKey,
    template_params: {
      to_email: c.to,
      reply_to: inquiry.email,
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone,
      company: inquiry.company || "-",
      address: inquiry.address || "-",
      message: inquiry.message,
      submitted_at: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
    },
  });

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        logger.info("[emailjs] inquiry emailed");
        return true;
      }
      const text = (await res.text()).slice(0, 200);
      logger.error(`[emailjs] attempt ${attempt}/${ATTEMPTS} failed: ${res.status} ${text}`);
      // A rejected request will not succeed by repeating it, except rate limits and outages.
      if (res.status !== 429 && res.status < 500) return false;
    } catch (error) {
      logger.error(`[emailjs] attempt ${attempt}/${ATTEMPTS} failed: ${(error as Error).message}`);
    }
    if (attempt < ATTEMPTS) await wait(1500 * attempt);
  }
  return false;
}
