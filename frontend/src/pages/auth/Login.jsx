
import { useCallback, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import GoogleAuthButton from "../../components/GoogleAuthButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPostAuthPath } from "../../utils/authRouting.js";

const Login = () => {
  const { user, partner, login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestedPath = useMemo(() => {
    const from = location.state?.from;
    if (!from?.pathname) return "";

    return `${from.pathname}${from.search || ""}`;
  }, [location.state]);

  // Redirect after successful authentication
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

  // Google authentication
  const handleGoogleLogin = useCallback(
    async (credential) => {
      setError("");
      setSubmitting(true);

      try {
        const data = await googleLogin(credential);
        goAfterLogin(data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to login with Google"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [googleLogin, goAfterLogin]
  );

  const handleGoogleError = useCallback(
    (message) => setError(message),
    []
  );

  // Email step
  const next = (event) => {
    event.preventDefault();

    const email = form.email.trim();
    if (!email) return;

    setForm((current) => ({
      ...current,
      email,
    }));

    setError("");
    setStep(2);
  };

  // Email/password authentication
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

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
          JSON.stringify({
            email: data.email,
            partner: false,
          })
        );

        navigate("/verify-email", {
          replace: true,
          state: {
            email: data.email,
            partner: false,
          },
        });

        return;
      }

      setError(data?.message || "Unable to login");
    } finally {
      setSubmitting(false);
    }
  };

  // Already authenticated
  if (user) {
    return (
      <Navigate
        to={getPostAuthPath({
          user,
          partner,
          requestedPath,
        })}
        replace
      />
    );
  }

  return (
    <section className="fixed inset-0 z-[250] overflow-y-auto bg-[#111111]/75 px-4 py-6 backdrop-blur-[6px] sm:px-6">
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center">

        {/* LOGIN CARD */}
        <main className="relative w-full max-w-[440px] rounded-[22px] border border-[#E9E3DA] bg-[#FFFCF8] px-6 pb-7 pt-8 shadow-[0_28px_90px_rgba(0,0,0,0.26)] sm:px-9 sm:pb-9 sm:pt-10">

          {/* CLOSE BUTTON */}
          <Link
            to="/"
            aria-label="Close login"
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#77716B] transition-colors hover:bg-[#F1ECE5] hover:text-[#171717] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C66A2C]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </Link>

          {/* BRAND */}
          <Link
            to="/"
            className="inline-block text-[15px] font-semibold tracking-[0.19em] text-[#1B1917]"
          >
            HAMPORIUM
          </Link>

          <div className="mt-2 h-[2px] w-8 rounded-full bg-[#D38A40]" />

          {/* HEADING */}
          <div className="mb-7 mt-10 sm:mt-11">
            <h1 className="text-[34px] font-medium leading-[1.12] tracking-[-0.045em] text-[#1A1917] sm:text-[38px]">
              {step === 1
                ? "Welcome back."
                : "Enter password."}
            </h1>

            <p className="mt-3 text-[13px] leading-6 text-[#827C75]">
              {step === 1 ? (
                "Sign in to your HAMPORIUM account."
              ) : (
                <>
                  Signing in as{" "}
                  <span className="font-medium text-[#393530]">
                    {form.email}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-700"
            >
              {error}
            </div>
          )}

          {/* STEP 1 - EMAIL */}
          {step === 1 ? (
            <>
              <form onSubmit={next}>
                <label
                  htmlFor="hamp-login-email"
                  className={labelClass}
                >
                  Email address
                </label>

                <input
                  id="hamp-login-email"
                  autoFocus
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }));

                    if (error) setError("");
                  }}
                  className={inputClass}
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className={buttonClass}
                >
                  Continue
                  <span aria-hidden="true">→</span>
                </button>
              </form>

              {/* DIVIDER */}
              <div
                className="my-6 flex items-center gap-4"
                aria-hidden="true"
              >
                <span className="h-px flex-1 bg-[#E9E4DE]" />

                <span className="text-[11px] uppercase tracking-[0.12em] text-[#98928B]">
                  or
                </span>

                <span className="h-px flex-1 bg-[#E9E4DE]" />
              </div>

              {/* GOOGLE LOGIN */}
              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleLogin}
                  onError={handleGoogleError}
                  disabled={submitting}
                />
              </div>
            </>
          ) : (

            /* STEP 2 - PASSWORD */
            <form onSubmit={handleSubmit}>
              <label
                htmlFor="hamp-login-password"
                className={labelClass}
              >
                Password
              </label>

              <input
                id="hamp-login-password"
                autoFocus
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }));

                  if (error) setError("");
                }}
                className={inputClass}
              />

              {/* PASSWORD OPTIONS */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setStep(1);
                    setError("");
                  }}
                  className="text-[12px] font-medium text-[#77716B] transition-colors hover:text-[#171717] disabled:opacity-50"
                >
                  ← Change email
                </button>

                <Link
                  to="/forgot-password"
                  className="text-[12px] font-semibold text-[#C26F35] transition-colors hover:text-[#171717]"
                >
                  Forgot password?
                </Link>
              </div>

              {/* SIGN IN BUTTON */}
              <button
                type="submit"
                disabled={submitting}
                className={buttonClass}
              >
                {submitting ? "Signing in..." : "Sign in"}

                {!submitting && (
                  <span aria-hidden="true">→</span>
                )}
              </button>
            </form>
          )}

          {/* FOOTER LINKS */}
          <div className="mt-8 border-t border-[#ECE6DE] pt-5 text-center">
            <p className="text-[13px] leading-6 text-[#89827B]">
              New to HAMPORIUM?{" "}
              <Link
                to="/signup"
                className="font-semibold text-[#1A1917] underline decoration-[#D6A475] underline-offset-4 transition-colors hover:text-[#C26F35]"
              >
                Create an account
              </Link>
            </p>

            <Link
              to="/partner/login"
              className="mt-2 inline-block text-[12px] font-medium text-[#918A83] transition-colors hover:text-[#C26F35]"
            >
              Partner login →
            </Link>
          </div>

        </main>
      </div>
    </section>
  );
};

// FIELD LABEL
const labelClass =
  "mb-2 block text-[13px] font-medium text-[#4A4540]";

// INPUT STYLING
const inputClass =
  "block h-[52px] w-full rounded-[10px] border border-[#DDD6CE] bg-white px-4 text-[15px] font-normal text-[#211E1B] outline-none transition-colors placeholder:text-[#A7A19C] focus:border-[#C8874C] focus:ring-2 focus:ring-[#C8874C]/15";

// PRIMARY BUTTON
const buttonClass =
  "mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#1C1B19] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#39332E] disabled:cursor-not-allowed disabled:opacity-50";

export default Login;
