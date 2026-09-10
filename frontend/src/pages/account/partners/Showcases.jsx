import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";


const Showcases = () => {
  const [showcases, setShowcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shareLinks, setShareLinks] = useState({});


  const loadShowcases = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        "/showcases/mine"
      );

      setShowcases(
        response.data.showcases || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load showcases."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadShowcases();
  }, []);


  const publishShowcase = async (
    showcaseId
  ) => {
    setBusyId(showcaseId);
    setError("");
    setMessage("");

    try {
      const response = await api.post(
        `/showcases/${showcaseId}/publish`
      );

      const sharePath =
        response.data.sharePath;

      const fullUrl = sharePath
        ? `${window.location.origin}${sharePath}`
        : "";

      if (fullUrl) {
        setShareLinks((prev) => ({
          ...prev,
          [showcaseId]: fullUrl,
        }));
      }

      setMessage(
        response.data.message ||
          "Showcase published successfully."
      );

      await loadShowcases();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to publish showcase."
      );
    } finally {
      setBusyId("");
    }
  };


  const revokeShowcase = async (
    showcaseId
  ) => {
    const confirmed =
      window.confirm(
        "Revoke client access to this showcase?"
      );

    if (!confirmed) {
      return;
    }

    setBusyId(showcaseId);
    setError("");
    setMessage("");

    try {
      const response = await api.post(
        `/showcases/${showcaseId}/revoke`
      );

      setShareLinks((prev) => {
        const next = { ...prev };

        delete next[showcaseId];

        return next;
      });

      setMessage(
        response.data.message ||
          "Showcase access revoked."
      );

      await loadShowcases();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to revoke showcase."
      );
    } finally {
      setBusyId("");
    }
  };


  const copyLink = async (
    showcaseId
  ) => {
    const url =
      shareLinks[showcaseId];

    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        url
      );

      setMessage(
        "Secure showcase link copied."
      );
    } catch {
      setError(
        "Unable to copy showcase link."
      );
    }
  };


  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#F97316]/20 border-t-[#F97316]" />
      </div>
    );
  }


  return (
    <div className="space-y-7">

      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F97316]">
            Event Partner
          </p>

          <h1 className="mt-2 text-3xl font-black text-[#171717]">
            Private Showcases
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">
            Manage secure client gifting
            showcases, regenerate access links
            and revoke client access.
          </p>
        </div>


        <Link
          to="/account/partner/projects"
          className="inline-flex w-fit items-center justify-center rounded-full bg-[#171717] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#F97316]"
        >
          View Projects
        </Link>

      </div>


      {/* MESSAGES */}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}


      {message && (
        <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}


      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <StatCard
          label="Total Showcases"
          value={showcases.length}
        />

        <StatCard
          label="Active"
          value={
            showcases.filter(
              (item) =>
                item.status === "active"
            ).length
          }
        />

        <StatCard
          label="Draft"
          value={
            showcases.filter(
              (item) =>
                item.status === "draft"
            ).length
          }
        />

        <StatCard
          label="Revoked / Expired"
          value={
            showcases.filter((item) =>
              [
                "revoked",
                "expired",
              ].includes(item.status)
            ).length
          }
        />

      </div>


      {/* SHOWCASE LIST */}

      {showcases.length ? (
        <div className="grid gap-5 xl:grid-cols-2">

          {showcases.map(
            (showcase) => {
              const project =
                showcase.project;

              const projectId =
                project?._id ||
                project;

              const isBusy =
                busyId ===
                showcase._id;

              const shareUrl =
                shareLinks[
                  showcase._id
                ];


              return (
                <article
                  key={showcase._id}
                  className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >

                  {/* GOLD LINE */}

                  <div className="h-1 w-full bg-gradient-to-r from-[#F97316] via-[#D4AF37] to-[#F97316]" />


                  <div className="p-6">

                    {/* TOP */}

                    <div className="flex items-start justify-between gap-4">

                      <div className="min-w-0">

                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D4AF37]">
                          {showcase.showcaseId ||
                            "Private Showcase"}
                        </p>


                        <h2 className="mt-2 truncate text-xl font-black text-[#171717]">
                          {showcase.title ||
                            project?.title ||
                            "Client Showcase"}
                        </h2>


                        <p className="mt-2 text-xs text-black/45">
                          {project?.client
                            ?.name ||
                            "Private Client"}
                        </p>

                      </div>


                      <StatusBadge
                        status={
                          showcase.status
                        }
                      />

                    </div>


                    {/* PROJECT INFO */}

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">

                      <Info
                        label="Project"
                        value={
                          project?.title ||
                          "—"
                        }
                      />


                      <Info
                        label="Project Status"
                        value={formatStatus(
                          project?.status ||
                            "—"
                        )}
                      />


                      <Info
                        label="Client"
                        value={
                          project?.client
                            ?.name ||
                          "—"
                        }
                      />


                      <Info
                        label="Event Date"
                        value={formatDate(
                          project?.eventDate
                        )}
                      />

                    </div>


                    {/* EXPIRES */}

                    <div className="mt-4 rounded-2xl bg-[#FFF9F2] p-4">

                      <div className="flex items-center justify-between gap-4">

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-black/35">
                            Showcase Expires
                          </p>

                          <p className="mt-1 text-sm font-black text-[#171717]">
                            {formatDateTime(
                              showcase.expiresAt
                            )}
                          </p>
                        </div>


                        <div className="text-[#D4AF37]">
                          <LockIcon />
                        </div>

                      </div>

                    </div>


                    {/* GENERATED LINK */}

                    {shareUrl && (
                      <div className="mt-4 rounded-2xl border border-[#D4AF37]/30 bg-[#FFF9F2] p-4">

                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#D4AF37]">
                          Secure Client Link
                        </p>


                        <p className="mt-2 break-all text-xs font-semibold leading-5 text-black/60">
                          {shareUrl}
                        </p>


                        <div className="mt-3 flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              copyLink(
                                showcase._id
                              )
                            }
                            className="rounded-full bg-[#171717] px-4 py-2 text-[11px] font-bold text-white transition hover:bg-[#F97316]"
                          >
                            Copy Link
                          </button>


                          <a
                            href={shareUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-black/10 bg-white px-4 py-2 text-[11px] font-bold text-[#171717] transition hover:border-[#F97316] hover:text-[#F97316]"
                          >
                            Open Link
                          </a>

                        </div>

                      </div>
                    )}


                    {/* ACTIONS */}

                    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/[0.06] pt-5">

                      {projectId && (
                        <Link
                          to={`/account/partner/projects/${projectId}`}
                          className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-xs font-bold text-[#171717] transition hover:border-[#F97316] hover:text-[#F97316]"
                        >
                          View Project
                        </Link>
                      )}


                      {showcase.status !==
                        "revoked" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            publishShowcase(
                              showcase._id
                            )
                          }
                          className="rounded-full bg-[#F97316] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy
                            ? "Please wait..."
                            : showcase.status ===
                              "active"
                            ? "Regenerate Secure Link"
                            : "Publish Showcase"}
                        </button>
                      )}


                      {showcase.status ===
                        "active" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            revokeShowcase(
                              showcase._id
                            )
                          }
                          className="rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          Revoke Access
                        </button>
                      )}

                    </div>

                  </div>

                </article>
              );
            }
          )}

        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white px-6 py-16 text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF9F2] text-[#F97316]">
            <GiftIcon />
          </div>


          <h2 className="mt-5 text-xl font-black text-[#171717]">
            No showcases yet
          </h2>


          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/45">
            First create a partner client
            project and get its client pricing
            approved by HAMPORIUM.
          </p>


          <Link
            to="/account/partner/projects"
            className="mt-6 inline-flex rounded-full bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717]"
          >
            Go to Projects
          </Link>

        </div>
      )}

    </div>
  );
};


// ======================================================
// COMPONENTS
// ======================================================

const StatCard = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-black/10 bg-white p-5">

    <p className="text-xs font-semibold text-black/40">
      {label}
    </p>

    <p className="mt-2 text-2xl font-black text-[#171717]">
      {value}
    </p>

  </div>
);


const Info = ({
  label,
  value,
}) => (
  <div className="rounded-xl border border-black/[0.06] bg-white p-3">

    <p className="text-[10px] font-bold uppercase tracking-wider text-black/35">
      {label}
    </p>

    <p className="mt-1 truncate text-sm font-bold text-[#171717]">
      {value}
    </p>

  </div>
);


const StatusBadge = ({
  status,
}) => {
  const styles = {
    draft:
      "border-black/10 bg-gray-50 text-gray-600",

    active:
      "border-green-200 bg-green-50 text-green-700",

    revoked:
      "border-red-200 bg-red-50 text-red-600",

    expired:
      "border-orange-200 bg-orange-50 text-orange-700",

    archived:
      "border-black/10 bg-gray-100 text-gray-500",
  };


  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${
        styles[status] ||
        "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#8B6C10]"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
};


// ======================================================
// HELPERS
// ======================================================

const formatStatus = (
  value = ""
) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );


const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};


const formatDateTime = (
  value
) => {
  if (!value) {
    return "Not set";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not set";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};


// ======================================================
// ICONS
// ======================================================

const GiftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-7 w-7"
  >
    <path d="M4 10h16v10H4V10Z" />

    <path d="M3 7h18v4H3V7ZM12 7v13" />

    <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
  </svg>
);


const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-6 w-6"
  >
    <rect
      x="5"
      y="10"
      width="14"
      height="10"
      rx="2"
    />

    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);


export default Showcases;