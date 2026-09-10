import mongoose from "mongoose";

import SupportTicket, {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from "./supportTicket.model.js";
import Order from "../orders/order.model.js";
import Refund from "../refunds/refund.model.js";

import asyncHandler from "../../utils/asyncHandler.js";
import createAuditLog from "../../helpers/createAuditLog.js";
import notifyUser from "../../helpers/notifyUser.js";
import { NOTIFICATION_TYPE } from "../../constants/statuses.js";

const isValidId = (value) => mongoose.isValidObjectId(value);
const clean = (value, maxLength) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const pageParams = (req, defaultLimit = 20) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const normalizeAttachments = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 5)
    .filter((item) => item?.url)
    .map((item) => ({
      url: clean(item.url, 2000),
      name: clean(item.name, 180),
    }));
};

const actorRole = (req) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role];
  if (roles.includes("admin")) return "admin";
  if (roles.includes("operations")) return "operations";
  return "customer";
};

const findTicket = async (value) => {
  if (isValidId(value)) {
    const byId = await SupportTicket.findById(value);
    if (byId) return byId;
  }
  return SupportTicket.findOne({ ticketNumber: clean(value, 80).toUpperCase() });
};

const populateTicket = (query) =>
  query
    .populate("user", "name email phone")
    .populate("order", "orderNumber status paymentStatus totalAmount currency deliveryDate")
    .populate("refund", "status amount currency razorpayRefundId")
    .populate("assignedTo", "name email")
    .populate("messages.author", "name email");

const notifyCustomer = ({ ticket, title, message, eventKey }) => {
  void notifyUser({
    recipient: ticket.user?._id || ticket.user,
    type: NOTIFICATION_TYPE.SYSTEM,
    title,
    message,
    entityType: "support_ticket",
    entityId: ticket._id,
    actionUrl: `/account/support/${ticket._id}`,
    eventKey,
    email: {
      enabled: true,
      subject: `${title} - ${ticket.ticketNumber}`,
      textContent: message,
    },
  });
};

export const createSupportTicket = asyncHandler(async (req, res) => {
  const category = clean(req.body?.category, 60).toLowerCase();
  const subject = clean(req.body?.subject, 180);
  const message = clean(req.body?.message, 5000);
  const orderId = req.body?.orderId || null;
  const refundId = req.body?.refundId || null;

  if (!SUPPORT_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: "Invalid support category" });
  }
  if (subject.length < 3) {
    return res.status(400).json({ success: false, message: "Subject must be at least 3 characters" });
  }
  if (message.length < 5) {
    return res.status(400).json({ success: false, message: "Message must be at least 5 characters" });
  }

  let order = null;
  let refund = null;

  if (orderId) {
    if (!isValidId(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }
    order = await Order.findOne({ _id: orderId, user: req.user._id }).select("_id");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
  }

  if (refundId) {
    if (!isValidId(refundId)) {
      return res.status(400).json({ success: false, message: "Invalid refund ID" });
    }
    refund = await Refund.findOne({ _id: refundId, user: req.user._id }).select("_id order");
    if (!refund) {
      return res.status(404).json({ success: false, message: "Refund not found" });
    }
    if (order && String(refund.order) !== String(order._id)) {
      return res.status(400).json({ success: false, message: "Refund does not belong to the selected order" });
    }
  }

  const ticket = await SupportTicket.create({
    user: req.user._id,
    order: order?._id || refund?.order || null,
    refund: refund?._id || null,
    category,
    subject,
    status: "open",
    priority: "normal",
    lastMessageAt: new Date(),
    messages: [
      {
        author: req.user._id,
        role: "customer",
        message,
        attachments: normalizeAttachments(req.body?.attachments),
      },
    ],
  });

  await createAuditLog({
    req,
    action: "support_ticket_created",
    module: "support",
    entityType: "support_ticket",
    entityId: ticket._id,
    description: `Support ticket ${ticket.ticketNumber} created.`,
    metadata: { category, orderId: ticket.order, refundId: ticket.refund },
  });

  res.status(201).json({
    success: true,
    message: "Support request submitted",
    ticket,
  });
});

export const getMySupportTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req);
  const filter = { user: req.user._id };

  if (req.query.status) {
    if (!SUPPORT_STATUSES.includes(req.query.status)) {
      return res.status(400).json({ success: false, message: "Invalid ticket status" });
    }
    filter.status = req.query.status;
  }

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate("order", "orderNumber status")
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("ticketNumber category subject status priority order lastMessageAt resolvedAt closedAt createdAt")
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);

  res.json({
    success: true,
    tickets,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getMySupportTicketById = asyncHandler(async (req, res) => {
  const ticket = await populateTicket(
    SupportTicket.findOne({
      $or: [
        ...(isValidId(req.params.ticketId) ? [{ _id: req.params.ticketId }] : []),
        { ticketNumber: clean(req.params.ticketId, 80).toUpperCase() },
      ],
      user: req.user._id,
    })
  ).lean();

  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  res.json({ success: true, ticket });
});

export const replyToMySupportTicket = asyncHandler(async (req, res) => {
  const message = clean(req.body?.message, 5000);
  if (message.length < 2) {
    return res.status(400).json({ success: false, message: "Reply is required" });
  }

  const ticket = await findTicket(req.params.ticketId);
  if (!ticket || String(ticket.user) !== String(req.user._id)) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  if (ticket.status === "closed") {
    return res.status(409).json({ success: false, message: "Closed ticket cannot receive new replies" });
  }

  ticket.messages.push({
    author: req.user._id,
    role: "customer",
    message,
    attachments: normalizeAttachments(req.body?.attachments),
  });
  ticket.lastMessageAt = new Date();

  if (["resolved", "waiting_customer"].includes(ticket.status)) {
    ticket.status = "open";
    ticket.resolvedAt = null;
  }

  await ticket.save();

  res.json({ success: true, message: "Reply added", ticket });
});

export const getAdminSupportTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req, 30);
  const filter = {};

  if (req.query.status) {
    if (!SUPPORT_STATUSES.includes(req.query.status)) {
      return res.status(400).json({ success: false, message: "Invalid ticket status" });
    }
    filter.status = req.query.status;
  }

  if (req.query.priority) {
    if (!SUPPORT_PRIORITIES.includes(req.query.priority)) {
      return res.status(400).json({ success: false, message: "Invalid ticket priority" });
    }
    filter.priority = req.query.priority;
  }

  if (req.query.category) {
    if (!SUPPORT_CATEGORIES.includes(req.query.category)) {
      return res.status(400).json({ success: false, message: "Invalid ticket category" });
    }
    filter.category = req.query.category;
  }

  if (req.query.assignedTo === "me") filter.assignedTo = req.user._id;
  if (req.query.unassigned === "true") filter.assignedTo = null;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate("user", "name email phone")
      .populate("order", "orderNumber status paymentStatus")
      .populate("assignedTo", "name email")
      .sort({ priority: -1, lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("ticketNumber user order category subject status priority assignedTo lastMessageAt createdAt")
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);

  res.json({
    success: true,
    tickets,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getAdminSupportTicketById = asyncHandler(async (req, res) => {
  const ticket = await findTicket(req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  await ticket.populate([
    { path: "user", select: "name email phone" },
    { path: "order", select: "orderNumber status paymentStatus totalAmount currency deliveryDate cancellation" },
    { path: "refund", select: "status amount currency razorpayRefundId" },
    { path: "assignedTo", select: "name email" },
    { path: "messages.author", select: "name email" },
  ]);

  res.json({ success: true, ticket });
});

export const replyToSupportTicketAdmin = asyncHandler(async (req, res) => {
  const message = clean(req.body?.message, 5000);
  if (message.length < 2) {
    return res.status(400).json({ success: false, message: "Reply is required" });
  }

  const ticket = await findTicket(req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  const role = actorRole(req);
  ticket.messages.push({
    author: req.user._id,
    role: role === "customer" ? "operations" : role,
    message,
    attachments: normalizeAttachments(req.body?.attachments),
  });
  ticket.lastMessageAt = new Date();
  ticket.status = req.body?.keepInProgress ? "in_progress" : "waiting_customer";
  ticket.assignedTo = ticket.assignedTo || req.user._id;
  ticket.resolvedAt = null;
  ticket.closedAt = null;
  await ticket.save();

  notifyCustomer({
    ticket,
    title: "Support Reply Received",
    message: `HAMPORIUM replied to ${ticket.ticketNumber}: ${message.slice(0, 220)}`,
    eventKey: `support-reply:${ticket._id}:${ticket.messages.length}`,
  });

  await createAuditLog({
    req,
    action: "support_ticket_replied",
    module: "support",
    entityType: "support_ticket",
    entityId: ticket._id,
    description: `Internal reply sent on ${ticket.ticketNumber}.`,
  });

  res.json({ success: true, message: "Reply sent", ticket });
});

export const updateSupportTicketAdmin = asyncHandler(async (req, res) => {
  const ticket = await findTicket(req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, message: "Support ticket not found" });
  }

  const previous = {
    status: ticket.status,
    priority: ticket.priority,
    assignedTo: ticket.assignedTo,
  };

  if (req.body.status !== undefined) {
    const status = clean(req.body.status, 40).toLowerCase();
    if (!SUPPORT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid ticket status" });
    }
    ticket.status = status;
    ticket.resolvedAt = status === "resolved" ? new Date() : null;
    ticket.closedAt = status === "closed" ? new Date() : null;
  }

  if (req.body.priority !== undefined) {
    const priority = clean(req.body.priority, 40).toLowerCase();
    if (!SUPPORT_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: "Invalid ticket priority" });
    }
    ticket.priority = priority;
  }

  if (req.body.assignedTo !== undefined) {
    if (req.body.assignedTo === null || req.body.assignedTo === "") {
      ticket.assignedTo = null;
    } else if (!isValidId(req.body.assignedTo)) {
      return res.status(400).json({ success: false, message: "Invalid assignee ID" });
    } else {
      ticket.assignedTo = req.body.assignedTo;
    }
  }

  await ticket.save();

  if (previous.status !== ticket.status) {
    notifyCustomer({
      ticket,
      title: "Support Request Updated",
      message: `${ticket.ticketNumber} is now ${ticket.status.replaceAll("_", " ")}.`,
      eventKey: `support-status:${ticket._id}:${ticket.status}`,
    });
  }

  await createAuditLog({
    req,
    action: "support_ticket_updated",
    module: "support",
    entityType: "support_ticket",
    entityId: ticket._id,
    description: `Support ticket ${ticket.ticketNumber} updated.`,
    changes: {
      status: { from: previous.status, to: ticket.status },
      priority: { from: previous.priority, to: ticket.priority },
      assignedTo: { from: previous.assignedTo, to: ticket.assignedTo },
    },
  });

  res.json({ success: true, message: "Support ticket updated", ticket });
});
