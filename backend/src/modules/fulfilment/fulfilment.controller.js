import mongoose from "mongoose";

import Fulfilment from "./fulfilment.model.js";
import ProductionJob from "../production/productionJob.model.js";
import Order from "../orders/order.model.js";
import notifyUser from "../../helpers/notifyUser.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import { markCommissionEligibleForOrder } from "../commissions/commission.controller.js";

import {
  CANCELLATION_STATUS,
  FULFILMENT_STATUS,
  NOTIFICATION_TYPE,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  PRODUCTION_STAGE,
} from "../../constants/statuses.js";

const findShipment = async (value) => {
  if (mongoose.isValidObjectId(value)) {
    const byId = await Fulfilment.findById(value);
    if (byId) return byId;
  }

  return Fulfilment.findOne({ shipmentCode: value });
};

const notify = async ({
  recipient,
  title,
  message,
  entityId,
  actionUrl = "/account/orders",
  eventKey = "",
  email = null,
  whatsapp = null,
}) => {
  if (!recipient) return;

  await notifyUser({
    recipient,
    type: NOTIFICATION_TYPE.SHIPMENT,
    title,
    message,
    entityType: "shipment",
    entityId,
    actionUrl,
    eventKey: eventKey || undefined,
    email: email || undefined,
    whatsapp: whatsapp || undefined,
  });
};

const findRetailOrder = async (sourceType, sourceId) => {
  if (sourceType !== "order" || !mongoose.isValidObjectId(sourceId)) {
    return null;
  }

  return Order.findById(sourceId);
};

const orderAddressToShipmentAddress = (order) => ({
  line1: order?.deliveryAddress?.addressLine1 || "",
  line2: order?.deliveryAddress?.addressLine2 || "",
  city: order?.deliveryAddress?.city || "",
  state: order?.deliveryAddress?.state || "",
  postalCode: order?.deliveryAddress?.postalCode || "",
  country: order?.deliveryAddress?.country || "India",
});

const validateShippingAddress = (address) =>
  Boolean(
    address?.line1?.trim?.() &&
      address?.city?.trim?.() &&
      address?.state?.trim?.() &&
      address?.postalCode?.trim?.()
  );

export const createShipment = async (req, res) => {
  const {
    productionJob,
    recipientName = "",
    recipientPhone = "",
    shippingAddress = null,
    packages = [],
    carrier = "",
    trackingNumber = "",
    trackingUrl = "",
    notes = "",
  } = req.body;

  if (!productionJob) {
    return res.status(400).json({
      message: "productionJob is required.",
    });
  }

  const job = await ProductionJob.findById(productionJob);

  if (!job) {
    return res.status(404).json({
      message: "Production job not found.",
    });
  }

  if (
    ![
      PRODUCTION_STAGE.READY_TO_SHIP,
      PRODUCTION_STAGE.SHIPPED,
    ].includes(job.stage)
  ) {
    return res.status(400).json({
      message: "Production job must be ready to ship.",
    });
  }

  const order = await findRetailOrder(job.sourceType, job.sourceId);

  if (order?.status === ORDER_STATUS.CANCELLED) {
    return res.status(409).json({
      message: "Cannot create a shipment for a cancelled order.",
    });
  }

  if (order?.cancellation?.status === CANCELLATION_STATUS.REQUESTED) {
    return res.status(409).json({
      message:
        "Cancellation request is under review. Resolve it before creating a shipment.",
    });
  }

  const resolvedRecipientName =
    String(recipientName || order?.recipient?.fullName || "").trim();
  const resolvedRecipientPhone =
    String(recipientPhone || order?.recipient?.phone || "").trim();
  const resolvedShippingAddress =
    shippingAddress || (order ? orderAddressToShipmentAddress(order) : null);

  if (!resolvedRecipientName || !validateShippingAddress(resolvedShippingAddress)) {
    return res.status(400).json({
      message:
        "Recipient name and a complete shipping address are required.",
    });
  }

  const shipment = await Fulfilment.create({
    productionJob: job._id,
    sourceType: job.sourceType,
    sourceId: job.sourceId,
    customerUser: job.customerUser,
    recipientName: resolvedRecipientName,
    recipientPhone: resolvedRecipientPhone,
    shippingAddress: resolvedShippingAddress,
    packages,
    carrier,
    trackingNumber,
    trackingUrl,
    notes,
    status: FULFILMENT_STATUS.CREATED,
    createdBy: req.user._id,
    updatedBy: req.user._id,
    history: [
      {
        status: FULFILMENT_STATUS.CREATED,
        note: "Shipment created.",
        by: req.user._id,
      },
    ],
  });

  await createAuditLog({
    req,
    action: "shipment_created",
    module: "fulfilment",
    entityType: "shipment",
    entityId: shipment._id,
    description: `Shipment ${shipment.shipmentCode} created for ${job.jobCode}.`,
    metadata: {
      productionJob: job._id,
      jobCode: job.jobCode,
      orderId: order?._id || null,
    },
  });

  res.status(201).json({
    message: "Shipment created.",
    shipment,
  });
};

export const getShipments = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.productionJob) filter.productionJob = req.query.productionJob;
  if (req.query.sourceType) filter.sourceType = req.query.sourceType;

  if (req.query.search) {
    filter.$or = [
      { shipmentCode: { $regex: req.query.search, $options: "i" } },
      { trackingNumber: { $regex: req.query.search, $options: "i" } },
      { recipientName: { $regex: req.query.search, $options: "i" } },
      { sourceId: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const [shipments, total] = await Promise.all([
    Fulfilment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Fulfilment.countDocuments(filter),
  ]);

  res.json({
    shipments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

export const getShipmentById = async (req, res) => {
  const shipment = await findShipment(req.params.id);

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  res.json({ shipment });
};

export const updateShipment = async (req, res) => {
  const shipment = await findShipment(req.params.id);

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  const allowed = [
    "carrier",
    "trackingNumber",
    "trackingUrl",
    "recipientName",
    "recipientPhone",
    "shippingAddress",
    "packages",
    "notes",
  ];

  const changes = {};

  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      changes[field] = {
        from: shipment[field],
        to: req.body[field],
      };

      shipment[field] = req.body[field];
    }
  });

  shipment.updatedBy = req.user._id;

  await shipment.save();

  await createAuditLog({
    req,
    action: "shipment_updated",
    module: "fulfilment",
    entityType: "shipment",
    entityId: shipment._id,
    description: `Shipment ${shipment.shipmentCode} updated.`,
    changes,
  });

  res.json({
    message: "Shipment updated.",
    shipment,
  });
};

export const dispatchShipment = async (req, res) => {
  const shipment = await findShipment(req.params.id);

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  if (!shipment.carrier || !shipment.trackingNumber) {
    return res.status(400).json({
      message: "Carrier and tracking number are required before dispatch.",
    });
  }

  if (
    [
      FULFILMENT_STATUS.DELIVERED,
      FULFILMENT_STATUS.RETURNED,
      FULFILMENT_STATUS.CANCELLED,
    ].includes(shipment.status)
  ) {
    return res.status(400).json({
      message: `Cannot dispatch a ${shipment.status} shipment.`,
    });
  }

  const order = await findRetailOrder(shipment.sourceType, shipment.sourceId);

  if (order?.status === ORDER_STATUS.CANCELLED) {
    return res.status(409).json({
      message: "Cannot dispatch a shipment for a cancelled order.",
    });
  }

  if (order?.cancellation?.status === CANCELLATION_STATUS.REQUESTED) {
    return res.status(409).json({
      message:
        "Cancellation request is under review. Resolve it before dispatch.",
    });
  }

  shipment.status = FULFILMENT_STATUS.DISPATCHED;
  shipment.dispatchedAt = new Date();
  shipment.updatedBy = req.user._id;

  shipment.history.push({
    status: FULFILMENT_STATUS.DISPATCHED,
    note: req.body.note || "Shipment dispatched.",
    location: req.body.location || "",
    by: req.user._id,
  });

  await shipment.save();

  const job = await ProductionJob.findById(shipment.productionJob);

  if (job && job.stage !== PRODUCTION_STAGE.DELIVERED) {
    job.stage = PRODUCTION_STAGE.SHIPPED;
    job.updatedBy = req.user._id;

    job.history.push({
      stage: PRODUCTION_STAGE.SHIPPED,
      note: `Shipment ${shipment.shipmentCode} dispatched.`,
      by: req.user._id,
    });

    await job.save();
  }

  if (order && order.status !== ORDER_STATUS.CANCELLED) {
    if (
      [
        ORDER_PAYMENT_STATUS.PAID,
        ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ].includes(order.paymentStatus)
    ) {
      order.status = ORDER_STATUS.SHIPPED;
      await order.save();
    }
  }

  await notify({
    recipient: shipment.customerUser,
    title: "Your Gift Has Been Dispatched",
    message: `${shipment.shipmentCode} has been dispatched via ${shipment.carrier}. Tracking: ${shipment.trackingNumber}.`,
    entityId: shipment._id,
    actionUrl: order ? `/account/orders/${order._id}` : "/account/orders",
    eventKey: `shipment-dispatched:${shipment._id}`,
    email: {
      enabled: true,
      subject: order
        ? `Your HAMPORIUM order ${order.orderNumber} has been dispatched`
        : "Your HAMPORIUM gift has been dispatched",
      textContent: `${shipment.shipmentCode} has been dispatched via ${shipment.carrier}. Tracking number: ${shipment.trackingNumber}.${shipment.trackingUrl ? ` Carrier tracking: ${shipment.trackingUrl}` : ""}`,
      actionLabel: "Track your order",
    },
    whatsapp: order
      ? {
          enabled: true,
          templateKey: "shipment_dispatched",
          bodyParameters: [
            order.orderNumber,
            shipment.carrier,
            shipment.trackingNumber,
          ],
          includeActionUrl: true,
        }
      : null,
  });

  await createAuditLog({
    req,
    action: "shipment_dispatched",
    module: "fulfilment",
    entityType: "shipment",
    entityId: shipment._id,
    description: `Shipment ${shipment.shipmentCode} dispatched.`,
    metadata: {
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
    },
  });

  res.json({
    message: "Shipment dispatched.",
    shipment,
  });
};

export const updateShipmentStatus = async (req, res) => {
  const { status, note = "", location = "" } = req.body;

  if (!Object.values(FULFILMENT_STATUS).includes(status)) {
    return res.status(400).json({
      message: "Invalid fulfilment status.",
    });
  }

  if (
    [
      FULFILMENT_STATUS.DISPATCHED,
      FULFILMENT_STATUS.DELIVERED,
    ].includes(status)
  ) {
    return res.status(400).json({
      message:
        "Use dedicated dispatch/deliver endpoints for this status.",
    });
  }

  const shipment = await findShipment(req.params.id);

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  if (shipment.status === FULFILMENT_STATUS.CANCELLED) {
    return res.status(409).json({
      message: "Cancelled shipment cannot be moved to another status.",
    });
  }

  let linkedOrderForMovement = null;

  if (
    shipment.sourceType === "order" &&
    [
      FULFILMENT_STATUS.CANCELLED,
      FULFILMENT_STATUS.IN_TRANSIT,
      FULFILMENT_STATUS.OUT_FOR_DELIVERY,
    ].includes(status)
  ) {
    linkedOrderForMovement = await findRetailOrder(
      shipment.sourceType,
      shipment.sourceId
    );
  }

  if (
    status === FULFILMENT_STATUS.CANCELLED &&
    linkedOrderForMovement &&
    linkedOrderForMovement.status !== ORDER_STATUS.CANCELLED
  ) {
    return res.status(409).json({
      message: "Retail shipment cancellation must use the order cancellation workflow.",
    });
  }

  if (
    [
      FULFILMENT_STATUS.IN_TRANSIT,
      FULFILMENT_STATUS.OUT_FOR_DELIVERY,
    ].includes(status) &&
    linkedOrderForMovement?.cancellation?.status ===
      CANCELLATION_STATUS.REQUESTED
  ) {
    return res.status(409).json({
      message:
        "Cancellation request is under review. Resolve it before moving the shipment.",
    });
  }

  const previousStatus = shipment.status;

  shipment.status = status;
  shipment.updatedBy = req.user._id;

  shipment.history.push({
    status,
    note,
    location,
    by: req.user._id,
  });

  await shipment.save();

  if (
    [
      FULFILMENT_STATUS.IN_TRANSIT,
      FULFILMENT_STATUS.OUT_FOR_DELIVERY,
    ].includes(status) &&
    linkedOrderForMovement &&
    linkedOrderForMovement.status !== ORDER_STATUS.CANCELLED &&
    [
      ORDER_PAYMENT_STATUS.PAID,
      ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ].includes(linkedOrderForMovement.paymentStatus)
  ) {
    linkedOrderForMovement.status = ORDER_STATUS.SHIPPED;
    await linkedOrderForMovement.save();
  }

  const movementOrder = linkedOrderForMovement;

  if (status === FULFILMENT_STATUS.OUT_FOR_DELIVERY) {
    await notify({
      recipient: shipment.customerUser,
      title: "Out for Delivery",
      message: movementOrder
        ? `${movementOrder.orderNumber} is out for delivery.`
        : `${shipment.shipmentCode} is out for delivery.`,
      entityId: shipment._id,
      actionUrl: movementOrder
        ? `/account/orders/${movementOrder._id}`
        : "/account/orders",
      eventKey: `shipment-out-for-delivery:${shipment._id}`,
      email: {
        enabled: true,
        subject: movementOrder
          ? `${movementOrder.orderNumber} is out for delivery`
          : "Your HAMPORIUM gift is out for delivery",
        textContent: movementOrder
          ? `Your HAMPORIUM order ${movementOrder.orderNumber} is out for delivery today.`
          : `${shipment.shipmentCode} is out for delivery today.`,
        actionLabel: "Track your order",
      },
      whatsapp: movementOrder
        ? {
            enabled: true,
            templateKey: "out_for_delivery",
            bodyParameters: [movementOrder.orderNumber],
            includeActionUrl: true,
          }
        : null,
    });
  } else {
    await notify({
      recipient: shipment.customerUser,
      title: "Shipment Update",
      message: `${shipment.shipmentCode} is now ${status.replaceAll("_", " ")}.`,
      entityId: shipment._id,
      eventKey: `shipment-status:${shipment._id}:${status}`,
    });
  }

  await createAuditLog({
    req,
    action: "shipment_status_changed",
    module: "fulfilment",
    entityType: "shipment",
    entityId: shipment._id,
    description: `${shipment.shipmentCode}: ${previousStatus} → ${status}`,
    changes: {
      status: {
        from: previousStatus,
        to: status,
      },
    },
    metadata: {
      note,
      location,
    },
  });

  res.json({
    message: "Shipment status updated.",
    shipment,
  });
};

export const deliverShipment = async (req, res) => {
  const shipment = await findShipment(req.params.id);

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  if (shipment.status === FULFILMENT_STATUS.DELIVERED) {
    return res.status(400).json({
      message: "Shipment is already delivered.",
    });
  }

  if (
    [FULFILMENT_STATUS.CANCELLED, FULFILMENT_STATUS.RETURNED].includes(
      shipment.status
    )
  ) {
    return res.status(409).json({
      message: `Cannot deliver a ${shipment.status} shipment.`,
    });
  }

  const linkedOrderBeforeDelivery = await findRetailOrder(
    shipment.sourceType,
    shipment.sourceId
  );

  if (linkedOrderBeforeDelivery?.status === ORDER_STATUS.CANCELLED) {
    return res.status(409).json({
      message: "Cannot deliver a shipment for a cancelled order.",
    });
  }

  shipment.status = FULFILMENT_STATUS.DELIVERED;
  shipment.deliveredAt = new Date();
  shipment.updatedBy = req.user._id;

  shipment.history.push({
    status: FULFILMENT_STATUS.DELIVERED,
    note: req.body.note || "Shipment delivered successfully.",
    location: req.body.location || "",
    by: req.user._id,
  });

  await shipment.save();

  const pendingShipments = await Fulfilment.countDocuments({
    productionJob: shipment.productionJob,
    status: {
      $nin: [FULFILMENT_STATUS.DELIVERED, FULFILMENT_STATUS.CANCELLED],
    },
  });

  let job = null;

  if (pendingShipments === 0) {
    job = await ProductionJob.findById(shipment.productionJob);

    if (job) {
      job.stage = PRODUCTION_STAGE.DELIVERED;
      job.updatedBy = req.user._id;

      job.history.push({
        stage: PRODUCTION_STAGE.DELIVERED,
        note: "All shipments delivered.",
        by: req.user._id,
      });

      await job.save();
    }
  }

  const order = await findRetailOrder(shipment.sourceType, shipment.sourceId);

  if (
    order &&
    order.status !== ORDER_STATUS.CANCELLED &&
    pendingShipments === 0
  ) {
    order.status = ORDER_STATUS.DELIVERED;
    await order.save();

    try {
      await markCommissionEligibleForOrder(order._id, req.user?._id || null);
    } catch (error) {
      console.error(
        `Partner commission eligibility sync failed for order ${order.orderNumber || order._id}:`,
        error.message
      );
    }
  }

  await notify({
    recipient: shipment.customerUser,
    title: "Delivered",
    message: `${shipment.shipmentCode} has been delivered successfully.`,
    entityId: shipment._id,
    actionUrl: order ? `/account/orders/${order._id}` : "/account/orders",
    eventKey: `shipment-delivered:${shipment._id}`,
    email: {
      enabled: true,
      subject: order
        ? `Your HAMPORIUM order ${order.orderNumber} was delivered`
        : "Your HAMPORIUM gift was delivered",
      textContent: order
        ? `${order.orderNumber} has been delivered successfully. You can now rate and review the products from your order details.`
        : `${shipment.shipmentCode} has been delivered successfully.`,
      actionLabel: order ? "Rate your order" : "View delivery",
    },
    whatsapp: order
      ? {
          enabled: true,
          templateKey: "order_delivered",
          bodyParameters: [order.orderNumber],
          includeActionUrl: true,
        }
      : null,
  });

  await createAuditLog({
    req,
    action: "shipment_delivered",
    module: "fulfilment",
    entityType: "shipment",
    entityId: shipment._id,
    description: `Shipment ${shipment.shipmentCode} delivered.`,
    metadata: {
      productionCompleted: pendingShipments === 0,
    },
  });

  res.json({
    message: "Shipment marked as delivered.",
    shipment,
    productionJob: job,
  });
};