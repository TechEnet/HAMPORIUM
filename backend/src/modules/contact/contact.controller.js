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
    if (value && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
      return value;
    }
  }
  return "";
};

const getEmailConfig = () => ({
  apiKey: process.env.BREVO_API_KEY?.trim() || "",
  sender: firstConfiguredEmail(
    "CONTACT_FROM_EMAIL",
    "BREVO_SENDER_EMAIL",
    "BREVO_FROM_EMAIL",
    "EMAIL_FROM",
    "EMAIL_FROM_ADDRESS",
    "SENDER_EMAIL",
  ),
  senderName: process.env.BREVO_SENDER_NAME?.trim() || "HAMPORIUM",
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

// Table-based, inline-styled HTML is intentionally used for Gmail / Outlook support.
// Every visitor-provided value is HTML-escaped before being inserted into the email.
const buildAdminEmailHtml = ({ input, category, receivedAt }) => {
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const phone = escapeHtml(input.phone || "Not provided");
  const type = escapeHtml(category);
  const message = escapeHtml(input.message).replace(/\r\n|\r|\n/g, "<br>");
  const received = escapeHtml(receivedAt);
  const replySubject = encodeURIComponent(`Re: Your HAMPORIUM enquiry - ${category}`);
  const replyHref = escapeHtml(
    `mailto:${encodeURIComponent(input.email)}?subject=${replySubject}`,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>New HAMPORIUM enquiry</title>
</head>
<body style="margin:0;padding:0;background-color:#F6F4F1;font-family:Arial,Helvetica,sans-serif;color:#222222;">
  <div style="display:none;font-size:1px;line-height:1px;color:#F6F4F1;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    New ${type} from ${name} via HAMPORIUM Contact Us.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6F4F1;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 12px 42px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background-color:#FFFFFF;border-collapse:collapse;">
          <tr><td height="5" style="height:5px;line-height:5px;font-size:1px;background-color:#F47822;">&nbsp;</td></tr>
          <tr>
            <td style="background-color:#F47822;padding:25px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="middle" style="width:46px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td align="center" valign="middle" width="38" height="38" style="width:38px;height:38px;background-color:#191919;border-radius:8px;color:#FFFFFF;font-size:23px;font-weight:800;line-height:38px;">H</td>
                    </tr></table>
                  </td>
                  <td valign="middle" style="padding-left:11px;">
                    <div style="font-size:20px;line-height:25px;font-weight:800;letter-spacing:1.2px;color:#FFFFFF;">HAMPORIUM</div>
                    <div style="padding-top:4px;font-size:10px;line-height:15px;letter-spacing:2px;font-weight:700;color:#FFF0E4;">CONTACT DESK</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 30px 23px;">
              <div style="display:inline-block;padding:7px 12px;border-radius:5px;background-color:#FFF0E4;color:#C75B12;font-size:11px;line-height:15px;font-weight:800;letter-spacing:1px;">NEW ENQUIRY</div>
              <h1 style="margin:17px 0 8px;font-size:27px;line-height:34px;font-weight:800;letter-spacing:-0.5px;color:#1D1D1D;">You've received a message.</h1>
              <p style="margin:0;color:#696969;font-size:14px;line-height:23px;">A visitor has contacted HAMPORIUM through the website.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FFF7F0;border:1px solid #FFE2CC;border-collapse:separate;border-radius:8px;">
                <tr><td style="padding:18px 20px 5px;color:#A84D0E;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1px;">ENQUIRY TYPE</td></tr>
                <tr><td style="padding:0 20px 18px;color:#28211B;font-size:17px;line-height:24px;font-weight:700;overflow-wrap:anywhere;">${type}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 8px;">
              <h2 style="margin:0 0 18px;font-size:16px;line-height:23px;font-weight:800;color:#232323;">Contact information</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td valign="top" width="118" style="width:118px;padding:0 12px 17px 0;color:#797979;font-size:13px;line-height:21px;">Full name</td>
                  <td valign="top" style="padding:0 0 17px;color:#222222;font-size:14px;line-height:21px;font-weight:700;overflow-wrap:anywhere;">${name}</td>
                </tr>
                <tr>
                  <td valign="top" style="padding:0 12px 17px 0;color:#797979;font-size:13px;line-height:21px;">Email address</td>
                  <td valign="top" style="padding:0 0 17px;color:#C75B12;font-size:14px;line-height:21px;font-weight:700;word-break:break-all;">${email}</td>
                </tr>
                <tr>
                  <td valign="top" style="padding:0 12px 17px 0;color:#797979;font-size:13px;line-height:21px;">Phone number</td>
                  <td valign="top" style="padding:0 0 17px;color:#222222;font-size:14px;line-height:21px;font-weight:700;overflow-wrap:anywhere;">${phone}</td>
                </tr>
                <tr>
                  <td valign="top" style="padding:0 12px 17px 0;color:#797979;font-size:13px;line-height:21px;">Received</td>
                  <td valign="top" style="padding:0 0 17px;color:#222222;font-size:14px;line-height:21px;font-weight:700;">${received}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:2px 30px 27px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FAFAF9;border-collapse:separate;">
                <tr>
                  <td style="padding:22px 24px;border-left:4px solid #F47822;">
                    <p style="margin:0 0 11px;font-size:11px;line-height:17px;font-weight:800;letter-spacing:1.2px;color:#C75B12;">CUSTOMER MESSAGE</p>
                    <p style="margin:0;font-size:15px;line-height:25px;color:#292929;font-weight:400;overflow-wrap:anywhere;">${message}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 33px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td bgcolor="#F47822" style="background-color:#F47822;border-radius:7px;">
                  <a href="${replyHref}" style="display:inline-block;padding:14px 24px;font-size:14px;line-height:19px;font-weight:800;color:#FFFFFF;text-decoration:none;">Reply to customer &rarr;</a>
                </td>
              </tr></table>
              <p style="margin:13px 0 0;color:#858585;font-size:12px;line-height:19px;">You can also reply directly to this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#202020;padding:20px 30px;">
              <p style="margin:0;color:#FFFFFF;font-size:12px;line-height:19px;font-weight:700;letter-spacing:0.3px;">HAMPORIUM <span style="color:#F47822;">&bull;</span> Contact notification</p>
              <p style="margin:5px 0 0;color:#BDBDBD;font-size:11px;line-height:18px;">Sent automatically from the public Contact Us form.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const submitContact = async (req, res) => {
  const input = normalizeContact(req.body);

  // Honeypot: silently accept bot submissions without sending an email.
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

  const { apiKey, sender, senderName, admin } = getEmailConfig();
  if (!apiKey || !sender || !admin) {
    console.error(
      "Contact mail not configured: check BREVO_API_KEY, verified sender email and admin mailbox environment variables.",
    );
    return res.status(503).json({
      success: false,
      message: "Contact form is temporarily unavailable. Please try again later.",
    });
  }

  const category = CONTACT_TYPES[input.enquiryType];
  const receivedAt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date()) + " IST";

  const textContent = [
    "HAMPORIUM | New website enquiry",
    "",
    `Enquiry type: ${category}`,
    `Full name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone || "Not provided"}`,
    `Received: ${receivedAt}`,
    "",
    "CUSTOMER MESSAGE",
    input.message,
    "",
    `Reply to: ${input.email}`,
  ].join("\n");

  const htmlContent = buildAdminEmailHtml({ input, category, receivedAt });

  try {
    const response = await fetch(BREVO_EMAIL_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: sender },
        to: [{ email: admin }],
        replyTo: { name: input.name, email: input.email },
        subject: `HAMPORIUM | New ${category}`,
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
