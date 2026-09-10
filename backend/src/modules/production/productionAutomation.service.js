import mongoose from "mongoose";

import Order from "../orders/order.model.js";
import Fulfilment from "../fulfilment/fulfilment.model.js";
import notifyUser from "../../helpers/notifyUser.js";

import {
  FULFILMENT_STATUS,
  NOTIFICATION_TYPE,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  PRODUCTION_STAGE,
} from "../../constants/statuses.js";

const paidStatuses = [
  ORDER_PAYMENT_STATUS.PAID,
  ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
];

const hasValidShipmentAddress = (order) =>
  Boolean(
    order?.deliveryAddress?.addressLine1 &&
      order?.deliveryAddress?.city &&
      order?.deliveryAddress?.state &&
      order?.deliveryAddress?.postalCode
  );

const buildShipmentAddress = (order) => ({
  line1: order.deliveryAddress.addressLine1,
  line2: order.deliveryAddress.addressLine2 || "",
  city: order.deliveryAddress.city,
  state: order.deliveryAddress.state,
  postalCode: order.deliveryAddress.postalCode,
  country: order.deliveryAddress.country || "India",
});

const totalOrderUnits = (order) =>
  Math.max(
    1,
    (order.items || []).reduce(
      (sum, item) => sum + Math.max(1, Number(item.quantity || 1)),
      0
    )
  );

const ensureRetailShipment = async ({ job, order }) => {
  if (!job?._id || !order?._id) return null;
  if (!hasValidShipmentAddress(order)) return null;

  const existing = await Fulfilment.findOne({
    productionJob: job._id,
    sourceType: "order",
    sourceId: String(order._id),
    status: { $ne: FULFILMENT_STATUS.CANCELLED },
  });

  if (existing) return existing;

  try {
    const shipment = await Fulfilment.create({
      productionJob: job._id,
      sourceType: "order",
      sourceId: String(order._id),
      customerUser: order.user || null,
      recipientName:
        order.recipient?.fullName ||
        order.deliveryAddress?.fullName ||
        "HAMPORIUM Customer",
      recipientPhone:
        order.recipient?.phone || order.deliveryAddress?.phone || "",
      shippingAddress: buildShipmentAddress(order),
      packages: [
        {
          label: `Order ${order.orderNumber || order._id}`,
          itemCount: totalOrderUnits(order),
        },
      ],
      status: FULFILMENT_STATUS.CREATED,
      notes: "Shipment automatically created when production became ready to ship.",
      history: [
        {
          status: FULFILMENT_STATUS.CREATED,
          note: "Automatically created from completed packing.",
          by: job.updatedBy || null,
          at: new Date(),
        },
      ],
      createdBy: job.updatedBy || null,
      updatedBy: job.updatedBy || null,
    });

    void notifyUser({
      recipient: order.user,
      type: NOTIFICATION_TYPE.SHIPMENT,
      title: "Packed & Ready to Ship",
      message: `${order.orderNumber} is packed and waiting for courier dispatch.`,
      entityType: "shipment",
      entityId: shipment._id,
      actionUrl: `/account/orders/${order._id}`,
      eventKey: `shipment-auto-created:${job._id}`,
    });

    return shipment;
  } catch (error) {
    if (error?.code === 11000) {
      return Fulfilment.findOne({
        productionJob: job._id,
        sourceType: "order",
        sourceId: String(order._id),
      });
    }

    throw error;
  }
};

const syncOrderStatus = async ({ job, order }) => {
  if (!order || order.status === ORDER_STATUS.CANCELLED) return false;
  if (!paidStatuses.includes(order.paymentStatus)) return false;

  let nextStatus = order.status;

  if (
    [
      PRODUCTION_STAGE.PERSONALIZATION,
      PRODUCTION_STAGE.ASSEMBLY,
      PRODUCTION_STAGE.QC,
      PRODUCTION_STAGE.PACKING,
      PRODUCTION_STAGE.READY_TO_SHIP,
      PRODUCTION_STAGE.ON_HOLD,
    ].includes(job.stage)
  ) {
    nextStatus = ORDER_STATUS.PROCESSING;
  }

  if (job.stage === PRODUCTION_STAGE.SHIPPED) {
    nextStatus = ORDER_STATUS.SHIPPED;
  }

  if (job.stage === PRODUCTION_STAGE.DELIVERED) {
    nextStatus = ORDER_STATUS.DELIVERED;
  }

  if (nextStatus === order.status) return false;
  order.status = nextStatus;
  await order.save();
  return true;
};

export const syncProductionJobSideEffects = async (jobLike) => {
  if (
    !jobLike ||
    jobLike.sourceType !== "order" ||
    !mongoose.isValidObjectId(jobLike.sourceId)
  ) {
    return null;
  }

  const order = await Order.findById(jobLike.sourceId);
  if (!order) return null;

  if (order.status === ORDER_STATUS.CANCELLED) return { order };

  await syncOrderStatus({ job: jobLike, order });

  let shipment = null;
  if (
    jobLike.stage === PRODUCTION_STAGE.READY_TO_SHIP &&
    paidStatuses.includes(order.paymentStatus)
  ) {
    shipment = await ensureRetailShipment({ job: jobLike, order });
  }

  if (jobLike.stage === PRODUCTION_STAGE.DELIVERED) {
    void notifyUser({
      recipient: order.user,
      type: NOTIFICATION_TYPE.ORDER,
      title: "How Was Your HAMPORIUM Gift?",
      message: `${order.orderNumber} has been delivered. You can now rate and review purchased products.`,
      entityType: "order",
      entityId: order._id,
      actionUrl: `/account/orders/${order._id}`,
      eventKey: `review-eligible:${order._id}`,
    });
  }

  return { order, shipment };
};

export default syncProductionJobSideEffects;
