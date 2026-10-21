
import { useCallback, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPostAuthPath } from "../../utils/authRouting.js";

const inputClass =
  "block min-w-0 h-[50px] w-full rounded-[12px] border border-[#DED6CA] bg-white px-4 text-[14px] font-medium text-[#28241F] outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#A39A8F] hover:border-[#CABBA6] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-[#494239]";
const buttonClass =
  "flex h-[50px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#171715] px-5 text-[14px] font-semibold tracking-[.015em] text-[#E9D0A1] shadow-[0_7px_18px_rgba(22,23,21,.12)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#34302A] hover:shadow-[0_10px_22px_rgba(22,23,21,.18)] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

const Signup = () => {
  const { user, partner, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (error) setError("");
  };

  const handleGoogle = useCallback(async (credential) => {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const data = await googleLogin(credential);
      navigate(getPostAuthPath({ user: data.user, partner: data.partner }), { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to continue with Google.");
    } finally {
      setSubmitting(false);
    }
  }, [googleLogin, navigate, submitting]);

  const nextStep = (event) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!form.email.trim()) return;
    setForm((current) => ({ ...current, name: current.name.trim(), email: current.email.trim(), phone: current.phone.trim() }));
    setError("");
    setStep(2);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      const verificationEmail = data?.email || form.email.trim();
      try {
        sessionStorage.setItem("hamporium.pendingVerification", JSON.stringify({ email: verificationEmail, partner: false }));
      } catch {
        // Navigation state still carries the address if storage is unavailable.
      }
      navigate("/verify-email", { replace: true, state: { email: verificationEmail, partner: false } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.errors?.[0]?.message || "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (user) return <Navigate to={getPostAuthPath({ user, partner })} replace />;

  return (
    <TypeformShell
      eyebrow="NEW ACCOUNT"
      authMode="signup"
      simple
      closeTo="/login"
      title={step === 1 ? "Create account." : "Set password."}
      description={step === 1 ? "Join HAMPORIUM in two steps." : "At least 8 characters."}
      step={step}
      totalSteps={2}
    >
      {error && <div role="alert" className="mb-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-700">{error}</div>}

      {step === 1 ? (
        <>
          <form onSubmit={nextStep} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className={labelClass}>Full name</span>
              <input autoFocus type="text" autoComplete="name" minLength={2} required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your full name" className={inputClass} />
            </label>
            <label className="block min-w-0">
              <span className={labelClass}>Email address</span>
              <input type="email" autoComplete="email" required value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" className={inputClass} />
            </label>
            <div className="sm:col-span-2">
              <button type="button" aria-expanded={showPhone} onClick={() => setShowPhone((current) => !current)} className="text-left text-[12px] font-medium text-[#9A784D] transition-colors hover:text-[#403A32]">
                {showPhone ? "− Hide phone number" : "+ Add phone number (optional)"}
              </button>
              {showPhone && (
                <label className="mt-2 block">
                  <span className={labelClass}>Phone number</span>
                  <input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="Your phone number" className={inputClass} />
                </label>
              )}
            </div>
            <button type="submit" className={`${buttonClass} sm:col-span-2`}>Continue <span aria-hidden="true">→</span></button>
          </form>
          <div className="my-3 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-[#E9E4DE]" />
            <span className="text-[11px] uppercase tracking-[0.12em] text-[#98928B]">or</span>
            <span className="h-px flex-1 bg-[#E9E4DE]" />
          </div>
          <div className="flex justify-center">
            <GoogleAuthButton onSuccess={handleGoogle} onError={setError} disabled={submitting} />
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <PasswordInput label="Password" value={form.password} onChange={(value) => update("password", value)} visible={showPassword} toggle={() => setShowPassword((value) => !value)} autoFocus />
          <PasswordInput label="Confirm password" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} visible={showConfirm} toggle={() => setShowConfirm((value) => !value)} />
          <p className="text-[11px] leading-4 text-[#786F64] sm:col-span-2">At least 8 characters.</p>
          <button type="submit" disabled={submitting} className={`${buttonClass} sm:col-span-2`}>{submitting ? "Creating account..." : "Create account →"}</button>
          <button type="button" disabled={submitting} onClick={() => { setStep(1); setError(""); }} className="w-full py-1 text-[12px] font-medium text-[#77716B] sm:col-span-2 transition-colors hover:text-[#171717]">← Back to details</button>
        </form>
      )}

      <div className="mt-4 border-t border-[#EAE2D8] pt-3 text-center">
        <p className="text-[13px] leading-6 text-[#786F64]">
          Already registered?{" "}<Link to="/login" className="font-semibold text-[#1A1917] underline decoration-[#B79B6A]/65 underline-offset-4 hover:text-[#967343]">Sign in</Link>
        </p>
        <Link to="/partner/register" className="mt-1 inline-block text-[12px] font-medium text-[#82796F] hover:text-[#967343]">Become a partner →</Link>
      </div>
    </TypeformShell>
  );
};

const PasswordInput = ({ label, value, onChange, visible, toggle, autoFocus = false }) => (
  <label className="block min-w-0">
    <span className={labelClass}>{label}</span>
    <span className="relative block">
      <input
        autoFocus={autoFocus}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        minLength={8}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className={`${inputClass} pr-20`}
      />
      <button type="button" onClick={toggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[12px] font-semibold text-[#77716B] hover:text-[#1A1917]">
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  </label>
);

export default Signup;
