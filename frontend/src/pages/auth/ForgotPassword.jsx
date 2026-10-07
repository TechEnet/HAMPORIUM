import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import TypeformShell from "../../components/TypeformShell.jsx";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const partnerFlow = Boolean(location.state?.partner);

  const [email, setEmail] = useState(location.state?.email || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.post("/auth/forgot-password", { email });
      navigate("/verify-otp", {
        state: { email, partner: partnerFlow },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to send OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const backPath = partnerFlow ? "/partner/login" : "/login";

  return (
    <TypeformShell
      eyebrow={partnerFlow ? "Partner Recovery" : "Account Recovery"}
      title="Reset your password."
      description="Enter your account email and we will send a 6-digit recovery code."
      sideTitle={partnerFlow ? "Recover partner access." : "Reset access securely."}
      sideText=""
      closeTo={partnerFlow ? "/partner/login" : "/login"}
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-[13px] font-bold text-black/58">
            Email address
          </span>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
            required
          />
        </label>

        <button disabled={submitting} className={primaryButton}>
          {submitting ? "Sending..." : "Send recovery OTP"}
        </button>
      </form>

      <Link
        to={backPath}
        className="mt-7 inline-block text-[13px] font-extrabold text-[#F97316] hover:text-[#171717]"
      >
        Back to {partnerFlow ? "partner login" : "login"}
      </Link>
    </TypeformShell>
  );
};

const ErrorBox = ({ children }) => (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-5 text-red-700">
    {children}
  </div>
);

const inputClass =
  "h-13 w-full rounded-xl border border-black/10 bg-[#FBF8F3] px-4 text-[16px] font-semibold text-[#171717] outline-none transition placeholder:font-medium placeholder:text-black/28 focus:border-[#D59A3A] focus:bg-white focus:ring-4 focus:ring-[#D59A3A]/10";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#171717] px-6 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-45";

export default ForgotPassword;
