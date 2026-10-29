
// HAMPORIUM Customer Profile — clean ecommerce account layout.
// Replace: frontend/src/pages/account/Profile.jsx
// Keeps existing /users/me PATCH and embedded AddressManager intact.
// Account navigation already lives in AccountLayout.jsx; do not duplicate it here.

import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { AddressManager } from "./Addresses.jsx";

const Profile = () => {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name || "", phone: user.phone || "" });
    setEditing(false);
  }, [user]);

  const initials = useMemo(() => {
    const name = String(user?.name || "Customer").trim();
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [user?.name]);

  const beginEdit = () => {
    setForm({ name: user?.name || "", phone: user?.phone || "" });
    setMessage("");
    setError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    if (submitting) return;
    setForm({ name: user?.name || "", phone: user?.phone || "" });
    setMessage("");
    setError("");
    setEditing(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await api.patch("/users/me", form);
      setUser(response.data.user);
      setEditing(false);
      setMessage("Your details have been updated.");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Unable to update your details. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="hmp-account-profile">
      <style>{PROFILE_CSS}</style>

      <header className="hmp-ap-heading">
        <div>
          <p className="hmp-ap-overline">MY ACCOUNT</p>
          <h1>My Profile</h1>
          <p className="hmp-ap-subtitle">Manage your personal details and addresses.</p>
        </div>
      </header>

      <div className="hmp-ap-user" aria-label="Account details">
        <span className="hmp-ap-avatar" aria-hidden="true">{initials}</span>
        <div className="hmp-ap-user-info">
          <strong>{user?.name || "Customer"}</strong>
          <span>{user?.email || "Your HAMPORIUM account"}</span>
        </div>
      </div>

      <section className="hmp-ap-section" aria-labelledby="hmp-ap-personal-heading">
        <div className="hmp-ap-section-head">
          <h2 id="hmp-ap-personal-heading">Personal Information</h2>
          {!editing && (
            <button type="button" className="hmp-ap-link" onClick={beginEdit}>
              <PencilIcon /> Edit
            </button>
          )}
        </div>

        {message && (
          <p className="hmp-ap-message is-success" role="status">
            <CheckIcon /> {message}
          </p>
        )}
        {error && (
          <p className="hmp-ap-message is-error" role="alert">
            <AlertIcon /> {error}
          </p>
        )}

        {editing ? (
          <form onSubmit={handleSubmit} className="hmp-ap-edit-form">
            <div className="hmp-ap-fields">
              <label className="hmp-ap-field">
                <span>Full Name</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                  disabled={submitting}
                />
              </label>

              <label className="hmp-ap-field">
                <span>Phone Number</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="Add phone number"
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="hmp-ap-email-row">
              <span>Email Address</span>
              <strong>{user?.email || "Not available"}</strong>
              <small>Email address cannot be edited here.</small>
            </div>

            <div className="hmp-ap-actions">
              <button type="submit" className="hmp-ap-save" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="hmp-ap-cancel"
                onClick={cancelEdit}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="hmp-ap-details">
            <div>
              <dt>Full Name</dt>
              <dd>{user?.name || "Not added"}</dd>
            </div>
            <div>
              <dt>Phone Number</dt>
              <dd>{user?.phone || "Not added"}</dd>
            </div>
            <div className="hmp-ap-email-detail">
              <dt>Email Address</dt>
              <dd>{user?.email || "Not available"}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* Reuse the original address manager. No API or modal changes. */}
      <div className="hmp-ap-addresses">
        <AddressManager embedded />
      </div>
    </main>
  );
};

const Icon = ({ children }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const PencilIcon = () => (
  <Icon><path d="m15 5 4 4M4 20l4.5-.9L19.5 8.1a2.12 2.12 0 0 0-3-3L5.4 16.2 4 20Z" /></Icon>
);
const CheckIcon = () => <Icon><path d="m5 12 4 4L19 6" /></Icon>;
const AlertIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></Icon>;

const PROFILE_CSS = `
  .hmp-account-profile {
    --hmp-ap-ink: #252525;
    --hmp-ap-secondary: #6f6f6f;
    --hmp-ap-rule: #dededb;
    --hmp-ap-accent: #d76b24;
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 0 52px;
    font-family: 'Manrope', Arial, sans-serif;
    color: var(--hmp-ap-ink);
    -webkit-font-smoothing: antialiased;
  }
  .hmp-account-profile *,
  .hmp-account-profile *::before,
  .hmp-account-profile *::after { box-sizing: border-box; }

  /* Clean, borderless page heading — no separate card. */
  .hmp-ap-heading { margin: 4px 0 24px; }
  .hmp-ap-overline {
    margin: 0 0 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .13em;
    color: #9d7f53;
  }
  .hmp-ap-heading h1 {
    margin: 0;
    font-size: clamp(26px, 2.8vw, 34px);
    font-weight: 750;
    letter-spacing: -.035em;
    line-height: 1.2;
  }
  .hmp-ap-subtitle { margin: 7px 0 0; color: var(--hmp-ap-secondary); font-size: 13px; line-height: 1.6; }

  /* Simple customer row, not a banner/card. */
  .hmp-ap-user {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 0 0 25px;
    border-bottom: 1px solid var(--hmp-ap-rule);
  }
  .hmp-ap-avatar {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    flex: 0 0 54px;
    border: 1px solid rgba(183,155,106,.36);
    border-radius: 50%;
    background: #f1e9db;
    color: #6b4b22;
    font-size: 17px;
    font-weight: 800;
  }
  .hmp-ap-user-info { display:flex; flex-direction:column; min-width:0; gap:3px; }
  .hmp-ap-user-info strong { font-size: 17px; font-weight: 750; line-height: 1.35; overflow-wrap: anywhere; }
  .hmp-ap-user-info span { color: var(--hmp-ap-secondary); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }

  .hmp-ap-section { padding: 27px 0 32px; border-bottom: 1px solid var(--hmp-ap-rule); }
  .hmp-ap-section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 25px; }
  .hmp-ap-section-head h2 { margin: 0; font-size: 19px; font-weight: 750; line-height: 1.3; letter-spacing: -.02em; }
  .hmp-ap-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    padding: 8px 1px;
    background: none;
    color: #ad5b22;
    font: 700 13px 'Manrope', Arial, sans-serif;
    cursor: pointer;
  }
  .hmp-ap-link:hover { color: #7e3c12; text-decoration: underline; text-underline-offset: 4px; }
  .hmp-ap-link:focus-visible, .hmp-ap-save:focus-visible, .hmp-ap-cancel:focus-visible {
    outline: 2px solid var(--hmp-ap-accent); outline-offset: 3px;
  }

  /* View mode: readable values and simple row separation. */
  .hmp-ap-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px 32px; margin: 0; }
  .hmp-ap-details > div { min-width:0; }
  .hmp-ap-details dt, .hmp-ap-email-row > span {
    display: block;
    margin-bottom: 8px;
    color: #737373;
    font-size: 12px;
    font-weight: 600;
  }
  .hmp-ap-details dd {
    margin: 0;
    color: #292929;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .hmp-ap-email-detail { grid-column: 1 / -1; }

  /* Edit mode: plain ecommerce inputs, no surrounding cards. */
  .hmp-ap-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:22px 24px; max-width:820px; }
  .hmp-ap-field { display:block; min-width:0; }
  .hmp-ap-field > span { display:block; margin-bottom:8px; color:#525252; font-size:12px; font-weight:700; }
  .hmp-ap-field input {
    display: block;
    width: 100%;
    height: 45px;
    padding: 10px 13px;
    border: 1px solid #d4d2cd;
    border-radius: 4px;
    background: #fff;
    color: #252525;
    outline: none;
    font: 600 13px 'Manrope', Arial, sans-serif;
    transition: border-color .2s ease, box-shadow .2s ease;
  }
  .hmp-ap-field input:focus { border-color: #ad7b43; box-shadow: 0 0 0 2px rgba(183,155,106,.12); }
  .hmp-ap-field input::placeholder { color:#aaa6a0; font-weight:400; }
  .hmp-ap-field input:disabled { opacity:.65; cursor:wait; }
  .hmp-ap-email-row { margin-top: 24px; min-width: 0; }
  .hmp-ap-email-row strong { display:block; font-size:14px; font-weight:650; overflow-wrap:anywhere; }
  .hmp-ap-email-row small { display:block; margin-top:5px; color:#898989; font-size:11px; }
  .hmp-ap-actions { display:flex; align-items:center; flex-wrap:wrap; gap:16px; margin-top:25px; }
  .hmp-ap-save {
    min-height:43px; min-width:142px; border:1px solid #292929; border-radius:4px; padding:10px 20px;
    background:#292929; color:#fff; font:700 12px 'Manrope',Arial,sans-serif; cursor:pointer;
    transition: background .2s ease, border-color .2s ease;
  }
  .hmp-ap-save:hover:not(:disabled) { background:#ad5b22; border-color:#ad5b22; }
  .hmp-ap-save:disabled, .hmp-ap-cancel:disabled { opacity:.5; cursor:wait; }
  .hmp-ap-cancel { border:0; padding:10px 6px; background:none; color:#626262; font:650 12px 'Manrope',Arial,sans-serif; cursor:pointer; }
  .hmp-ap-cancel:hover { color:#292929; text-decoration:underline; }
  .hmp-ap-message { display:flex; align-items:center; gap:8px; margin:0 0 19px; font-size:12px; font-weight:650; line-height:1.5; }
  .hmp-ap-message.is-success { color:#277646; }
  .hmp-ap-message.is-error { color:#b43e32; }

  /* AddressManager already renders its list and modal; flatten its embed. */
  .hmp-ap-addresses { margin-top:0; }
  .hmp-ap-addresses > section {
    margin: 0 !important;
    padding: 29px 0 0 !important;
    border: 0 !important;
    background: transparent;
  }
  .hmp-ap-addresses > section > div:first-of-type { align-items:center; gap:12px; padding-bottom:17px; }
  .hmp-ap-addresses > section > div:first-of-type p:first-child { font-size:10px; letter-spacing:.12em; }
  .hmp-ap-addresses > section > div:first-of-type h2 {
    margin-top:6px;
    font-family:'Manrope',Arial,sans-serif !important;
    font-size:19px !important;
    line-height:1.3 !important;
    letter-spacing:-.02em !important;
    font-weight:750 !important;
  }
  .hmp-ap-addresses > section > div:first-of-type button {
    color:#ad5b22;
    font-size:12px;
    font-weight:750;
    letter-spacing:0;
  }
  @media (max-width:640px) {
    .hmp-account-profile { padding-bottom:42px; }
    .hmp-ap-heading { margin:0 0 20px; }
    .hmp-ap-user { padding-bottom:21px; }
    .hmp-ap-section { padding-top:24px; padding-bottom:28px; }
    .hmp-ap-section-head { margin-bottom:21px; }
    .hmp-ap-section-head h2, .hmp-ap-addresses > section > div:first-of-type h2 { font-size:18px !important; }
    .hmp-ap-details, .hmp-ap-fields { grid-template-columns:1fr; gap:20px; }
    .hmp-ap-email-detail { grid-column:auto; }
    .hmp-ap-avatar { width:48px; height:48px; flex-basis:48px; font-size:15px; }
    .hmp-ap-user-info strong { font-size:15px; }
    .hmp-ap-addresses > section > div:first-of-type { align-items:start; }
  }
  @media (prefers-reduced-motion:reduce) {
    .hmp-account-profile * { animation:none !important; transition:none !important; }
  }
`;

export default Profile;
