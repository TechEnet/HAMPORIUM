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

const populateShipment = (query) =>
  query
    .populate(
      "productionJob",
      "jobCode title stage dueDate expectedDeliveryDate sourceType sourceId"
    )
    .populate("customerUser", "name email phone");

const TERMINAL_SHIPMENT_STATUSES = [
  FULFILMENT_STATUS.DELIVERED,
  FULFILMENT_STATUS.RETURNED,
  FULFILMENT_STATUS.CANCELLED,
];

const shipmentTransitionAllowed = (currentStatus, nextStatus) => {
  const transitions = {
    [FULFILMENT_STATUS.CREATED]: [
      FULFILMENT_STATUS.LABEL_READY,
      FULFILMENT_STATUS.CANCELLED,
    ],
    [FULFILMENT_STATUS.LABEL_READY]: [
      FULFILMENT_STATUS.CANCELLED,
    ],
    [FULFILMENT_STATUS.DISPATCHED]: [
      FULFILMENT_STATUS.IN_TRANSIT,
      FULFILMENT_STATUS.OUT_FOR_DELIVERY,
      FULFILMENT_STATUS.FAILED,
    ],
    [FULFILMENT_STATUS.IN_TRANSIT]: [
      FULFILMENT_STATUS.OUT_FOR_DELIVERY,
      FULFILMENT_STATUS.FAILED,
    ],
    [FULFILMENT_STATUS.OUT_FOR_DELIVERY]: [
      FULFILMENT_STATUS.FAILED,
    ],
    [FULFILMENT_STATUS.FAILED]: [
      FULFILMENT_STATUS.OUT_FOR_DELIVERY,
      FULFILMENT_STATUS.RETURNED,
    ],
    [FULFILMENT_STATUS.RETURNED]: [],
    [FULFILMENT_STATUS.DELIVERED]: [],
    [FULFILMENT_STATUS.CANCELLED]: [],
  };

  return (transitions[currentStatus] || []).includes(nextStatus);
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

  if (job.stage !== PRODUCTION_STAGE.READY_TO_SHIP) {
    return res.status(409).json({
      message: "Production job must be ready to ship.",
    });
  }

  const order = await findRetailOrder(
    job.sourceType,
    job.sourceId
  );

  if (order?.status === ORDER_STATUS.CANCELLED) {
    return res.status(409).json({
      message: "Cannot create a shipment for a cancelled order.",
    });
  }

  if (
    order?.cancellation?.status ===
    CANCELLATION_STATUS.REQUESTED
  ) {
    return res.status(409).json({
      message:
        "Cancellation request is under review. Resolve it before creating a shipment.",
    });
  }

  if (job.sourceType === "order") {
    const existing = await Fulfilment.findOne({
      sourceType: "order",
      sourceId: String(job.sourceId),
    });

    if (existing) {
      return res.status(409).json({
        message:
          "A shipment already exists for this retail order. Use the existing shipment.",
        shipment: existing,
      });
    }
  }

  const resolvedRecipientName = String(
    recipientName ||
      order?.recipient?.fullName ||
      ""
  ).trim();

  const resolvedRecipientPhone = String(
    recipientPhone ||
      order?.recipient?.phone ||
      ""
  ).trim();

  const resolvedShippingAddress =
    shippingAddress ||
    (order
      ? orderAddressToShipmentAddress(order)
      : null);

  if (
    !resolvedRecipientName ||
    !validateShippingAddress(
      resolvedShippingAddress
    )
  ) {
    return res.status(400).json({
      message:
        "Recipient name and a complete shipping address are required.",
    });
  }

  let shipment;

  try {
    shipment = await Fulfilment.create({
      productionJob: job._id,
      sourceType: job.sourceType,
      sourceId: job.sourceId,
      customerUser:
        job.customerUser ||
        order?.user ||
        null,
      recipientName:
        resolvedRecipientName,
      recipientPhone:
        resolvedRecipientPhone,
      shippingAddress:
        resolvedShippingAddress,
      packages,
      carrier,
      trackingNumber,
      trackingUrl,
      notes,
      status:
        FULFILMENT_STATUS.CREATED,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      history: [
        {
          status:
            FULFILMENT_STATUS.CREATED,
          note: "Shipment created.",
          by: req.user._id,
        },
      ],
    });
  } catch (error) {
    if (
      error?.code === 11000 &&
      job.sourceType === "order"
    ) {
      const existing =
        await Fulfilment.findOne({
          sourceType: "order",
          sourceId: String(
            job.sourceId
          ),
        });

      return res.status(409).json({
        message:
          "A shipment already exists for this retail order.",
        shipment: existing,
      });
    }

    throw error;
  }

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
  const page = Math.max(
    Number(req.query.page) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      Number(req.query.limit) || 20,
      1
    ),
    100
  );

  const skip = (page - 1) * limit;
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.productionJob) {
    filter.productionJob =
      req.query.productionJob;
  }

  if (req.query.sourceType) {
    filter.sourceType =
      req.query.sourceType;
  }

  if (req.query.search) {
    filter.$or = [
      {
        shipmentCode: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        trackingNumber: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        recipientName: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        sourceId: {
          $regex: req.query.search,
          $options: "i",
        },
      },
    ];
  }

  const [shipments, total] =
    await Promise.all([
      populateShipment(
        Fulfilment.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ).lean(),

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
  let query;

  if (mongoose.isValidObjectId(req.params.id)) {
    query = Fulfilment.findById(req.params.id);
  } else {
    query = Fulfilment.findOne({
      shipmentCode: req.params.id,
    });
  }

  const shipment = await populateShipment(query);

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
  const shipment = await findShipment(
    req.params.id
  );

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  if (
    ![
      FULFILMENT_STATUS.CREATED,
      FULFILMENT_STATUS.LABEL_READY,
    ].includes(shipment.status)
  ) {
    return res.status(409).json({
      message:
        "Only a created or label-ready shipment can be dispatched.",
    });
  }

  if (
    !shipment.carrier ||
    !shipment.trackingNumber
  ) {
    return res.status(400).json({
      message:
        "Carrier and tracking number are required before dispatch.",
    });
  }

  const order = await findRetailOrder(
    shipment.sourceType,
    shipment.sourceId
  );

  if (
    order?.status ===
    ORDER_STATUS.CANCELLED
  ) {
    return res.status(409).json({
      message:
        "Cannot dispatch a shipment for a cancelled order.",
    });
  }

  if (
    order?.cancellation?.status ===
    CANCELLATION_STATUS.REQUESTED
  ) {
    return res.status(409).json({
      message:
        "Cancellation request is under review. Resolve it before dispatch.",
    });
  }

  shipment.status =
    FULFILMENT_STATUS.DISPATCHED;

  shipment.dispatchedAt =
    shipment.dispatchedAt || new Date();

  shipment.updatedBy =
    req.user._id;

  shipment.history.push({
    status:
      FULFILMENT_STATUS.DISPATCHED,
    note:
      req.body.note ||
      "Shipment dispatched.",
    location:
      req.body.location || "",
    by: req.user._id,
  });

  await shipment.save();

  const job =
    await ProductionJob.findById(
      shipment.productionJob
    );

  if (
    job &&
    ![
      PRODUCTION_STAGE.DELIVERED,
      PRODUCTION_STAGE.CANCELLED,
    ].includes(job.stage)
  ) {
    job.stage =
      PRODUCTION_STAGE.SHIPPED;

    job.updatedBy =
      req.user._id;

    job.history.push({
      stage:
        PRODUCTION_STAGE.SHIPPED,
      note: `Shipment ${shipment.shipmentCode} dispatched.`,
      by: req.user._id,
    });

    await job.save();
  }

  if (
    order &&
    order.status !==
      ORDER_STATUS.CANCELLED &&
    [
      ORDER_PAYMENT_STATUS.PAID,
      ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ].includes(order.paymentStatus)
  ) {
    order.status =
      ORDER_STATUS.SHIPPED;

    await order.save();
  }

  await notify({
    recipient:
      shipment.customerUser,
    title:
      "Your Gift Has Been Dispatched",
    message: `${shipment.shipmentCode} has been dispatched via ${shipment.carrier}. Tracking: ${shipment.trackingNumber}.`,
    entityId: shipment._id,
    actionUrl: order
      ? `/account/orders/${order._id}`
      : "/account/orders",
    eventKey: `shipment-dispatched:${shipment._id}`,
    email: {
      enabled: true,
      subject: order
        ? `Your HAMPORIUM order ${order.orderNumber} has been dispatched`
        : "Your HAMPORIUM gift has been dispatched",
      textContent: `${shipment.shipmentCode} has been dispatched via ${shipment.carrier}. Tracking number: ${shipment.trackingNumber}.${
        shipment.trackingUrl
          ? ` Carrier tracking: ${shipment.trackingUrl}`
          : ""
      }`,
      actionLabel: "Track your order",
    },
    whatsapp: order
      ? {
          enabled: true,
          templateKey:
            "shipment_dispatched",
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
    action:
      "shipment_dispatched",
    module: "fulfilment",
    entityType: "shipment",
    entityId: shipment._id,
    description: `Shipment ${shipment.shipmentCode} dispatched.`,
    metadata: {
      carrier: shipment.carrier,
      trackingNumber:
        shipment.trackingNumber,
    },
  });

  res.json({
    message:
      "Shipment dispatched.",
    shipment,
  });
};

export const updateShipmentStatus = async (req, res) => {
  const {
    status,
    note = "",
    location = "",
  } = req.body;

  if (
    !Object.values(
      FULFILMENT_STATUS
    ).includes(status)
  ) {
    return res.status(400).json({
      message:
        "Invalid fulfilment status.",
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
        "Use the dedicated dispatch/deliver action for this status.",
    });
  }

  const shipment =
    await findShipment(req.params.id);

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  if (
    TERMINAL_SHIPMENT_STATUSES.includes(
      shipment.status
    )
  ) {
    return res.status(409).json({
      message: `Cannot move a ${shipment.status} shipment.`,
    });
  }

  if (
    !shipmentTransitionAllowed(
      shipment.status,
      status
    )
  ) {
    return res.status(409).json({
      message: `Invalid shipment movement: ${shipment.status} → ${status}.`,
    });
  }

  let linkedOrder = null;

  if (
    shipment.sourceType === "order"
  ) {
    linkedOrder =
      await findRetailOrder(
        shipment.sourceType,
        shipment.sourceId
      );
  }

  if (
    status ===
      FULFILMENT_STATUS.CANCELLED &&
    linkedOrder &&
    linkedOrder.status !==
      ORDER_STATUS.CANCELLED
  ) {
    return res.status(409).json({
      message:
        "Retail shipment cancellation must use the order cancellation workflow.",
    });
  }

  if (
    [
      FULFILMENT_STATUS.IN_TRANSIT,
      FULFILMENT_STATUS.OUT_FOR_DELIVERY,
    ].includes(status) &&
    linkedOrder?.cancellation
      ?.status ===
      CANCELLATION_STATUS.REQUESTED
  ) {
    return res.status(409).json({
      message:
        "Cancellation request is under review. Resolve it before moving the shipment.",
    });
  }

  const previousStatus =
    shipment.status;

  shipment.status = status;
  shipment.updatedBy =
    req.user._id;

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
    linkedOrder &&
    linkedOrder.status !==
      ORDER_STATUS.CANCELLED &&
    [
      ORDER_PAYMENT_STATUS.PAID,
      ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    ].includes(
      linkedOrder.paymentStatus
    )
  ) {
    linkedOrder.status =
      ORDER_STATUS.SHIPPED;

    await linkedOrder.save();
  }

  if (
    status ===
    FULFILMENT_STATUS.OUT_FOR_DELIVERY
  ) {
    await notify({
      recipient:
        shipment.customerUser,
      title: "Out for Delivery",
      message: linkedOrder
        ? `${linkedOrder.orderNumber} is out for delivery.`
        : `${shipment.shipmentCode} is out for delivery.`,
      entityId: shipment._id,
      actionUrl: linkedOrder
        ? `/account/orders/${linkedOrder._id}`
        : "/account/orders",
      eventKey: `shipment-out-for-delivery:${shipment._id}`,
      email: {
        enabled: true,
        subject: linkedOrder
          ? `${linkedOrder.orderNumber} is out for delivery`
          : "Your HAMPORIUM gift is out for delivery",
        textContent: linkedOrder
          ? `Your HAMPORIUM order ${linkedOrder.orderNumber} is out for delivery today.`
          : `${shipment.shipmentCode} is out for delivery today.`,
        actionLabel: "Track your order",
      },
      whatsapp: linkedOrder
        ? {
            enabled: true,
            templateKey:
              "out_for_delivery",
            bodyParameters: [
              linkedOrder.orderNumber,
            ],
            includeActionUrl: true,
          }
        : null,
    });
  } else {
    await notify({
      recipient:
        shipment.customerUser,
      title: "Shipment Update",
      message: `${shipment.shipmentCode} is now ${status.replaceAll(
        "_",
        " "
      )}.`,
      entityId: shipment._id,
      eventKey: `shipment-status:${shipment._id}:${status}`,
    });
  }

  await createAuditLog({
    req,
    action:
      "shipment_status_changed",
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
    message:
      "Shipment status updated.",
    shipment,
  });
};

export const deliverShipment = async (req, res) => {
  const shipment =
    await findShipment(req.params.id);

  if (!shipment) {
    return res.status(404).json({
      message: "Shipment not found.",
    });
  }

  if (
    shipment.status ===
    FULFILMENT_STATUS.DELIVERED
  ) {
    return res.status(200).json({
      message:
        "Shipment is already delivered.",
      shipment,
    });
  }

  if (
    shipment.status !==
    FULFILMENT_STATUS.OUT_FOR_DELIVERY
  ) {
    return res.status(409).json({
      message:
        "Shipment must be out for delivery before it can be marked delivered.",
    });
  }

  const order =
    await findRetailOrder(
      shipment.sourceType,
      shipment.sourceId
    );

  if (
    order?.status ===
    ORDER_STATUS.CANCELLED
  ) {
    return res.status(409).json({
      message:
        "Cannot deliver a shipment for a cancelled order.",
    });
  }

  shipment.status =
    FULFILMENT_STATUS.DELIVERED;

  shipment.deliveredAt =
    new Date();

  shipment.updatedBy =
    req.user._id;

  shipment.history.push({
    status:
      FULFILMENT_STATUS.DELIVERED,
    note:
      req.body.note ||
      "Shipment delivered successfully.",
    location:
      req.body.location || "",
    by: req.user._id,
  });

  await shipment.save();

  const siblingShipments =
    await Fulfilment.find({
      productionJob:
        shipment.productionJob,
    }).select("status");

  const activeShipments =
    siblingShipments.filter(
      (item) =>
        item.status !==
        FULFILMENT_STATUS.CANCELLED
    );

  const allActiveDelivered =
    activeShipments.length > 0 &&
    activeShipments.every(
      (item) =>
        item.status ===
        FULFILMENT_STATUS.DELIVERED
    );

  let job = null;

  if (allActiveDelivered) {
    job =
      await ProductionJob.findById(
        shipment.productionJob
      );

    if (
      job &&
      job.stage !==
        PRODUCTION_STAGE.DELIVERED
    ) {
      job.stage =
        PRODUCTION_STAGE.DELIVERED;

      job.updatedBy =
        req.user._id;

      job.history.push({
        stage:
          PRODUCTION_STAGE.DELIVERED,
        note:
          "All active shipments were delivered.",
        by: req.user._id,
      });

      await job.save();
    }
  }

  if (
    order &&
    order.status !==
      ORDER_STATUS.CANCELLED &&
    allActiveDelivered
  ) {
    order.status =
      ORDER_STATUS.DELIVERED;

    await order.save();

    try {
      await markCommissionEligibleForOrder(
        order._id,
        req.user?._id || null
      );
    } catch (error) {
      console.error(
        `Partner commission eligibility sync failed for order ${
          order.orderNumber ||
          order._id
        }:`,
        error.message
      );
    }
  }

  await notify({
    recipient:
      shipment.customerUser,
    title: "Delivered",
    message: order
      ? `${order.orderNumber} has been delivered successfully.`
      : `${shipment.shipmentCode} has been delivered successfully.`,
    entityId: shipment._id,
    actionUrl: order
      ? `/account/orders/${order._id}`
      : "/account/orders",
    eventKey: `shipment-delivered:${shipment._id}`,
    email: {
      enabled: true,
      subject: order
        ? `Your HAMPORIUM order ${order.orderNumber} was delivered`
        : "Your HAMPORIUM gift was delivered",
      textContent: order
        ? `${order.orderNumber} has been delivered successfully. You can now rate and review the products from your order details.`
        : `${shipment.shipmentCode} has been delivered successfully.`,
      actionLabel: order
        ? "Rate your order"
        : "View delivery",
    },
    whatsapp: order
      ? {
          enabled: true,
          templateKey:
            "order_delivered",
          bodyParameters: [
            order.orderNumber,
          ],
          includeActionUrl: true,
        }
      : null,
  });

  await createAuditLog({
    req,
    action:
      "shipment_delivered",
    module: "fulfilment",
    entityType: "shipment",
    entityId: shipment._id,
    description: `Shipment ${shipment.shipmentCode} delivered.`,
    metadata: {
      allActiveDelivered,
    },
  });

  res.json({
    message:
      "Shipment marked as delivered.",
    shipment,
    productionJob: job,
  });
};

