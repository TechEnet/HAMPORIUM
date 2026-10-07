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
  const [showPassword, setShowPassword] = useState(false);

  const requestedPath = useMemo(() => {
    const from = location.state?.from;
    return from?.pathname ? `${from.pathname}${from.search || ""}` : "";
  }, [location.state]);

  const finish = useCallback(
    (data) =>
      navigate(requestedPath || getPartnerLandingPath(data.partner), {
        replace: true,
      }),
    [navigate, requestedPath]
  );

  const handleGoogle = useCallback(
    async (credential) => {
      setError("");
      setSubmitting(true);
      try {
        finish(await partnerGoogleLogin(credential));
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Unable to login with Google"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [partnerGoogleLogin, finish]
  );

  const googleError = useCallback((message) => setError(message), []);

  if (user?.roles?.includes("partner")) {
    return (
      <Navigate
        to={requestedPath || getPartnerLandingPath(partner)}
        replace
      />
    );
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
        sessionStorage.setItem(
          "hamporium.pendingVerification",
          JSON.stringify({ email: data.email, partner: true })
        );
        navigate("/verify-email", {
          replace: true,
          state: { email: data.email, partner: true },
        });
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
      description={
        step === 1
          ? "Use the email registered with your partner account."
          : `Enter the password for ${form.email}.`
      }
      step={step}
      totalSteps={2}
      sideTitle="Your partner workspace."
      sideText=""
      closeTo="/event-partners"
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      {step === 1 ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (form.email) setStep(2);
            }}
            className="space-y-5"
          >
            <input
              autoFocus
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="partner@example.com"
              autoComplete="email"
              className={bigInput}
              required
            />
            <button className={primaryButton}>Continue</button>
          </form>

          <Divider />
          <GoogleAuthButton
            onSuccess={handleGoogle}
            onError={googleError}
            disabled={submitting}
          />
        </>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <div className="relative">
              <input
                autoFocus
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Partner password"
                autoComplete="current-password"
                className={`${bigInput} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-black/35 transition hover:bg-black/[0.05] hover:text-[#171717]"
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <Link
                to="/forgot-password"
                state={{ partner: true, email: form.email }}
                className="text-[12px] font-black text-[#F97316] transition hover:text-[#171717]"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setShowPassword(false);
                setForm((current) => ({ ...current, password: "" }));
              }}
              className={secondaryButton}
            >
              Back
            </button>
            <button disabled={submitting} className={primaryButton}>
              {submitting ? "Signing in..." : "Open Partner Portal"}
            </button>
          </div>
        </form>
      )}

      <p className="mt-7 text-[13px] text-black/45">
        Want to join?{" "}
        <Link
          to="/partner/register"
          className="font-black text-[#F97316] hover:text-[#171717]"
        >
          Apply as a Partner
        </Link>
        {"  |  "}
        <Link
          to="/login"
          className="font-black text-[#171717] hover:text-[#F97316]"
        >
          Customer login
        </Link>
      </p>
    </TypeformShell>
  );
};

const Divider = () => (
  <div className="my-6 flex items-center gap-4">
    <span className="h-px flex-1 bg-black/10" />
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/30">
      or
    </span>
    <span className="h-px flex-1 bg-black/10" />
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold leading-5 text-red-700">
    {children}
  </div>
);

const EyeIcon = ({ visible }) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-[19px] w-[19px]" aria-hidden="true">
    <path
      d="M2.8 12s3.3-5.2 9.2-5.2S21.2 12 21.2 12s-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    {!visible && (
      <path d="M4 4 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    )}
  </svg>
);

const bigInput =
  "h-14 w-full rounded-xl border border-black/10 bg-white px-4 text-[16px] font-semibold text-[#171717] outline-none transition placeholder:font-medium placeholder:text-black/25 focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/10";
const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F97316] px-6 py-3 text-[12px] font-black text-white transition hover:bg-[#171717] disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-5 py-3 text-[12px] font-black text-[#171717] transition hover:bg-black/[0.03]";

export default PartnerLogin;
