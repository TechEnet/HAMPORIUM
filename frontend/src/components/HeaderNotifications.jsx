import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import api from "../api/api.js";

const PAGE_SIZE = 12;

const formatNotificationDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const typeLabel = (value) =>
  String(value || "system")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const HeaderNotifications = ({
  darkContent,
  unread = 0,
  onUnreadChange,
  mobile = false,
}) => {
  const location = useLocation();
  const rootRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = async ({
    pageNumber = 1,
    append = false,
  } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError("");

    try {
      const response = await api.get("/notifications/mine", {
        params: {
          page: pageNumber,
          limit: PAGE_SIZE,
        },
      });

      const items = response.data?.notifications || [];

      setNotifications((current) =>
        append
          ? [
              ...current,
              ...items.filter(
                (incoming) =>
                  !current.some(
                    (existing) => existing._id === incoming._id
                  )
              ),
            ]
          : items
      );

      setPagination(response.data?.pagination || null);
      setPage(pageNumber);
      onUnreadChange?.(Number(response.data?.unread || 0));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load notifications."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    void loadNotifications({
      pageNumber: 1,
      append: false,
    });
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const markRead = async (notification) => {
    if (!notification?._id || notification.status === "read") {
      return;
    }

    try {
      await api.patch(`/notifications/${notification._id}/read`);

      setNotifications((current) =>
        current.map((item) =>
          item._id === notification._id
            ? {
                ...item,
                status: "read",
                readAt: new Date().toISOString(),
              }
            : item
        )
      );

      onUnreadChange?.(
        Math.max(0, Number(unread) - 1)
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to mark notification as read."
      );
    }
  };

  const markAllRead = async () => {
    if (!Number(unread) || working) {
      return;
    }

    setWorking(true);
    setError("");

    try {
      await api.patch("/notifications/read-all");

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          status: "read",
          readAt: item.readAt || new Date().toISOString(),
        }))
      );

      onUnreadChange?.(0);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to mark all notifications as read."
      );
    } finally {
      setWorking(false);
    }
  };

  const loadMore = async () => {
    if (
      loadingMore ||
      !pagination ||
      page >= Number(pagination.pages || 1)
    ) {
      return;
    }

    await loadNotifications({
      pageNumber: page + 1,
      append: true,
    });
  };

  const closeAfterAction = (notification) => {
    void markRead(notification);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`relative flex ${
          mobile ? "h-10 w-10" : "h-11 w-11"
        } items-center justify-center rounded-full transition duration-300 ${
          open
            ? "bg-[#F97316] text-white shadow-[0_8px_22px_rgba(249,115,22,.28)]"
            : darkContent
              ? "text-[#171717] hover:bg-black/[0.05] hover:text-[#F97316]"
              : "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.65)] hover:bg-white/10 hover:text-[#F97316]"
        }`}
      >
        <BellIcon />

        {Number(unread) > 0 && (
          <span
            className={`absolute flex items-center justify-center rounded-full bg-[#F97316] font-black leading-none text-white ring-2 ring-white ${
              mobile
                ? "right-0 top-0 min-h-[17px] min-w-[17px] px-1 text-[8px]"
                : "-right-0.5 -top-0.5 min-h-[18px] min-w-[18px] px-1 text-[9px]"
            }`}
          >
            {Number(unread) > 99 ? "99+" : Number(unread)}
          </span>
        )}
      </button>

      {open && (
        <div
          className={
            mobile
              ? "fixed left-3 right-3 top-[70px] z-[180] overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-[0_28px_90px_rgba(0,0,0,.24)]"
              : "absolute right-0 top-[calc(100%+12px)] z-[180] w-[390px] overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-[0_28px_90px_rgba(0,0,0,.20)]"
          }
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-[#F97316] via-[#D4AF37] to-[#F97316]" />

          <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FFF9F2] px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-serif text-[20px] font-semibold leading-none text-[#171717]">
                  Notifications
                </p>

                {Number(unread) > 0 && (
                  <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#F97316] px-1.5 py-1 text-[8px] font-black leading-none text-white">
                    {Number(unread) > 99 ? "99+" : Number(unread)}
                  </span>
                )}
              </div>

              <p className="mt-1.5 text-[9px] font-medium text-black/38">
                Order, payment, delivery and refund updates
              </p>
            </div>

            <button
              type="button"
              disabled={!Number(unread) || working}
              onClick={() => void markAllRead()}
              className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[8px] font-black uppercase tracking-[0.06em] text-[#171717] transition hover:border-[#F97316]/40 hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {working ? "Updating..." : "Mark all read"}
            </button>
          </div>

          {error && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-[9px] font-semibold text-red-700">
              {error}
            </div>
          )}

          <div
            className={`overflow-y-auto ${
              mobile
                ? "max-h-[calc(100vh-165px)]"
                : "max-h-[430px]"
            }`}
          >
            {loading ? (
              <NotificationSkeleton />
            ) : !notifications.length ? (
              <EmptyNotifications />
            ) : (
              <div className="divide-y divide-black/[0.055]">
                {notifications.map((notification) => {
                  const isUnread =
                    notification.status === "unread";

                  return (
                    <article
                      key={notification._id}
                      className={`relative px-4 py-3.5 transition ${
                        isUnread
                          ? "bg-[#FFF9F2]/80"
                          : "bg-white"
                      }`}
                    >
                      {isUnread && (
                        <span className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-[#F97316]" />
                      )}

                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isUnread
                              ? "bg-[#FFF1E8] text-[#F97316]"
                              : "bg-black/[0.035] text-black/35"
                          }`}
                        >
                          <NotificationGlyph type={notification.type} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-[11px] ${
                                  isUnread
                                    ? "font-black text-[#171717]"
                                    : "font-bold text-[#171717]/75"
                                }`}
                              >
                                {notification.title}
                              </p>

                              <p className="mt-1 line-clamp-2 text-[9px] font-medium leading-[1.55] text-black/46">
                                {notification.message}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-full bg-black/[0.035] px-2 py-1 text-[7px] font-extrabold uppercase tracking-[0.06em] text-black/35">
                              {typeLabel(notification.type)}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-3">
                            <p className="truncate text-[8px] font-medium text-black/28">
                              {formatNotificationDate(
                                notification.createdAt
                              )}
                            </p>

                            <div className="flex shrink-0 items-center gap-2">
                              {isUnread && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void markRead(notification)
                                  }
                                  className="text-[8px] font-extrabold text-black/35 transition hover:text-[#F97316]"
                                >
                                  Mark read
                                </button>
                              )}

                              {notification.actionUrl && (
                                <Link
                                  to={notification.actionUrl}
                                  onClick={() =>
                                    closeAfterAction(notification)
                                  }
                                  className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-2.5 py-1.5 text-[8px] font-black text-white transition hover:bg-[#F97316]"
                                >
                                  Open
                                  <span>→</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {pagination &&
            Number(pagination.pages || 1) > page && (
              <div className="border-t border-black/[0.06] bg-white p-3">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="w-full rounded-xl border border-black/[0.08] bg-[#FFF9F2] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#171717] transition hover:border-[#F97316]/30 hover:text-[#F97316] disabled:opacity-40"
                >
                  {loadingMore
                    ? "Loading..."
                    : "Load older notifications"}
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

const NotificationGlyph = ({ type }) => {
  const normalized = String(type || "").toLowerCase();

  if (normalized === "payment" || normalized === "refund") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-4 w-4"
      >
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </svg>
    );
  }

  if (normalized === "shipment" || normalized === "production") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-4 w-4"
      >
        <path d="M4 6h11v11H4V6Z" />
        <path d="M15 10h3l2 3v4h-5v-7Z" />
        <circle cx="8" cy="19" r="1.5" />
        <circle cx="18" cy="19" r="1.5" />
      </svg>
    );
  }

  return <BellIcon small />;
};

const EmptyNotifications = () => (
  <div className="flex min-h-[220px] flex-col items-center justify-center px-8 py-10 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1E8] text-[#F97316]">
      <BellIcon />
    </span>

    <p className="mt-4 text-[12px] font-black text-[#171717]">
      You&apos;re all caught up
    </p>

    <p className="mt-1.5 max-w-[250px] text-[9px] font-medium leading-5 text-black/38">
      Your order, payment, delivery and refund updates will appear here.
    </p>
  </div>
);

const NotificationSkeleton = () => (
  <div className="divide-y divide-black/[0.05]">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className="flex gap-3 px-4 py-4">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-black/[0.05]" />

        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-black/[0.08]" />
          <div className="h-2 w-full animate-pulse rounded bg-black/[0.04]" />
          <div className="h-2 w-2/3 animate-pulse rounded bg-black/[0.04]" />
        </div>
      </div>
    ))}
  </div>
);

const BellIcon = ({ small = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={small ? "h-4 w-4" : "h-[22px] w-[22px]"}
  >
    <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z" />
    <path d="M10 20h4" />
  </svg>
);

export default HeaderNotifications;
