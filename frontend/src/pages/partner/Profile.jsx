import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  BUSINESS_TYPES,
  PARTNER_CAPABILITIES,
  PARTNER_TYPES,
  WORKING_MODELS,
} from "../../constants/partnerOptions.js";
import {
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  inputClass,
  textareaClass,
} from "../../components/partner/PartnerUI.jsx";

const Profile = () => {
  const { partner: authPartner, refreshPartner } = useAuth();
  const [partner, setPartner] = useState(authPartner);
  const [form, setForm] = useState(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("partner_user");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const response = await api.get("/partners/me");
      setPartner(response.data.partner || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load partner profile");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!partner) return;
    setForm({
      businessName: partner.businessName || "",
      legalName: partner.legalName || "",
      registeredBusinessName: partner.registeredBusinessName || "",
      businessType: partner.businessType || "individual",
      partnerType: partner.partnerType || "event_planner",
      capabilities: partner.capabilities || [],
      supplyCategories: (partner.supplyCategories || []).join(", "),
      servicesOffered: (partner.servicesOffered || []).join(", "),
      contact: { ...partner.contact },
      website: partner.website || "",
      portfolioUrl: partner.portfolioUrl || "",
      social: { instagram: "", linkedin: "", facebook: "", other: "", ...(partner.social || {}) },
      gstNumber: partner.gstNumber || "",
      panNumber: partner.panNumber || "",
      address: { line1: "", line2: "", city: "", state: "", pincode: "", country: "India", ...(partner.address || {}) },
      about: partner.about || "",
      experienceYears: partner.experienceYears || 0,
      commercialProfile: {
        expectedMonthlyVolume: 0,
        typicalOrderValue: 0,
        preferredWorkingModel: "referral",
        commissionAcknowledged: true,
        ...(partner.commercialProfile || {}),
      },
    });
  }, [partner?._id]);

  const ownerId = String(partner?.owner?._id || partner?.owner || "");
  const currentUserMembership = useMemo(() => partner?.members || [], [partner]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.patch("/partners/me", {
        ...form,
        capabilities: form.capabilities,
        supplyCategories: split(form.supplyCategories),
        servicesOffered: split(form.servicesOffered),
        experienceYears: Number(form.experienceYears || 0),
        commercialProfile: {
          ...form.commercialProfile,
          expectedMonthlyVolume: Number(form.commercialProfile.expectedMonthlyVolume || 0),
          typicalOrderValue: Number(form.commercialProfile.typicalOrderValue || 0),
          commissionAcknowledged: true,
        },
      });
      setMessage("Partner profile updated.");
      await Promise.all([load(), refreshPartner()]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update partner profile");
    } finally {
      setSaving(false);
    }
  };

  const addMember = async (event) => {
    event.preventDefault();
    if (!memberEmail.trim()) return;
    setError("");
    try {
      await api.post("/partners/members", { email: memberEmail.trim(), role: memberRole });
      setMemberEmail("");
      setMessage("Partner member added.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to add partner member");
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm("Remove this member from the partner organisation?")) return;
    try {
      await api.delete(`/partners/members/${userId}`);
      setMessage("Partner member removed.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to remove partner member");
    }
  };

  if (!partner || !form) return <Panel>Loading profile...</Panel>;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Partner Account"
        title="Profile & Team"
        description={`Partner ID ${partner.partnerId} · Referral code ${partner.referralCode || "—"}`}
        action={<StatusPill value={partner.status} />}
      />
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <Panel>
        <form onSubmit={save} className="space-y-7">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Business name" value={form.businessName} onChange={(value) => setField(setForm, "businessName", value)} />
            <Input label="Legal name" value={form.legalName} onChange={(value) => setField(setForm, "legalName", value)} />
            <Input label="Registered business name" value={form.registeredBusinessName} onChange={(value) => setField(setForm, "registeredBusinessName", value)} />
            <Select label="Partner type" value={form.partnerType} options={PARTNER_TYPES} onChange={(value) => setField(setForm, "partnerType", value)} />
            <Select label="Business type" value={form.businessType} options={BUSINESS_TYPES} onChange={(value) => setField(setForm, "businessType", value)} />
            <Input label="Experience years" type="number" value={form.experienceYears} onChange={(value) => setField(setForm, "experienceYears", value)} />
            <Input label="Contact name" value={form.contact?.name || ""} onChange={(value) => setNested(setForm, "contact", "name", value)} />
            <Input label="Contact email" type="email" value={form.contact?.email || ""} onChange={(value) => setNested(setForm, "contact", "email", value)} />
            <Input label="Phone" value={form.contact?.phone || ""} onChange={(value) => setNested(setForm, "contact", "phone", value)} />
            <Input label="Website" type="url" value={form.website} onChange={(value) => setField(setForm, "website", value)} />
            <Input label="Portfolio" type="url" value={form.portfolioUrl} onChange={(value) => setField(setForm, "portfolioUrl", value)} />
            <Input label="GSTIN" value={form.gstNumber} onChange={(value) => setField(setForm, "gstNumber", value.toUpperCase())} />
            <Input label="PAN" value={form.panNumber} onChange={(value) => setField(setForm, "panNumber", value.toUpperCase())} />
          </div>

          <label><span className={labelClass}>About</span><textarea rows="4" value={form.about} onChange={(event) => setField(setForm, "about", event.target.value)} className={textareaClass} /></label>

          <div>
            <p className={labelClass}>Capabilities</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {PARTNER_CAPABILITIES.map(([value, label]) => {
                const active = form.capabilities.includes(value);
                return <button type="button" key={value} onClick={() => setForm((current) => ({ ...current, capabilities: active ? current.capabilities.filter((item) => item !== value) : [...current.capabilities, value] }))} className={`rounded-xl border p-3 text-left text-xs font-bold ${active ? "border-[#F97316] bg-[#FFF1E8] text-[#F97316]" : "border-black/10 bg-white"}`}>{active ? "✓ " : ""}{label}</button>;
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label><span className={labelClass}>Supply categories</span><textarea rows="3" value={form.supplyCategories} onChange={(event) => setField(setForm, "supplyCategories", event.target.value)} className={textareaClass} /></label>
            <label><span className={labelClass}>Services offered</span><textarea rows="3" value={form.servicesOffered} onChange={(event) => setField(setForm, "servicesOffered", event.target.value)} className={textareaClass} /></label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(form.address).map(([key, value]) => <Input key={key} label={key.replaceAll("line", "address line ")} value={value} onChange={(nextValue) => setNested(setForm, "address", key, nextValue)} disabled={key === "country"} />)}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(form.social).map(([key, value]) => <Input key={key} label={key} type="url" value={value} onChange={(nextValue) => setNested(setForm, "social", key, nextValue)} />)}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Expected monthly volume" type="number" value={form.commercialProfile.expectedMonthlyVolume} onChange={(value) => setNested(setForm, "commercialProfile", "expectedMonthlyVolume", value)} />
            <Input label="Typical order value" type="number" value={form.commercialProfile.typicalOrderValue} onChange={(value) => setNested(setForm, "commercialProfile", "typicalOrderValue", value)} />
            <Select label="Working model" value={form.commercialProfile.preferredWorkingModel} options={WORKING_MODELS} onChange={(value) => setNested(setForm, "commercialProfile", "preferredWorkingModel", value)} />
          </div>

          <button disabled={saving} className="rounded-xl bg-[#171717] px-6 py-3 text-xs font-black text-white hover:bg-[#F97316] disabled:opacity-40">{saving ? "Saving..." : "Save partner profile"}</button>
        </form>
      </Panel>

      {partner.status === "approved" && (
        <Panel>
          <div><p className="text-[9px] font-black uppercase tracking-wider text-[#F97316]">Team</p><h2 className="mt-1 text-xl font-black">Partner members</h2></div>
          <form onSubmit={addMember} className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="Existing HAMPORIUM user email" className={inputClass} required />
            <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className={inputClass}><option value="partner_user">Partner User</option><option value="partner_admin">Partner Admin</option></select>
            <button className="rounded-xl bg-[#F97316] px-5 py-3 text-xs font-black text-white">Add member</button>
          </form>

          <div className="mt-5 divide-y divide-black/[0.06]">
            {currentUserMembership.map((member) => {
              const userId = String(member.user?._id || member.user || "");
              return <div key={userId} className="flex items-center justify-between gap-4 py-4"><div><p className="font-black">{member.user?.name || "Partner member"}</p><p className="mt-1 text-xs text-black/40">{member.user?.email || ""} · {String(member.role).replaceAll("_", " ")}</p></div>{member.isActive && userId !== ownerId && <button type="button" onClick={() => removeMember(userId)} className="text-xs font-black text-red-500">Remove</button>}</div>;
            })}
          </div>
        </Panel>
      )}
    </div>
  );
};

const split = (value) => [...new Set(String(value || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
const setField = (setter, field, value) => setter((current) => ({ ...current, [field]: value }));
const setNested = (setter, group, field, value) => setter((current) => ({ ...current, [group]: { ...current[group], [field]: value } }));
const Input = ({ label, value, onChange, type = "text", disabled = false }) => <label><span className={labelClass}>{label}</span><input type={type} value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${inputClass} disabled:bg-black/[0.03] disabled:text-black/40`} /></label>;
const Select = ({ label, value, options, onChange }) => <label><span className={labelClass}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
const labelClass = "mb-2 block text-[9px] font-black uppercase tracking-[0.1em] text-black/45";

export default Profile;
