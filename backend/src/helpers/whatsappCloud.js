const clean = (value) => String(value || "").trim();

const TEMPLATE_ENV = Object.freeze({
  order_confirmed: "WHATSAPP_TEMPLATE_ORDER_CONFIRMED",
  cancellation_requested: "WHATSAPP_TEMPLATE_CANCELLATION_REQUESTED",
  cancellation_approved: "WHATSAPP_TEMPLATE_CANCELLATION_APPROVED",
  cancellation_rejected: "WHATSAPP_TEMPLATE_CANCELLATION_REJECTED",
  shipment_dispatched: "WHATSAPP_TEMPLATE_SHIPMENT_DISPATCHED",
  out_for_delivery: "WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY",
  order_delivered: "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
  refund_initiated: "WHATSAPP_TEMPLATE_REFUND_INITIATED",
  refund_completed: "WHATSAPP_TEMPLATE_REFUND_COMPLETED",
  refund_failed: "WHATSAPP_TEMPLATE_REFUND_FAILED",
});

const TEMPLATE_FALLBACK = Object.freeze({
  order_confirmed: "hamporium_order_confirmed",
  cancellation_requested: "hamporium_cancellation_requested",
  cancellation_approved: "hamporium_cancellation_approved",
  cancellation_rejected: "hamporium_cancellation_rejected",
  shipment_dispatched: "hamporium_shipment_dispatched",
  out_for_delivery: "hamporium_out_for_delivery",
  order_delivered: "hamporium_order_delivered",
  refund_initiated: "hamporium_refund_initiated",
  refund_completed: "hamporium_refund_completed",
  refund_failed: "hamporium_refund_failed",
});

export const normalizeWhatsAppPhone = (value) => {
  let digits = clean(value).replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // HAMPORIUM currently serves India. Convert common local formats to E.164 digits.
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    return "";
  }

  return digits;
};

const resolveTemplateName = (templateKey, explicitName = "") => {
  if (clean(explicitName)) return clean(explicitName);

  const envName = TEMPLATE_ENV[templateKey];
  if (envName && clean(process.env[envName])) {
    return clean(process.env[envName]);
  }

  return TEMPLATE_FALLBACK[templateKey] || clean(templateKey);
};

export const getWhatsAppConfigStatus = () => ({
  enabled: clean(process.env.COMMUNICATION_WHATSAPP_ENABLED).toLowerCase() === "true",
  phoneNumberId: clean(process.env.WHATSAPP_PHONE_NUMBER_ID),
  accessTokenConfigured: Boolean(clean(process.env.WHATSAPP_ACCESS_TOKEN)),
  graphVersion: clean(process.env.WHATSAPP_GRAPH_VERSION) || "v23.0",
  languageCode: clean(process.env.WHATSAPP_TEMPLATE_LANGUAGE) || "en",
});

const extractMetaError = (payload, fallback = "WhatsApp Cloud API request failed") =>
  clean(
    payload?.error?.error_user_msg ||
      payload?.error?.message ||
      payload?.message ||
      fallback
  );

export const sendWhatsAppTemplate = async ({
  to,
  templateKey,
  templateName = "",
  languageCode = "",
  bodyParameters = [],
}) => {
  const phone = normalizeWhatsAppPhone(to);
  const config = getWhatsAppConfigStatus();
  const resolvedTemplateName = resolveTemplateName(templateKey, templateName);

  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: "WhatsApp delivery is disabled",
      messageId: "",
      phone,
      templateName: resolvedTemplateName,
    };
  }

  if (!phone) {
    return {
      sent: false,
      skipped: true,
      reason: "Recipient WhatsApp phone is unavailable or invalid",
      messageId: "",
      phone: "",
      templateName: resolvedTemplateName,
    };
  }

  if (!config.phoneNumberId || !config.accessTokenConfigured) {
    return {
      sent: false,
      skipped: true,
      reason:
        "WhatsApp Cloud API is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.",
      messageId: "",
      phone,
      templateName: resolvedTemplateName,
    };
  }

  if (!resolvedTemplateName) {
    return {
      sent: false,
      skipped: true,
      reason: "WhatsApp template name is missing",
      messageId: "",
      phone,
      templateName: "",
    };
  }

  const parameters = (Array.isArray(bodyParameters) ? bodyParameters : [])
    .map((value) => clean(value).slice(0, 1024))
    .filter(Boolean)
    .map((text) => ({ type: "text", text }));

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: resolvedTemplateName,
      language: {
        code: clean(languageCode) || config.languageCode,
      },
      ...(parameters.length
        ? {
            components: [
              {
                type: "body",
                parameters,
              },
            ],
          }
        : {}),
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clean(process.env.WHATSAPP_ACCESS_TOKEN)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      extractMetaError(data, `WhatsApp Cloud API returned HTTP ${response.status}`)
    );
    error.statusCode = response.status;
    error.body = data;
    throw error;
  }

  return {
    sent: true,
    skipped: false,
    reason: "",
    messageId: clean(data?.messages?.[0]?.id),
    phone,
    templateName: resolvedTemplateName,
  };
};

export default sendWhatsAppTemplate;
