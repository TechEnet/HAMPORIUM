import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import Payment from "./payment.model.js";

import {
  markPaymentCaptured,
  markPaymentFailed,
} from "./payment.controller.js";
import { processRefundWebhookEvent } from "../refunds/refund.webhook.js";

import { PAYMENT_STATUS } from "../../constants/statuses.js";

const safeSignatureEqual = (expected, received) => {
  if (!expected || !received) return false;
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

const verifyWebhookSignature = (rawBody, receivedSignature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    const error = new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return safeSignatureEqual(expectedSignature, receivedSignature);
};

const fallbackEventId = (rawBody) =>
  `derived-${createHash("sha256").update(rawBody).digest("hex")}`;

const paymentWebhook = async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Webhook body must be raw JSON",
      });
    }

    const signature = String(req.headers["x-razorpay-signature"] || "").trim();

    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    let event;

    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload",
      });
    }

    const webhookEventId =
      String(req.headers["x-razorpay-event-id"] || "").trim() ||
      fallbackEventId(req.body);

    const eventType = String(event?.event || "");
    const gatewayRefund = event?.payload?.refund?.entity || null;

    if (eventType.startsWith("refund.") && gatewayRefund) {
      const result = await processRefundWebhookEvent({
        eventType,
        gatewayRefund,
        webhookEventId,
      });

      return res.status(200).json({
        success: true,
        ignored: Boolean(result?.ignored),
        duplicate: Boolean(result?.duplicate),
      });
    }

    const gatewayPayment = event?.payload?.payment?.entity || null;

    if (!gatewayPayment?.order_id) {
      return res.status(200).json({
        success: true,
        ignored: true,
      });
    }

    const paymentRecord = await Payment.findOne({
      razorpayOrderId: gatewayPayment.order_id,
    }).sort({ createdAt: -1 });

    if (!paymentRecord) {
      console.warn(
        `Webhook payment record not found for Razorpay order ${gatewayPayment.order_id}`
      );

      return res.status(200).json({
        success: true,
        ignored: true,
      });
    }

    if (paymentRecord.webhookEventIds.includes(webhookEventId)) {
      return res.status(200).json({
        success: true,
        duplicate: true,
      });
    }

    if (eventType === "payment.captured") {
      await markPaymentCaptured({
        paymentRecord,
        gatewayPayment,
        webhookEventId,
      });

      return res.status(200).json({ success: true });
    }

    if (eventType === "payment.failed") {
      await markPaymentFailed({
        paymentRecord,
        gatewayPayment,
        webhookEventId,
      });

      return res.status(200).json({ success: true });
    }

    if (eventType === "payment.authorized") {
      if (
        ![
          PAYMENT_STATUS.CAPTURED,
          PAYMENT_STATUS.PARTIALLY_REFUNDED,
          PAYMENT_STATUS.REFUNDED,
        ].includes(paymentRecord.status)
      ) {
        paymentRecord.status = PAYMENT_STATUS.AUTHORIZED;
        paymentRecord.razorpayPaymentId =
          gatewayPayment.id || paymentRecord.razorpayPaymentId;
        paymentRecord.method = gatewayPayment.method || "";

        if (!paymentRecord.webhookEventIds.includes(webhookEventId)) {
          paymentRecord.webhookEventIds.push(webhookEventId);
        }

        await paymentRecord.save();
      }

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({
      success: true,
      ignored: true,
    });
  } catch (error) {
    next(error);
  }
};

export default paymentWebhook;
