
import Notification from "./notification.model.js";
import { NOTIFICATION_STATUS } from "../../constants/statuses.js";

export const getMyNotifications = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // Retired refund messages stay archived in MongoDB for financial auditing,
  // but never appear in the active customer/admin notification feed.
  const filter = { recipient: req.user._id, type: { $ne: "refund" } };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type && req.query.type !== "refund") filter.type = req.query.type;
  if (req.query.type === "refund") return res.json({
    notifications: [], unread: 0,
    pagination: { page, limit, total: 0, pages: 0 },
  });

  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({
      recipient: req.user._id,
      type: { $ne: "refund" },
      status: NOTIFICATION_STATUS.UNREAD,
    }),
  ]);

  return res.json({
    notifications,
    unread,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const markNotificationRead = async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
    type: { $ne: "refund" },
  });
  if (!notification) return res.status(404).json({ message: "Notification not found." });

  notification.status = NOTIFICATION_STATUS.READ;
  notification.readAt = new Date();
  await notification.save();
  return res.json({ message: "Notification marked as read.", notification });
};

export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany(
    {
      recipient: req.user._id,
      type: { $ne: "refund" },
      status: NOTIFICATION_STATUS.UNREAD,
    },
    { $set: { status: NOTIFICATION_STATUS.READ, readAt: new Date() } }
  );
  return res.json({ message: "All notifications marked as read." });
};

export const getAllNotifications = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { type: { $ne: "refund" } };
  if (req.query.recipient) filter.recipient = req.query.recipient;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type && req.query.type !== "refund") filter.type = req.query.type;
  if (req.query.type === "refund") return res.json({
    notifications: [],
    pagination: { page, limit, total: 0, pages: 0 },
  });

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return res.json({
    notifications,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};
