import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

import formatCurrency from "../../../utils/formatCurrency.js";
import formatDate from "../../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (status) {
          params.set("status", status);
        }

        if (paymentStatus) {
          params.set("paymentStatus", paymentStatus);
        }

        const response = await api.get(
          `/admin/orders?${params.toString()}`
        );

        setOrders(response.data.orders || []);
        setPagination(response.data.pagination);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Unable to load orders"
        );
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadOrders, 300);

    return () => clearTimeout(timer);
  }, [search, status, paymentStatus, page]);

  const filtersActive =
    search.trim() || status || paymentStatus;

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPaymentStatus("");
    setPage(1);
  };

  return (
    <div
      className="mx-auto w-full max-w-[1600px] pb-12 text-[#171717]"
      style={{
        fontFamily: "'Manrope', Arial, sans-serif",
      }}
    >
      {/* HEADER */}

      <header className="flex flex-col gap-5 border-b border-black/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#F97316]" />

            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
              Order Management
            </p>
          </div>

          <h1
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-2 text-[42px] font-semibold leading-none tracking-[-0.035em] sm:text-[50px]"
          >
            Orders
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/45">
            Review customer orders, payment state, delivery
            recipient and current fulfilment progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/refunds"
            className="rounded-xl bg-[#171717] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#F97316]"
          >
            Cancellation / Refund Queue
          </Link>
          <div className="rounded-xl border border-black/[0.07] bg-white px-4 py-2.5">
            <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
              Showing
            </p>

            <p className="mt-0.5 text-lg font-black leading-none">
              {orders.length}
            </p>
          </div>

          {pagination && (
            <div className="rounded-xl border border-black/[0.07] bg-white px-4 py-2.5">
              <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
                Current Page
              </p>

              <p className="mt-0.5 text-lg font-black leading-none">
                {pagination.page}
                <span className="ml-1 text-xs font-semibold text-black/25">
                  / {pagination.totalPages}
                </span>
              </p>
            </div>
          )}
        </div>
      </header>

      {/* FILTERS */}

      <section className="mt-7 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-7">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
              Search & Filter
            </p>

            <h2 className="mt-1 text-sm font-extrabold text-[#171717]">
              Find Orders
            </h2>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.06em] text-black/40 transition hover:bg-black/[0.04] hover:text-[#F97316]"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[minmax(320px,1.5fr)_1fr_1fr] sm:p-7">
          <FieldGroup
            label="Search Order"
            icon={<SearchIcon />}
          >
            <input
              placeholder="Order number, recipient, phone..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
          </FieldGroup>

          <FieldGroup label="Order Status">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All Order Statuses</option>
              <option value="pending_payment">
                Pending Payment
              </option>
              <option value="payment_failed">
                Payment Failed
              </option>
              <option value="confirmed">
                Confirmed
              </option>
              <option value="processing">
                Processing
              </option>
              <option value="shipped">
                Shipped
              </option>
              <option value="delivered">
                Delivered
              </option>
              <option value="cancelled">
                Cancelled
              </option>
            </select>
          </FieldGroup>

          <FieldGroup label="Payment Status">
            <select
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">
                All Payment Statuses
              </option>
              <option value="pending">
                Pending
              </option>
              <option value="paid">
                Paid
              </option>
              <option value="failed">
                Failed
              </option>
              <option value="refunded">
                Refunded
              </option>
            </select>
          </FieldGroup>
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* ORDER LIST */}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-5 sm:px-7">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
              Order Register
            </p>

            <h2
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-1 text-[26px] font-semibold leading-none"
            >
              All Orders
            </h2>

            <p className="mt-2 text-xs text-black/40">
              Customer, recipient, commercial and payment
              information in one view.
            </p>
          </div>

          {loading && (
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-black/35">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#F97316]" />
              Updating
            </span>
          )}
        </div>

        {loading ? (
          <OrdersLoading />
        ) : !orders.length ? (
          <EmptyOrders />
        ) : (
          <>
            {/* DESKTOP */}

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] text-left">
                <thead>
                  <tr className="bg-[#FAFAF9]">
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Order Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead alignRight>
                      Action
                    </TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/[0.055]">
                  {orders.map((order) => (
                    <tr
                      key={order._id}
                      className="transition hover:bg-[#FFF9F2]/45"
                    >
                      <td className="px-5 py-5 sm:px-7">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F97316]">
                            <OrderIcon />
                          </span>

                          <div>
                            <p className="text-xs font-extrabold text-[#171717]">
                              {order.orderNumber}
                            </p>

                            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-black/25">
                              Customer Order
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <p className="max-w-[190px] truncate text-xs font-bold text-[#171717]">
                          {order.user?.name || "-"}
                        </p>

                        <p className="mt-1 max-w-[190px] truncate text-[10px] text-black/40">
                          {order.user?.email || "-"}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <p className="max-w-[170px] truncate text-xs font-bold text-[#171717]">
                          {order.recipient?.fullName ||
                            "-"}
                        </p>

                        <p className="mt-1 text-[10px] text-black/40">
                          {order.recipient?.phone || "-"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-xs font-extrabold text-[#171717]">
                        {formatCurrency(
                          order.totalAmount
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <StatusBadge
                          status={order.status}
                        />
                        {order.cancellation?.status === "requested" && (
                          <div className="mt-1.5">
                            <StatusBadge status="requested" label="Cancellation Requested" />
                          </div>
                        )}
                        {order.cancellation?.status === "requested" && (
                          <div className="mt-1.5">
                            <StatusBadge status="requested" label="Cancellation Requested" />
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <StatusBadge
                          status={
                            order.paymentStatus
                          }
                        />
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-[11px] font-medium text-black/40">
                        {formatDate(order.createdAt)}
                      </td>

                      <td className="px-5 py-5 text-right sm:pr-7">
                        <Link
                          to={`/admin/orders/${order._id}`}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/[0.08] px-3.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-black/50 transition hover:border-[#F97316] hover:bg-[#F97316] hover:text-white"
                        >
                          View
                          <ArrowIcon />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}

            <div className="divide-y divide-black/[0.06] lg:hidden">
              {orders.map((order) => (
                <article
                  key={order._id}
                  className="p-5 transition hover:bg-[#FFF9F2]/45"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F97316]">
                        <OrderIcon />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold">
                          {order.orderNumber}
                        </p>

                        <p className="mt-1 text-[10px] text-black/40">
                          {formatDate(
                            order.createdAt
                          )}
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-black">
                      {formatCurrency(
                        order.totalAmount
                      )}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <MobileInfo
                      label="Customer"
                      value={
                        order.user?.name ||
                        order.user?.email ||
                        "-"
                      }
                    />

                    <MobileInfo
                      label="Recipient"
                      value={
                        order.recipient
                          ?.fullName || "-"
                      }
                    />

                    <div>
                      <MobileInfoLabel>
                        Order Status
                      </MobileInfoLabel>

                      <StatusBadge
                        status={order.status}
                      />
                    </div>

                    <div>
                      <MobileInfoLabel>
                        Payment
                      </MobileInfoLabel>

                      <StatusBadge
                        status={
                          order.paymentStatus
                        }
                      />
                    </div>
                  </div>

                  <Link
                    to={`/admin/orders/${order._id}`}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#F97316]"
                  >
                    View Order
                    <ArrowIcon />
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* PAGINATION */}

      {pagination &&
        pagination.totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={
                !pagination.hasPreviousPage
              }
              onClick={() =>
                setPage(
                  (current) => current - 1
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/[0.08] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-black/50 transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Previous
            </button>

            <div className="text-center">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-black/30">
                Page
              </p>

              <p className="mt-1 text-sm font-black text-[#171717]">
                {pagination.page}
                <span className="mx-1.5 font-medium text-black/25">
                  of
                </span>
                {pagination.totalPages}
              </p>
            </div>

            <button
              type="button"
              disabled={
                !pagination.hasNextPage
              }
              onClick={() =>
                setPage(
                  (current) => current + 1
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
    </div>
  );
};

const inputClass =
  "w-full rounded-xl border border-black/[0.09] bg-[#FAFAF9] px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:bg-white focus:ring-4 focus:ring-orange-100";

const FieldGroup = ({
  label,
  icon,
  children,
}) => (
  <label className="block">
    <span className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/40">
      {icon}
      {label}
    </span>

    {children}
  </label>
);

const TableHead = ({
  children,
  alignRight = false,
}) => (
  <th
    className={`px-5 py-3.5 text-[9px] font-extrabold uppercase tracking-[0.11em] text-black/30 ${
      alignRight ? "text-right" : ""
    }`}
  >
    {children}
  </th>
);

const MobileInfoLabel = ({
  children,
}) => (
  <p className="mb-1.5 text-[8px] font-extrabold uppercase tracking-[0.09em] text-black/30">
    {children}
  </p>
);

const MobileInfo = ({
  label,
  value,
}) => (
  <div className="min-w-0">
    <MobileInfoLabel>
      {label}
    </MobileInfoLabel>

    <p className="truncate text-xs font-bold text-[#171717]">
      {value}
    </p>
  </div>
);

const OrdersLoading = () => (
  <div className="divide-y divide-black/[0.05]">
    {[1, 2, 3, 4, 5].map((item) => (
      <div
        key={item}
        className="flex animate-pulse items-center gap-4 px-6 py-5"
      >
        <div className="h-10 w-10 rounded-xl bg-black/[0.04]" />
        <div className="flex-1">
          <div className="h-3 w-32 rounded bg-black/[0.05]" />
          <div className="mt-2 h-2.5 w-48 rounded bg-black/[0.035]" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-black/[0.04]" />
      </div>
    ))}
  </div>
);

const EmptyOrders = () => (
  <div className="flex min-h-[300px] items-center justify-center p-8 text-center">
    <div>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1E8] text-[#F97316]">
        <OrderIcon />
      </span>

      <p className="mt-4 text-sm font-extrabold text-[#171717]">
        No orders found
      </p>

      <p className="mt-1 text-xs text-black/35">
        Try changing your search or filters.
      </p>
    </div>
  </div>
);

const IconBase = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[17px] w-[17px]"
  >
    {children}
  </svg>
);

const OrderIcon = () => (
  <IconBase>
    <path d="M5 4h14v16H5V4Z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </IconBase>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className="h-3.5 w-3.5"
  >
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="m13 13 4 4" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-3.5 w-3.5"
  >
    <path d="M6 10h8M11 7l3 3-3 3" />
  </svg>
);

export default Orders;