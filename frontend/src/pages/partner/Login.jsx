import { useCallback, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPartnerLandingPath } from "../../utils/authRouting.js";

const PartnerLogin = () => {
  const { user, partner, partnerLogin, partnerGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestedPath = useMemo(() => {
    const from = location.state?.from;
    return from?.pathname ? `${from.pathname}${from.search || ""}` : "";
  }, [location.state]);

  const finish = useCallback(
    (data) => navigate(requestedPath || getPartnerLandingPath(data.partner), { replace: true }),
    [navigate, requestedPath]
  );

  const handleGoogle = useCallback(
    async (credential) => {
      setError("");
      setSubmitting(true);
      try {
        finish(await partnerGoogleLogin(credential));
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to login with Google");
      } finally {
        setSubmitting(false);
      }
    },
    [partnerGoogleLogin, finish]
  );

  const googleError = useCallback((message) => setError(message), []);

  if (user?.roles?.includes("partner")) {
    return <Navigate to={requestedPath || getPartnerLandingPath(partner)} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      finish(await partnerLogin(form));
    } catch (requestError) {
      const data = requestError.response?.data;
      if (data?.verificationRequired && data?.email) {
        sessionStorage.setItem("hamporium.pendingVerification", JSON.stringify({ email: data.email, partner: true }));
        navigate("/verify-email", { replace: true, state: { email: data.email, partner: true } });
        return;
      }
      setError(data?.message || "Unable to login to Partner Portal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TypeformShell
      eyebrow="Partner Portal"
      title={step === 1 ? "Partner email?" : "Welcome back, partner."}
      description={step === 1 ? "Use the account registered with your partner application." : `Enter the password for ${form.email}.`}
      step={step}
      totalSteps={2}
      sideTitle="Your partner business, in one place."
      sideText="Projects, showcases, attributed orders, commissions and payouts — separated from the customer account."
      closeTo="/event-partners"
    >
      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {step === 1 ? (
        <>
          <form onSubmit={(event) => { event.preventDefault(); if (form.email) setStep(2); }} className="space-y-6">
            <input autoFocus type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="partner@example.com" className={bigInput} required />
            <button className={primaryButton}>Continue →</button>
          </form>
          <Divider />
          <GoogleAuthButton onSuccess={handleGoogle} onError={googleError} disabled={submitting} />
        </>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <input autoFocus type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Partner password" className={bigInput} required />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-black/10 px-5 py-3 text-xs font-bold">← Back</button>
            <button disabled={submitting} className={primaryButton}>{submitting ? "Signing in..." : "Open Partner Portal →"}</button>
          </div>
        </form>
      )}

      <p className="mt-8 text-sm text-black/45">
        Want to join? <Link to="/partner/register" className="font-black text-[#F97316]">Apply as a Partner</Link>
        {" · "}<Link to="/login" className="font-black text-[#171717]">Customer login</Link>
      </p>
    </TypeformShell>
  );
};

const Divider = () => <div className="my-7 flex items-center gap-4"><span className="h-px flex-1 bg-black/10" /><span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/30">or</span><span className="h-px flex-1 bg-black/10" /></div>;
const bigInput = "h-16 w-full border-b-2 border-black/15 bg-transparent text-2xl font-semibold outline-none placeholder:text-black/20 focus:border-[#F97316] sm:text-3xl";
const primaryButton = "rounded-xl bg-[#F97316] px-7 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-[#171717] disabled:opacity-50";

export default PartnerLogin;
