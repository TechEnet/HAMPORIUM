import Notification from "./notification.model.js";
import { NOTIFICATION_STATUS } from "../../constants/statuses.js";

export const getMyNotifications = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { recipient: req.user._id };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Notification.countDocuments(filter),

    Notification.countDocuments({
      recipient: req.user._id,
      status: NOTIFICATION_STATUS.UNREAD,
    }),
  ]);

  res.json({
    notifications,
    unread,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

export const markNotificationRead = async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({ message: "Notification not found." });
  }

  notification.status = NOTIFICATION_STATUS.READ;
  notification.readAt = new Date();

  await notification.save();

  res.json({
    message: "Notification marked as read.",
    notification,
  });
};

export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany(
    {
      recipient: req.user._id,
      status: NOTIFICATION_STATUS.UNREAD,
    },
    {
      $set: {
        status: NOTIFICATION_STATUS.READ,
        readAt: new Date(),
      },
    }
  );

  res.json({ message: "All notifications marked as read." });
};

export const getAllNotifications = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.recipient) filter.recipient = req.query.recipient;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Notification.countDocuments(filter),
  ]);

  res.json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};