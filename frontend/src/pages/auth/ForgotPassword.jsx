import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import TypeformShell from "../../components/TypeformShell.jsx";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.post("/auth/forgot-password", { email });
      navigate("/verify-otp", { state: { email } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to send OTP");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TypeformShell
      eyebrow="Account Recovery"
      title="Which email should we verify?"
      description="If the account can be recovered, HAMPORIUM will send a 6-digit reset OTP."
      sideTitle="Reset access securely."
      sideText="Recovery responses are intentionally privacy-safe and don’t reveal whether an account exists."
    >
      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="h-16 w-full border-b-2 border-black/15 bg-transparent text-2xl font-semibold outline-none placeholder:text-black/20 focus:border-[#F97316] sm:text-3xl"
          required
        />
        <button
          disabled={submitting}
          className="rounded-xl bg-[#F97316] px-7 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-[#171717] disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send recovery OTP →"}
        </button>
      </form>
      <Link to="/login" className="mt-7 inline-block text-xs font-black text-[#F97316]">← Back to login</Link>
    </TypeformShell>
  );
};

export default ForgotPassword;
