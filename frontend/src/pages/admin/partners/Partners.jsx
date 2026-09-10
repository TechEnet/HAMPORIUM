import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../../api/api.js";
import StatusBadge from "../../../components/StatusBadge.jsx";

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/partners/admin/all", {
          params: {
            ...(status ? { status } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
          },
        });

        if (active) {
          setPartners(response.data.partners || []);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load partners"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [status, search]);

  const counts = useMemo(
    () => ({
      total: partners.length,
      pending: partners.filter((item) =>
        ["applied", "under_review"].includes(item.status)
      ).length,
      approved: partners.filter((item) => item.status === "approved").length,
      withPromo: partners.filter(
        (item) => Number(item.customerDiscountRate || 0) > 0
      ).length,
    }),
    [partners]
  );

  return (
    <div className="space-y-7 pb-12">
      <header className="border-b border-black/[0.07] pb-7">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F97316]">
          Partner Network
        </p>
        <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">
          Partner Applications
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/45">
          Review onboarding details, approval status, referral codes, customer promo discount and partner commission settings.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Loaded" value={counts.total} />
        <Stat label="Pending review" value={counts.pending} />
        <Stat label="Approved" value={counts.approved} />
        <Stat label="Promo enabled" value={counts.withPromo} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-[1fr_220px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, contact, email, Partner ID or referral code..."
          className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[#F97316]"
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[#F97316]"
        >
          <option value="">All statuses</option>
          {["applied", "under_review", "approved", "rejected", "suspended"].map(
            (value) => (
              <option key={value} value={value}>
                {format(value)}
              </option>
            )
          )}
        </select>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-sm text-black/40">
          Loading partners...
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-black/10 bg-white">
          {partners.map((partner) => (
            <Link
              key={partner._id}
              to={`/admin/partners/${partner._id}`}
              className="grid gap-5 border-b border-black/[0.06] p-5 transition last:border-0 hover:bg-[#FFF9F2] lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">
                    {partner.partnerId}
                  </p>
                  {partner.referralCode && (
                    <span className="rounded-full bg-[#171717] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.05em] text-white">
                      {partner.referralCode}
                    </span>
                  )}
                </div>

                <h2 className="mt-2 text-lg font-black">
                  {partner.businessName}
                </h2>

                <p className="mt-1 text-xs text-black/45">
                  {partner.contact?.name} · {partner.contact?.email}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold text-black/35">
                  <span>{format(partner.partnerType)}</span>
                  <span>·</span>
                  <span>{partner.capabilities?.length || 0} capabilities</span>
                  <span>·</span>
                  <span>
                    {partner.address?.city || "—"}, {partner.address?.state || "—"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:text-right">
                <CommercialValue
                  label="Commission"
                  value={`${Number(partner.defaultCommissionRate || 0)}%`}
                />
                <CommercialValue
                  label="Customer Promo"
                  value={`${Number(partner.customerDiscountRate || 0)}%`}
                  accent={Number(partner.customerDiscountRate || 0) > 0}
                />
                <div className="sm:text-right">
                  <p className="mb-2 text-[8px] font-black uppercase tracking-wider text-black/30">
                    Status
                  </p>
                  <StatusBadge status={partner.status} />
                </div>
              </div>
            </Link>
          ))}

          {!partners.length && (
            <div className="p-12 text-center text-sm text-black/40">
              No partners found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CommercialValue = ({ label, value, accent = false }) => (
  <div>
    <p className="text-[8px] font-black uppercase tracking-wider text-black/30">
      {label}
    </p>
    <p
      className={`mt-2 text-sm font-black ${
        accent ? "text-[#F97316]" : "text-[#171717]"
      }`}
    >
      {value}
    </p>
  </div>
);

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
    <p className="text-[9px] font-black uppercase tracking-wider text-black/35">
      {label}
    </p>
    <p className="mt-2 text-2xl font-black">{value}</p>
  </div>
);

const format = (value = "") =>
  String(value || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default Partners;
