import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


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

  const [quote, setQuote] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");


  const loadQuote =
    useCallback(async () => {
      try {
        setLoading(true);

        const { data } =
          await api.get(
            `/quotes/${id}`
          );

        setQuote(data.quote);
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to load quotation"
        );
      } finally {
        setLoading(false);
      }
    }, [id]);


  useEffect(() => {
    loadQuote();
  }, [loadQuote]);


  const sendQuote =
    async () => {
      try {
        setBusy(true);

        await api.post(
          `/quotes/${id}/send`
        );

        await loadQuote();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "Unable to send quotation"
        );
      } finally {
        setBusy(false);
      }
    };


  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        Loading quote...
      </div>
    );
  }


  if (!quote) return null;


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
            {quote.quoteId}
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Quote Details
          </h1>

          <div className="mt-3 flex items-center gap-3">
            <StatusBadge
              status={quote.status}
            />

            <span className="text-sm text-slate-500">
              Current V
              {
                quote.currentVersionNumber
              }
            </span>
          </div>
        </div>


        {quote.rfq?._id && (
          <Link
            to={`/admin/rfqs/${quote.rfq._id}`}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Open RFQ
          </Link>
        )}
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      {quote.status === "draft" && (
        <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <p className="text-sm text-orange-800">
            Current version is still
            draft.
          </p>

          <button
            disabled={busy}
            onClick={sendQuote}
            className="mt-4 rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white"
          >
            Send Quote V
            {
              quote.currentVersionNumber
            }
          </button>
        </section>
      )}


      {[...(quote.versions || [])]
        .sort(
          (a, b) =>
            b.versionNumber -
            a.versionNumber
        )
        .map((version) => (
          <section
            key={version._id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Version{" "}
                  {
                    version.versionNumber
                  }
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {new Date(
                    version.createdAt
                  ).toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <StatusBadge
                status={
                  version.status
                }
              />
            </div>


            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Product
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Qty
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                      Unit
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {version.lineItems?.map(
                    (item) => (
                      <tr
                        key={
                          item._id
                        }
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">
                            {
                              item.name
                            }
                          </div>

                          {item.personalization && (
                            <div className="text-xs text-slate-500">
                              {
                                item.personalization
                              }
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm">
                          {
                            item.quantity
                          }
                        </td>

                        <td className="px-5 py-4 text-sm">
                          {money(
                            item.unitPrice,
                            version.currency
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold">
                          {money(
                            item.lineTotal,
                            version.currency
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>


            <div className="border-t border-slate-100 p-5">
              <div className="ml-auto max-w-sm rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">
                    Total
                  </span>

                  <span className="text-lg font-bold text-[#F26522]">
                    {money(
                      version.total,
                      version.currency
                    )}
                  </span>
                </div>
              </div>


              {version.changeRequest && (
                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
                  <strong>
                    Customer Change Request:
                  </strong>{" "}
                  {
                    version
                      .changeRequest
                      .comment
                  }
                </div>
              )}
            </div>
          </section>
        ))}
    </div>
  );
};


export default QuoteDetails;