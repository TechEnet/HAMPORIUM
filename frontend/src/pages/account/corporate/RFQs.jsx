import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";


const RFQs = () => {
  const [rfqs, setRfqs] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  const loadRFQs = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } =
        await api.get("/rfqs/mine");

      setRfqs(data.rfqs || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to load RFQs"
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadRFQs();
  }, []);


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
            HAMPORIUM Business
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
            Corporate RFQs
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Create and track your business
            gifting requirements.
          </p>
        </div>

        <Link
          to="/account/corporate/rfqs/new"
          className="inline-flex items-center justify-center rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d95416]"
        >
          + Create RFQ
        </Link>
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading RFQs...
        </div>
      ) : rfqs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-2xl text-[#F26522]">
            RFQ
          </div>

          <h2 className="text-lg font-semibold text-slate-900">
            No RFQs yet
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Submit your first bulk or branded
            gifting requirement.
          </p>

          <Link
            to="/account/corporate/rfqs/new"
            className="mt-5 inline-flex rounded-xl bg-[#F26522] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95416]"
          >
            Create RFQ
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    RFQ
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Requirement
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quantity
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Delivery
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rfqs.map((rfq) => (
                  <tr
                    key={rfq._id}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {rfq.rfqId}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(
                          rfq.createdAt
                        ).toLocaleDateString(
                          "en-IN"
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {rfq.title}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {rfq.companyName ||
                          "Corporate RFQ"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {rfq.quantity}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {rfq.requiredDeliveryDate
                        ? new Date(
                            rfq.requiredDeliveryDate
                          ).toLocaleDateString(
                            "en-IN"
                          )
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge
                        status={rfq.status}
                      />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/account/corporate/rfqs/${rfq._id}`}
                        className="text-sm font-semibold text-[#F26522] hover:text-[#d95416]"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


export default RFQs;