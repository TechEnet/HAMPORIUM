import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


const Quotes = () => {
  const [quotes, setQuotes] =
    useState([]);

  const [status, setStatus] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    const loadQuotes =
      async () => {
        try {
          setLoading(true);

          const { data } =
            await api.get(
              "/quotes/admin/all",
              {
                params: {
                  ...(status && {
                    status,
                  }),
                },
              }
            );

          setQuotes(
            data.quotes || []
          );
        } catch (error) {
          setError(
            error.response?.data
              ?.message ||
              "Unable to load quotations"
          );
        } finally {
          setLoading(false);
        }
      };

    loadQuotes();
  }, [status]);


  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
          Admin / Operations
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
          Quotations
        </h1>
      </div>


      <select
        value={status}
        onChange={(e) =>
          setStatus(
            e.target.value
          )
        }
        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#F26522]"
      >
        <option value="">
          All Statuses
        </option>

        <option value="draft">
          Draft
        </option>

        <option value="sent">
          Sent
        </option>

        <option value="change_requested">
          Changes Requested
        </option>

        <option value="accepted">
          Accepted
        </option>

        <option value="expired">
          Expired
        </option>
      </select>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Quote
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  RFQ
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Customer
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Version
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : quotes.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    No quotations found.
                  </td>
                </tr>
              ) : (
                quotes.map(
                  (quote) => (
                    <tr
                      key={
                        quote._id
                      }
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {
                          quote.quoteId
                        }
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {quote.rfq
                            ?.title ||
                            "—"}
                        </div>

                        <div className="text-xs text-slate-500">
                          {quote.rfq
                            ?.rfqId}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {quote.customer
                            ?.name ||
                            "—"}
                        </div>

                        <div className="text-xs text-slate-500">
                          {quote.customer
                            ?.email}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm">
                        V
                        {
                          quote.currentVersionNumber
                        }
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={
                            quote.status
                          }
                        />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/admin/quotes/${quote._id}`}
                          className="text-sm font-semibold text-[#F26522]"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


export default Quotes;