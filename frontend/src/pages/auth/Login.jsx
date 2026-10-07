import { useCallback, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPostAuthPath } from "../../utils/authRouting.js";

const Login = () => {
  const { user, partner, login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestedPath = useMemo(() => {
    const from = location.state?.from;
    if (!from?.pathname) return "";
    return `${from.pathname}${from.search || ""}`;
  }, [location.state]);

  const goAfterLogin = useCallback(
    (data) => {
      navigate(
        getPostAuthPath({
          user: data.user,
          partner: data.partner,
          requestedPath,
        }),
        { replace: true }
      );
    },
    [navigate, requestedPath]
  );

  const handleGoogleLogin = useCallback(
    async (credential) => {
      setError("");
      setSubmitting(true);

      try {
        const data = await googleLogin(credential);
        goAfterLogin(data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to login with Google");
      } finally {
        setSubmitting(false);
      }
    },
    [googleLogin, goAfterLogin]
  );

  const handleGoogleError = useCallback((message) => setError(message), []);

  if (user) {
    return <Navigate to={getPostAuthPath({ user, partner, requestedPath })} replace />;
  }

  const next = (event) => {
    event.preventDefault();
    setError("");
    if (!form.email.trim()) return;
    setStep(2);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await login(form);
      goAfterLogin(data);
    } catch (requestError) {
      const data = requestError.response?.data;

      if (data?.verificationRequired && data?.email) {
        sessionStorage.setItem(
          "hamporium.pendingVerification",
          JSON.stringify({ email: data.email, partner: false })
        );
        navigate("/verify-email", {
          replace: true,
          state: { email: data.email, partner: false },
        });
        return;
      }

      setError(data?.message || "Unable to login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TypeformShell
      eyebrow="Customer Login"
      title={step === 1 ? "Welcome back." : "Enter your password."}
      description={
        step === 1
          ? "Use the email linked to your HAMPORIUM account."
          : `Signing in as ${form.email}.`
      }
      step={step}
      totalSteps={2}
      sideTitle="Welcome back."
      sideText=""
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 ? (
        <>
          <form onSubmit={next} className="space-y-5">
            <Field label="Email address">
              <input
                autoFocus
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>

            <button type="submit" className={primaryButton}>
              Continue <span aria-hidden="true">→</span>
            </button>
          </form>

          <Divider />
          <GoogleAuthButton
            onSuccess={handleGoogleLogin}
            onError={handleGoogleError}
            disabled={submitting}
          />
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Password">
            <input
              autoFocus
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
              autoComplete="current-password"
              placeholder="Your password"
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
              }}
              className={secondaryButton}
            >
              ← Back
            </button>
            <button type="submit" disabled={submitting} className={primaryButton}>
              {submitting ? "Signing in..." : "Login →"}
            </button>
            <Link to="/forgot-password" className="ml-auto text-[13px] font-bold text-[#C56920] hover:text-[#171717]">
              Forgot password?
            </Link>
          </div>
        </form>
      )}

      <p className="mt-7 text-[13px] font-medium leading-6 text-black/48">
        New to HAMPORIUM?{" "}
        <Link to="/signup" className="font-extrabold text-[#F97316] hover:text-[#171717]">
          Create an account
        </Link>
        <span className="mx-2 text-black/20">•</span>
        <Link to="/partner/login" className="font-bold text-[#171717] hover:text-[#F97316]">
          Partner login
        </Link>
      </p>
    </TypeformShell>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-[13px] font-bold text-black/58">{label}</span>
    {children}
  </label>
);

const Divider = () => (
  <div className="my-6 flex items-center gap-3">
    <span className="h-px flex-1 bg-black/[0.08]" />
    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-black/30">or</span>
    <span className="h-px flex-1 bg-black/[0.08]" />
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-5 text-red-700">
    {children}
  </div>
);

const inputClass =
  "h-13 w-full rounded-xl border border-black/10 bg-[#FBF8F3] px-4 text-[16px] font-semibold text-[#171717] outline-none transition placeholder:font-medium placeholder:text-black/28 focus:border-[#D59A3A] focus:bg-white focus:ring-4 focus:ring-[#D59A3A]/10";

const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#171717] px-6 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-45";

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-5 py-3 text-[13px] font-bold text-[#171717] transition hover:border-black/20 hover:bg-black/[0.03]";

export default Login;
