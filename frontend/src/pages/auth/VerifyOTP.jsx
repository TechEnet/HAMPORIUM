import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import TypeformShell from "../../components/TypeformShell.jsx";

const inputClass =
  "block min-w-0 h-[50px] w-full rounded-[12px] border border-[#DED6CA] bg-white px-4 text-[14px] font-medium text-[#28241F] outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#A39A8F] hover:border-[#CABBA6] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-[#494239]";
const buttonClass =
  "flex h-[50px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#171715] px-5 text-[14px] font-semibold tracking-[.015em] text-[#E9D0A1] shadow-[0_7px_18px_rgba(22,23,21,.12)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#34302A] hover:shadow-[0_10px_22px_rgba(22,23,21,.18)] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

const VerifyOTP = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const partnerFlow = Boolean(location.state?.partner);
  const loginPath = partnerFlow ? "/partner/login" : "/login";
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: location.state?.email || "", otp: "", newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (error) setError("");
  };

  const nextStep = (event) => {
    event.preventDefault();
    if (!form.email.trim() || !/^\d{6}$/.test(form.otp)) {
      setError("Enter your email and the 6-digit code.");
      return;
    }
    setForm((previous) => ({ ...previous, email: previous.email.trim() }));
    setError("");
    setStep(2);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (form.newPassword.length < 8) {
      setError("Use 8 or more characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", {
        email: form.email.trim(),
        otp: form.otp,
        newPassword: form.newPassword,
      });
      navigate(loginPath, { replace: true, state: { resetSuccess: true } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.errors?.[0]?.message || "Unable to reset your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TypeformShell
      eyebrow="RESET PASSWORD"
      simple
      closeTo={loginPath}
      title={step === 1 ? "Enter reset code." : "New password."}
      description={step === 1 ? "Enter the 6-digit email code." : "Use 8 or more characters."}
      step={step}
      totalSteps={2}
    >
      {error && <div role="alert" className="mb-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-700">{error}</div>}

      {step === 1 ? (
        <form onSubmit={nextStep} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className={labelClass}>Email address</span>
            <input autoComplete="email" type="email" required value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" className={inputClass} />
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Reset code</span>
            <input
              autoFocus type="text" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required
              value={form.otp}
              onChange={(event) => update("otp", event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={`${inputClass} text-center text-[22px] font-semibold tracking-[0.16em] sm:tracking-[0.23em]`}
            />
          </label>
          <button type="submit" disabled={form.otp.length !== 6} className={`${buttonClass} sm:col-span-2`}>Continue →</button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <PasswordInput label="New password" value={form.newPassword} onChange={(value) => update("newPassword", value)} visible={showPassword} toggle={() => setShowPassword((value) => !value)} autoFocus />
          <PasswordInput label="Confirm password" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} visible={showConfirm} toggle={() => setShowConfirm((value) => !value)} />
          <button type="submit" disabled={submitting} className={`${buttonClass} sm:col-span-2`}>{submitting ? "Resetting password..." : "Reset password →"}</button>
          <button type="button" disabled={submitting} onClick={() => { setStep(1); setError(""); }} className="w-full py-1 text-[12px] font-medium text-[#77716B] sm:col-span-2 transition-colors hover:text-[#171717]">← Back to reset code</button>
        </form>
      )}

      <div className="mt-4 border-t border-[#EAE2D8] pt-3 text-center">
        {step === 1 && (
          <Link to="/forgot-password" state={{ email: form.email.trim(), partner: partnerFlow }} className="mb-2 block text-[12px] font-medium text-[#82796F] hover:text-[#967343]">Need a new code?</Link>
        )}
        <Link to={loginPath} className="text-[13px] font-semibold text-[#1A1917] underline decoration-[#B79B6A]/65 underline-offset-4 hover:text-[#967343]">← Back to {partnerFlow ? "partner login" : "login"}</Link>
      </div>
    </TypeformShell>
  );
};

const PasswordInput = ({ label, value, onChange, visible, toggle, autoFocus = false }) => (
  <label className="block min-w-0">
    <span className={labelClass}>{label}</span>
    <span className="relative block">
      <input autoFocus={autoFocus} type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} className={`${inputClass} pr-20`} />
      <button type="button" onClick={toggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[12px] font-semibold text-[#77716B] hover:text-[#1A1917]">{visible ? "Hide" : "Show"}</button>
    </span>
  </label>
);

export default VerifyOTP;
