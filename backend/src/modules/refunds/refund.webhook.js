import mongoose from "mongoose";

import Refund from "./refund.model.js";
import Payment from "../payments/payment.model.js";
import AuditLog from "../audit/audit.model.js";

import {
  REFUND_STATUS,
  REFUND_TYPE,
} from "../../constants/statuses.js";
import { applyGatewayRefundState } from "./refund.controller.js";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const resolveRefundType = (gatewayRefund, payment) =>
  Number(gatewayRefund?.amount || 0) >= Number(payment?.amountPaise || 0)
    ? REFUND_TYPE.FULL
    : REFUND_TYPE.PARTIAL;

export const processRefundWebhookEvent = async ({
  eventType,
  gatewayRefund,
  webhookEventId,
}) => {
  if (!gatewayRefund?.id || !gatewayRefund?.payment_id) {
    return { ignored: true };
  }

  let refund = await Refund.findOne({
    razorpayRefundId: gatewayRefund.id,
  });

  const hintedRefundId = String(
    gatewayRefund?.notes?.hamporiumRefundId || ""
  ).trim();

  if (!refund && mongoose.isValidObjectId(hintedRefundId)) {
    refund = await Refund.findById(hintedRefundId);
  }

  if (
    refund &&
    webhookEventId &&
    refund.webhookEventIds.includes(webhookEventId)
  ) {
    return { duplicate: true, refund };
  }

  if (!refund) {
    const payment = await Payment.findOne({
      razorpayPaymentId: gatewayRefund.payment_id,
    });

    if (!payment) {
      return { ignored: true };
    }

    try {
      refund = await Refund.create({
        order: payment.order,
        payment: payment._id,
        user: payment.user,
        type: resolveRefundType(gatewayRefund, payment),
        status: REFUND_STATUS.CREATED,
        amount: roundMoney(Number(gatewayRefund.amount || 0) / 100),
        amountPaise: Number(gatewayRefund.amount || 0),
        currency: gatewayRefund.currency || payment.currency || "INR",
        reason: "Refund created in Razorpay",
        providerStatus: gatewayRefund.status || "",
        razorpayPaymentId: gatewayRefund.payment_id,
        razorpayRefundId: gatewayRefund.id,
        idempotencyKey: `gateway:${gatewayRefund.id}`,
        requestedAt: gatewayRefund.created_at
          ? new Date(Number(gatewayRefund.created_at) * 1000)
          : new Date(),
        initiatedAt: new Date(),
        metadata: {
          source: "razorpay_webhook",
        },
      });
    } catch (error) {
      if (error?.code === 11000) {
        refund = await Refund.findOne({
          $or: [
            { razorpayRefundId: gatewayRefund.id },
            { idempotencyKey: `gateway:${gatewayRefund.id}` },
          ],
        });
      }

      if (!refund) throw error;
    }
  }

  await applyGatewayRefundState({
    refund,
    gatewayRefund,
    webhookEventId,
  });

  await AuditLog.create({
    actor: null,
    actorRoles: ["system"],
    action: `razorpay_${String(eventType || "refund_event").replaceAll(".", "_")}`,
    module: "payments",
    entityType: "refund",
    entityId: String(refund._id),
    description: `Razorpay refund event ${eventType} processed.`,
    metadata: {
      webhookEventId,
      razorpayRefundId: gatewayRefund.id,
      razorpayPaymentId: gatewayRefund.payment_id,
      providerStatus: gatewayRefund.status || "",
    },
  });

  return { refund };
};

export default processRefundWebhookEvent;
