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
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to update profile"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-[1380px] text-[#171717]"
      style={{
        fontFamily: "'Manrope', Arial, sans-serif",
      }}
    >
      {/* PAGE HEADING */}
      <div className="border-b border-black/[0.07] pb-5">
        <h1
          style={{ fontFamily: DISPLAY_FONT }}
          className="text-[42px] font-semibold leading-none tracking-[-0.035em] sm:text-[48px]"
        >
          My Profile
        </h1>
      </div>

      {/* PROFILE CARD */}
      <section className="mt-5 overflow-hidden rounded-[18px] border border-black/[0.06] bg-white shadow-[0_8px_30px_rgba(23,23,23,.035)]">
        {/* TOP USER INFO */}
        <div className="flex flex-col gap-5 border-b border-black/[0.06] bg-[#FFFDFC] px-5 py-5 sm:flex-row sm:items-center lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/25 bg-[#171717] font-serif text-[20px] font-semibold text-[#F97316]">
              {initials}
            </div>

            <div className="min-w-0">
              <p
                style={{ fontFamily: DISPLAY_FONT }}
                className="truncate text-[26px] font-semibold leading-none"
              >
                {user?.name || "Customer"}
              </p>

              <p className="mt-2 truncate text-[11px] font-medium text-black/40">
                {user?.email}
              </p>

              {user?.phone && (
                <p className="mt-1 text-[10px] font-medium text-black/35">
                  {user.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="p-5 lg:p-6">
          <h2
            style={{ fontFamily: DISPLAY_FONT }}
            className="text-[28px] font-semibold leading-none"
          >
            Account Details
          </h2>

          {message && (
            <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-semibold text-emerald-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[9px]">
                ✓
              </span>
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5">
            <div className="grid gap-4 md:grid-cols-3">
              <ProfileField label="Full Name" icon={<UserIcon />}>
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
                  className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none"
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
                  className="h-full min-w-0 flex-1 cursor-not-allowed bg-transparent text-[12px] font-semibold text-black/40 outline-none"
                />
              </ProfileField>

              <ProfileField label="Phone Number" icon={<PhoneIcon />}>
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
                  className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none placeholder:text-black/25"
                />
              </ProfileField>
            </div>

            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="group ml-auto flex h-[46px] items-center justify-center gap-2 rounded-[10px] bg-[#F97316] px-6 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white shadow-[0_10px_24px_rgba(249,115,22,.16)] transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Changes"}
                {!submitting && (
                  <span className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ADDRESS MANAGER */}
      <AddressManager embedded />
    </div>
  );
};

const ProfileField = ({
  label,
  icon,
  children,
  disabled = false,
}) => (
  <label className="block">
    <span className="mb-2 block text-[9px] font-extrabold uppercase tracking-[0.09em] text-black/45">
      {label}
    </span>

    <div
      className={`flex h-[50px] items-center rounded-[12px] border px-4 transition ${
        disabled
          ? "border-black/[0.05] bg-black/[0.025]"
          : "border-black/[0.09] bg-[#FFFDFC] focus-within:border-[#F97316] focus-within:ring-4 focus-within:ring-[#F97316]/10"
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
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px]"
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