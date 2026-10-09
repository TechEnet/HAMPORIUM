import {
  CONTACT_TYPES,
  escapeHtml,
  normalizeContact,
  validateContact,
} from "./contact.validation.js";

const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

const firstConfiguredEmail = (...keys) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return value;
  }
  return "";
};

const getEmailConfig = () => ({
  apiKey: process.env.BREVO_API_KEY?.trim() || "",
  // Prefer your existing verified Brevo sender; aliases avoid another .env entry.
  sender: firstConfiguredEmail(
    "CONTACT_FROM_EMAIL",
    "BREVO_SENDER_EMAIL",
    "BREVO_FROM_EMAIL",
    "EMAIL_FROM",
    "EMAIL_FROM_ADDRESS",
    "SENDER_EMAIL",
  ),
  // Existing admin/support inbox works; override with CONTACT_ADMIN_EMAIL if needed.
  admin: firstConfiguredEmail(
    "CONTACT_ADMIN_EMAIL",
    "ADMIN_EMAIL",
    "SUPPORT_EMAIL",
    "BUSINESS_EMAIL",
    "COMPANY_EMAIL",
  ),
});

const failedDelivery = (res) =>
  res.status(502).json({
    success: false,
    message: "We could not send your enquiry right now. Please try again later.",
  });

export const submitContact = async (req, res) => {
  const input = normalizeContact(req.body);

  // Hidden frontend field: silently accept bot submissions but send nothing.
  if (input.website) {
    return res.status(200).json({
      success: true,
      message: "Thank you for reaching out.",
    });
  }

  const validationError = validateContact(input);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const { apiKey, sender, admin } = getEmailConfig();
  if (!apiKey || !sender || !admin) {
    console.error(
      "Contact mail not configured: check BREVO_API_KEY, verified sender email and admin mailbox environment variables."
    );
    return res.status(503).json({
      success: false,
      message: "Contact form is temporarily unavailable. Please try again later.",
    });
  }

  const category = CONTACT_TYPES[input.enquiryType];
  const textContent = [
    "HAMPORIUM - New website enquiry",
    `Type: ${category}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone || "Not provided"}`,
    "",
    "Message:",
    input.message,
  ].join("\n");

  const htmlContent = `
    <div style="max-width:640px;margin:auto;font-family:Arial,sans-serif;color:#242424;line-height:1.7">
      <div style="background:#1d1c19;padding:22px 26px;color:#e6c37d">
        <h1 style="font-size:22px;margin:0">HAMPORIUM | New website enquiry</h1>
      </div>
      <div style="padding:24px 26px;border:1px solid #e9e3da">
        <p><strong>Type:</strong> ${escapeHtml(category)}</p>
        <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(input.phone || "Not provided")}</p>
        <h2 style="font-size:17px;margin-top:26px">Message</h2>
        <p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(input.message)}</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch(BREVO_EMAIL_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "HAMPORIUM", email: sender },
        to: [{ email: admin }],
        replyTo: { name: input.name, email: input.email },
        subject: `HAMPORIUM Contact - ${category}`,
        textContent,
        htmlContent,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("Brevo contact email rejected with HTTP", response.status);
      return failedDelivery(res);
    }

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been sent to our team.",
    });
  } catch (error) {
    console.error("Contact email send failed:", error?.message || error);
    return failedDelivery(res);
  }
};
