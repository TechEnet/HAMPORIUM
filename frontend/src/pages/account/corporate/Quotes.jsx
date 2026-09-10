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

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    const loadQuotes = async () => {
      try {
        setLoading(true);

        const { data } =
          await api.get(
            "/quotes/mine"
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
  }, []);


  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
          HAMPORIUM Business
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
          Quotations
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Review your current quotation and
          previous commercial versions.
        </p>
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
          Loading quotations...
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="font-semibold text-slate-900">
            No quotations yet
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Quotations will appear here after
            HAMPORIUM reviews your RFQ.
          </p>
        </div>
      ) : (
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
                    Version
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {quotes.map(
                  (quote) => (
                    <tr
                      key={quote._id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {quote.quoteId}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {quote.rfq
                            ?.title ||
                            "RFQ"}
                        </div>

                        <div className="text-xs text-slate-500">
                          {quote.rfq
                            ?.rfqId}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
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
                          to={`/account/corporate/quotes/${quote._id}`}
                          className="text-sm font-semibold text-[#F26522]"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


export default Quotes;