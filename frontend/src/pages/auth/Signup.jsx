import { useCallback, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import TypeformShell from "../../components/TypeformShell.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPostAuthPath } from "../../utils/authRouting.js";

const Signup = () => {
  const { user, partner, register, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleGoogle = useCallback(
    async (credential) => {
      setError("");
      setSubmitting(true);

      try {
        const data = await googleLogin(credential);
        navigate(getPostAuthPath({ user: data.user, partner: data.partner }), {
          replace: true,
        });
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Unable to continue with Google"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [googleLogin, navigate]
  );

  const handleGoogleError = useCallback((message) => setError(message), []);

  if (user) {
    return <Navigate to={getPostAuthPath({ user, partner })} replace />;
  }

  const nextFromIdentity = (event) => {
    event.preventDefault();
    setError("");
    if (form.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    setStep(2);
  };

  const nextFromEmail = (event) => {
    event.preventDefault();
    setError("");
    if (!form.email.trim()) return;
    setStep(3);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      const data = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });

      sessionStorage.setItem(
        "hamporium.pendingVerification",
        JSON.stringify({ email: data.email || form.email, partner: false })
      );

      navigate("/verify-email", {
        replace: true,
        state: { email: data.email || form.email, partner: false },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.errors?.[0]?.message ||
          "Unable to create account"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const titles = ["Tell us your name.", "Where should we reach you?", "Create a secure password."];
  const descriptions = [
    "We’ll use this for your gifting account and order communication.",
    "Your email becomes your HAMPORIUM login. Phone is optional.",
    "Use at least 8 characters. Long, memorable passphrases are welcome.",
  ];

  return (
    <TypeformShell
      eyebrow="Create Account"
      title={titles[step - 1]}
      description={descriptions[step - 1]}
      step={step}
      totalSteps={3}
      sideTitle="Make every gift feel personal."
      sideText="Create an account, verify your email and manage every HAMPORIUM moment from one place."
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 && (
        <>
          <form onSubmit={nextFromIdentity} className="space-y-6">
            <input
              autoFocus
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Your full name"
              className={bigInput}
              required
            />
            <button className={primaryButton}>Continue →</button>
          </form>
          <Divider />
          <GoogleAuthButton
            onSuccess={handleGoogle}
            onError={handleGoogleError}
            disabled={submitting}
          />
          <p className="mt-3 text-[10px] leading-5 text-black/35">
            Google signup uses your verified Google email and skips email OTP.
          </p>
        </>
      )}

      {step === 2 && (
        <form onSubmit={nextFromEmail} className="space-y-6">
          <input
            autoFocus
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="you@example.com"
            className={bigInput}
            required
          />
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Phone number (optional)"
            className={bigInput}
          />
          <StepButtons back={() => setStep(1)} />
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            autoFocus
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Create password"
            className={bigInput}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Confirm password"
            className={bigInput}
            autoComplete="new-password"
            required
          />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(2)} className={backButton}>
              ← Back
            </button>
            <button disabled={submitting} className={primaryButton}>
              {submitting ? "Creating..." : "Create account →"}
            </button>
          </div>
        </form>
      )}

      <p className="mt-8 text-sm text-black/45">
        Already registered?{" "}
        <Link to="/login" className="font-black text-[#F97316]">Login</Link>
        {" · "}
        <Link to="/partner/register" className="font-black text-[#171717]">Become a Partner</Link>
      </p>
    </TypeformShell>
  );
};

const bigInput =
  "h-16 w-full border-b-2 border-black/15 bg-transparent text-2xl font-semibold outline-none transition placeholder:text-black/20 focus:border-[#F97316] sm:text-3xl";
const primaryButton =
  "rounded-xl bg-[#F97316] px-7 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#171717] disabled:opacity-50";
const backButton = "rounded-xl border border-black/10 px-5 py-3 text-xs font-bold";

const StepButtons = ({ back }) => (
  <div className="flex flex-wrap gap-3">
    <button type="button" onClick={back} className={backButton}>← Back</button>
    <button className={primaryButton}>Continue →</button>
  </div>
);

const Divider = () => (
  <div className="my-7 flex items-center gap-4">
    <span className="h-px flex-1 bg-black/10" />
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/30">or</span>
    <span className="h-px flex-1 bg-black/10" />
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{children}</div>
);

export default Signup;
