import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

import { otpTemplate } from "./mail.templates.js";
import { SendOtpMailOptions } from "./mail.types.js";

/**
 * Render's free plan blocks outbound traffic on SMTP ports (25, 465, 587),
 * so nodemailer + SMTP works on localhost but silently fails in production.
 * We use Resend's HTTPS API instead (port 443, not blocked) with the same
 * API key that was previously used as SMTP_PASS.
 */
class MailService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY ?? process.env.SMTP_PASS;

    if (!this.apiKey) {
      logger.warn(
        "RESEND_API_KEY (or SMTP_PASS) not found. Emails will be logged to console.",
      );
    }
  }

  async sendOtp({ to, otp, purpose }: SendOtpMailOptions): Promise<void> {
    const subject =
      purpose === "LOGIN"
        ? "Your Login Verification Code • Promise Jewels"
        : "Reset Your Password • Promise Jewels";

    if (!this.apiKey) {
      // Printing the code to the console is how you sign in locally with no
      // mail provider configured. It must never happen in production.
      //
      // The guard used to be "no API key" alone, which is the wrong question:
      // a production deploy that loses its key would start printing live
      // sign-in codes into a log that several people and every log shipper can
      // read. Checking the environment as well means the worst case there is a
      // sign-in that fails loudly rather than one that succeeds for whoever
      // reads the log first.
      if (env.NODE_ENV === "production") {
        logger.error(
          "No mail provider is configured, so the sign-in code cannot be sent. " +
            "Set RESEND_API_KEY (or the SMTP settings) in the server environment.",
        );

        throw new Error("The verification email could not be sent.");
      }

      logger.info("====================================");
      logger.info("[DEV OTP EMAIL]");
      logger.info(`TO      : ${to}`);
      logger.info(`PURPOSE : ${purpose}`);
      logger.info(`OTP     : ${otp}`);
      logger.info("====================================");

      return;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to,
        subject,
        html: otpTemplate(otp, purpose),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `Resend API error (${response.status}): ${errorBody}`,
      );
    }
  }
}

export default new MailService();