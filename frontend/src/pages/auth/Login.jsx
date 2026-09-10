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
        setError(
          requestError.response?.data?.message || "Unable to login with Google"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [googleLogin, goAfterLogin]
  );

  const handleGoogleError = useCallback((message) => setError(message), []);

  if (user) {
    return (
      <Navigate
        to={getPostAuthPath({ user, partner, requestedPath })}
        replace
      />
    );
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
      title={step === 1 ? "What’s your email?" : "Welcome back."}
      description={
        step === 1
          ? "Start with the email linked to your HAMPORIUM account."
          : `Enter the password for ${form.email}.`
      }
      step={step}
      totalSteps={2}
      sideTitle="Beautiful gifts. Effortless moments."
      sideText="A focused sign-in flow for orders, addresses, payments and gifting." 
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 ? (
        <>
          <form onSubmit={next} className="space-y-5">
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
              className="h-16 w-full border-b-2 border-black/15 bg-transparent text-2xl font-semibold outline-none transition placeholder:text-black/20 focus:border-[#F97316] sm:text-3xl"
            />

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                className="rounded-xl bg-[#F97316] px-7 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#171717]"
              >
                Continue →
              </button>
              <span className="text-[10px] text-black/35">Press Enter ↵</span>
            </div>
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
            className="h-16 w-full border-b-2 border-black/15 bg-transparent text-2xl font-semibold outline-none transition placeholder:text-black/20 focus:border-[#F97316] sm:text-3xl"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
              }}
              className="rounded-xl border border-black/10 px-5 py-3 text-xs font-bold"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#F97316] px-7 py-3 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#171717] disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Login →"}
            </button>
            <Link to="/forgot-password" className="ml-auto text-xs font-bold text-[#F97316]">
              Forgot password?
            </Link>
          </div>
        </form>
      )}

      <p className="mt-8 text-sm text-black/45">
        New to HAMPORIUM?{" "}
        <Link to="/signup" className="font-black text-[#F97316]">
          Create an account
        </Link>
        {" · "}
        <Link to="/partner/login" className="font-black text-[#171717]">
          Partner login
        </Link>
      </p>
    </TypeformShell>
  );
};

const Divider = () => (
  <div className="my-7 flex items-center gap-4">
    <span className="h-px flex-1 bg-black/10" />
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/30">or</span>
    <span className="h-px flex-1 bg-black/10" />
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
    {children}
  </div>
);

export default Login;
