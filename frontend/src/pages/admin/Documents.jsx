import { useState } from "react";
import api from "../../api/api.js";


const ENTITY_TYPES = [
  "rfq",
  "quote",
  "approval",
  "order",
  "production",
  "shipment",
  "corporate",
  "wedding",
  "partner",
];


const pretty = (value) =>
  String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );


const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};


const getError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong.";


const Documents = () => {
  const [entityType, setEntityType] =
    useState("rfq");

  const [entityId, setEntityId] =
    useState("");

  const [documents, setDocuments] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [searched, setSearched] =
    useState(false);


  const loadDocuments = async (
    event
  ) => {
    event?.preventDefault?.();

    if (!entityId.trim()) {
      setError(
        "Entity ID is required."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");
      setSearched(true);

      const response =
        await api.get(
          `/documents/entity/${encodeURIComponent(
            entityType
          )}/${encodeURIComponent(
            entityId.trim()
          )}`
        );

      setDocuments(
        response.data.documents ||
          []
      );
    } catch (err) {
      setDocuments([]);
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };


  const archiveDocument =
    async (documentId) => {
      const confirmed =
        window.confirm(
          "Archive this document?"
        );

      if (!confirmed) return;

      try {
        setError("");

        await api.patch(
          `/documents/${documentId}/archive`,
          {
            note:
              "Archived from admin document console.",
          }
        );

        await loadDocuments();
      } catch (err) {
        setError(getError(err));
      }
    };


  return (
    <div className="space-y-6 pb-12">

      <div className="rounded-[22px] bg-[#171717] p-6 text-white">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#D4AF37]">
          Phase 9 · Shared Records
        </p>

        <h1 className="mt-2 text-2xl font-black">
          Documents
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          Find operational documents attached
          to RFQs, quotes, approvals, orders
          and project records.
        </p>
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}


      <form
        onSubmit={loadDocuments}
        className="rounded-[20px] border border-black/[0.06] bg-white p-5"
      >

        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto]">

          <label>
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/40">
              Entity Type
            </span>

            <select
              value={entityType}
              onChange={(event) =>
                setEntityType(
                  event.target.value
                )
              }
              className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
            >
              {ENTITY_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {pretty(type)}
                  </option>
                )
              )}
            </select>
          </label>


          <label>
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/40">
              Entity ID
            </span>

            <input
              value={entityId}
              onChange={(event) =>
                setEntityId(
                  event.target.value
                )
              }
              placeholder="Paste MongoDB entity ID"
              className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#F97316]"
            />
          </label>


          <button
            type="submit"
            disabled={loading}
            className="self-end rounded-xl bg-[#F97316] px-6 py-3 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : "Find Documents"}
          </button>

        </div>

      </form>


      <div className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white">

        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <div>
            <p className="text-sm font-black">
              Documents
            </p>

            <p className="mt-1 text-[10px] text-black/40">
              {documents.length} record(s)
            </p>
          </div>

          {searched && (
            <span className="rounded-full bg-[#FFF9F2] px-3 py-1 text-[9px] font-extrabold text-[#F97316]">
              {pretty(entityType)}
            </span>
          )}
        </div>


        {!searched ? (
          <div className="p-10 text-center">
            <p className="text-sm font-bold text-black/60">
              Search an entity first.
            </p>

            <p className="mt-2 text-xs text-black/35">
              Enter the record type and its
              MongoDB ID.
            </p>
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-black/40">
            Loading documents...
          </div>
        ) : !documents.length ? (
          <div className="p-10 text-center text-sm text-black/40">
            No documents found for this record.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.05]">

            {documents.map(
              (document) => (
                <div
                  key={document._id}
                  className="p-5"
                >

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <p className="break-words text-sm font-black">
                          {document.title ||
                            document.fileName ||
                            "Document"}
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[8px] font-extrabold uppercase ${
                            document.status ===
                            "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : document.status ===
                                  "archived"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {pretty(
                            document.status
                          )}
                        </span>

                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-black/45">

                        <span>
                          Type:{" "}
                          <strong className="text-black/65">
                            {pretty(
                              document.documentType
                            )}
                          </strong>
                        </span>

                        <span>
                          Version:{" "}
                          <strong className="text-black/65">
                            {document.version ||
                              1}
                          </strong>
                        </span>

                        <span>
                          Uploaded:{" "}
                          <strong className="text-black/65">
                            {formatDate(
                              document.createdAt
                            )}
                          </strong>
                        </span>

                      </div>

                      {document.description && (
                        <p className="mt-3 max-w-2xl text-xs leading-5 text-black/50">
                          {
                            document.description
                          }
                        </p>
                      )}

                      <p className="mt-3 break-all text-[9px] text-black/30">
                        {document.fileName}
                      </p>

                    </div>


                    <div className="flex shrink-0 flex-wrap gap-2">

                      {document.url && (
                        <a
                          href={
                            document.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-[#171717] px-4 py-2.5 text-[10px] font-extrabold text-white transition hover:bg-[#F97316]"
                        >
                          Open File ↗
                        </a>
                      )}

                      {document.status !==
                        "archived" && (
                        <button
                          type="button"
                          onClick={() =>
                            archiveDocument(
                              document._id
                            )
                          }
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[10px] font-extrabold text-red-600 transition hover:bg-red-600 hover:text-white"
                        >
                          Archive
                        </button>
                      )}

                    </div>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </div>

    </div>
  );
};


export default Documents;