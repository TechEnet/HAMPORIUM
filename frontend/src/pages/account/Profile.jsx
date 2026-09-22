import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { AddressManager } from "./Addresses.jsx";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const Profile = () => {
  const { user, setUser } = useAuth();

  const [form, setForm] = useState({
    name: "",
    phone: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    setForm({
      name: user.name || "",
      phone: user.phone || "",
    });
  }, [user]);

  const initials = useMemo(() => {
    const value = user?.name?.trim() || "Customer";

    return value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [user?.name]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await api.patch("/users/me", form);

      setUser(response.data.user);
      setMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update profile"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="profile-page mx-auto w-full max-w-[1400px] pb-16 text-[#181715]"
      style={{
        fontFamily: "'Manrope', Arial, sans-serif",
      }}
    >
      <style>{`
        .profile-page {
          --profile-orange: #F47822;
          --profile-gold: #C49A2B;
          --profile-deep-gold: #916B17;
          --profile-ink: #181715;
        }

        .profile-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .profile-hero::after {
          content: "H";
          position: absolute;
          right: 0;
          top: -78px;
          z-index: -1;

          font-family: ${DISPLAY_FONT};
          font-size: clamp(170px, 21vw, 320px);
          font-style: italic;
          font-weight: 600;
          line-height: 1;

          color: rgba(196, 154, 43, .045);
          pointer-events: none;
        }

        .profile-gold {
          background:
            linear-gradient(
              120deg,
              #936B16,
              #D2AA3C 48%,
              #A47A1D
            );

          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .profile-field {
          position: relative;
          border-bottom: 1px solid rgba(24, 23, 21, .13);
          transition:
            border-color .25s ease;
        }

        .profile-field:focus-within {
          border-color: var(--profile-orange);
        }

        .profile-save {
          position: relative;
          overflow: hidden;
          transition:
            transform .3s cubic-bezier(.22,1,.36,1),
            background-color .3s ease;
        }

        .profile-save::after {
          content: "";
          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              110deg,
              transparent 33%,
              rgba(255,255,255,.2) 50%,
              transparent 67%
            );

          transform: translateX(-140%);
          transition: transform .7s cubic-bezier(.16,1,.3,1);
        }

        .profile-save:hover {
          transform: translateY(-2px);
        }

        .profile-save:hover::after {
          transform: translateX(140%);
        }

        @media (max-width: 767px) {
          .profile-hero::after {
            right: -30px;
            top: -20px;
            font-size: 190px;
          }
        }
      `}</style>

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <header className="profile-hero border-b border-black/[0.09] pb-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#916B17]">
              Account
            </p>

            <h1
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-2 text-[56px] font-semibold leading-[0.88] tracking-[-0.055em] sm:text-[70px]"
            >
              My{" "}
              <span className="profile-gold italic">
                Profile.
              </span>
            </h1>
          </div>

          <p className="max-w-[420px] text-[12px] font-medium leading-6 text-black/40">
            Keep your contact details current for orders, delivery updates and support.
          </p>
        </div>
      </header>

      {/* =====================================================
          IDENTITY
      ===================================================== */}

      <section className="grid gap-8 border-b border-black/[0.09] py-8 lg:grid-cols-[110px_minmax(0,1fr)] lg:items-center">
        <div className="flex h-[90px] w-[90px] items-center justify-center rounded-full border border-[#C49A2B]/30 bg-[#181715]">
          <span
            style={{ fontFamily: DISPLAY_FONT }}
            className="text-[31px] font-semibold italic text-[#D4AF37]"
          >
            {initials}
          </span>
        </div>

        <div className="min-w-0">
          <p
            style={{ fontFamily: DISPLAY_FONT }}
            className="truncate text-[35px] font-semibold leading-none tracking-[-0.025em]"
          >
            {user?.name || "Customer"}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-medium text-black/42">
            {user?.email && <span>{user.email}</span>}
            {user?.phone && (
              <>
                <span className="text-black/15">•</span>
                <span>{user.phone}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          ACCOUNT DETAILS
      ===================================================== */}

      <section className="py-9">
        <div className="flex flex-col gap-5 border-b border-black/[0.09] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              style={{ fontFamily: DISPLAY_FONT }}
              className="text-[36px] font-semibold tracking-[-0.03em]"
            >
              Account details
            </h2>
          </div>

          <p className="text-[11px] font-medium text-black/35">
            Email cannot be changed here.
          </p>
        </div>

        {message && (
          <p className="mt-5 border-l-2 border-emerald-500 pl-4 text-[12px] font-semibold text-emerald-700">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-5 border-l-2 border-red-500 pl-4 text-[12px] font-semibold text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-7">
          <div className="grid gap-x-10 gap-y-7 md:grid-cols-3">
            <ProfileField
              label="Full Name"
              icon={<UserIcon />}
            >
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
              />
            </ProfileField>

            <ProfileField
              label="Email Address"
              icon={<MailIcon />}
              disabled
            >
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="h-full min-w-0 flex-1 cursor-not-allowed bg-transparent text-[13px] font-semibold text-black/38 outline-none"
              />
            </ProfileField>

            <ProfileField
              label="Phone Number"
              icon={<PhoneIcon />}
            >
              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="Add phone number"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-black/25"
              />
            </ProfileField>
          </div>

          <div className="mt-8 flex justify-end border-t border-black/[0.08] pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="profile-save inline-flex min-h-[46px] items-center justify-center gap-4 bg-[#181715] px-6 text-[10px] font-extrabold uppercase tracking-[0.09em] text-white hover:bg-[#F47822] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? "Saving..." : "Save Changes"}

              {!submitting && (
                <span className="text-[15px]">→</span>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* =====================================================
          ADDRESS MANAGER
      ===================================================== */}

      <AddressManager embedded />
    </main>
  );
};

const ProfileField = ({
  label,
  icon,
  children,
  disabled = false,
}) => (
  <label className="block">
    <span className="text-[10px] font-semibold text-black/38">
      {label}
    </span>

    <div
      className={`profile-field mt-2 flex h-[48px] items-center ${
        disabled ? "opacity-65" : ""
      }`}
    >
      <span className="mr-3 shrink-0 text-black/25">
        {icon}
      </span>

      {children}
    </div>
  </label>
);

const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.55"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px]"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" />
  </Icon>
);

const MailIcon = () => (
  <Icon>
    <path d="M4 6h16v12H4V6Z" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);

const PhoneIcon = () => (
  <Icon>
    <path d="M7 3h3l1 5-2 1.5c1.3 2.7 2.8 4.2 5.5 5.5L16 13l5 1v3c0 2.2-1.8 4-4 4C9.3 21 3 14.7 3 7c0-2.2 1.8-4 4-4Z" />
  </Icon>
);

export default Profile;
