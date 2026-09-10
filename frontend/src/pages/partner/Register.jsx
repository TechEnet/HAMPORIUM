import { useCallback, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  BUSINESS_TYPES,
  PARTNER_CAPABILITIES,
  PARTNER_TYPES,
  WORKING_MODELS,
} from "../../constants/partnerOptions.js";
import { getPartnerLandingPath } from "../../utils/authRouting.js";

const TOTAL_STEPS = 9;

const initialForm = (user) => ({
  name: user?.name || "",
  email: user?.email || "",
  password: "",
  confirmPassword: "",
  phone: user?.phone || "",
  businessName: "",
  legalName: "",
  registeredBusinessName: "",
  businessType: "individual",
  partnerType: "event_planner",
  about: "",
  experienceYears: "",
  capabilities: [],
  supplyCategoriesText: "",
  servicesOfferedText: "",
  address: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  },
  serviceAreas: [{ city: "", state: "", pincode: "" }],
  website: "",
  portfolioUrl: "",
  social: {
    instagram: "",
    linkedin: "",
    facebook: "",
    other: "",
  },
  gstNumber: "",
  panNumber: "",
  commercialProfile: {
    expectedMonthlyVolume: "",
    typicalOrderValue: "",
    preferredWorkingModel: "referral",
    commissionAcknowledged: false,
  },
  application: {
    termsAccepted: false,
    privacyAccepted: false,
    declarationAccepted: false,
    onboardingVersion: "1.0",
    agreementVersion: "1.0",
  },
});

const splitTags = (value) =>
  [...new Set(String(value || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];

const buildPayload = (form, includeCredentials = true) => ({
  ...(includeCredentials
    ? {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      }
    : {}),
  businessName: form.businessName.trim(),
  legalName: form.legalName.trim(),
  registeredBusinessName:
    form.registeredBusinessName.trim() || form.legalName.trim() || form.businessName.trim(),
  businessType: form.businessType,
  partnerType: form.partnerType,
  contact: {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
  },
  capabilities: form.capabilities,
  supplyCategories: splitTags(form.supplyCategoriesText),
  servicesOffered: splitTags(form.servicesOfferedText),
  address: form.address,
  serviceAreas: form.serviceAreas.filter((area) => area.city || area.state || area.pincode),
  about: form.about.trim(),
  experienceYears: Number(form.experienceYears || 0),
  website: form.website.trim(),
  portfolioUrl: form.portfolioUrl.trim(),
  social: form.social,
  gstNumber: form.gstNumber.trim().toUpperCase(),
  panNumber: form.panNumber.trim().toUpperCase(),
  commercialProfile: {
    expectedMonthlyVolume: Number(form.commercialProfile.expectedMonthlyVolume || 0),
    typicalOrderValue: Number(form.commercialProfile.typicalOrderValue || 0),
    preferredWorkingModel: form.commercialProfile.preferredWorkingModel,
    commissionAcknowledged: form.commercialProfile.commissionAcknowledged,
  },
  application: form.application,
});

const PartnerRegister = () => {
  const {
    user,
    partner,
    partnerRegister,
    partnerGoogleRegister,
    partnerApply,
  } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => initialForm(user));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existingCustomer = Boolean(user && !user.roles?.includes("partner"));

  const payload = useMemo(
    () => buildPayload(form, !existingCustomer),
    [form, existingCustomer]
  );

  const finishGoogle = useCallback(
    async (credential) => {
      setSubmitting(true);
      setError("");

      try {
        const googlePayload = buildPayload(form, false);
        googlePayload.contact = {
          ...googlePayload.contact,
          email: "",
        };

        const data = await partnerGoogleRegister({ credential, payload: googlePayload });
        navigate(getPartnerLandingPath(data.partner), { replace: true });
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Unable to register partner with Google"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [partnerGoogleRegister, form, navigate]
  );

  const googleError = useCallback((message) => setError(message), []);

  if (user?.roles?.includes("partner")) {
    return <Navigate to={getPartnerLandingPath(partner)} replace />;
  }

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const setNested = (group, name, value) =>
    setForm((current) => ({
      ...current,
      [group]: { ...current[group], [name]: value },
    }));

  const toggleCapability = (value) => {
    setForm((current) => ({
      ...current,
      capabilities: current.capabilities.includes(value)
        ? current.capabilities.filter((item) => item !== value)
        : [...current.capabilities, value],
    }));
  };

  const validateStep = () => {
    if (step === 1 && (!form.partnerType || !form.businessType)) return "Select your partner and business type.";
    if (step === 2) {
      if (form.name.trim().length < 2) return "Enter your full name.";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
      if (form.phone.trim().length < 7) return "Enter a valid phone number.";
      if (!existingCustomer) {
        if (form.password.length < 8) return "Password must be at least 8 characters.";
        if (form.password !== form.confirmPassword) return "Passwords do not match.";
      }
    }
    if (step === 3) {
      if (!form.businessName.trim()) return "Business name is required.";
      if (form.about.trim().length < 20) return "Tell us a little more about your business (at least 20 characters).";
    }
    if (step === 4 && !form.capabilities.length) return "Select at least one capability.";
    if (step === 6 && (!form.address.city.trim() || !form.address.state.trim())) return "City and state are required.";
    if (step === 8) {
      if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(form.panNumber)) return "Enter a valid PAN number.";
      if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(form.gstNumber)) return "Enter a valid GSTIN.";
      if (!form.commercialProfile.commissionAcknowledged) return "Please acknowledge the partner commission model.";
    }
    if (step === 9) {
      if (!form.application.termsAccepted || !form.application.privacyAccepted || !form.application.declarationAccepted) {
        return "Accept the partner terms, privacy policy and declaration to continue.";
      }
    }
    return "";
  };

  const next = () => {
    const problem = validateStep();
    setError(problem);
    if (!problem) setStep((value) => Math.min(TOTAL_STEPS, value + 1));
  };

  const back = () => {
    setError("");
    setStep((value) => Math.max(1, value - 1));
  };

  const submitPasswordOrExisting = async () => {
    const problem = validateStep();
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    try {
      if (existingCustomer) {
        await partnerApply(buildPayload(form, false));
        navigate("/partner/status", { replace: true });
        return;
      }

      const data = await partnerRegister(payload);
      sessionStorage.setItem(
        "hamporium.pendingVerification",
        JSON.stringify({ email: data.email || form.email, partner: true })
      );
      navigate("/verify-email", {
        replace: true,
        state: { email: data.email || form.email, partner: true },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.errors?.[0]?.message ||
          "Unable to submit partner application"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const titles = [
    "What kind of partner are you?",
    existingCustomer ? "Confirm your contact details." : "Create your partner identity.",
    "Tell us about your business.",
    "What can you deliver?",
    "What do you supply or offer?",
    "Where do you work?",
    "Show us your work.",
    "Commercial & verification details.",
    "Review, agree and submit.",
  ];

  const descriptions = [
    "Choose the closest match. You can update your profile later.",
    existingCustomer
      ? "We’ll use your existing HAMPORIUM account and add the Partner role after application submission."
      : "This creates the owner login for your Partner Portal.",
    "HAMPORIUM uses this to understand your business before approval.",
    "Select every capability that genuinely applies to your business.",
    "Comma-separated categories and services are fine — keep them practical and specific.",
    "Your registered address and primary service areas help us route the right opportunities.",
    "Website, portfolio and social profiles help the review team understand your work.",
    "PAN/GST are optional when not applicable; payout banking is intentionally collected later.",
    "Nothing becomes active until HAMPORIUM approves the application.",
  ];

  return (
    <TypeformShell
      eyebrow="HAMPORIUM Partner Network"
      title={titles[step - 1]}
      description={descriptions[step - 1]}
      step={step}
      totalSteps={TOTAL_STEPS}
      sideTitle="Build a partner profile that feels like you."
      sideText="One focused section at a time, then a single secure application submission."
      closeTo="/event-partners"
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceGrid
            label="Partner type"
            value={form.partnerType}
            options={PARTNER_TYPES}
            onChange={(value) => set("partnerType", value)}
          />
          <ChoiceGrid
            label="Business structure"
            value={form.businessType}
            options={BUSINESS_TYPES}
            onChange={(value) => set("businessType", value)}
          />
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Full name" value={form.name} onChange={(value) => set("name", value)} disabled={existingCustomer} autoFocus />
          <TextInput label="Phone" value={form.phone} onChange={(value) => set("phone", value)} />
          <TextInput label="Email" type="email" value={form.email} onChange={(value) => set("email", value)} disabled={existingCustomer} full />
          {!existingCustomer && (
            <>
              <TextInput label="Password" type="password" value={form.password} onChange={(value) => set("password", value)} />
              <TextInput label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => set("confirmPassword", value)} />
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Business name" value={form.businessName} onChange={(value) => set("businessName", value)} autoFocus />
          <TextInput label="Legal name" value={form.legalName} onChange={(value) => set("legalName", value)} />
          <TextInput label="Registered business name" value={form.registeredBusinessName} onChange={(value) => set("registeredBusinessName", value)} full />
          <TextInput label="Experience (years)" type="number" value={form.experienceYears} onChange={(value) => set("experienceYears", value)} />
          <label className="sm:col-span-2">
            <span className={labelClass}>About the business</span>
            <textarea
              rows="5"
              value={form.about}
              onChange={(event) => set("about", event.target.value)}
              placeholder="What do you specialise in, who do you serve, and what makes your offering useful?"
              className={textareaClass}
            />
            <span className="mt-2 block text-[10px] text-black/35">{form.about.trim().length}/3000 characters</span>
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PARTNER_CAPABILITIES.map(([value, label]) => {
            const active = form.capabilities.includes(value);
            return (
              <button
                type="button"
                key={value}
                onClick={() => toggleCapability(value)}
                className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#F97316] bg-[#FFF1E8] text-[#F97316]" : "border-black/10 bg-white hover:border-[#D4AF37]"}`}
              >
                <span className="text-sm font-black">{active ? "✓ " : ""}{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {step === 5 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TagTextarea
            label="Supply categories"
            value={form.supplyCategoriesText}
            onChange={(value) => set("supplyCategoriesText", value)}
            placeholder="Premium gifting, wedding hampers, artisanal food..."
          />
          <TagTextarea
            label="Services offered"
            value={form.servicesOfferedText}
            onChange={(value) => set("servicesOfferedText", value)}
            placeholder="Event gifting, client curation, custom packaging..."
          />
        </div>
      )}

      {step === 6 && (
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(form.address).map(([key, value]) => (
              <TextInput
                key={key}
                label={key === "line1" ? "Address line 1" : key === "line2" ? "Address line 2" : key}
                value={value}
                onChange={(nextValue) => setNested("address", key, nextValue)}
                disabled={key === "country"}
              />
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <p className={labelClass}>Service areas</p>
              <button
                type="button"
                onClick={() => set("serviceAreas", [...form.serviceAreas, { city: "", state: "", pincode: "" }])}
                className="text-xs font-black text-[#F97316]"
              >
                + Add area
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {form.serviceAreas.map((area, index) => (
                <div key={index} className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-[1fr_1fr_150px_auto]">
                  {[
                    ["city", "City"],
                    ["state", "State"],
                    ["pincode", "Pincode"],
                  ].map(([key, label]) => (
                    <input
                      key={key}
                      value={area[key]}
                      onChange={(event) => {
                        const next = [...form.serviceAreas];
                        next[index] = { ...next[index], [key]: event.target.value };
                        set("serviceAreas", next);
                      }}
                      placeholder={label}
                      className={smallInput}
                    />
                  ))}
                  {form.serviceAreas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => set("serviceAreas", form.serviceAreas.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-xs font-bold text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Website" type="url" value={form.website} onChange={(value) => set("website", value)} placeholder="https://..." />
          <TextInput label="Portfolio" type="url" value={form.portfolioUrl} onChange={(value) => set("portfolioUrl", value)} placeholder="https://..." />
          {Object.entries(form.social).map(([key, value]) => (
            <TextInput key={key} label={key} type="url" value={value} onChange={(nextValue) => setNested("social", key, nextValue)} placeholder="https://..." />
          ))}
        </div>
      )}

      {step === 8 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="PAN (if applicable)" value={form.panNumber} onChange={(value) => set("panNumber", value.toUpperCase())} />
          <TextInput label="GSTIN (if applicable)" value={form.gstNumber} onChange={(value) => set("gstNumber", value.toUpperCase())} />
          <TextInput
            label="Expected monthly projects / volume"
            type="number"
            value={form.commercialProfile.expectedMonthlyVolume}
            onChange={(value) => setNested("commercialProfile", "expectedMonthlyVolume", value)}
          />
          <TextInput
            label="Typical order value (₹)"
            type="number"
            value={form.commercialProfile.typicalOrderValue}
            onChange={(value) => setNested("commercialProfile", "typicalOrderValue", value)}
          />
          <label className="sm:col-span-2">
            <span className={labelClass}>Preferred working model</span>
            <select
              value={form.commercialProfile.preferredWorkingModel}
              onChange={(event) => setNested("commercialProfile", "preferredWorkingModel", event.target.value)}
              className={smallInput}
            >
              {WORKING_MODELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <Check
            checked={form.commercialProfile.commissionAcknowledged}
            onChange={(checked) => setNested("commercialProfile", "commissionAcknowledged", checked)}
            text="I understand that commissions are subject to HAMPORIUM approval, eligible orders, cancellations/refunds and payout status."
            full
          />
        </div>
      )}

      {step === 9 && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Review label="Business" value={form.businessName} />
            <Review label="Partner type" value={PARTNER_TYPES.find(([value]) => value === form.partnerType)?.[1]} />
            <Review label="Capabilities" value={`${form.capabilities.length} selected`} />
            <Review label="Primary location" value={`${form.address.city}, ${form.address.state}`} />
          </div>

          <div className="space-y-3">
            <Check checked={form.application.termsAccepted} onChange={(checked) => setNested("application", "termsAccepted", checked)} text="I accept the HAMPORIUM Partner Terms." />
            <Check checked={form.application.privacyAccepted} onChange={(checked) => setNested("application", "privacyAccepted", checked)} text="I accept the privacy policy and consent to application processing." />
            <Check checked={form.application.declarationAccepted} onChange={(checked) => setNested("application", "declarationAccepted", checked)} text="I declare that the submitted business information is accurate." />
          </div>

          <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#FFF9F2] p-4 text-xs leading-6 text-black/55">
            Submission creates an <strong>Applied</strong> partner account. Projects, referral activation and commission tools stay locked until HAMPORIUM approves the application.
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {step > 1 && <button type="button" onClick={back} className={secondaryButton}>← Back</button>}
        {step < TOTAL_STEPS ? (
          <button type="button" onClick={next} className={primaryButton}>Continue →</button>
        ) : (
          <button type="button" onClick={submitPasswordOrExisting} disabled={submitting} className={primaryButton}>
            {submitting ? "Submitting..." : existingCustomer ? "Submit application →" : "Submit with email →"}
          </button>
        )}
      </div>

      {step === TOTAL_STEPS && !existingCustomer && (
        <>
          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-black/10" />
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/30">or submit with Google</span>
            <span className="h-px flex-1 bg-black/10" />
          </div>
          <GoogleAuthButton onSuccess={finishGoogle} onError={googleError} disabled={submitting} />
          <p className="mt-3 text-[10px] leading-5 text-black/35">
            Google registration uses your verified Google account and does not require the password entered earlier.
          </p>
        </>
      )}

      <p className="mt-7 text-sm text-black/45">
        Already a partner? <Link to="/partner/login" className="font-black text-[#F97316]">Partner login</Link>
      </p>
    </TypeformShell>
  );
};

const ChoiceGrid = ({ label, value, options, onChange }) => (
  <div>
    <p className={labelClass}>{label}</p>
    <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {options.map(([optionValue, optionLabel]) => (
        <button
          type="button"
          key={optionValue}
          onClick={() => onChange(optionValue)}
          className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${value === optionValue ? "border-[#F97316] bg-[#FFF1E8] text-[#F97316]" : "border-black/10 bg-white hover:border-[#D4AF37]"}`}
        >
          {value === optionValue ? "✓ " : ""}{optionLabel}
        </button>
      ))}
    </div>
  </div>
);

const TextInput = ({ label, value, onChange, type = "text", placeholder = "", disabled = false, full = false, autoFocus = false }) => (
  <label className={full ? "sm:col-span-2" : ""}>
    <span className={labelClass}>{label}</span>
    <input
      autoFocus={autoFocus}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`${smallInput} disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/40`}
    />
  </label>
);

const TagTextarea = ({ label, value, onChange, placeholder }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <textarea rows="6" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={textareaClass} />
    <span className="mt-2 block text-[10px] text-black/35">Separate entries with commas or new lines.</span>
  </label>
);

const Check = ({ checked, onChange, text, full = false }) => (
  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-white p-4 ${full ? "sm:col-span-2" : ""}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#F97316]" />
    <span className="text-xs font-semibold leading-5 text-black/60">{text}</span>
  </label>
);

const Review = ({ label, value }) => (
  <div className="rounded-xl border border-black/10 bg-white p-4">
    <p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p>
    <p className="mt-1 text-sm font-black">{value || "—"}</p>
  </div>
);

const ErrorBox = ({ children }) => <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{children}</div>;

const labelClass = "mb-2 block text-[9px] font-black uppercase tracking-[0.1em] text-black/45";
const smallInput = "h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10";
const textareaClass = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium leading-6 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10";
const primaryButton = "rounded-xl bg-[#F97316] px-7 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#171717] disabled:opacity-50";
const secondaryButton = "rounded-xl border border-black/10 bg-white px-5 py-3 text-xs font-bold";

export default PartnerRegister;
