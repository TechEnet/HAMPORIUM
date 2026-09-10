import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../../../api/api.js";


const ProjectDetails = () => {
  const { id } = useParams();

  const [project, setProject] =
    useState(null);

  const [showcase, setShowcase] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [shareUrl, setShareUrl] =
    useState("");


  const load = async () => {
    setLoading(true);

    try {
      const [
        projectResponse,
        showcasesResponse,
      ] = await Promise.all([
        api.get(
          `/partners/projects/${id}`
        ),
        api.get(
          "/showcases/mine"
        ),
      ]);

      const currentProject =
        projectResponse.data.project;

      setProject(
        currentProject
      );


      const existing =
        (
          showcasesResponse.data
            .showcases || []
        ).find((item) => {
          const projectId =
            item.project?._id ||
            item.project;

          return (
            String(projectId) ===
            String(id)
          );
        });

      setShowcase(
        existing || null
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load project."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    load();
  }, [id]);


  const submitProject =
    async () => {
      if (
        !window.confirm(
          "Submit this project to HAMPORIUM for validation?"
        )
      ) {
        return;
      }

      setBusy(true);

      try {
        await api.post(
          `/partners/projects/${id}/submit`
        );

        setMessage(
          "Project submitted for validation."
        );

        await load();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to submit project."
        );
      } finally {
        setBusy(false);
      }
    };


  const createShowcase =
    async () => {
      setBusy(true);
      setError("");

      try {
        const response =
          await api.post(
            "/showcases",
            {
              projectId:
                project._id,

              title:
                project.title,

              introduction:
                `Private gifting showcase prepared for ${project.client?.name}.`,
            }
          );

        setShowcase(
          response.data.showcase
        );

        setMessage(
          "Private showcase created."
        );
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to create showcase."
        );
      } finally {
        setBusy(false);
      }
    };


  const publishShowcase =
    async () => {
      setBusy(true);
      setError("");

      try {
        const response =
          await api.post(
            `/showcases/${showcase._id}/publish`
          );

        const url =
          `${window.location.origin}${response.data.sharePath}`;

        setShareUrl(url);

        setMessage(
          "Secure showcase link generated."
        );

        await load();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to publish showcase."
        );
      } finally {
        setBusy(false);
      }
    };


  const revokeShowcase =
    async () => {
      if (
        !window.confirm(
          "Revoke client access to this showcase?"
        )
      ) {
        return;
      }

      try {
        await api.post(
          `/showcases/${showcase._id}/revoke`
        );

        setMessage(
          "Showcase access revoked."
        );

        await load();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to revoke showcase."
        );
      }
    };


  const copyShareLink =
    async () => {
      if (!shareUrl) {
        return;
      }

      await navigator.clipboard.writeText(
        shareUrl
      );

      setMessage(
        "Showcase link copied."
      );
    };


  if (loading) {
    return (
      <div className="py-20 text-center">
        Loading project...
      </div>
    );
  }


  if (!project) {
    return (
      <div>
        Project not found.
      </div>
    );
  }


  const canSubmit = [
    "draft",
    "changes_requested",
  ].includes(project.status);


  const canShowcase = [
    "client_price_approved",
    "showcase_live",
    "client_review",
    "client_approved",
    "enquiry",
    "order_attributed",
  ].includes(project.status);


  return (
    <div className="space-y-7">

      <div>

        <Link
          to="/account/partner/projects"
          className="text-sm font-bold text-[#F97316]"
        >
          ← Back to Projects
        </Link>


        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div>

            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D4AF37]">
              {project.projectId}
            </p>

            <h1 className="mt-2 text-3xl font-black">
              {project.title}
            </h1>

            <p className="mt-2 text-sm text-black/45">
              {project.client?.name} ·{" "}
              {project.client?.company ||
                "Private Client"}
            </p>

          </div>


          <Status
            value={
              project.status
            }
          />

        </div>

      </div>


      {error && (
        <Notice
          type="error"
          text={error}
        />
      )}

      {message && (
        <Notice
          type="success"
          text={message}
        />
      )}


      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">

        {/* REQUIREMENT */}

        <section className="rounded-[28px] border border-black/10 bg-white p-6">

          <SectionTitle
            title="Client Requirement"
            subtitle="Project information submitted by partner."
          />


          <div className="mt-6 grid gap-4 sm:grid-cols-2">

            <Info
              label="Client"
              value={
                project.client
                  ?.name
              }
            />

            <Info
              label="Email"
              value={
                project.client
                  ?.email
              }
            />

            <Info
              label="Event"
              value={
                project.eventType ||
                "—"
              }
            />

            <Info
              label="Delivery City"
              value={
                project.deliveryCity ||
                "—"
              }
            />

            <Info
              label="Quantity"
              value={
                project.quantity
              }
            />

            <Info
              label="Budget / Gift"
              value={`₹${Number(
                project.budgetPerGift ||
                  0
              ).toLocaleString(
                "en-IN"
              )}`}
            />

          </div>


          <div className="mt-6">

            <p className="text-xs font-bold text-black/45">
              Requirements
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {project.requirements ||
                "No additional requirement."}
            </p>

          </div>

        </section>


        {/* WORKFLOW */}

        <section className="rounded-[28px] bg-[#171717] p-6 text-white">

          <SectionTitle
            light
            title="Workflow"
            subtitle="Current HAMPORIUM validation state."
          />


          <div className="mt-6 space-y-4">

            <DarkInfo
              label="Current Status"
              value={
                format(
                  project.status
                )
              }
            />

            <DarkInfo
              label="Next Action"
              value={
                project.nextAction ||
                "—"
              }
            />

            <DarkInfo
              label="Client Price"
              value={`₹${Number(
                project.clientPriceTotal ||
                  0
              ).toLocaleString(
                "en-IN"
              )}`}
            />

          </div>


          {canSubmit && (
            <button
              disabled={busy}
              onClick={
                submitProject
              }
              className="mt-6 w-full rounded-full bg-[#F97316] px-5 py-3 text-sm font-bold text-white"
            >
              Submit for Validation
            </button>
          )}

        </section>

      </div>


      {/* ITEMS */}

      <section className="rounded-[28px] border border-black/10 bg-white p-6">

        <SectionTitle
          title="Gift Options"
          subtitle="Products and custom requirements submitted for validation."
        />


        <div className="mt-5 space-y-3">

          {project.items?.map(
            (item) => (
              <div
                key={item._id}
                className="grid gap-4 rounded-2xl bg-[#FFF9F2] p-4 sm:grid-cols-[1fr_auto]"
              >

                <div>

                  <p className="font-black">
                    {item.product?.name ||
                      item.requestedTitle ||
                      "Gift Option"}
                  </p>


                  <p className="mt-1 text-xs text-black/45">
                    Qty:{" "}
                    {item.quantity}
                  </p>


                  {item.personalization && (
                    <p className="mt-2 text-sm">
                      {
                        item.personalization
                      }
                    </p>
                  )}

                </div>


                <div className="text-left sm:text-right">

                  <Status
                    value={
                      item.validationStatus
                    }
                  />


                  {item.clientPrice >
                    0 && (
                    <p className="mt-2 font-black text-[#F97316]">
                      ₹
                      {Number(
                        item.clientPrice
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  )}

                </div>

              </div>
            )
          )}

        </div>

      </section>


      {/* SHOWCASE */}

      {canShowcase && (
        <section className="rounded-[28px] border border-[#D4AF37]/40 bg-[#FFF9F2] p-6">

          <SectionTitle
            title="Private Client Showcase"
            subtitle="Generate OTP-protected client access after HAMPORIUM validation."
          />


          {!showcase ? (
            <button
              onClick={
                createShowcase
              }
              disabled={busy}
              className="mt-6 rounded-full bg-[#171717] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#F97316]"
            >
              Create Private Showcase
            </button>
          ) : (
            <div className="mt-6">

              <div className="flex flex-wrap items-center gap-3">

                <Status
                  value={
                    showcase.status
                  }
                />

                <span className="text-sm text-black/45">
                  {showcase.showcaseId}
                </span>

              </div>


              <div className="mt-5 flex flex-wrap gap-3">

                <button
                  onClick={
                    publishShowcase
                  }
                  disabled={busy}
                  className="rounded-full bg-[#F97316] px-6 py-3 text-sm font-bold text-white"
                >
                  {showcase.status ===
                  "active"
                    ? "Regenerate Secure Link"
                    : "Publish Showcase"}
                </button>


                {showcase.status ===
                  "active" && (
                  <button
                    onClick={
                      revokeShowcase
                    }
                    className="rounded-full border border-red-200 bg-white px-6 py-3 text-sm font-bold text-red-500"
                  >
                    Revoke Access
                  </button>
                )}

              </div>


              {shareUrl && (
                <div className="mt-5 rounded-2xl border border-[#D4AF37]/40 bg-white p-4">

                  <p className="text-xs font-bold text-black/45">
                    Secure client link
                  </p>

                  <p className="mt-2 break-all text-sm font-semibold">
                    {shareUrl}
                  </p>


                  <button
                    onClick={
                      copyShareLink
                    }
                    className="mt-3 text-xs font-black text-[#F97316]"
                  >
                    Copy Link
                  </button>

                </div>
              )}

            </div>
          )}

        </section>
      )}

    </div>
  );
};


const SectionTitle = ({
  title,
  subtitle,
  light = false,
}) => (
  <div>

    <h2
      className={`text-xl font-black ${
        light
          ? "text-white"
          : "text-[#171717]"
      }`}
    >
      {title}
    </h2>

    <p
      className={`mt-1 text-xs ${
        light
          ? "text-white/45"
          : "text-black/45"
      }`}
    >
      {subtitle}
    </p>

  </div>
);


const Info = ({
  label,
  value,
}) => (
  <div className="rounded-xl bg-[#FFF9F2] p-4">

    <p className="text-xs text-black/40">
      {label}
    </p>

    <p className="mt-1 font-bold">
      {value || "—"}
    </p>

  </div>
);


const DarkInfo = ({
  label,
  value,
}) => (
  <div className="border-b border-white/10 pb-4">

    <p className="text-xs text-white/40">
      {label}
    </p>

    <p className="mt-1 font-bold">
      {value}
    </p>

  </div>
);


const Status = ({
  value,
}) => (
  <span className="inline-flex rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[#9B7915]">
    {format(value)}
  </span>
);


const Notice = ({
  type,
  text,
}) => (
  <div
    className={`rounded-xl px-4 py-3 text-sm ${
      type === "error"
        ? "bg-red-50 text-red-600"
        : "bg-green-50 text-green-700"
    }`}
  >
    {text}
  </div>
);


const format = (
  value = ""
) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );


export default ProjectDetails;