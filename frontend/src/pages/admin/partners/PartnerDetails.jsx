import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";
import {
  PARTNER_CAPABILITIES,
  PARTNER_TYPES,
} from "../../../constants/partnerOptions.js";
const PartnerDetails = () => {
  const { id } = useParams();
  const [partner, setPartner] = useState(null);
  const [projects, setProjects] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState({
    status: "under_review",
    note: "",
    defaultCommissionRate: "5",
    customerDiscountRate: "0",
    agreementVersion: "1.0",
    agreementNote: "",
  });
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [partnerResponse, projectsResponse, commissionsResponse] =
        await Promise.all([
          api.get(`/partners/admin/${id}`),
          api.get("/partners/projects/admin/all", {
            params: { partnerId: id },
          }),
          api.get("/commissions/admin/all", {
            params: { partnerId: id },
          }),
        ]);
      const nextPartner = partnerResponse.data.partner;
      setPartner(nextPartner);
      setProjects(projectsResponse.data.projects || []);
      setCommissions(commissionsResponse.data.commissions || []);
      setReview((current) => ({
        ...current,
        status:
          nextPartner.status === "applied"
            ? "under_review"
            : nextPartner.status,
        note: nextPartner.review?.note || "",
        defaultCommissionRate: String(
          nextPartner.defaultCommissionRate ??
            current.defaultCommissionRate
        ),
        customerDiscountRate: String(
          nextPartner.customerDiscountRate ??
            current.customerDiscountRate
        ),
        agreementVersion: nextPartner.agreement?.version || "1.0",
        agreementNote: nextPartner.agreement?.note || "",
      }));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load partner"
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  const summary = useMemo(
    () => ({
      commission: commissions.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
      payable: commissions
        .filter((item) => item.status === "payable")
        .reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        ),
    }),
    [commissions]
  );
  const submitReview = async () => {
    const commissionRate = Number(review.defaultCommissionRate || 0);
    const customerDiscountRate = Number(review.customerDiscountRate || 0);
    if (
      !Number.isFinite(commissionRate) ||
      commissionRate < 0 ||
      commissionRate > 100
    ) {
      setError("Commission rate must be between 0 and 100.");
      return;
    }
    if (
      !Number.isFinite(customerDiscountRate) ||
      customerDiscountRate < 0 ||
      customerDiscountRate > 100
    ) {
      setError("Customer promo discount must be between 0 and 100.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await api.patch(
        `/partners/admin/${id}/review`,
        {
          status: review.status,
          note: review.note,
          defaultCommissionRate: commissionRate,
          customerDiscountRate,
          agreementVersion: review.agreementVersion,
          agreementNote: review.agreementNote,
        }
      );
      setMessage(
        response.data.message || "Partner review updated."
      );
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update partner review"
      );
    } finally {
      setBusy(false);
    }
  };
  const validateProject = async (project) => {
    const approved = window.confirm(
      "Approve this project and enter client pricing? Choose Cancel to request changes."
    );
    if (!approved) {
      const note = window.prompt("Reason / changes required?");
      if (!note) return;
      try {
        await api.patch(
          `/partners/projects/${project._id}/validate`,
          { approved: false, note }
        );
        setMessage("Project changes requested.");
        await load();
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Project validation failed"
        );
      }
      return;
    }
    const itemPricing = [];
    for (const item of project.items || []) {
      const title =
        item.product?.name ||
        item.requestedTitle ||
        "Gift option";
      const value = window.prompt(
        `Client price for ${title}?`,
        String(item.clientPrice || 0)
      );
      if (value === null) return;
      itemPricing.push({
        itemId: item._id,
        validationStatus: "approved",
        clientPrice: Number(value),
        validationNote: "Approved by HAMPORIUM.",
      });
    }
    try {
      await api.patch(
        `/partners/projects/${project._id}/validate`,
        {
          approved: true,
          items: itemPricing,
          note: "Validated by HAMPORIUM.",
        }
      );
      setMessage("Project validated and client pricing approved.");
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Project validation failed"
      );
    }
  };
  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-8">
        Loading partner...
      </div>
    );
  }
  if (!partner) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-red-700">
        {error || "Partner not found"}
      </div>
    );
  }
  const partnerTypeLabel =
    PARTNER_TYPES.find(([value]) => value === partner.partnerType)?.[1] ||
    format(partner.partnerType);
  const capabilityMap = new Map(PARTNER_CAPABILITIES);
  return (
    <div className="space-y-7 pb-12">
      <Link
        to="/admin/partners"
        className="text-xs font-black text-[#F97316]"
      >
        ← Partner Applications
      </Link>
      <div className="flex flex-col gap-5 border-b border-black/[0.07] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D4AF37]">
            {partner.partnerId}
          </p>
          <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">
            {partner.businessName}
          </h1>
          <p className="mt-3 text-sm text-black/45">
            {partner.contact?.name} · {partner.contact?.email}
          </p>
        </div>
        <StatusBadge status={partner.status} />
      </div>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Commission Records" value={commissions.length} />
        <Stat label="Commission Amount" value={money(summary.commission)} />
        <Stat label="Payable" value={money(summary.payable)} />
        <Stat
          label="Partner Commission"
          value={`${Number(partner.defaultCommissionRate || 0)}%`}
        />
        <Stat
          label="Customer Promo"
          value={`${Number(partner.customerDiscountRate || 0)}%`}
        />
      </div>
      <section className="overflow-hidden rounded-[22px] border border-[#D4AF37]/25 bg-[#171717] text-white">
        <div className="grid lg:grid-cols-[1fr_.8fr_.8fr]">
          <div className="p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#D4AF37]">
              Partner Referral Code
            </p>
            <p className="mt-2 break-all font-serif text-[30px] font-semibold tracking-[0.04em]">
              {partner.referralCode || "Not generated"}
            </p>
            <p className="mt-2 text-[10px] leading-5 text-white/40">
              Customers must explicitly apply or arrive through this code for partner attribution.
            </p>
          </div>
          <CommercialStat
            label="Commission Rate"
            value={`${Number(partner.defaultCommissionRate || 0)}%`}
            note="Partner earning rate on eligible attributed paid value."
          />
          <CommercialStat
            label="Customer Discount"
            value={`${Number(partner.customerDiscountRate || 0)}%`}
            note="Discount shown to eligible ready-made retail orders using this code."
          />
        </div>
      </section>
      <section className="rounded-[22px] border border-black/10 bg-white p-6">
        <p className="text-[9px] font-black uppercase tracking-wider text-[#F97316]">
          Application Review
        </p>
        <h2 className="mt-1 text-xl font-black">
          Status & commercial approval
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label>
            <span className={labelClass}>Review status</span>
            <select
              value={review.status}
              onChange={(event) =>
                setReview((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className={inputClass}
            >
              {["under_review", "approved", "rejected", "suspended"].map(
                (value) => (
                  <option key={value} value={value}>
                    {format(value)}
                  </option>
                )
              )}
            </select>
          </label>
          <Input
            label="Commission rate %"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={review.defaultCommissionRate}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                defaultCommissionRate: value,
              }))
            }
          />
          <Input
            label="Customer discount % (partner code)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={review.customerDiscountRate}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                customerDiscountRate: value,
              }))
            }
          />
          <Input
            label="Agreement version"
            value={review.agreementVersion}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                agreementVersion: value,
              }))
            }
          />
          <button
            type="button"
            onClick={submitReview}
            disabled={busy}
            className="mt-5 h-12 rounded-xl bg-[#F97316] px-5 text-xs font-black text-white transition hover:bg-[#171717] disabled:opacity-40"
          >
            {busy ? "Updating..." : "Update Review"}
          </button>
        </div>
        <div className="mt-4 border-l-2 border-[#D4AF37] bg-[#FFF9F2] px-4 py-3 text-xs leading-6 text-black/55">
        <strong className="text-[#171717]">Partner-code rule:</strong> the code is an exclusive retail promotion slot. Automatic retail commission is created only after a successful captured payment and only when this partner code is actually stored on that order. No partner code means no automatic retail commission. Commission uses only the promo-eligible SKU taxable value after the partner discount; custom-hamper value is not silently included.
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClass}>Review note</span>
            <textarea
              rows="3"
              value={review.note}
              onChange={(event) =>
                setReview((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              className={textareaClass}
            />
          </label>
          <label>
            <span className={labelClass}>Agreement note</span>
            <textarea
              rows="3"
              value={review.agreementNote}
              onChange={(event) =>
                setReview((current) => ({
                  ...current,
                  agreementNote: event.target.value,
                }))
              }
              className={textareaClass}
            />
          </label>
        </div>
      </section>
      <section className="rounded-[22px] border border-black/10 bg-white p-6">
        <p className="text-[9px] font-black uppercase tracking-wider text-[#F97316]">
          Onboarding Details
        </p>
        <h2 className="mt-1 text-xl font-black">
          Business & verification
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Partner type" value={partnerTypeLabel} />
          <Info label="Business type" value={format(partner.businessType)} />
          <Info label="Legal name" value={partner.legalName} />
          <Info label="Registered name" value={partner.registeredBusinessName} />
          <Info label="Phone" value={partner.contact?.phone} />
          <Info
            label="Location"
            value={`${partner.address?.city || "—"}, ${partner.address?.state || "—"}`}
          />
          <Info
            label="Verification"
            value={format(partner.verification?.status || "pending")}
          />
          <Info
            label="PAN verified"
            value={partner.verification?.panVerified ? "Yes" : "No"}
          />
          <Info label="PAN" value={partner.panNumber || "Not supplied"} />
          <Info label="GSTIN" value={partner.gstNumber || "Not supplied"} />
          <Info
            label="GST verified"
            value={partner.verification?.gstVerified ? "Yes" : "No"}
          />
          <Info label="Experience" value={`${partner.experienceYears || 0} years`} />
          <Info
            label="Working model"
            value={format(partner.commercialProfile?.preferredWorkingModel)}
          />
          <Info
            label="Monthly volume"
            value={partner.commercialProfile?.expectedMonthlyVolume || 0}
          />
          <Info
            label="Typical order"
            value={money(partner.commercialProfile?.typicalOrderValue)}
          />
          <Info label="Referral code" value={partner.referralCode || "—"} />
        </div>
        <div className="mt-5 rounded-xl bg-[#FFF9F2] p-4">
          <p className="text-[9px] font-black uppercase tracking-wider text-black/35">
            About
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/60">
            {partner.about || "—"}
          </p>
        </div>
        <div className="mt-5">
          <p className={labelClass}>Capabilities</p>
          <div className="flex flex-wrap gap-2">
            {(partner.capabilities || []).map((value) => (
              <span
                key={value}
                className="rounded-full bg-[#FFF1E8] px-3 py-1.5 text-[10px] font-bold text-[#F97316]"
              >
                {capabilityMap.get(value) || format(value)}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <List label="Supply categories" values={partner.supplyCategories} />
          <List label="Services offered" values={partner.servicesOffered} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <List
            label="Service areas"
            values={(partner.serviceAreas || []).map((area) =>
              [area.city, area.state, area.pincode]
                .filter(Boolean)
                .join(", ")
            )}
          />
          <List
            label="Links"
            values={[
              partner.website,
              partner.portfolioUrl,
              partner.social?.instagram,
              partner.social?.linkedin,
            ].filter(Boolean)}
          />
        </div>
</section>
      <section className="rounded-[22px] border border-black/10 bg-white p-6">
        <p className="text-[9px] font-black uppercase tracking-wider text-[#F97316]">
          Projects
        </p>
        <h2 className="mt-1 text-xl font-black">
          HAMPORIUM validation queue
        </h2>
        <div className="mt-5 space-y-3">
          {projects.map((project) => (
            <div key={project._id} className="rounded-xl bg-[#FFF9F2] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-black text-[#D4AF37]">
                    {project.projectId}
                  </p>
                  <p className="mt-1 font-black">{project.title}</p>
                  <p className="mt-1 text-xs text-black/40">
                    {project.client?.name} · {project.items?.length || 0} option(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={project.status} />
                  {["submitted", "under_review", "changes_requested"].includes(
                    project.status
                  ) && (
                    <button
                      type="button"
                      onClick={() => validateProject(project)}
                      className="rounded-xl bg-[#171717] px-4 py-2.5 text-[10px] font-black text-white transition hover:bg-[#F97316]"
                    >
                      Validate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!projects.length && (
            <p className="text-sm text-black/40">No projects.</p>
          )}
        </div>
      </section>
      <section className="rounded-[22px] bg-[#171717] p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">
              Commission
            </p>
            <h2 className="mt-1 text-xl font-black">
              Partner earnings records
            </h2>
          </div>
          <Link
            to="/admin/commissions"
            className="text-xs font-black text-[#F97316]"
          >
            Open commission ledger →
          </Link>
        </div>
        <div className="mt-5 space-y-3">
          {commissions.slice(0, 8).map((commission) => (
            <div
              key={commission._id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-[9px] font-bold text-[#D4AF37]">
                  {commission.commissionId}
                </p>
                <p className="mt-1 font-black">
                  {money(commission.amount)}
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={commission.status} />
                <StatusBadge status={commission.payoutStatus} />
              </div>
            </div>
          ))}
          {!commissions.length && (
            <p className="text-sm text-white/40">
              No commission records.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
const inputClass =
  "h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#F97316]";
const textareaClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#F97316]";
const labelClass =
  "mb-2 block text-[9px] font-black uppercase tracking-wider text-black/40";
const Input = ({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
}) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input
      type={type}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  </label>
);
const CommercialStat = ({ label, value, note }) => (
  <div className="border-t border-white/10 p-6 lg:border-l lg:border-t-0">
    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-[28px] font-black text-[#D4AF37]">{value}</p>
    <p className="mt-2 text-[10px] leading-5 text-white/40">{note}</p>
  </div>
);
const Info = ({ label, value }) => (
  <div className="rounded-xl bg-[#FFF9F2] p-4">
    <p className="text-[9px] font-black uppercase tracking-wider text-black/35">
      {label}
    </p>
    <p className="mt-1 break-words text-sm font-black">{value || "—"}</p>
  </div>
);
const List = ({ label, values = [] }) => (
  <div className="rounded-xl border border-black/[0.06] p-4">
    <p className={labelClass}>{label}</p>
    <div className="space-y-1">
      {values.length ? (
        values.map((value, index) => (
          <p
            key={`${value}-${index}`}
            className="break-all text-xs text-black/55"
          >
            • {value}
          </p>
        ))
      ) : (
        <p className="text-xs text-black/35">—</p>
      )}
    </div>
  </div>
);
const Stat = ({ label, value }) => (
  <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
    <p className="text-[9px] font-black uppercase tracking-wider text-black/35">
      {label}
    </p>
    <p className="mt-2 break-words text-xl font-black">{value}</p>
  </div>
);
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const format = (value = "") =>
  String(value || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
export default PartnerDetails;
