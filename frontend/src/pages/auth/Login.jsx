
import { useCallback, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPostAuthPath } from "../../utils/authRouting.js";

const inputClass = "block h-[50px] w-full min-w-0 rounded-[11px] border border-[#DDD5CA] bg-white px-4 text-[14px] text-[#211E1B] outline-none transition-colors placeholder:text-[#A69F96] focus:border-[#B79B6A] focus:ring-[3px] focus:ring-[#B79B6A]/15";
const labelClass = "mb-2 block text-[13px] font-medium text-[#302B25]";
const buttonClass = "flex h-[50px] w-full items-center justify-center gap-3 rounded-[11px] bg-[#171715] px-5 text-[14px] font-semibold text-[#E9D0A1] transition-colors hover:bg-[#34302A] disabled:cursor-not-allowed disabled:opacity-50";

export default function Login() {
  const { user, partner, login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestedPath = useMemo(() => {
    const from = location.state?.from;
    return typeof from?.pathname === "string" && from.pathname.startsWith("/") && !from.pathname.startsWith("//")
      ? `${from.pathname}${from.search || ""}` : "";
  }, [location.state]);

  const finish = useCallback((data) => {
    navigate(getPostAuthPath({ user: data.user, partner: data.partner, requestedPath }), { replace: true });
  }, [navigate, requestedPath]);

  const google = useCallback(async (credential) => {
    if (submitting) return;
    setSubmitting(true); setError("");
    try { finish(await googleLogin(credential)); }
    catch (err) { setError(err.response?.data?.message || "Unable to sign in with Google."); }
    finally { setSubmitting(false); }
  }, [finish, googleLogin, submitting]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError(""); setSubmitting(true);
    try {
      finish(await login({ email: form.email.trim(), password: form.password }));
    } catch (err) {
      const data = err.response?.data;
      if (data?.verificationRequired && data?.email) {
        try { sessionStorage.setItem("hamporium.pendingVerification", JSON.stringify({ email: data.email, partner: false })); }
        catch { /* navigation state is enough */ }
        navigate("/verify-email", { replace: true, state: { email: data.email, partner: false } });
        return;
      }
      setError(data?.message || "Unable to sign in.");
    } finally { setSubmitting(false); }
  };

  if (user) return <Navigate to={getPostAuthPath({ user, partner, requestedPath })} replace />;

  return (
    <TypeformShell simple authMode="login" eyebrow="SIGN IN" title="Sign in" closeTo="/">
      {location.state?.resetSuccess && <div role="status" className="mb-4 rounded-lg border border-[#DCE7D9] bg-[#F3F8F0] px-4 py-3 text-[13px] text-[#3D6944]">Password updated. Sign in below.</div>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block min-w-0"><span className={labelClass}>Email address</span>
          <input autoFocus type="email" autoComplete="email" required value={form.email} onChange={(e) => { setForm(v => ({ ...v, email: e.target.value })); setError(""); }} placeholder="you@example.com" className={inputClass} />
        </label>
        <label className="block min-w-0"><span className="mb-2 flex items-center justify-between gap-3"><span className="text-[13px] font-medium text-[#302B25]">Password</span><Link to="/forgot-password" state={{ email: form.email }} className="text-[12px] font-medium text-[#967343] hover:text-[#171715]">Forgot password?</Link></span>
          <span className="relative block"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={form.password} onChange={(e) => { setForm(v => ({ ...v, password: e.target.value })); setError(""); }} placeholder="Enter password" className={`${inputClass} pr-20`} />
            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[12px] text-[#7D776F] hover:text-[#171715]">{showPassword ? "Hide" : "Show"}</button>
          </span>
        </label>
        <button disabled={submitting} type="submit" className={buttonClass}>{submitting ? "Signing in..." : "Continue"} {!submitting && <span aria-hidden="true">→</span>}</button>
      </form>
      <div className="my-5 flex items-center gap-4" aria-hidden="true"><span className="h-px flex-1 bg-[#E6DED4]"/><span className="text-[12px] text-[#989088]">or</span><span className="h-px flex-1 bg-[#E6DED4]"/></div>
      <div className="flex justify-center"><GoogleAuthButton onSuccess={google} onError={setError} disabled={submitting}/></div>
      <p className="mt-6 text-center text-[13px] text-[#777067]">New here? <Link to="/signup" className="font-semibold text-[#927044] hover:text-[#171715]">Create account</Link></p>
      <p className="mt-2 text-center"><Link to="/partner/login" className="text-[12px] text-[#8A8378] hover:text-[#927044]">Partner login →</Link></p>
    </TypeformShell>
  );
}
