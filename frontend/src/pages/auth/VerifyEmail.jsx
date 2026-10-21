
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

  const pending = useMemo(readPending, []);
  const email = location.state?.email || pending?.email || "";
  const isPartner = Boolean(location.state?.partner ?? pending?.partner);
  const restartPath = isPartner ? "/partner/register" : "/signup";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || otp.length !== 6 || !email) return;
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const data = await verifyEmail({ email, otp });
      try { sessionStorage.removeItem("hamporium.pendingVerification"); } catch { /* no-op */ }
      navigate(getPostAuthPath({ user: data.user, partner: data.partner }), { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to verify your code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || submitting) return;
    setError("");
    setMessage("");
    setResending(true);
    try {
      const data = await resendVerificationOtp(email);
      setMessage(data?.message || "A new code has been sent.");
      setCooldown(60);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to resend your code.");
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <TypeformShell simple eyebrow="VERIFY EMAIL" title="Session expired." description="Start again to verify your email." closeTo={restartPath}>
        <Link to={restartPath} className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#171715] px-5 text-[14px] font-semibold tracking-[.015em] text-[#E9D0A1] shadow-[0_7px_18px_rgba(22,23,21,.12)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#34302A] hover:shadow-[0_10px_22px_rgba(22,23,21,.18)] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none">Start again →</Link>
      </TypeformShell>
    );
  }

  return (
    <TypeformShell simple eyebrow="VERIFY EMAIL" closeTo={isPartner ? "/partner/login" : "/login"} title="Check your inbox." description={<>Enter the 6-digit code sent to <span className="font-semibold text-[#B79B6A] [overflow-wrap:break-word]">{email}</span>.</>}>
      {error && <div role="alert" className="mb-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-700">{error}</div>}
      {message && <div role="status" className="mb-3 rounded-[12px] border border-[#DBE8D8] bg-[#F2F8F0] px-3.5 py-3 text-[13px] leading-5 text-[#39603D]">{message}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="hamp-verification-code" className="mb-1.5 block text-[12px] font-semibold text-[#494239]">Verification code</label>
        <input
          id="hamp-verification-code"
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={otp}
          onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); if (error) setError(""); }}
          placeholder="000000"
          className="block h-[54px] w-full rounded-[12px] border border-[#DED6CA] bg-white px-4 text-center text-[22px] font-semibold tracking-[0.16em] sm:tracking-[0.25em] text-[#211E1B] outline-none transition-colors placeholder:text-[#C7BEB5] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15 sm:text-[27px]"
        />
        <button disabled={submitting || otp.length !== 6} className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#171715] px-5 text-[14px] font-semibold tracking-[.015em] text-[#E9D0A1] shadow-[0_7px_18px_rgba(22,23,21,.12)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#34302A] hover:shadow-[0_10px_22px_rgba(22,23,21,.18)] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none">
          {submitting ? "Verifying..." : "Verify email →"}
        </button>
      </form>
      <div className="mt-3 text-center">
        <button type="button" disabled={cooldown > 0 || submitting || resending} onClick={handleResend} className="text-[13px] font-semibold text-[#967343] transition-colors hover:text-[#1A1917] disabled:cursor-not-allowed disabled:text-[#9C948B]">
          {resending ? "Sending..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
      <div className="mt-4 border-t border-[#EAE2D8] pt-3 text-center">
        <Link to={restartPath} className="text-[12px] font-medium text-[#82796F] transition-colors hover:text-[#967343]">Wrong email? Start again →</Link>
      </div>
    </TypeformShell>
  );
};

export default VerifyEmail;
