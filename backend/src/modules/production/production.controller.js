import mongoose from "mongoose";

import ProductionJob from "./productionJob.model.js";
import Order from "../orders/order.model.js";
import notifyUser from "../../helpers/notifyUser.js";
import createAuditLog from "../../helpers/createAuditLog.js";

import {
  NOTIFICATION_TYPE,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  PRODUCTION_ITEM_STATUS,
  PRODUCTION_STAGE,
  QC_STATUS,
} from "../../constants/statuses.js";

const populateJob = (query) =>
  query
    .populate("customerUser", "name email phone")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("qc.checkedBy", "name email")
    .populate("history.by", "name email");

const findJob = async (value) => {
  if (mongoose.isValidObjectId(value)) {
    const byId = await populateJob(ProductionJob.findById(value));
    if (byId) return byId;
  }

  return populateJob(ProductionJob.findOne({ jobCode: value }));
};

const createNotification = async ({
  recipient,
  title,
  message,
  entityId,
  actionUrl,
  type = NOTIFICATION_TYPE.PRODUCTION,
}) => {
  if (!recipient) return;

  await notifyUser({
    recipient,
    type,
    title,
    message,
    entityType: "production_job",
    entityId,
    actionUrl,
  });
};

const syncRetailOrderFromProduction = async (job) => {
  if (!job || job.sourceType !== "order" || !job.sourceId) return null;

  const order = await Order.findById(job.sourceId);
  if (!order || order.status === ORDER_STATUS.CANCELLED) return order;

  const processingStages = [
    PRODUCTION_STAGE.PERSONALIZATION,
    PRODUCTION_STAGE.ASSEMBLY,
    PRODUCTION_STAGE.QC,
    PRODUCTION_STAGE.PACKING,
    PRODUCTION_STAGE.READY_TO_SHIP,
    PRODUCTION_STAGE.ON_HOLD,
  ];

  if (
    processingStages.includes(job.stage) &&
    order.status === ORDER_STATUS.CONFIRMED
  ) {
    order.status = ORDER_STATUS.PROCESSING;
    await order.save();
  }

  return order;
};
const normalizeProductionItem = (item) => ({
  productId: item.productId || null,
  name: String(item.name || "Production Item").trim(),
  sku: String(item.sku || "").trim(),
  quantity: Math.max(1, Number(item.quantity || 1)),
  personalizationRequired: Boolean(item.personalizationRequired),
  personalizationDetails: item.personalizationDetails || "",
  personalizationStatus: item.personalizationRequired
    ? PRODUCTION_ITEM_STATUS.PENDING
    : PRODUCTION_ITEM_STATUS.NOT_REQUIRED,
  assemblyStatus: PRODUCTION_ITEM_STATUS.PENDING,
  qcStatus: PRODUCTION_ITEM_STATUS.PENDING,
  packingStatus: PRODUCTION_ITEM_STATUS.PENDING,
  notes: item.notes || "",
});

const doneOrNotRequired = (value) =>
  [
    PRODUCTION_ITEM_STATUS.DONE,
    PRODUCTION_ITEM_STATUS.NOT_REQUIRED,
  ].includes(value);

const allItemsDone = (items, field) =>
  Array.isArray(items) &&
  items.length > 0 &&
  items.every((item) => doneOrNotRequired(item[field]));

const hasPersonalization = (items) =>
  (items || []).some((item) => item.personalizationRequired);

const personalizationDone = (items) => {
  const requiredItems = (items || []).filter(
    (item) => item.personalizationRequired
  );

  if (!requiredItems.length) return true;

  return requiredItems.every((item) =>
    doneOrNotRequired(item.personalizationStatus)
  );
};

const firstProductionStage = (job) =>
  hasPersonalization(job.items)
    ? PRODUCTION_STAGE.PERSONALIZATION
    : PRODUCTION_STAGE.ASSEMBLY;

const getResumeStage = (job) => {
  const history = Array.isArray(job.history) ? [...job.history].reverse() : [];

  const previous = history.find(
    (entry) =>
      entry.stage &&
      entry.stage !== PRODUCTION_STAGE.ON_HOLD &&
      entry.stage !== PRODUCTION_STAGE.SHIPPED &&
      entry.stage !== PRODUCTION_STAGE.DELIVERED &&
      entry.stage !== PRODUCTION_STAGE.CANCELLED
  );

  return previous?.stage || PRODUCTION_STAGE.CONFIRMED;
};

const formatPersonalizationDetails = (personalization) => {
  if (!personalization?.enabled) return "";
  const lines = [];
  for (const asset of personalization.assets || []) {
    const type = String(asset.type || "artwork").replaceAll("_", " ");
    const placement = String(asset.placement || "other").replaceAll("_", " ");
    const note = asset.notes ? ` - ${asset.notes}` : "";
    lines.push(`${type} @ ${placement}: ${asset.url}${note}`);
  }
  if (personalization.message) lines.push(`Personalised text: ${personalization.message}`);
  if (personalization.instructions) lines.push(`Instructions: ${personalization.instructions}`);
  return lines.join("\n").slice(0, 5000);
};

const buildOrderProductionItems = (order) => {
  const productionItems = [];

  for (const orderItem of order.items || []) {
    const itemType = orderItem.itemType || "sku";
    const orderQuantity = Math.max(1, Number(orderItem.quantity || 1));

    if (itemType === "custom_hamper") {
      const hamper = orderItem.customHamper || {};

      if (hamper.containerName) {
        productionItems.push(
          normalizeProductionItem({
            name: `Container: ${hamper.containerName}`,
            sku: hamper.containerCode || "CUSTOM-BOX",
            quantity: orderQuantity,
            notes: "Custom hamper container / box.",
          })
        );
      }

      for (const component of hamper.components || []) {
        productionItems.push(
          normalizeProductionItem({
            productId: component.component || null,
            name: component.name || "Custom Hamper Component",
            sku: component.code || "",
            quantity:
              Math.max(1, Number(component.quantity || 1)) * orderQuantity,
            notes: `Custom hamper content for ${orderItem.productName || "Custom Hamper"}.`,
          })
        );
      }

      for (const decoration of hamper.decorations || []) {
        productionItems.push(
          normalizeProductionItem({
            productId: decoration.component || null,
            name: `Decoration: ${decoration.name || "Decorative Material"}`,
            sku: decoration.code || "",
            quantity:
              Math.max(1, Number(decoration.quantity || 1)) * orderQuantity,
            notes: `Decorative finishing for ${orderItem.productName || "Custom Hamper"}. This item does not consume hamper capacity.`,
          })
        );
      }

      if (hamper.personalization?.enabled) {
        productionItems.push(
          normalizeProductionItem({
            name: "Custom Hamper Personalisation / Artwork",
            sku: "CUSTOM-PERSONALISATION",
            quantity: orderQuantity,
            personalizationRequired: true,
            personalizationDetails: formatPersonalizationDetails(hamper.personalization),
            notes:
              "Use the customer-supplied artwork/reference only for this order. Confirm final placement and finish during production/QC.",
          })
        );
      }

      continue;
    }

    productionItems.push(
      normalizeProductionItem({
        productId: orderItem.product || null,
        name: orderItem.productName || "Ready-made Hamper",
        sku: orderItem.skuCode || orderItem.skuName || "",
        quantity: orderQuantity,
        notes: "Ready-made retail order item.",
      })
    );
  }

  return productionItems;
};

const buildOrderJobNotes = (order) => {
  const lines = [
    "Automatically created after successful payment.",
  ];

  if (order.recipient?.fullName) {
    lines.push(`Recipient: ${order.recipient.fullName}`);
  }

  if (order.recipient?.phone) {
    lines.push(`Recipient phone: ${order.recipient.phone}`);
  }

  if (order.giftMessage) {
    lines.push(`Gift message: ${order.giftMessage}`);
  }

  const personalizedHamperCount = (order.items || []).filter(
    (item) => item.itemType === "custom_hamper" && item.customHamper?.personalization?.enabled
  ).length;

  if (personalizedHamperCount > 0) {
    lines.push(`Custom artwork/personalisation present on ${personalizedHamperCount} hamper line(s).`);
  }

  return lines.join("\n");
};

export const ensureProductionJobForOrder = async (
  order,
  { actorId = null, notifyCustomer = true } = {}
) => {
  if (!order?._id) {
    throw new Error("Order is required to create a production job");
  }

  const sourceId = String(order._id);
  const sourceKey = `order:${sourceId}`;

  let existing = await ProductionJob.findOne({
    $or: [
      { sourceKey },
      { sourceType: "order", sourceId },
    ],
  });

  if (existing) {
    let shouldSave = false;

    if (!existing.sourceKey) {
      existing.sourceKey = sourceKey;
      shouldSave = true;
    }

    if (
      !existing.dueDate &&
      (order.deliveryPlan?.dispatchReadyDate || order.deliveryDate)
    ) {
      existing.dueDate =
        order.deliveryPlan?.dispatchReadyDate ||
        order.deliveryDate;
      shouldSave = true;
    }

    if (
      !existing.expectedDeliveryDate &&
      (order.deliveryPlan?.expectedDeliveryDate || order.deliveryDate)
    ) {
      existing.expectedDeliveryDate =
        order.deliveryPlan?.expectedDeliveryDate ||
        order.deliveryDate;
      shouldSave = true;
    }

    if (shouldSave) {
      try {
        await existing.save();
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }

    return {
      job: existing,
      created: false,
    };
  }

  const items = buildOrderProductionItems(order);

  if (!items.length) {
    throw new Error(`Order ${order.orderNumber || sourceId} has no production items`);
  }

  const payload = {
    sourceKey,
    sourceType: "order",
    sourceId,
    customerUser: order.user || null,
    title: `Order ${order.orderNumber || sourceId} Production`,
    items,
    priority: "normal",
    assignedTo: null,
    dueDate:
      order.deliveryPlan?.dispatchReadyDate ||
      order.deliveryDate ||
      null,
    expectedDeliveryDate:
      order.deliveryPlan?.expectedDeliveryDate ||
      order.deliveryDate ||
      null,
    notes: buildOrderJobNotes(order),
    stage: PRODUCTION_STAGE.CONFIRMED,
    createdBy: actorId || null,
    updatedBy: actorId || null,
    history: [
      {
        stage: PRODUCTION_STAGE.CONFIRMED,
        note: "Production job automatically created after successful payment.",
        by: actorId || null,
      },
    ],
  };

  let job;

  try {
    job = await ProductionJob.create(payload);
  } catch (error) {
    if (error?.code !== 11000) throw error;

    job = await ProductionJob.findOne({
      $or: [
        { sourceKey },
        { sourceType: "order", sourceId },
      ],
    });

    if (!job) throw error;

    return {
      job,
      created: false,
    };
  }

  if (notifyCustomer) {
    await createNotification({
      recipient: job.customerUser,
      title: "Production Started",
      message: `Your order ${order.orderNumber || job.jobCode} has entered production.`,
      entityId: job._id,
      actionUrl: `/account/orders/${order._id}`,
    });
  }

  return {
    job,
    created: true,
  };
};

export const syncPaidOrdersToProduction = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.body?.limit) || 200, 1), 500);

  const orders = await Order.find({
    paymentStatus: ORDER_PAYMENT_STATUS.PAID,
  })
    .sort({ paidAt: 1, createdAt: 1 })
    .limit(limit);

  let created = 0;
  let existing = 0;
  let failed = 0;
  const errors = [];

  for (const order of orders) {
    try {
      const result = await ensureProductionJobForOrder(order, {
        actorId: req.user._id,
        notifyCustomer: false,
      });

      if (result.created) created += 1;
      else existing += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        message: error.message,
      });
    }
  }

  await createAuditLog({
    req,
    action: "production_paid_orders_synced",
    module: "production",
    entityType: "production_job",
    entityId: req.user._id,
    description: `Paid-order production sync completed: ${created} created, ${existing} already present, ${failed} failed.`,
    metadata: {
      scanned: orders.length,
      created,
      existing,
      failed,
    },
  });

  res.json({
    success: true,
    message: "Paid orders synced to production.",
    summary: {
      scanned: orders.length,
      created,
      existing,
      failed,
    },
    errors,
  });
};

export const createProductionJob = async (req, res) => {
  const {
    sourceType,
    sourceId,
    customerUser,
    title,
    items,
    priority = "normal",
    assignedTo,
    dueDate,
    expectedDeliveryDate,
    notes = "",
  } = req.body;

  if (!sourceType || !sourceId || !title) {
    return res.status(400).json({
      message: "sourceType, sourceId and title are required.",
    });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({
      message: "At least one production item is required.",
    });
  }

  const normalizedSourceId = String(sourceId);
  const sourceKey = `${sourceType}:${normalizedSourceId}`;

  const existing = await ProductionJob.findOne({
    $or: [
      { sourceKey },
      { sourceType, sourceId: normalizedSourceId },
    ],
  });

  if (existing) {
    return res.status(409).json({
      message: "Production job already exists for this work.",
      job: existing,
    });
  }

  const normalizedItems = items.map(normalizeProductionItem);

  let job;

  try {
    job = await ProductionJob.create({
      sourceKey,
      sourceType,
      sourceId: normalizedSourceId,
      customerUser: customerUser || null,
      title,
      items: normalizedItems,
      priority,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      notes,
      stage: PRODUCTION_STAGE.CONFIRMED,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      history: [
        {
          stage: PRODUCTION_STAGE.CONFIRMED,
          note: "Production job created from confirmed work.",
          by: req.user._id,
        },
      ],
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await ProductionJob.findOne({ sourceKey });

      return res.status(409).json({
        message: "Production job already exists for this work.",
        job: duplicate,
      });
    }

    throw error;
  }

  await createNotification({
    recipient: job.customerUser,
    title: "Production Started",
    message: `Your confirmed work ${job.jobCode} has entered production.`,
    entityId: job._id,
    actionUrl: "/account/orders",
  });

  await createAuditLog({
    req,
    action: "production_job_created",
    module: "production",
    entityType: "production_job",
    entityId: job._id,
    description: `Production job ${job.jobCode} created.`,
    metadata: {
      sourceType,
      sourceId: normalizedSourceId,
      jobCode: job.jobCode,
    },
  });

  res.status(201).json({
    message: "Production job created.",
    job,
  });
};

export const getProductionJobs = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.sourceType) filter.sourceType = req.query.sourceType;
  if (req.query.priority) filter.priority = req.query.priority;

  if (req.query.search) {
    filter.$or = [
      { jobCode: { $regex: req.query.search, $options: "i" } },
      { title: { $regex: req.query.search, $options: "i" } },
      { sourceId: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const [jobs, total] = await Promise.all([
    populateJob(
      ProductionJob.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ).lean(),

    ProductionJob.countDocuments(filter),
  ]);

  res.json({
    jobs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

export const getProductionJobById = async (req, res) => {
  const job = await findJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      message: "Production job not found.",
    });
  }

  res.json({ job });
};

export const updateProductionJob = async (req, res) => {
  const job = await findJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      message: "Production job not found.",
    });
  }

  const allowed = [
    "priority",
    "assignedTo",
    "dueDate",
    "expectedDeliveryDate",
    "notes",
  ];

  const changes = {};

  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      changes[field] = {
        from: job[field],
        to: req.body[field],
      };

      job[field] = req.body[field];
    }
  });

  job.updatedBy = req.user._id;

  await job.save();

  await createAuditLog({
    req,
    action: "production_job_updated",
    module: "production",
    entityType: "production_job",
    entityId: job._id,
    description: `Production job ${job.jobCode} updated.`,
    changes,
  });

  res.json({
    message: "Production job updated.",
    job,
  });
};

export const updateProductionStage = async (req, res) => {
  const { stage, note = "" } = req.body;

  if (!Object.values(PRODUCTION_STAGE).includes(stage)) {
    return res.status(400).json({
      message: "Invalid production stage.",
    });
  }

  if (
    [PRODUCTION_STAGE.SHIPPED, PRODUCTION_STAGE.DELIVERED].includes(stage)
  ) {
    return res.status(400).json({
      message:
        "Shipping and delivery are controlled only from Fulfilment.",
    });
  }

  const job = await findJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      message: "Production job not found.",
    });
  }

  if (
    [PRODUCTION_STAGE.DELIVERED, PRODUCTION_STAGE.CANCELLED].includes(
      job.stage
    )
  ) {
    return res.status(409).json({
      message: `Cannot move a ${job.stage} production job.`,
    });
  }

  if (stage === job.stage) {
    return res.status(200).json({
      message: "Production stage is already up to date.",
      job,
    });
  }

  if (job.sourceType === "order") {
    if (stage === PRODUCTION_STAGE.CANCELLED) {
      const linkedOrder = await Order.findById(job.sourceId).select(
        "status"
      );

      if (linkedOrder && linkedOrder.status !== ORDER_STATUS.CANCELLED) {
        return res.status(409).json({
          message:
            "Retail production can be cancelled only through the order cancellation workflow.",
        });
      }
    } else if (stage === PRODUCTION_STAGE.ON_HOLD) {
      if (
        [
          PRODUCTION_STAGE.SHIPPED,
          PRODUCTION_STAGE.DELIVERED,
          PRODUCTION_STAGE.CANCELLED,
        ].includes(job.stage)
      ) {
        return res.status(409).json({
          message: "This production job can no longer be put on hold.",
        });
      }
    } else if (job.stage === PRODUCTION_STAGE.ON_HOLD) {
      const resumeStage = getResumeStage(job);

      if (stage !== resumeStage) {
        return res.status(409).json({
          message: `Resume this job at ${String(resumeStage).replaceAll(
            "_",
            " "
          )}.`,
        });
      }
    } else if (job.stage === PRODUCTION_STAGE.CONFIRMED) {
      const allowedStartStage = firstProductionStage(job);

      if (stage !== allowedStartStage) {
        return res.status(409).json({
          message: `Start production at ${String(
            allowedStartStage
          ).replaceAll("_", " ")}.`,
        });
      }
    } else {
      return res.status(409).json({
        message:
          "Retail production advances from item completion and QC. Update the current production step instead of skipping stages.",
      });
    }
  }

  const previousStage = job.stage;

  job.stage = stage;
  job.updatedBy = req.user._id;

  job.history.push({
    stage,
    note: note || `Moved from ${previousStage} to ${stage}.`,
    by: req.user._id,
  });

  await job.save();
  await syncRetailOrderFromProduction(job);

  if (
    job.sourceType !== "order" ||
    previousStage === PRODUCTION_STAGE.CONFIRMED ||
    previousStage === PRODUCTION_STAGE.ON_HOLD ||
    stage === PRODUCTION_STAGE.ON_HOLD
  ) {
    await createNotification({
      recipient: job.customerUser?._id || job.customerUser,
      title:
        stage === PRODUCTION_STAGE.ON_HOLD
          ? "Production Update"
          : "Order Preparation Update",
      message:
        stage === PRODUCTION_STAGE.ON_HOLD
          ? `${job.jobCode} is temporarily on hold.`
          : `${job.jobCode} is now being prepared.`,
      entityId: job._id,
      actionUrl: "/account/orders",
    });
  }

  await createAuditLog({
    req,
    action: "production_stage_changed",
    module: "production",
    entityType: "production_job",
    entityId: job._id,
    description: `${job.jobCode}: ${previousStage} → ${job.stage}`,
    changes: {
      stage: {
        from: previousStage,
        to: job.stage,
      },
    },
  });

  res.json({
    message: "Production stage updated.",
    job,
  });
};

export const updateProductionItem = async (req, res) => {
  const job = await findJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      message: "Production job not found.",
    });
  }

  if (
    [
      PRODUCTION_STAGE.READY_TO_SHIP,
      PRODUCTION_STAGE.SHIPPED,
      PRODUCTION_STAGE.DELIVERED,
      PRODUCTION_STAGE.CANCELLED,
    ].includes(job.stage)
  ) {
    return res.status(409).json({
      message: "Production items can no longer be changed at this stage.",
    });
  }

  const item = job.items.id(req.params.itemId);

  if (!item) {
    return res.status(404).json({
      message: "Production item not found.",
    });
  }

  const statusFields = [
    "personalizationStatus",
    "assemblyStatus",
    "qcStatus",
    "packingStatus",
  ];

  const allowedFields = [
    ...statusFields,
    "personalizationDetails",
    "notes",
  ];

  if (job.sourceType === "order") {
    const stageFieldMap = {
      [PRODUCTION_STAGE.PERSONALIZATION]: "personalizationStatus",
      [PRODUCTION_STAGE.ASSEMBLY]: "assemblyStatus",
      [PRODUCTION_STAGE.PACKING]: "packingStatus",
    };

    const activeStatusField = stageFieldMap[job.stage] || null;

    for (const field of statusFields) {
      if (
        Object.prototype.hasOwnProperty.call(req.body, field) &&
        field !== activeStatusField
      ) {
        return res.status(409).json({
          message:
            job.stage === PRODUCTION_STAGE.QC
              ? "Use the QC action for quality-control results."
              : `Only ${activeStatusField || "the active production step"} can be updated right now.`,
        });
      }
    }
  }

  const previousStage = job.stage;
  const changes = {};

  for (const field of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;

    if (
      statusFields.includes(field) &&
      !Object.values(PRODUCTION_ITEM_STATUS).includes(req.body[field])
    ) {
      return res.status(400).json({
        message: `Invalid ${field}.`,
      });
    }

    changes[field] = {
      from: item[field],
      to: req.body[field],
    };

    item[field] = req.body[field];
  }

  job.updatedBy = req.user._id;

  await job.save();
  await syncRetailOrderFromProduction(job);

  if (
    previousStage !== job.stage &&
    job.stage === PRODUCTION_STAGE.READY_TO_SHIP
  ) {
    // Shipment creation is handled by productionAutomation.service.js.
  }

  await createAuditLog({
    req,
    action: "production_item_updated",
    module: "production",
    entityType: "production_job",
    entityId: job._id,
    description: `${job.jobCode} item "${item.name}" updated.`,
    changes,
    metadata: {
      itemId: item._id,
      previousStage,
      currentStage: job.stage,
    },
  });

  res.json({
    message:
      previousStage !== job.stage
        ? `Item updated. Production moved to ${String(job.stage).replaceAll(
            "_",
            " "
          )}.`
        : "Production item updated.",
    job,
    item,
  });
};

export const submitQCResult = async (req, res) => {
  const { status, notes = "" } = req.body;

  if (![QC_STATUS.PASSED, QC_STATUS.FAILED].includes(status)) {
    return res.status(400).json({
      message: "QC status must be passed or failed.",
    });
  }

  const job = await findJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      message: "Production job not found.",
    });
  }

  if (job.stage !== PRODUCTION_STAGE.QC) {
    return res.status(409).json({
      message: "Production job must be in QC stage.",
    });
  }

  job.qc.status = status;
  job.qc.notes = notes;
  job.qc.checkedBy = req.user._id;
  job.qc.checkedAt = new Date();
  job.updatedBy = req.user._id;

  if (status === QC_STATUS.PASSED) {
    for (const item of job.items || []) {
      if (item.qcStatus !== PRODUCTION_ITEM_STATUS.NOT_REQUIRED) {
        item.qcStatus = PRODUCTION_ITEM_STATUS.DONE;
      }
    }

    job.stage = PRODUCTION_STAGE.PACKING;

    job.history.push({
      stage: PRODUCTION_STAGE.PACKING,
      note: "QC passed. Job moved to packing.",
      by: req.user._id,
    });
  } else {
    for (const item of job.items || []) {
      if (item.qcStatus !== PRODUCTION_ITEM_STATUS.NOT_REQUIRED) {
        item.qcStatus = PRODUCTION_ITEM_STATUS.PENDING;
      }
    }

    job.history.push({
      stage: PRODUCTION_STAGE.QC,
      note: "QC failed. Rework is required before packing.",
      by: req.user._id,
    });
  }

  await job.save();
  await syncRetailOrderFromProduction(job);

  await createAuditLog({
    req,
    action: status === QC_STATUS.PASSED ? "qc_passed" : "qc_failed",
    module: "production",
    entityType: "production_job",
    entityId: job._id,
    description: `${job.jobCode} QC ${status}.`,
    metadata: { notes },
  });

  res.json({
    message:
      status === QC_STATUS.PASSED
        ? "QC passed. Production moved to packing."
        : "QC failed. Keep the job in QC until rework is complete.",
    job,
  });
};

