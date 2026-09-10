import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const Quotes = () => {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/weddings/projects/${id}`);
      setProject(data.project);
      setQuote(data.quote || null);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load quotation.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async () => {
    if (!window.confirm("Accept the current quotation version?")) return;

    try {
      setBusy(true);
      await api.post(`/quotes/${quote._id}/accept`, {});
      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to accept quote.");
    } finally {
      setBusy(false);
    }
  };

  const requestChanges = async () => {
    const comment = window.prompt("Describe required quotation changes.");
    if (!comment?.trim()) return;

    try {
      setBusy(true);

      await api.post(`/quotes/${quote._id}/request-changes`, {
        comment,
      });

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to request changes.");
    } finally {
      setBusy(false);
    }
  };

  const askForCall = async () => {
    try {
      setBusy(true);

      await api.post(`/quotes/${quote._id}/ask-for-call`, {
        message: "Wedding customer requested a call.",
      });

      await load();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to request call.");
    } finally {
      setBusy(false);
    }
  };

  if (!project) {
    return <div className="rounded-2xl border bg-white p-8">Loading...</div>;
  }

  if (!quote) {
    return (
      <div className="space-y-5">
        <Back project={project} id={id} />

        <div className="rounded-2xl border bg-white p-10 text-center">
          <h2 className="text-xl font-bold">Quotation not ready yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            HAMPORIUM will publish the quotation after concept approval.
          </p>
        </div>
      </div>
    );
  }

  const versions = [...(quote.versions || [])].sort(
    (a, b) => b.versionNumber - a.versionNumber
  );

  return (
    <div className="space-y-6">
      <Back project={project} id={id} />

      {error && <ErrorBox>{error}</ErrorBox>}

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#F26522]">{quote.quoteId}</p>
            <h2 className="mt-1 text-xl font-bold">Wedding Quotation</h2>
          </div>

          <StatusBadge status={quote.status} />
        </div>

        {quote.status === "sent" && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={accept}
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Accept Quote
            </button>

            <button
              onClick={requestChanges}
              disabled={busy}
              className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700"
            >
              Request Changes
            </button>

            <button
              onClick={askForCall}
              disabled={busy}
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
            >
              Ask for Call
            </button>
          </div>
        )}
      </section>

      {versions.map((version) => (
        <section
          key={version._id}
          className="rounded-2xl border bg-white p-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Quote Version {version.versionNumber}</h3>
            <StatusBadge status={version.status} />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <TH>Item</TH>
                  <TH>Qty</TH>
                  <TH>Unit Price</TH>
                  <TH>Total</TH>
                </tr>
              </thead>

              <tbody className="divide-y">
                {version.lineItems?.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.personalization}
                      </p>
                    </td>

                    <td className="px-4 py-3">{item.quantity}</td>

                    <td className="px-4 py-3">
                      ₹{Number(item.unitPrice || 0).toLocaleString("en-IN")}
                    </td>

                    <td className="px-4 py-3">
                      ₹{Number(item.lineTotal || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 ml-auto max-w-sm space-y-2 text-sm">
            <Row label="Subtotal" value={version.subtotal} />
            <Row label="Discount" value={version.discount} />
            <Row label="Freight" value={version.freight} />
            <Row label="Tax" value={version.taxAmount} />
            <Row label="Total" value={version.total} bold />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info label="Lead Time" value={`${version.leadTimeDays || 0} days`} />
            <Info label="Payment Terms" value={version.paymentTerms} />
            <Info
              label="Valid Until"
              value={
                version.validUntil
                  ? new Date(version.validUntil).toLocaleDateString("en-IN")
                  : "—"
              }
            />
            <Info label="Assumptions" value={version.assumptions} />
          </div>
        </section>
      ))}
    </div>
  );
};

const Back = ({ project, id }) => (
  <div className="flex items-start justify-between">
    <div>
      <p className="font-bold text-[#F26522]">{project.weddingProjectId}</p>
      <h1 className="text-3xl font-bold">Quotation</h1>
    </div>

    <Link
      to={`/account/weddings/${id}`}
      className="rounded-xl border px-4 py-2 text-sm font-semibold"
    >
      ← Project
    </Link>
  </div>
);

const TH = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">
    {children}
  </th>
);

const Row = ({ label, value, bold }) => (
  <div className={`flex justify-between ${bold ? "text-lg font-bold" : ""}`}>
    <span>{label}</span>
    <span>₹{Number(value || 0).toLocaleString("en-IN")}</span>
  </div>
);

const Info = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-xs uppercase text-slate-400">{label}</p>
    <p className="mt-1 text-sm">{value || "—"}</p>
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
    {children}
  </div>
);

export default Quotes;