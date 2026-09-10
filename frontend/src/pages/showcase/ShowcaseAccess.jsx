import {
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../../api/api.js";


const ShowcaseAccess = () => {
  const { token } =
    useParams();

  const navigate =
    useNavigate();

  const [email, setEmail] =
    useState("");

  const [otp, setOtp] =
    useState("");

  const [otpSent, setOtpSent] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");


  const requestOtp =
    async (event) => {
      event.preventDefault();

      setBusy(true);
      setError("");
      setMessage("");

      try {
        const response =
          await api.post(
            `/showcases/public/${token}/request-otp`,
            {
              email,
            }
          );

        setOtpSent(true);

        setMessage(
          response.data.message
        );
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to request OTP."
        );
      } finally {
        setBusy(false);
      }
    };


  const verifyOtp =
    async (event) => {
      event.preventDefault();

      setBusy(true);
      setError("");

      try {
        const response =
          await api.post(
            `/showcases/public/${token}/verify-otp`,
            {
              email,
              otp,
            }
          );


        sessionStorage.setItem(
          `showcaseSession:${token}`,
          response.data.sessionToken
        );


        navigate(
          `/showcase/${token}/view`
        );
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "OTP verification failed."
        );
      } finally {
        setBusy(false);
      }
    };


  return (
    <main className="flex min-h-screen items-center justify-center bg-[#171717] px-5 py-12">

      <div className="w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl">

        <div className="h-2 bg-[#F97316]" />


        <div className="p-7 sm:p-9">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF9F2] text-[#F97316]">
            <GiftIcon />
          </div>


          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37]">
            Private Showcase
          </p>


          <h1 className="mt-2 text-3xl font-black text-[#171717]">
            Curated for you.
          </h1>


          <p className="mt-3 text-sm leading-6 text-black/50">
            Enter the email used by your gifting partner. We’ll send a secure OTP to access this private showcase.
          </p>


          {error && (
            <Notice
              text={error}
              error
            />
          )}

          {message && (
            <Notice
              text={message}
            />
          )}


          {!otpSent ? (
            <form
              onSubmit={
                requestOtp
              }
              className="mt-7"
            >

              <label className="text-sm font-bold">
                Email address
              </label>


              <input
                type="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="client@company.com"
                className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3.5 outline-none focus:border-[#F97316]"
              />


              <button
                disabled={busy}
                className="mt-5 w-full rounded-full bg-[#F97316] py-3.5 text-sm font-black text-white transition hover:bg-[#171717]"
              >
                {busy
                  ? "Sending..."
                  : "Send Secure OTP"}
              </button>

            </form>
          ) : (
            <form
              onSubmit={
                verifyOtp
              }
              className="mt-7"
            >

              <p className="text-xs text-black/45">
                OTP sent for{" "}
                <strong className="text-[#171717]">
                  {email}
                </strong>
              </p>


              <label className="mt-4 block text-sm font-bold">
                6-digit OTP
              </label>


              <input
                required
                maxLength="6"
                inputMode="numeric"
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(0, 6)
                  )
                }
                className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-4 text-center text-2xl font-black tracking-[0.4em] outline-none focus:border-[#F97316]"
              />


              <button
                disabled={busy}
                className="mt-5 w-full rounded-full bg-[#171717] py-3.5 text-sm font-black text-white transition hover:bg-[#F97316]"
              >
                {busy
                  ? "Verifying..."
                  : "Open Showcase"}
              </button>


              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                }}
                className="mt-4 w-full text-xs font-bold text-[#F97316]"
              >
                Use another email
              </button>

            </form>
          )}

        </div>

      </div>

    </main>
  );
};


const Notice = ({
  text,
  error,
}) => (
  <div
    className={`mt-5 rounded-xl px-4 py-3 text-sm ${
      error
        ? "bg-red-50 text-red-600"
        : "bg-green-50 text-green-700"
    }`}
  >
    {text}
  </div>
);


const GiftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-7 w-7"
  >
    <path d="M4 10h16v10H4V10Z" />
    <path d="M3 7h18v4H3V7ZM12 7v13" />
    <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
  </svg>
);


export default ShowcaseAccess;