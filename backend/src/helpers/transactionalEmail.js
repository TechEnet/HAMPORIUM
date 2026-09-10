import { BrevoClient } from "@getbrevo/brevo";

let brevoClient = null;
let cachedApiKey = "";

const clean = (value) => String(value || "").trim();

const getClient = () => {
  const apiKey = clean(process.env.BREVO_API_KEY);

  if (!apiKey) return null;

  if (!brevoClient || cachedApiKey !== apiKey) {
    brevoClient = new BrevoClient({
      apiKey,
      timeoutInSeconds: 10,
      maxRetries: 1,
    });

    cachedApiKey = apiKey;
  }

  return brevoClient;
};

const resolveSender = () => ({
  email: clean(
    process.env.BREVO_SENDER_EMAIL ||
      process.env.HAMPORIUM_SUPPORT_EMAIL
  ),
  name: clean(
    process.env.BREVO_SENDER_NAME ||
      process.env.HAMPORIUM_BUSINESS_NAME ||
      "HAMPORIUM"
  ),
});

export const getTransactionalEmailConfigStatus = () => {
  const sender = resolveSender();

  return {
    configured: Boolean(clean(process.env.BREVO_API_KEY) && sender.email),
    senderEmail: sender.email,
    senderName: sender.name,
  };
};

export const isTransactionalEmailConfigured = () =>
  getTransactionalEmailConfigStatus().configured;

const extractMessageId = (result) =>
  clean(
    result?.messageId ||
      result?.data?.messageId ||
      result?.body?.messageId ||
      result?.response?.messageId
  );

const extractBrevoError = (error) => {
  const body =
    error?.body ||
    error?.response?.body ||
    error?.response?.data ||
    null;

  return clean(
    body?.message ||
      body?.error ||
      error?.message ||
      "Brevo transactional email failed"
  );
};

const sendTransactionalEmail = async ({
  to,
  toName = "",
  subject,
  textContent = "",
  htmlContent = "",
  replyTo = "",
  tags = [],
}) => {
  const recipient = clean(to);
  const sender = resolveSender();
  const client = getClient();

  if (!recipient) {
    return {
      sent: false,
      skipped: true,
      reason: "Recipient email is missing",
      messageId: "",
    };
  }

  if (!client || !sender.email) {
    return {
      sent: false,
      skipped: true,
      reason:
        "Brevo transactional email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.",
      messageId: "",
    };
  }

  const payload = {
    sender,
    to: [
      {
        email: recipient,
        ...(clean(toName) ? { name: clean(toName) } : {}),
      },
    ],
    subject: clean(subject) || "HAMPORIUM Update",
    textContent: String(textContent || ""),
    htmlContent: String(htmlContent || ""),
  };

  const resolvedReplyTo = clean(
    replyTo || process.env.HAMPORIUM_SUPPORT_EMAIL
  );

  if (resolvedReplyTo) {
    payload.replyTo = { email: resolvedReplyTo };
  }

  if (Array.isArray(tags) && tags.length) {
    payload.tags = tags
      .map((tag) => clean(tag))
      .filter(Boolean)
      .slice(0, 10);
  }

  try {
    const result =
      await client.transactionalEmails.sendTransacEmail(payload);

    return {
      sent: true,
      skipped: false,
      reason: "",
      messageId: extractMessageId(result),
    };
  } catch (error) {
    const wrapped = new Error(extractBrevoError(error));
    wrapped.cause = error;
    throw wrapped;
  }
};

export default sendTransactionalEmail;
