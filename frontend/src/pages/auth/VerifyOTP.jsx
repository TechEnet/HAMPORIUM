import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import TypeformShell from "../../components/TypeformShell.jsx";

const VerifyOTP = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: location.state?.email || "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      navigate("/login", { replace: true, state: { resetSuccess: true } });
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

  return (
    <TypeformShell
      eyebrow="Password Reset"
      title={step === 1 ? "Enter your reset code." : "Choose your new password."}
      description={step === 1 ? "Use the OTP sent to your email." : "Use at least 8 characters and avoid reusing an old password."}
      step={step}
      totalSteps={2}
      sideTitle="Secure account recovery."
      sideText="Successful password reset also invalidates older authenticated sessions on the backend."
    >
      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {step === 1 ? (
        <form onSubmit={continueOtp} className="space-y-6">
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="you@example.com"
            className={bigInput}
            required
          />
          <input
            autoFocus
            inputMode="numeric"
            value={form.otp}
            onChange={(event) => setForm((current) => ({ ...current, otp: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
            placeholder="6-digit OTP"
            className={bigInput}
            required
          />
          <button className={primaryButton}>Continue →</button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <input
            autoFocus
            type="password"
            value={form.newPassword}
            onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
            placeholder="New password"
            className={bigInput}
            required
          />
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Confirm password"
            className={bigInput}
            required
          />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-black/10 px-5 py-3 text-xs font-bold">← Back</button>
            <button disabled={submitting} className={primaryButton}>
              {submitting ? "Resetting..." : "Reset password →"}
            </button>
          </div>
        </form>
      )}

      <Link to="/login" className="mt-7 inline-block text-xs font-black text-[#F97316]">Back to Login</Link>
    </TypeformShell>
  );
};

const bigInput = "h-16 w-full border-b-2 border-black/15 bg-transparent text-2xl font-semibold outline-none placeholder:text-black/20 focus:border-[#F97316] sm:text-3xl";
const primaryButton = "rounded-xl bg-[#F97316] px-7 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-[#171717] disabled:opacity-50";

export default VerifyOTP;
