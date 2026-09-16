export interface SendOtpMailOptions {
  to: string;
  otp: string;
  purpose: "LOGIN" | "FORGOT_PASSWORD";
}
