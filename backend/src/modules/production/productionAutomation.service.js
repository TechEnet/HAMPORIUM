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
      (sum, item) =>
        sum + Math.max(1, Number(item.quantity || 1)),
      0
    )
  );

const ensureRetailShipment = async ({ job, order }) => {
  if (!job?._id || !order?._id) return null;
  if (!hasValidShipmentAddress(order)) return null;

  const sourceId = String(order._id);

  // A retail order has one operational shipment in this version.
  // Re-use any existing shipment instead of creating duplicates.
  const existing = await Fulfilment.findOne({
    sourceType: "order",
    sourceId,
  });

  if (existing) {
    return existing;
  }

  try {
    const shipment = await Fulfilment.create({
      productionJob: job._id,
      sourceType: "order",
      sourceId,
      customerUser: order.user || null,
      recipientName:
        order.recipient?.fullName ||
        order.deliveryAddress?.fullName ||
        "HAMPORIUM Customer",
      recipientPhone:
        order.recipient?.phone ||
        order.deliveryAddress?.phone ||
        "",
      shippingAddress: buildShipmentAddress(order),
      packages: [
        {
          label: `Order ${order.orderNumber || order._id}`,
          itemCount: totalOrderUnits(order),
        },
      ],
      status: FULFILMENT_STATUS.CREATED,
      notes:
        "Shipment automatically created when production became ready to ship.",
      history: [
        {
          status: FULFILMENT_STATUS.CREATED,
          note:
            "Automatically created after packing was completed.",
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
      message: `${order.orderNumber} is packed and ready for courier dispatch.`,
      entityType: "shipment",
      entityId: shipment._id,
      actionUrl: `/account/orders/${order._id}`,
      eventKey: `shipment-auto-created:${order._id}`,
    });

    return shipment;
  } catch (error) {
    if (error?.code === 11000) {
      return Fulfilment.findOne({
        sourceType: "order",
        sourceId,
      });
    }

    throw error;
  }
};

const syncOrderStatus = async ({ job, order }) => {
  if (!order || order.status === ORDER_STATUS.CANCELLED) {
    return false;
  }

  if (!paidStatuses.includes(order.paymentStatus)) {
    return false;
  }

  if (
    ![
      PRODUCTION_STAGE.PERSONALIZATION,
      PRODUCTION_STAGE.ASSEMBLY,
      PRODUCTION_STAGE.QC,
      PRODUCTION_STAGE.PACKING,
      PRODUCTION_STAGE.READY_TO_SHIP,
      PRODUCTION_STAGE.ON_HOLD,
    ].includes(job.stage)
  ) {
    return false;
  }

  if (order.status === ORDER_STATUS.PROCESSING) {
    return false;
  }

  order.status = ORDER_STATUS.PROCESSING;
  await order.save();

  return true;
};

export const syncProductionJobSideEffects = async (
  jobLike
) => {
  if (
    !jobLike ||
    jobLike.sourceType !== "order" ||
    !mongoose.isValidObjectId(jobLike.sourceId)
  ) {
    return null;
  }

  const order = await Order.findById(jobLike.sourceId);

  if (!order) return null;

  if (order.status === ORDER_STATUS.CANCELLED) {
    return { order };
  }

  await syncOrderStatus({
    job: jobLike,
    order,
  });

  let shipment = null;

  if (
    jobLike.stage === PRODUCTION_STAGE.READY_TO_SHIP &&
    paidStatuses.includes(order.paymentStatus)
  ) {
    shipment = await ensureRetailShipment({
      job: jobLike,
      order,
    });
  }

  /*
   * Important:
   * SHIPPED and DELIVERED are intentionally NOT handled here.
   * Fulfilment is the source of truth for physical movement and delivery.
   */

  return {
    order,
    shipment,
  };
};

export default syncProductionJobSideEffects;
