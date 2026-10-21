
import { useCallback, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPartnerLandingPath } from "../../utils/authRouting.js";

const field = "block h-[50px] w-full min-w-0 rounded-[11px] border border-[#DDD5CA] bg-white px-4 text-[14px] text-[#211E1B] outline-none transition-colors placeholder:text-[#A69F96] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15";
const button = "flex h-[50px] w-full items-center justify-center gap-3 rounded-[11px] bg-[#171715] px-5 text-[14px] font-semibold text-[#E9D0A1] transition-colors hover:bg-[#34302A] disabled:cursor-not-allowed disabled:opacity-50";

export default function PartnerLogin() {
  const { user, partner, partnerLogin, partnerGoogleLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestedPath = useMemo(() => {
    const from = location.state?.from;
    return typeof from?.pathname === "string" && from.pathname.startsWith("/") && !from.pathname.startsWith("//")
      ? `${from.pathname}${from.search || ""}` : "";
  }, [location.state]);
  const finish = useCallback((data) => navigate(requestedPath || getPartnerLandingPath(data.partner), { replace: true }), [navigate, requestedPath]);

  const google = useCallback(async (credential) => {
    if (submitting) return;
    setError(""); setSubmitting(true);
    try { finish(await partnerGoogleLogin(credential)); }
    catch (err) { setError(err.response?.data?.message || "Unable to sign in with Google."); }
    finally { setSubmitting(false); }
  }, [partnerGoogleLogin, finish, submitting]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError(""); setSubmitting(true);
    try { finish(await partnerLogin({ email: form.email.trim(), password: form.password })); }
    catch (err) {
      const data = err.response?.data;
      if (data?.verificationRequired && data?.email) {
        try { sessionStorage.setItem("hamporium.pendingVerification", JSON.stringify({ email: data.email, partner: true })); }
        catch { /* route state carries the email */ }
        navigate("/verify-email", { replace: true, state: { email: data.email, partner: true } });
        return;
      }
      setError(data?.message || "Unable to sign in to Partner Portal.");
    } finally { setSubmitting(false); }
  };

  if (user?.roles?.includes("partner")) return <Navigate to={requestedPath || getPartnerLandingPath(partner)} replace />;

  return (
    <TypeformShell simple authMode="partnerLogin" eyebrow="PARTNER LOGIN" title="Partner login" closeTo="/event-partners">
      {location.state?.resetSuccess && <p role="status" className="mb-3 rounded-lg bg-[#F3F8F0] px-4 py-3 text-[13px] text-[#3D6944]">Password updated. Please sign in.</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="mb-2 block text-[13px] font-medium text-[#302B25]">Partner email</span><input autoFocus type="email" autoComplete="email" required value={form.email} onChange={(e) => { setForm(v => ({ ...v, email: e.target.value })); setError(""); }} placeholder="partner@example.com" className={field}/></label>
        <label className="block"><span className="mb-2 flex items-center justify-between gap-3"><span className="text-[13px] font-medium text-[#302B25]">Password</span><Link to="/forgot-password" state={{ email: form.email, partner: true }} className="text-[12px] text-[#967343] hover:text-[#171715]">Forgot password?</Link></span><span className="relative block"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={form.password} onChange={(e) => { setForm(v => ({ ...v, password: e.target.value })); setError(""); }} placeholder="Enter password" className={`${field} pr-20`}/><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 px-2 text-[12px] text-[#7D776F] hover:text-[#171715]">{showPassword ? "Hide" : "Show"}</button></span></label>
        <button type="submit" disabled={submitting} className={button}>{submitting ? "Signing in..." : "Continue →"}</button>
      </form>
      <div className="my-5 flex items-center gap-4" aria-hidden="true"><span className="h-px flex-1 bg-[#E6DED4]"/><span className="text-[12px] text-[#989088]">or</span><span className="h-px flex-1 bg-[#E6DED4]"/></div>
      <div className="flex justify-center"><GoogleAuthButton onSuccess={google} onError={setError} disabled={submitting}/></div>
      <p className="mt-5 text-center text-[13px] text-[#777067]">New partner? <Link to="/partner/register" className="font-semibold text-[#927044]">Apply to join</Link></p>
      <p className="mt-2 text-center"><Link to="/login" className="text-[12px] text-[#8A8378]">Customer login →</Link></p>
    </TypeformShell>
  );
}
