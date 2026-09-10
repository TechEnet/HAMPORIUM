import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

import formatCurrency from "../../../utils/formatCurrency.js";
import formatDate from "../../../utils/formatDate.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayments = async () => {
      setLoading(true);

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

        const response = await api.get(
          `/admin/payments?${params.toString()}`
        );

        setPayments(response.data.payments || []);
        setPagination(response.data.pagination);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadPayments, 300);

    return () => clearTimeout(timer);
  }, [search, status, page]);

  const filtersActive = search.trim() || status;

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPage(1);
  };

  const capturedCount = payments.filter(
    (payment) => payment.status === "captured"
  ).length;

  const failedCount = payments.filter(
    (payment) => payment.status === "failed"
  ).length;

  const refundedCount = payments.filter(
    (payment) => payment.status === "refunded"
  ).length;

  const visibleAmount = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  return (
    <div
      className="mx-auto w-full max-w-[1600px] pb-12 text-[#171717]"
      style={{
        fontFamily: "'Manrope', Arial, sans-serif",
      }}
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="flex flex-col gap-5 border-b border-black/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#F97316]" />

            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F97316]">
              Finance & Transactions
            </p>
          </div>

          <h1
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-2 text-[42px] font-semibold leading-none tracking-[-0.035em] sm:text-[50px]"
          >
            Payments
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/45">
            Track customer payment attempts, captured
            transactions, failures and refunds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/refunds"
            className="rounded-xl bg-[#171717] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white transition hover:bg-[#F97316]"
          >
            Refund Operations
          </Link>

          <HeaderStat
            label="Showing"
            value={payments.length}
          />

          <HeaderStat
            label="Captured"
            value={capturedCount}
            accent
          />

          {pagination && (
            <HeaderStat
              label="Page"
              value={`${pagination.page}/${pagination.totalPages}`}
            />
          )}
        </div>
      </header>

      {/* =====================================================
          PAYMENT SNAPSHOT
      ===================================================== */}

      <section className="mt-7 overflow-hidden rounded-[26px] bg-[#171717] text-white shadow-[0_18px_55px_rgba(23,23,23,0.13)]">
        <div className="grid lg:grid-cols-[1.2fr_1fr]">
          <div className="relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/[0.04]" />
            <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full border border-[#D4AF37]/10" />

            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#D4AF37]">
              Visible Transaction Value
            </p>

            <p className="mt-4 text-[34px] font-black leading-none tracking-[-0.045em] sm:text-[42px]">
              {formatCurrency(visibleAmount)}
            </p>

            <p className="mt-4 max-w-md text-xs leading-5 text-white/40">
              Combined value of payment records currently shown
              on this page.
            </p>
          </div>

          <div className="grid grid-cols-3 border-t border-white/[0.08] lg:border-l lg:border-t-0">
            <DarkStat
              label="Captured"
              value={capturedCount}
            />

            <DarkStat
              label="Failed"
              value={failedCount}
              borderLeft
            />

            <DarkStat
              label="Refunded"
              value={refundedCount}
              borderLeft
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-4 sm:px-7">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
              Search & Filter
            </p>

            <h2 className="mt-1 text-sm font-extrabold text-[#171717]">
              Find Payment Records
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

        <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-7">
          <FieldGroup
            label="Search Transaction"
            icon={<SearchIcon />}
          >
            <input
              placeholder="Receipt / Razorpay ID..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
          </FieldGroup>

          <FieldGroup label="Payment Status">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">
                All Payment Statuses
              </option>

              <option value="created">
                Created
              </option>

              <option value="authorized">
                Authorized
              </option>

              <option value="captured">
                Captured
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

      {/* =====================================================
          PAYMENT REGISTER
      ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-5 sm:px-7">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#F97316]">
              Transaction Register
            </p>

            <h2
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-1 text-[27px] font-semibold leading-none"
            >
              Payment Records
            </h2>

            <p className="mt-2 text-xs text-black/40">
              Order, customer, transaction method and current
              payment state.
            </p>
          </div>

          {loading && (
            <span className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-black/35">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#F97316]" />
              Updating
            </span>
          )}
        </div>

        {loading ? (
          <PaymentLoading />
        ) : !payments.length ? (
          <EmptyPayments />
        ) : (
          <>
            {/* DESKTOP */}

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] text-left">
                <thead>
                  <tr className="bg-[#FAFAF9]">
                    <TableHead>
                      Order / Receipt
                    </TableHead>

                    <TableHead>
                      Customer
                    </TableHead>

                    <TableHead>
                      Amount
                    </TableHead>

                    <TableHead>
                      Method
                    </TableHead>

                    <TableHead>
                      Status
                    </TableHead>

                    <TableHead>
                      Date
                    </TableHead>

                    <TableHead alignRight>
                      Action
                    </TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/[0.055]">
                  {payments.map((payment) => (
                    <tr
                      key={payment._id}
                      className="transition hover:bg-[#FFF9F2]/45"
                    >
                      <td className="px-5 py-5 sm:px-7">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F97316]">
                            <PaymentIcon />
                          </span>

                          <div className="min-w-0">
                            <p className="max-w-[210px] truncate text-xs font-extrabold text-[#171717]">
                              {payment.order?.orderNumber ||
                                payment.receipt ||
                                "-"}
                            </p>

                            {payment.receipt &&
                              payment.order?.orderNumber && (
                                <p className="mt-1 max-w-[210px] truncate text-[9px] text-black/30">
                                  {payment.receipt}
                                </p>
                              )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <p className="max-w-[190px] truncate text-xs font-bold text-[#171717]">
                          {payment.user?.name || "-"}
                        </p>

                        <p className="mt-1 max-w-[190px] truncate text-[10px] text-black/40">
                          {payment.user?.email || "-"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5">
                        <p className="text-xs font-black text-[#171717]">
                          {formatCurrency(
                            payment.amount
                          )}
                        </p>
                        {Number(payment.refundedAmount || 0) > 0 && (
                          <p className="mt-1 text-[9px] font-bold text-[#F97316]">
                            Refunded {formatCurrency(payment.refundedAmount)}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <span className="inline-flex rounded-lg bg-black/[0.04] px-2.5 py-1.5 text-[10px] font-bold capitalize text-black/55">
                          {payment.method || "-"}
                        </span>
                      </td>

                      <td className="px-5 py-5">
                        <StatusBadge
                          status={payment.status}
                        />
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-[11px] font-medium text-black/40">
                        {formatDate(
                          payment.createdAt
                        )}
                      </td>

                      <td className="px-5 py-5 text-right sm:pr-7">
                        <Link
                          to={`/admin/payments/${payment._id}`}
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
              {payments.map((payment) => (
                <article
                  key={payment._id}
                  className="p-5 transition hover:bg-[#FFF9F2]/45"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F97316]">
                        <PaymentIcon />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-[#171717]">
                          {payment.order?.orderNumber ||
                            payment.receipt ||
                            "-"}
                        </p>

                        <p className="mt-1 text-[10px] text-black/40">
                          {formatDate(
                            payment.createdAt
                          )}
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-black">
                      {formatCurrency(
                        payment.amount
                      )}
                    </p>
                    {Number(payment.refundedAmount || 0) > 0 && (
                      <p className="mt-1 text-[9px] font-bold text-[#F97316]">
                        Refunded {formatCurrency(payment.refundedAmount)}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <MobileInfo
                      label="Customer"
                      value={
                        payment.user?.name ||
                        payment.user?.email ||
                        "-"
                      }
                    />

                    <MobileInfo
                      label="Method"
                      value={
                        payment.method || "-"
                      }
                      capitalize
                    />

                    <div className="col-span-2">
                      <MobileLabel>
                        Payment Status
                      </MobileLabel>

                      <StatusBadge
                        status={payment.status}
                      />
                    </div>
                  </div>

                  <Link
                    to={`/admin/payments/${payment._id}`}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#F97316]"
                  >
                    View Payment
                    <ArrowIcon />
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* =====================================================
          PAGINATION
      ===================================================== */}

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
              className="inline-flex items-center justify-center rounded-xl border border-black/[0.08] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-black/50 transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Previous
            </button>

            <div className="text-center">
              <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-black/30">
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
              className="inline-flex items-center justify-center rounded-xl bg-[#171717] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
    </div>
  );
};

/* =========================================================
   UI
========================================================= */

const inputClass =
  "w-full rounded-xl border border-black/[0.09] bg-[#FAFAF9] px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:bg-white focus:ring-4 focus:ring-orange-100";

const HeaderStat = ({
  label,
  value,
  accent = false,
}) => (
  <div
    className={`min-w-[92px] rounded-xl border px-4 py-2.5 ${
      accent
        ? "border-orange-100 bg-orange-50"
        : "border-black/[0.07] bg-white"
    }`}
  >
    <p
      className={`text-[8px] font-extrabold uppercase tracking-[0.1em] ${
        accent
          ? "text-[#F97316]/65"
          : "text-black/30"
      }`}
    >
      {label}
    </p>

    <p
      className={`mt-1 text-lg font-black leading-none ${
        accent
          ? "text-[#F97316]"
          : "text-[#171717]"
      }`}
    >
      {value}
    </p>
  </div>
);

const DarkStat = ({
  label,
  value,
  borderLeft = false,
}) => (
  <div
    className={`flex min-h-[150px] flex-col justify-between p-5 sm:p-6 ${
      borderLeft
        ? "border-l border-white/[0.08]"
        : ""
    }`}
  >
    <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-white/35">
      {label}
    </p>

    <p className="text-[28px] font-black leading-none tracking-[-0.04em] text-white">
      {value}
    </p>
  </div>
);

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

const MobileLabel = ({ children }) => (
  <p className="mb-1.5 text-[8px] font-extrabold uppercase tracking-[0.09em] text-black/30">
    {children}
  </p>
);

const MobileInfo = ({
  label,
  value,
  capitalize = false,
}) => (
  <div className="min-w-0">
    <MobileLabel>
      {label}
    </MobileLabel>

    <p
      className={`truncate text-xs font-bold text-[#171717] ${
        capitalize ? "capitalize" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

const PaymentLoading = () => (
  <div className="divide-y divide-black/[0.05]">
    {[1, 2, 3, 4, 5].map((item) => (
      <div
        key={item}
        className="flex animate-pulse items-center gap-4 px-6 py-5"
      >
        <div className="h-10 w-10 rounded-xl bg-black/[0.04]" />

        <div className="flex-1">
          <div className="h-3 w-40 rounded bg-black/[0.05]" />
          <div className="mt-2 h-2.5 w-52 rounded bg-black/[0.035]" />
        </div>

        <div className="h-8 w-24 rounded-lg bg-black/[0.04]" />
      </div>
    ))}
  </div>
);

const EmptyPayments = () => (
  <div className="flex min-h-[300px] items-center justify-center p-8 text-center">
    <div>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1E8] text-[#F97316]">
        <PaymentIcon />
      </span>

      <p className="mt-4 text-sm font-extrabold text-[#171717]">
        No payments found
      </p>

      <p className="mt-1 text-xs text-black/35">
        Try changing the search or payment status filter.
      </p>
    </div>
  </div>
);

/* =========================================================
   ICONS
========================================================= */

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

const PaymentIcon = () => (
  <IconBase>
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
    />
    <path d="M3 10h18M7 15h4" />
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

export default Payments;