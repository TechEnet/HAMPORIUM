import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPostAuthPath } from "../../utils/authRouting.js";

const readPending = () => {
  try {
    return JSON.parse(sessionStorage.getItem("hamporium.pendingVerification") || "null");
  } catch {
    return null;
  }
};

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendVerificationOtp } = useAuth();

  const pending = useMemo(() => readPending(), []);
  const email = location.state?.email || pending?.email || "";
  const isPartner = Boolean(location.state?.partner ?? pending?.partner);

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  if (!email) {
    return (
      <TypeformShell
        eyebrow="Email Verification"
        title="Verification session expired."
        description="Start signup again so we know which email to verify."
      >
        <Link to={isPartner ? "/partner/register" : "/signup"} className="font-black text-[#F97316]">
          Start again →
        </Link>
      </TypeformShell>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const data = await verifyEmail({ email, otp });
      sessionStorage.removeItem("hamporium.pendingVerification");
      navigate(
        getPostAuthPath({ user: data.user, partner: data.partner }),
        { replace: true }
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to verify OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError("");
    setMessage("");

    try {
      const data = await resendVerificationOtp(email);
      setMessage(data.message || "OTP sent.");
      setCooldown(60);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to resend OTP");
    }
  };

  return (
    <TypeformShell
      eyebrow={isPartner ? "Partner Verification" : "Email Verification"}
      title="Check your inbox."
      description={`Enter the 6-digit verification code sent to ${email}.`}
      step={1}
      totalSteps={1}
      sideTitle="One quick security check."
      sideText="Your account stays unverified until the OTP is successfully confirmed."
    >
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}

      <form onSubmit={submit} className="mt-6 space-y-6">
        <input
          autoFocus
          inputMode="numeric"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          placeholder="000000"
          className="h-20 w-full border-b-2 border-black/15 bg-transparent text-center text-4xl font-black tracking-[0.45em] outline-none focus:border-[#F97316]"
          required
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={submitting || otp.length !== 6}
            className="rounded-xl bg-[#F97316] px-7 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#171717] disabled:opacity-40"
          >
            {submitting ? "Verifying..." : "Verify email →"}
          </button>
          <button
            type="button"
            disabled={cooldown > 0}
            onClick={resend}
            className="rounded-xl border border-black/10 px-5 py-3 text-xs font-bold disabled:opacity-35"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </button>
        </div>
      </form>
    </TypeformShell>
  );
};

const Notice = ({ children, error = false }) => (
  <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
    {children}
  </div>
);

export default VerifyEmail;
