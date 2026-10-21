
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import TypeformShell from "../../components/TypeformShell.jsx";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const partnerFlow = Boolean(location.state?.partner);
  const backPath = partnerFlow ? "/partner/login" : "/login";
  const [email, setEmail] = useState(location.state?.email || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const address = email.trim();
    if (!address) return;
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: address });
      navigate("/verify-otp", { state: { email: address, partner: partnerFlow } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to send your recovery code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TypeformShell
      eyebrow="ACCOUNT RECOVERY"
      simple
      closeTo={backPath}
      title="Reset password."
      description="Get a 6-digit code by email."
    >
      {error && <div role="alert" className="mb-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-700">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="hamp-recovery-email" className="mb-1.5 block text-[12px] font-semibold text-[#494239]">Email address</label>
        <input
          id="hamp-recovery-email"
          autoFocus
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }}
          placeholder="you@example.com"
          className="block min-w-0 h-[50px] w-full rounded-[12px] border border-[#DED6CA] bg-white px-4 text-[14px] font-medium text-[#28241F] outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#A39A8F] hover:border-[#CABBA6] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15"
        />
        <button disabled={submitting} className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#171715] px-5 text-[14px] font-semibold tracking-[.015em] text-[#E9D0A1] shadow-[0_7px_18px_rgba(22,23,21,.12)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#34302A] hover:shadow-[0_10px_22px_rgba(22,23,21,.18)] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none">
          {submitting ? "Sending code..." : "Send reset code →"}
        </button>
      </form>
      <div className="mt-4 border-t border-[#EAE2D8] pt-3 text-center">
        <Link to={backPath} className="text-[13px] font-semibold text-[#1A1917] underline decoration-[#B79B6A]/65 underline-offset-4 transition-colors hover:text-[#967343]">← Back to {partnerFlow ? "partner login" : "login"}</Link>
      </div>
    </TypeformShell>
  );
};

export default ForgotPassword;
