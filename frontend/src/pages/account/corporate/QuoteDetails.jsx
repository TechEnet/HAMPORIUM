import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import CustomHamperRequestCard from "../../../components/CustomHamperRequestCard.jsx";

let razorpayScriptPromise = null;

const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existingScript.addEventListener("error", () => resolve(false), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const money = (
  value,
  currency = "INR"
) =>
  new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }
  ).format(Number(value || 0));

const QuoteDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quote, setQuote] = useState(null);
  const [changeComment, setChangeComment] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadQuote = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get(`/quotes/${id}`);
      setQuote(data.quote);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load quotation"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  const currentVersion = useMemo(() => {
    if (!quote) return null;

    return quote.versions?.find(
      (version) =>
        version.versionNumber === quote.currentVersionNumber
    );
  }, [quote]);

  const acceptedVersion = useMemo(() => {
    if (!quote?.acceptedVersionNumber) return null;

    return quote.versions?.find(
      (version) =>
        version.versionNumber === quote.acceptedVersionNumber
    );
  }, [quote]);

  const customHamperRFQ =
    quote?.rfq?.sourceType === "custom_hamper" &&
    quote?.rfq?.customHamperRequest;

  const orderId =
    quote?.order?._id ||
    quote?.order ||
    quote?.rfq?.order?._id ||
    quote?.rfq?.order ||
    "";

  const acceptQuote = async () => {
    const confirmed = window.confirm(
      `Accept Quote V${quote.currentVersionNumber}? Once accepted, this commercial version is locked.`
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      setError("");
      setSuccess("");

      await api.post(`/quotes/${id}/accept`, {
        comment: "Quotation accepted by customer.",
      });

      setSuccess("Quotation accepted successfully.");
      await loadQuote();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to accept quotation"
      );
    } finally {
      setBusy(false);
    }
  };

  const requestChanges = async () => {
    if (!changeComment.trim()) {
      setError("Please describe the changes you need.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setSuccess("");

      await api.post(`/quotes/${id}/request-changes`, {
        comment: changeComment.trim(),
      });

      setChangeComment("");
      setSuccess("Change request submitted.");
      await loadQuote();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to request changes"
      );
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    if (!message.trim()) return;

    try {
      setBusy(true);
      setError("");

      await api.post(`/quotes/${id}/comment`, {
        message: message.trim(),
      });

      setMessage("");
      setSuccess("Comment added.");
      await loadQuote();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to add comment"
      );
    } finally {
      setBusy(false);
    }
  };

  const askForCall = async () => {
    try {
      setBusy(true);
      setError("");

      await api.post(`/quotes/${id}/ask-for-call`, {
        message:
          message.trim() ||
          "Please call me to discuss this quotation.",
      });

      setMessage("");
      setSuccess("Call request submitted.");
      await loadQuote();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to request a call"
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyQuotePayment = async (razorpayResponse) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await api.post(
        `/payments/quotes/${id}/verify`,
        {
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
        }
      );

      if (!response.data.paymentPending) {
        return response.data;
      }

      if (attempt < 5) {
        await sleep(1500);
      }
    }

    return {
      success: true,
      paymentPending: true,
    };
  };

  const payAcceptedQuote = async () => {
    if (!quote || quote.status !== "accepted") return;

    setPaying(true);
    setError("");
    setSuccess("");

    try {
      const loaded = await loadRazorpay();

      if (!loaded) {
        throw new Error("Unable to load Razorpay Checkout");
      }

      const paymentResponse = await api.post(
        `/payments/quotes/${id}/create-order`
      );

      if (paymentResponse.data?.alreadyPaid) {
        const existingOrderId =
          paymentResponse.data.order?._id ||
          paymentResponse.data.order;

        if (existingOrderId) {
          navigate(`/order-success/${existingOrderId}`);
          return;
        }

        await loadQuote();
        setPaying(false);
        return;
      }

      const checkout = paymentResponse.data.checkout;

      if (!checkout?.razorpayOrderId) {
        throw new Error("Payment checkout details were not returned.");
      }

      const options = {
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: "HAMPORIUM",
        description: `Quotation ${checkout.quoteNumber}`,
        order_id: checkout.razorpayOrderId,
        prefill: {
          name: checkout.prefill?.name || quote.customer?.name || "",
          email: checkout.prefill?.email || quote.customer?.email || "",
          contact:
            checkout.prefill?.contact || quote.customer?.phone || "",
        },
        theme: {
          color: "#F26522",
        },
        handler: async (razorpayResponse) => {
          try {
            const verification = await verifyQuotePayment(
              razorpayResponse
            );

            if (verification.paymentPending) {
              setError(
                "Payment received but confirmation is still pending. Please try again shortly."
              );
              setPaying(false);
              return;
            }

            const placedOrderId =
              verification.order?._id || verification.order;

            if (!placedOrderId) {
              await loadQuote();
              setSuccess(
                "Payment confirmed. Your order is being finalised."
              );
              setPaying(false);
              return;
            }

            navigate(`/order-success/${placedOrderId}`, {
              replace: true,
            });
          } catch (requestError) {
            setError(
              requestError.response?.data?.message ||
                "Payment verification failed. Please contact support if payment was deducted."
            );
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response) => {
        setError(
          response.error?.description ||
            "Payment failed. Please try again."
        );
        setPaying(false);
      });

      razorpay.open();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to start quotation payment"
      );
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading quotation...
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        Quotation not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
            {quote.quoteId}
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Quotation V{quote.currentVersionNumber}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={quote.status} />

            {quote.rfq?._id && (
              <Link
                to={`/account/corporate/rfqs/${quote.rfq._id}`}
                className="text-sm font-semibold text-[#F26522]"
              >
                View RFQ
              </Link>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {customHamperRFQ && (
        <CustomHamperRequestCard
          request={quote.rfq.customHamperRequest}
          quantity={quote.rfq.quantity}
          title="Custom Hamper Behind This Quote"
        />
      )}

      {currentVersion && (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Commercial Proposal
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Please review product, pricing, delivery and payment terms carefully.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">Product</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">Qty</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">Unit Price</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">Packaging</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {currentVersion.lineItems?.map((item) => (
                  <tr key={item._id}>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      {item.personalization && (
                        <div className="mt-1 text-xs text-slate-500">
                          {item.personalization}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {money(item.unitPrice, currentVersion.currency)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {item.packaging || "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                      {money(item.lineTotal, currentVersion.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 border-t border-slate-100 p-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Detail label="Lead Time" value={`${currentVersion.leadTimeDays || 0} days`} />
              <Detail
                label="Valid Until"
                value={
                  currentVersion.validUntil
                    ? new Date(currentVersion.validUntil).toLocaleDateString("en-IN")
                    : "—"
                }
              />
              <Detail label="Payment Terms" value={currentVersion.paymentTerms || "—"} />
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <PriceRow label="Subtotal" value={money(currentVersion.subtotal, currentVersion.currency)} />
              <PriceRow label="Discount" value={money(currentVersion.discount, currentVersion.currency)} />
              <PriceRow label="Freight" value={money(currentVersion.freight, currentVersion.currency)} />
              <PriceRow
                label={`Tax (${currentVersion.taxRate}%)`}
                value={money(currentVersion.taxAmount, currentVersion.currency)}
              />

              <div className="mt-3 flex justify-between border-t border-slate-200 pt-4">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-[#F26522]">
                  {money(currentVersion.total, currentVersion.currency)}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {quote.status === "sent" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-semibold text-emerald-900">Accept Quotation</h2>
            <p className="mt-2 text-sm text-emerald-700">
              Once accepted, this quote version becomes the locked commercial version.
            </p>
            <button
              disabled={busy}
              onClick={acceptQuote}
              className="mt-5 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416] disabled:opacity-60"
            >
              Accept Quote V{quote.currentVersionNumber}
            </button>
          </section>

          <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <h2 className="font-semibold text-orange-900">Request Changes</h2>
            <textarea
              rows="4"
              value={changeComment}
              onChange={(event) => setChangeComment(event.target.value)}
              placeholder="Tell us what needs to change..."
              className="mt-4 w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#F26522]"
            />
            <button
              disabled={busy}
              onClick={requestChanges}
              className="mt-3 rounded-xl border border-[#F26522] px-5 py-3 text-sm font-semibold text-[#F26522] hover:bg-white disabled:opacity-60"
            >
              Request Changes
            </button>
          </section>
        </div>
      )}

      {customHamperRFQ && quote.status === "accepted" && (
        <section className="overflow-hidden rounded-2xl border border-[#F26522]/25 bg-white">
          <div className="border-b border-slate-100 bg-orange-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F26522]">
              Accepted commercial
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {orderId ? "Bulk order placed" : "Pay to place your bulk order"}
            </h2>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm leading-6 text-slate-600">
                {orderId
                  ? "Payment is complete and the accepted quotation has been converted into an order."
                  : "No catalogue price is recalculated here. Razorpay uses the total from the accepted quote version, and the final Order is created only after payment is captured."}
              </p>

              {acceptedVersion && (
                <p className="mt-3 text-2xl font-bold text-[#F26522]">
                  {money(acceptedVersion.total, acceptedVersion.currency)}
                </p>
              )}
            </div>

            {orderId ? (
              <Link
                to={`/account/orders/${orderId}`}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
              >
                View Order →
              </Link>
            ) : (
              <button
                type="button"
                disabled={paying || busy}
                onClick={payAcceptedQuote}
                className="min-h-[48px] rounded-xl bg-[#F26522] px-6 py-3 text-sm font-semibold text-white hover:bg-[#d95416] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? "Starting Payment..." : "Pay & Place Bulk Order"}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Version History</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {[...(quote.versions || [])]
            .sort((a, b) => b.versionNumber - a.versionNumber)
            .map((version) => (
              <div
                key={version._id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    Version {version.versionNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(version.createdAt).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-900">
                    {money(version.total, version.currency)}
                  </span>
                  <StatusBadge status={version.status} />
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Discussion</h2>
        <textarea
          rows="3"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Add a comment or tell us what you'd like to discuss..."
          className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522] focus:ring-2 focus:ring-orange-100"
        />

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            disabled={busy}
            onClick={addComment}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add Comment
          </button>
          <button
            disabled={busy}
            onClick={askForCall}
            className="rounded-xl border border-[#F26522] px-5 py-2.5 text-sm font-semibold text-[#F26522] hover:bg-orange-50"
          >
            Ask for Call
          </button>
        </div>

        {quote.communications?.length > 0 && (
          <div className="mt-6 space-y-3">
            {[...quote.communications].reverse().map((item) => (
              <div key={item._id} className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#F26522]">
                  {item.action === "ask_for_call" ? "Call Requested" : "Comment"}
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.message}</p>
                <div className="mt-2 text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 font-semibold text-slate-900">{value || "—"}</p>
  </div>
);

const PriceRow = ({ label, value }) => (
  <div className="flex justify-between py-2 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900">{value}</span>
  </div>
);

export default QuoteDetails;
