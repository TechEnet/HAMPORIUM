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
        sideTitle="Verify your email."
        sideText=""
      >
        <Link to={isPartner ? "/partner/register" : "/signup"} className={primaryButton}>
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
      navigate(getPostAuthPath({ user: data.user, partner: data.partner }), { replace: true });
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
      sideTitle="Verify your email."
      sideText=""
    >
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}

      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-[13px] font-bold text-black/58">Verification code</span>
          <input
            autoFocus
            inputMode="numeric"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            placeholder="000000"
            className="h-16 w-full rounded-xl border border-black/10 bg-[#FBF8F3] px-4 text-center text-[28px] font-extrabold tracking-[0.32em] text-[#171717] outline-none transition placeholder:text-black/18 focus:border-[#D59A3A] focus:bg-white focus:ring-4 focus:ring-[#D59A3A]/10 sm:text-[30px]"
            required
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button disabled={submitting || otp.length !== 6} className={primaryButton}>
            {submitting ? "Verifying..." : "Verify email →"}
          </button>
          <button type="button" disabled={cooldown > 0} onClick={resend} className={secondaryButton}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </button>
        </div>
      </form>
    </TypeformShell>
  );
};

const Notice = ({ children, error = false }) => (
  <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] font-semibold leading-5 ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
    {children}
  </div>
);

const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#171717] px-6 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-5 py-3 text-[13px] font-bold text-[#171717] transition hover:border-black/20 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40";

export default VerifyEmail;
