import Notification from "../modules/notifications/notification.model.js";
import User from "../modules/users/user.model.js";
import sendEmail from "./transactionalEmail.js";
import sendWhatsAppTemplate from "./whatsappCloud.js";
import {
  NOTIFICATION_EMAIL_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_WHATSAPP_STATUS,
} from "../constants/statuses.js";

const clean = (value, maxLength = 1000) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getClientBaseUrl = () =>
  clean(
    process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
    500
  ).replace(/\/+$/, "");

export const toAbsoluteClientUrl = (value) => {
  const url = clean(value, 1000);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  return `${getClientBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
};

const defaultHtml = ({ title, message, actionUrl = "", actionLabel = "View update" }) => {
  const absoluteActionUrl = toAbsoluteClientUrl(actionUrl);

  return `
    <div style="margin:0;padding:28px;background:#fff9f2;font-family:Arial,sans-serif;color:#171717">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #eee6dc;border-radius:18px;padding:28px">
        <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#f97316;margin-bottom:12px">HAMPORIUM</div>
        <h2 style="margin:0 0 12px;font-size:24px;line-height:1.25">${escapeHtml(title)}</h2>
        <p style="margin:0;color:#595959;font-size:15px;line-height:1.7">${escapeHtml(message).replaceAll("\n", "<br />")}</p>
        ${
          absoluteActionUrl
            ? `<div style="margin-top:24px"><a href="${escapeHtml(absoluteActionUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:700">${escapeHtml(actionLabel)}</a></div>`
            : ""
        }
        <div style="margin-top:26px;padding-top:18px;border-top:1px solid #eee6dc;color:#999;font-size:12px">HAMPORIUM transactional update</div>
      </div>
    </div>
  `;
};

const ensureNotification = async (payload) => {
  if (payload.eventKey) {
    const existing = await Notification.findOne({ eventKey: payload.eventKey });
    if (existing) return { notification: existing, created: false };
  }

  try {
    const notification = await Notification.create(payload);
    return { notification, created: true };
  } catch (error) {
    if (error?.code === 11000 && payload.eventKey) {
      const existing = await Notification.findOne({ eventKey: payload.eventKey });
      if (existing) return { notification: existing, created: false };
    }

    throw error;
  }
};

const ensureEmailState = (notification, wantsEmail) => {
  if (!notification.emailDelivery) {
    notification.emailDelivery = {};
  }

  if (
    wantsEmail &&
    [
      undefined,
      null,
      "",
      NOTIFICATION_EMAIL_STATUS.NOT_REQUESTED,
    ].includes(notification.emailDelivery.status)
  ) {
    notification.emailDelivery.status = NOTIFICATION_EMAIL_STATUS.PENDING;
  }
};

const ensureWhatsAppState = (notification, wantsWhatsApp) => {
  if (!notification.whatsappDelivery) {
    notification.whatsappDelivery = {};
  }

  if (
    wantsWhatsApp &&
    [
      undefined,
      null,
      "",
      NOTIFICATION_WHATSAPP_STATUS.NOT_REQUESTED,
    ].includes(notification.whatsappDelivery.status)
  ) {
    notification.whatsappDelivery.status = NOTIFICATION_WHATSAPP_STATUS.PENDING;
  }
};

export const notifyUser = async ({
  recipient,
  type = NOTIFICATION_TYPE.SYSTEM,
  title,
  message,
  entityType = "",
  entityId = "",
  actionUrl = "",
  metadata = {},
  eventKey = "",
  email = null,
  whatsapp = null,
}) => {
  if (!recipient || !title || !message) return null;

  try {
    const wantsEmail = Boolean(email?.enabled);
    const wantsWhatsApp = Boolean(whatsapp?.enabled);

    const { notification } = await ensureNotification({
      recipient,
      type,
      title: clean(title, 240),
      message: clean(message, 2000),
      entityType: clean(entityType, 120),
      entityId: clean(entityId, 180),
      actionUrl: clean(actionUrl, 500),
      eventKey: clean(eventKey, 240) || undefined,
      metadata: metadata || {},
      emailDelivery: {
        status: wantsEmail
          ? NOTIFICATION_EMAIL_STATUS.PENDING
          : NOTIFICATION_EMAIL_STATUS.NOT_REQUESTED,
      },
      whatsappDelivery: {
        status: wantsWhatsApp
          ? NOTIFICATION_WHATSAPP_STATUS.PENDING
          : NOTIFICATION_WHATSAPP_STATUS.NOT_REQUESTED,
      },
    });

    if (!wantsEmail && !wantsWhatsApp) return notification;

    ensureEmailState(notification, wantsEmail);
    ensureWhatsAppState(notification, wantsWhatsApp);

    const user = await User.findById(recipient)
      .select("name email phone isActive")
      .lean();

    if (wantsEmail && notification.emailDelivery?.status !== NOTIFICATION_EMAIL_STATUS.SENT) {
      if (!user?.email || user.isActive === false) {
        notification.emailDelivery.status = NOTIFICATION_EMAIL_STATUS.SKIPPED;
        notification.emailDelivery.attemptedAt = new Date();
        notification.emailDelivery.error = user?.email
          ? "User account is inactive"
          : "Recipient email is unavailable";
      } else {
        notification.emailDelivery.attemptedAt = new Date();

        try {
          const absoluteActionUrl = toAbsoluteClientUrl(actionUrl);
          const baseText = email?.textContent || message;
          const textWithAction =
            absoluteActionUrl && !String(baseText).includes(absoluteActionUrl)
              ? `${baseText}\n\n${email?.actionLabel || "View update"}: ${absoluteActionUrl}`
              : baseText;

          const result = await sendEmail({
            to: user.email,
            toName: user.name || "",
            subject: email?.subject || title,
            textContent: textWithAction,
            htmlContent:
              email?.htmlContent ||
              defaultHtml({
                title: email?.heading || title,
                message: email?.textContent || message,
                actionUrl,
                actionLabel: email?.actionLabel || "View update",
              }),
            replyTo: email?.replyTo || "",
          });

          notification.emailDelivery.status = result.sent
            ? NOTIFICATION_EMAIL_STATUS.SENT
            : NOTIFICATION_EMAIL_STATUS.SKIPPED;
          notification.emailDelivery.provider = "brevo";
          notification.emailDelivery.providerMessageId = result.messageId || "";
          notification.emailDelivery.sentAt = result.sent ? new Date() : null;
          notification.emailDelivery.error = result.reason || "";
        } catch (error) {
          notification.emailDelivery.status = NOTIFICATION_EMAIL_STATUS.FAILED;
          notification.emailDelivery.provider = "brevo";
          notification.emailDelivery.error = clean(
            error?.body?.message ||
              error?.response?.body?.message ||
              error?.message ||
              "Transactional email failed",
            1000
          );
        }
      }
    }

    if (
      wantsWhatsApp &&
      notification.whatsappDelivery?.status !== NOTIFICATION_WHATSAPP_STATUS.SENT
    ) {
      const targetPhone = clean(whatsapp?.to || user?.phone, 30);
      notification.whatsappDelivery.attemptedAt = new Date();

      if (!targetPhone || user?.isActive === false) {
        notification.whatsappDelivery.status = NOTIFICATION_WHATSAPP_STATUS.SKIPPED;
        notification.whatsappDelivery.error = targetPhone
          ? "User account is inactive"
          : "Recipient WhatsApp phone is unavailable";
      } else {
        try {
          const absoluteActionUrl = toAbsoluteClientUrl(actionUrl);
          const bodyParameters = [
            ...(Array.isArray(whatsapp?.bodyParameters)
              ? whatsapp.bodyParameters
              : []),
            ...(whatsapp?.includeActionUrl && absoluteActionUrl
              ? [absoluteActionUrl]
              : []),
          ];

          const result = await sendWhatsAppTemplate({
            to: targetPhone,
            templateKey: whatsapp?.templateKey || "",
            templateName: whatsapp?.templateName || "",
            languageCode: whatsapp?.languageCode || "",
            bodyParameters,
          });

          notification.whatsappDelivery.status = result.sent
            ? NOTIFICATION_WHATSAPP_STATUS.SENT
            : NOTIFICATION_WHATSAPP_STATUS.SKIPPED;
          notification.whatsappDelivery.provider = "meta_whatsapp_cloud";
          notification.whatsappDelivery.providerMessageId = result.messageId || "";
          notification.whatsappDelivery.templateName = result.templateName || "";
          notification.whatsappDelivery.recipientPhone = result.phone || targetPhone;
          notification.whatsappDelivery.sentAt = result.sent ? new Date() : null;
          notification.whatsappDelivery.error = result.reason || "";
        } catch (error) {
          notification.whatsappDelivery.status = NOTIFICATION_WHATSAPP_STATUS.FAILED;
          notification.whatsappDelivery.provider = "meta_whatsapp_cloud";
          notification.whatsappDelivery.recipientPhone = targetPhone;
          notification.whatsappDelivery.templateName = clean(
            whatsapp?.templateName || whatsapp?.templateKey,
            160
          );
          notification.whatsappDelivery.error = clean(
            error?.body?.error?.message ||
              error?.message ||
              "WhatsApp delivery failed",
            1000
          );
        }
      }
    }

    await notification.save();
    return notification;
  } catch (error) {
    console.error("Notification delivery error:", error.message);
    return null;
  }
};

export default notifyUser;
