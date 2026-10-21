
import { useCallback, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PARTNER_TYPES } from "../../constants/partnerOptions.js";
import { getPartnerLandingPath } from "../../utils/authRouting.js";

const TOTAL_STEPS = 5;
const MAX_KYC_FILE_SIZE = 8 * 1024 * 1024;
const KYC_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const initialForm = (user) => ({
  name: user?.name || "",
  email: user?.email || "",
  password: "",
  confirmPassword: "",
  phone: user?.phone || "",
  businessName: "",
  partnerType: "event_planner",
  about: "",
  city: "",
  state: "",
  kycChoice: "pan",
  panNumber: "",
  aadhaarNumber: "",
  panDocument: null,
  aadhaarDocument: null,
  accepted: false,
});

const buildPayload = (form, includeCredentials = true) => ({
  ...(includeCredentials
    ? {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      }
    : {}),
  businessName: form.businessName.trim(),
  legalName: "",
  registeredBusinessName: form.businessName.trim(),
  businessType: "individual",
  partnerType: form.partnerType,
  contact: {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
  },
  capabilities: [],
  supplyCategories: [],
  servicesOffered: [],
  address: {
    city: form.city.trim(),
    state: form.state.trim(),
    country: "India",
  },
  serviceAreas: [],
  about: form.about.trim(),
  experienceYears: 0,
  website: "",
  portfolioUrl: "",
  social: {},
  gstNumber: "",
  panNumber:
    form.kycChoice === "pan" || form.kycChoice === "both"
      ? form.panNumber.trim().toUpperCase()
      : "",
  aadhaarNumber:
    form.kycChoice === "aadhaar" || form.kycChoice === "both"
      ? form.aadhaarNumber.replace(/\D/g, "")
      : "",
  commercialProfile: {
    expectedMonthlyVolume: 0,
    typicalOrderValue: 0,
    preferredWorkingModel: "referral",
    commissionAcknowledged: false,
  },
  application: {
    termsAccepted: form.accepted,
    privacyAccepted: form.accepted,
    declarationAccepted: form.accepted,
    onboardingVersion: "2.1",
    agreementVersion: "2.1",
  },
});

const buildRegistrationFormData = (payload, form) => {
  const data = new FormData();
  data.append("payload", JSON.stringify(payload));

  if (
    (form.kycChoice === "pan" || form.kycChoice === "both") &&
    form.panDocument
  ) {
    data.append("panDocument", form.panDocument);
  }

  if (
    (form.kycChoice === "aadhaar" || form.kycChoice === "both") &&
    form.aadhaarDocument
  ) {
    data.append("aadhaarDocument", form.aadhaarDocument);
  }

  return data;
};

const uploadExistingPartnerDocuments = async (partnerId, form) => {
  const jobs = [];

  const addUpload = (file, documentType, title) => {
    if (!file) return;

    const data = new FormData();
    data.append("file", file);
    data.append("entityType", "partner");
    data.append("entityId", partnerId);
    data.append("documentType", documentType);
    data.append("title", title);
    data.append("description", "Submitted during partner registration.");
    jobs.push(api.post("/documents", data));
  };

  if (form.kycChoice === "pan" || form.kycChoice === "both") {
    addUpload(form.panDocument, "pan", "PAN verification");
  }

  if (form.kycChoice === "aadhaar" || form.kycChoice === "both") {
    addUpload(form.aadhaarDocument, "aadhaar", "Aadhaar verification");
  }

  await Promise.all(jobs);
};

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const existingCustomer = Boolean(user && !user.roles?.includes("partner"));

  const payload = useMemo(
    () => buildPayload(form, !existingCustomer),
    [form, existingCustomer]
  );

  const set = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));

  const validateFile = (file) => {
    if (!file) return "Choose a document image or PDF.";
    if (!KYC_FILE_TYPES.has(file.type)) {
      return "Upload JPG, PNG, WEBP or PDF only.";
    }
    if (file.size > MAX_KYC_FILE_SIZE) {
      return "Document must be 8 MB or smaller.";
    }
    return "";
  };

  const validateStep = () => {
    if (step === 1 && !form.partnerType) {
      return "Choose the partner type that best matches your work.";
    }

    if (step === 2) {
      if (form.name.trim().length < 2) return "Enter your full name.";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        return "Enter a valid email address.";
      }
      if (form.phone.trim().length < 7) return "Enter a valid phone number.";
      if (!existingCustomer) {
        if (form.password.length < 8) return "Password must be at least 8 characters.";
        if (form.password !== form.confirmPassword) return "Passwords do not match.";
      }
    }

    if (step === 3) {
      if (!form.businessName.trim()) return "Enter your business or working name.";
      if (!form.city.trim() || !form.state.trim()) return "City and state are required.";
      if (form.about.trim().length < 10) {
        return "Tell us briefly what you provide or what kind of work you do.";
      }
    }

    if (step === 4) {
      if (form.kycChoice === "pan" || form.kycChoice === "both") {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(form.panNumber.trim())) {
          return "Enter a valid PAN number.";
        }
        const problem = validateFile(form.panDocument);
        if (problem) return `PAN: ${problem}`;
      }
      if (form.kycChoice === "aadhaar" || form.kycChoice === "both") {
        if (!/^\d{12}$/.test(form.aadhaarNumber.replace(/\D/g, ""))) {
          return "Enter a valid 12 digit Aadhaar number.";
        }
        const problem = validateFile(form.aadhaarDocument);
        if (problem) return `Aadhaar: ${problem}`;
      }
    }

    if (step === 5 && !form.accepted) {
      return "Accept the partner terms and declaration to submit.";
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
    if (submitting) return;
    const problem = validateStep();
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    setError("");

    try {
      if (existingCustomer) {
        const data = await partnerApply(buildPayload(form, false));
        const partnerId = data.partner?._id || data.partner?.id;

        if (!partnerId) {
          throw new Error(
            "Partner application was created but its ID was not returned."
          );
        }

        await uploadExistingPartnerDocuments(partnerId, form);
        navigate("/partner/status", { replace: true });
        return;
      }

      const data = await partnerRegister(
        buildRegistrationFormData(payload, form)
      );

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
          requestError.message ||
          "Unable to submit partner application"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const finishGoogle = useCallback(
    async (credential) => {
      const problem = validateStep();
      setError(problem);
      if (problem) return;

      setSubmitting(true);
      setError("");

      try {
        const googlePayload = buildPayload(form, false);
        googlePayload.contact = {
          ...googlePayload.contact,
          email: "",
        };

        const formData = buildRegistrationFormData(googlePayload, form);
        const data = await partnerGoogleRegister({
          credential,
          payload: formData,
        });

        navigate(getPartnerLandingPath(data.partner), { replace: true });
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to register partner with Google"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [form, navigate, partnerGoogleRegister]
  );

  const googleError = useCallback((message) => setError(message), []);

  if (user?.roles?.includes("partner")) {
    return <Navigate to={getPartnerLandingPath(partner)} replace />;
  }

  const titles = [
    "Become a partner.",
    "Your details.",
    "Business details.",
    "Verify identity.",
    "Review application.",
  ];

  const descriptions = [
    "Choose your partner type.",
    "Basic contact and account details.",
    "Tell us what you do.",
    "Upload PAN or Aadhaar.",
    "Confirm your application.",
  ];

  return (
    <TypeformShell
      eyebrow="Partner Application"
      authMode="partnerRegister"
      title={titles[step - 1]}
      description={descriptions[step - 1]}
      step={step}
      totalSteps={TOTAL_STEPS}
      sideTitle="Partner with HAMPORIUM."
      sideText=""
      closeTo="/event-partners"
      simple
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 && (
        <div className="space-y-3">
          <label className="block min-w-0">
            <span className={labelClass}>I want to join as</span>
            <div className="relative">
              <select
                autoFocus
                value={form.partnerType}
                onChange={(event) => set("partnerType", event.target.value)}
                className="h-[50px] w-full appearance-none rounded-[12px] border border-[#DED6CA] bg-white px-4 pr-12 text-[14px] font-medium text-[#211E1B] outline-none focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15"
              >
                {PARTNER_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#171717] text-white">
                <ChevronDownIcon />
              </span>
            </div>
          </label>

        </div>
      )}

      {step === 2 && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <TextInput
            label="Full name"
            value={form.name}
            onChange={(value) => set("name", value)}
            disabled={existingCustomer}
            autoFocus
          />
          <TextInput
            label="Phone number"
            value={form.phone}
            onChange={(value) => set("phone", value)}
            placeholder="+91 98765 43210"
          />
          <TextInput
            label="Email address"
            type="email"
            value={form.email}
            onChange={(value) => set("email", value)}
            disabled={existingCustomer}
            full
          />
          {!existingCustomer && (
            <>
              <PasswordInput
                label="Password"
                value={form.password}
                onChange={(value) => set("password", value)}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                autoComplete="new-password"
              />
              <PasswordInput
                label="Confirm password"
                value={form.confirmPassword}
                onChange={(value) => set("confirmPassword", value)}
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((value) => !value)}
                autoComplete="new-password"
              />
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <TextInput
            label="Business / working name"
            value={form.businessName}
            onChange={(value) => set("businessName", value)}
            full
          />
          <TextInput
            label="City"
            value={form.city}
            onChange={(value) => set("city", value)}
          />
          <TextInput
            label="State"
            value={form.state}
            onChange={(value) => set("state", value)}
          />
          <label className="sm:col-span-2">
            <span className={labelClass}>What do you provide?</span>
            <textarea
              rows={2}
              value={form.about}
              onChange={(event) => set("about", event.target.value)}
              placeholder="For example: premium hamper boxes and custom packaging."
              className={textareaClass}
            />
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <div>
            <p className={labelClass}>Choose verification</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["pan", "PAN"],
                ["aadhaar", "Aadhaar"],
                ["both", "Both"],
              ].map(([value, label]) => {
                const active = form.kycChoice === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => set("kycChoice", value)}
                    className={`rounded-[12px] border px-3 py-2 text-[12px] font-semibold transition ${
                      active
                        ? "border-[#B79B6A] bg-[#F7F1E7] text-[#73562F]"
                        : "border-black/10 bg-white text-black/55 hover:border-[#D4AF37]"
                    }`}
                  >
                    {active ? "✓ " : ""}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {(form.kycChoice === "pan" || form.kycChoice === "both") && (
              <>
                <TextInput
                  label="PAN number"
                  value={form.panNumber}
                  onChange={(value) =>
                    set(
                      "panNumber",
                      value.toUpperCase().replace(/\s/g, "").slice(0, 10)
                    )
                  }
                  placeholder="ABCDE1234F"
                />
                <FilePicker
                  label="PAN image / PDF"
                  file={form.panDocument}
                  onChange={(file) => set("panDocument", file)}
                />
              </>
            )}

            {(form.kycChoice === "aadhaar" || form.kycChoice === "both") && (
              <>
                <TextInput
                  label="Aadhaar number"
                  inputMode="numeric"
                  maxLength={12}
                  value={form.aadhaarNumber}
                  onChange={(value) =>
                    set(
                      "aadhaarNumber",
                      value.replace(/\D/g, "").slice(0, 12)
                    )
                  }
                  placeholder="12 digit Aadhaar"
                />
                <FilePicker
                  label="Aadhaar image / PDF"
                  file={form.aadhaarDocument}
                  onChange={(file) => set("aadhaarDocument", file)}
                />
              </>
            )}
          </div>

        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Review label="Partner type" value={findLabel(PARTNER_TYPES, form.partnerType)} />
            <Review label="Business" value={form.businessName} />
            <Review label="Location" value={`${form.city}, ${form.state}`} />
            <Review
              label="Verification"
              value={
                form.kycChoice === "both"
                  ? "PAN + Aadhaar"
                  : form.kycChoice === "aadhaar"
                    ? "Aadhaar"
                    : "PAN"
              }
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-white p-4">
            <input
              type="checkbox"
              checked={form.accepted}
              onChange={(event) => set("accepted", event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#B79B6A]"
            />
            <span className="text-[12px] font-semibold leading-5 text-black/55">
              I accept the Partner Terms, Privacy Policy and confirm that the submitted information is accurate.
            </span>
          </label>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {step > 1 && (
          <button type="button" onClick={back} className={secondaryButton}>
            Back
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button type="button" onClick={next} className={primaryButton}>
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submitPasswordOrExisting}
            disabled={submitting}
            className={primaryButton}
          >
            {submitting
              ? "Submitting..."
              : existingCustomer
                ? "Submit application"
                : "Create partner account"}
          </button>
        )}
      </div>

      {step === TOTAL_STEPS && !existingCustomer && (
        <>
          <Divider text="or continue with Google" />
          <GoogleAuthButton
            onSuccess={finishGoogle}
            onError={googleError}
            disabled={submitting}
          />
        </>
      )}

      <p className="mt-3 border-t border-[#EAE2D8] pt-2 text-center text-[12px] text-[#786F64]">
        Already a partner?{" "}
        <Link
          to="/partner/login"
          className="font-semibold text-[#967343] hover:text-[#171717]"
        >
          Partner login
        </Link>
      </p>
    </TypeformShell>
  );
};

const TextInput = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  full = false,
  autoFocus = false,
  inputMode,
  maxLength,
}) => (
  <label className={full ? "sm:col-span-2" : ""}>
    <span className={labelClass}>{label}</span>
    <input
      autoFocus={autoFocus}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={inputMode}
      maxLength={maxLength}
      className={`${smallInput} disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/40`}
    />
  </label>
);

const PasswordInput = ({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}) => (
  <label>
    <span className={labelClass}>{label}</span>
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className={`${smallInput} pr-12`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-black/40 transition hover:bg-black/[0.05] hover:text-[#171717]"
      >
        <EyeIcon visible={visible} />
      </button>
    </div>
  </label>
);

const FilePicker = ({ label, file, onChange }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <div className="flex min-h-12 items-center rounded-xl border border-dashed border-black/15 bg-white px-3">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        className="block min-w-0 w-full text-[11px] font-semibold text-black/50 file:mr-3 file:rounded-lg file:border-0 file:bg-[#171717] file:px-3 file:py-2 file:text-[10px] file:font-black file:text-white"
      />
    </div>
    {file && (
      <span className="mt-1 block [overflow-wrap:anywhere] text-[11px] font-medium leading-4 text-[#907147]">
        {file.name}
      </span>
    )}
  </label>
);

const Review = ({ label, value }) => (
  <div className="min-w-0 rounded-xl border border-[#E6DDD0] bg-white px-4 py-3">
    <p className="text-[11px] font-semibold text-[#736C62]">
      {label}
    </p>
    <p className="mt-1 min-w-0 text-[13px] font-semibold leading-5 text-[#171717] [overflow-wrap:anywhere]">{value || "-"}</p>
  </div>
);

const Divider = ({ text }) => (
  <div className="my-3 flex items-center gap-3">
    <span className="h-px flex-1 bg-black/10" />
    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-black/30">
      {text}
    </span>
    <span className="h-px flex-1 bg-black/10" />
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold leading-5 text-red-700">
    {children}
  </div>
);

const EyeIcon = ({ visible }) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M2.8 12s3.3-5.2 9.2-5.2S21.2 12 21.2 12s-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    {!visible && (
      <path d="M4 4 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    )}
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="m5.5 7.5 4.5 4.5 4.5-4.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const findLabel = (options, value) =>
  options.find(([optionValue]) => optionValue === value)?.[1] || value;

const labelClass =
  "mb-1.5 block text-[13px] font-medium text-[#302B25]";
const smallInput =
  "block min-w-0 h-[50px] w-full rounded-[12px] border border-[#DED6CA] bg-white px-4 text-[14px] font-medium text-[#28241F] outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#A39A8F] hover:border-[#CABBA6] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15";
const textareaClass =
  "w-full resize-none rounded-[12px] border border-[#DED6CA] bg-white px-4 py-2.5 text-[14px] font-medium leading-5 text-[#28241F] outline-none transition-[border-color,box-shadow] placeholder:text-[#A39A8F] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15";
const primaryButton =
  "inline-flex min-h-[50px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#161715] px-5 text-[13px] font-semibold text-white shadow-[0_7px_18px_rgba(22,23,21,.12)] transition-[background-color,transform] hover:bg-[#34302A] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton =
  "inline-flex h-[50px] items-center justify-center rounded-[12px] border border-[#DED6CA] bg-white px-5 text-[13px] font-semibold text-[#403A32] transition-colors hover:bg-[#FAF8F4]";

export default PartnerRegister;
