import { randomInt } from "node:crypto";

import sendEmail from "./sendEmail.js";

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const sendOTP = async ({
  to,
  email,
  otp: providedOtp,
  purpose = "Verification",
  expiresInMinutes = 10,
  toName = "",
} = {}) => {
  const recipient = String(to || email || "").trim();

  if (!recipient) {
    throw new Error("OTP recipient email is required");
  }

  const otp =
    String(providedOtp || "").trim() ||
    randomInt(100000, 1000000).toString();

  if (!/^\d{6}$/.test(otp)) {
    throw new Error("OTP must contain exactly 6 digits");
  }

  const safePurpose = escapeHtml(purpose);
  const minutes = Math.max(1, Number(expiresInMinutes || 10));

  const result = await sendEmail({
    to: recipient,
    toName,
    subject: `HAMPORIUM ${purpose} OTP`,
    text: `Your HAMPORIUM ${purpose} OTP is ${otp}. It will expire in ${minutes} minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#171717">
        <h2 style="margin-bottom:18px">HAMPORIUM</h2>
        <p>Your ${safePurpose} verification code is:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:8px;margin:20px 0">${otp}</div>
        <p>This OTP will expire in ${minutes} minutes.</p>
        <p style="color:#666;font-size:13px">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
    tags: ["otp"],
  });

  if (!result?.sent) {
    throw new Error(result?.reason || "OTP email could not be sent");
  }

  return otp;
};

export default sendOTP;
