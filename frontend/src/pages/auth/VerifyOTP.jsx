import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import TypeformShell from "../../components/TypeformShell.jsx";

const VerifyOTP = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const partnerFlow = Boolean(location.state?.partner);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: location.state?.email || "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const continueOtp = (event) => {
    event.preventDefault();
    setError("");
    if (!form.email || !/^\d{6}$/.test(form.otp)) {
      setError("Enter your email and the 6-digit OTP.");
      return;
    }
    setStep(2);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", {
        email: form.email,
        otp: form.otp,
        newPassword: form.newPassword,
      });

      navigate(partnerFlow ? "/partner/login" : "/login", {
        replace: true,
        state: { resetSuccess: true },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.errors?.[0]?.message ||
          "Unable to reset password"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const loginPath = partnerFlow ? "/partner/login" : "/login";

  return (
    <TypeformShell
      eyebrow={partnerFlow ? "Partner Password Reset" : "Password Reset"}
      title={step === 1 ? "Enter your reset code." : "Choose a new password."}
      description={
        step === 1
          ? "Use the OTP sent to your email."
          : "Use at least 8 characters for your new password."
      }
      step={step}
      totalSteps={2}
      sideTitle={partnerFlow ? "Recover partner access." : "Secure account recovery."}
      sideText=""
      closeTo={loginPath}
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 ? (
        <form onSubmit={continueOtp} className="space-y-5">
          <Field label="Email address">
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="you@example.com"
              className={inputClass}
              required
            />
          </Field>

          <Field label="Reset code">
            <input
              autoFocus
              inputMode="numeric"
              value={form.otp}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  otp: event.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
              placeholder="6-digit OTP"
              className={inputClass}
              required
            />
          </Field>

          <button className={primaryButton}>Continue</button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <PasswordField
            label="New password"
            value={form.newPassword}
            onChange={(value) =>
              setForm((current) => ({ ...current, newPassword: value }))
            }
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            autoFocus
          />

          <PasswordField
            label="Confirm password"
            value={form.confirmPassword}
            onChange={(value) =>
              setForm((current) => ({ ...current, confirmPassword: value }))
            }
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={secondaryButton}
            >
              Back
            </button>
            <button disabled={submitting} className={primaryButton}>
              {submitting ? "Resetting..." : "Reset password"}
            </button>
          </div>
        </form>
      )}

      <Link
        to={loginPath}
        className="mt-7 inline-block text-[13px] font-extrabold text-[#F97316] hover:text-[#171717]"
      >
        Back to {partnerFlow ? "Partner Login" : "Login"}
      </Link>
    </TypeformShell>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-[13px] font-bold text-black/58">
      {label}
    </span>
    {children}
  </label>
);

const PasswordField = ({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoFocus = false,
}) => (
  <Field label={label}>
    <div className="relative">
      <input
        autoFocus={autoFocus}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className={`${inputClass} pr-12`}
        autoComplete="new-password"
        required
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
  </Field>
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

const ErrorBox = ({ children }) => (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-5 text-red-700">
    {children}
  </div>
);

const inputClass =
  "h-13 w-full rounded-xl border border-black/10 bg-[#FBF8F3] px-4 text-[16px] font-semibold text-[#171717] outline-none transition placeholder:font-medium placeholder:text-black/28 focus:border-[#D59A3A] focus:bg-white focus:ring-4 focus:ring-[#D59A3A]/10";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#171717] px-6 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-5 py-3 text-[13px] font-bold text-[#171717] transition hover:border-black/20 hover:bg-black/[0.03]";

export default VerifyOTP;
