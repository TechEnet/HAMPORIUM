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
        setError(requestError.response?.data?.message || "Unable to continue with Google");
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

  const titles = ["Tell us your name.", "How can we reach you?", "Create your password."];
  const descriptions = [
    "Add the name you want us to use for your HAMPORIUM account.",
    "Your email becomes your login. Phone number is optional.",
    "Choose at least 8 characters for a secure password.",
  ];

  return (
    <TypeformShell
      eyebrow="Create Account"
      title={titles[step - 1]}
      description={descriptions[step - 1]}
      step={step}
      totalSteps={3}
      sideTitle="Create your account."
      sideText=""
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 && (
        <>
          <form onSubmit={nextFromIdentity} className="space-y-5">
            <Field label="Full name">
              <input
                autoFocus
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Your full name"
                className={inputClass}
                required
              />
            </Field>
            <button className={primaryButton}>Continue →</button>
          </form>

          <Divider />
          <GoogleAuthButton onSuccess={handleGoogle} onError={handleGoogleError} disabled={submitting} />
          <p className="mt-3 text-[12px] font-medium leading-5 text-black/38">
            Google signup uses your verified Google email and skips email OTP.
          </p>
        </>
      )}

      {step === 2 && (
        <form onSubmit={nextFromEmail} className="space-y-5">
          <Field label="Email address">
            <input
              autoFocus
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="you@example.com"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Phone number">
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Optional"
              className={inputClass}
            />
          </Field>
          <StepButtons back={() => setStep(1)} />
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Password">
            <input
              autoFocus
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Create password"
              className={inputClass}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              placeholder="Repeat password"
              className={inputClass}
              autoComplete="new-password"
              required
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(2)} className={secondaryButton}>
              ← Back
            </button>
            <button disabled={submitting} className={primaryButton}>
              {submitting ? "Creating..." : "Create account →"}
            </button>
          </div>
        </form>
      )}

      <p className="mt-7 text-[13px] font-medium leading-6 text-black/48">
        Already registered?{" "}
        <Link to="/login" className="font-extrabold text-[#F97316] hover:text-[#171717]">Login</Link>
        <span className="mx-2 text-black/20">•</span>
        <Link to="/partner/register" className="font-bold text-[#171717] hover:text-[#F97316]">Become a Partner</Link>
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

const StepButtons = ({ back }) => (
  <div className="flex flex-wrap gap-3">
    <button type="button" onClick={back} className={secondaryButton}>← Back</button>
    <button className={primaryButton}>Continue →</button>
  </div>
);

const Divider = () => (
  <div className="my-6 flex items-center gap-3">
    <span className="h-px flex-1 bg-black/[0.08]" />
    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-black/30">or</span>
    <span className="h-px flex-1 bg-black/[0.08]" />
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-5 text-red-700">{children}</div>
);

const inputClass =
  "h-13 w-full rounded-xl border border-black/10 bg-[#FBF8F3] px-4 text-[16px] font-semibold text-[#171717] outline-none transition placeholder:font-medium placeholder:text-black/28 focus:border-[#D59A3A] focus:bg-white focus:ring-4 focus:ring-[#D59A3A]/10";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#171717] px-6 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-5 py-3 text-[13px] font-bold text-[#171717] transition hover:border-black/20 hover:bg-black/[0.03]";

export default Signup;
