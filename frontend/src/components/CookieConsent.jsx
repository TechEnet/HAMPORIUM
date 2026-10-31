import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// HAMPORIUM V5 — ALWAYS show full-width cookie banner on each fresh page load.
// There is no small floating Privacy icon, even when a consent choice exists.
// This component saves a visitor's choice; it does NOT load GA4, Meta or Clarity.
// Do not load optional scripts elsewhere without checking consent first.
const STORAGE_KEY = "hamporium_cookie_preferences_v2"; // IMPORTANT: preserve existing visitor choices
const CONSENT_VERSION = 2;
const OPTIONAL_OFF = { analytics: false, marketing: false };

export function getHamporiumConsent() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      value?.version !== CONSENT_VERSION ||
      typeof value?.analytics !== "boolean" ||
      typeof value?.marketing !== "boolean"
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export function hasHamporiumConsent(category) {
  if (category === "essential") return true;
  if (category !== "analytics" && category !== "marketing") return false;
  return getHamporiumConsent()?.[category] === true;
}

function Symbol({ name, size = 20 }) {
  const paths = {
    shield: (
      <>
        <path d="M12 2.8 4.7 5.5V11c0 4.7 2.5 8 7.3 10.2C16.8 19 19.3 15.7 19.3 11V5.5L12 2.8Z" />
        <path d="m8.6 11.8 2.3 2.3 4.6-4.7" />
      </>
    ),
    arrow: <path d="M4.5 12h15m-6-6 6 6-6 6" />,
    sliders: (
      <>
        <path d="M3.5 7h17M3.5 17h17" />
        <circle cx="9" cy="7" r="2.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="17" r="2.3" fill="currentColor" stroke="none" />
      </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
    cookie: (
      <>
        <path d="M19.8 13.5A4.1 4.1 0 0 1 15 8.4a4.3 4.3 0 0 1-5.3-4.3A8.5 8.5 0 1 0 19.8 13.5Z" />
        <circle cx="8.2" cy="10.6" r=".9" fill="currentColor" stroke="none" />
        <circle cx="13.2" cy="15.1" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="8.8" cy="16.3" r=".8" fill="currentColor" stroke="none" />
      </>
    ),
    lock: (
      <>
        <rect x="5.5" y="10" width="13" height="11" rx="2" />
        <path d="M8.7 10V7a3.3 3.3 0 0 1 6.6 0v3" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.shield}
    </svg>
  );
}

function PreferenceRow({ title, description, checked, onChange, required = false }) {
  return (
    <div className="hcc3-preference-row">
      <div className="hcc3-preference-copy">
        <div className="hcc3-preference-title">
          <strong>{title}</strong>
          {required && <span className="hcc3-essential-tag"><Symbol name="lock" size={12} /> Always active</span>}
        </div>
        <p>{description}</p>
      </div>
      {!required && (
        <label className="hcc3-toggle">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            aria-label={`Allow ${title.toLowerCase()} cookies`}
          />
          <span className="hcc3-toggle-track" aria-hidden="true" />
        </label>
      )}
    </div>
  );
}

export default function CookieConsent() {
  const [saved, setSaved] = useState(getHamporiumConsent);
  // A fresh document load always shows the full bottom banner.
  // Navigating between React routes does not reopen it; a page refresh does.
  const [bannerVisible, setBannerVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [choices, setChoices] = useState(() => ({
    analytics: getHamporiumConsent()?.analytics ?? false,
    marketing: getHamporiumConsent()?.marketing ?? false,
  }));
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const openSettings = () => {
    setChoices({
      analytics: saved?.analytics ?? false,
      marketing: saved?.marketing ?? false,
    });
    setSettingsOpen(true);
  };

  const saveChoices = (next) => {
    const updated = {
      version: CONSENT_VERSION,
      essential: true,
      analytics: Boolean(next.analytics),
      marketing: Boolean(next.marketing),
      updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // In privacy modes that disable storage, retain the choice until refresh.
    }
    setSaved(updated);
    setBannerVisible(false);
    setChoices({ analytics: updated.analytics, marketing: updated.marketing });
    setSettingsOpen(false);
    window.dispatchEvent(new CustomEvent("hamporium:consent-changed", { detail: updated }));
  };

  // Keep multiple HAMPORIUM tabs in sync without resetting V2 preferences.
  useEffect(() => {
    const syncFromOtherTab = (event) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setSaved(getHamporiumConsent());
      }
    };
    window.addEventListener("storage", syncFromOtherTab);
    return () => window.removeEventListener("storage", syncFromOtherTab);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusables = [...modalRef.current.querySelectorAll(
        'button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )].filter((node) => node.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus?.({ preventScroll: true });
    };
  }, [settingsOpen]);

  return (
    <div className="hcc3-root">
      <style>{STYLES}</style>

      {bannerVisible && !settingsOpen && (
        <section className="hcc4-banner" aria-label="Cookie consent" role="region">
          <div className="hcc4-inner">
            <div className="hcc4-intro">
              <span className="hcc4-symbol" aria-hidden="true"><Symbol name="cookie" size={20} /></span>
              <div className="hcc4-copy">
                <h2>Cookies, thoughtfully used.</h2>
                <p>
                  Essential cookies keep HAMPORIUM working. Optional analytics and marketing
                  cookies are used only with your permission, if those services are connected.
                  {" "}<Link to="/privacy-policy" className="hcc4-policy">Privacy policy</Link>
                </p>
              </div>
            </div>
            <div className="hcc4-actions">
              <button type="button" className="hcc4-accept" onClick={() => saveChoices({ analytics: true, marketing: true })}>
                Accept all <Symbol name="arrow" size={17} />
              </button>
              <button type="button" className="hcc4-reject" onClick={() => saveChoices(OPTIONAL_OFF)}>
                Reject optional
              </button>
              <button type="button" className="hcc4-preferences" onClick={openSettings}>
                <Symbol name="sliders" size={15} /> Preferences
              </button>
            </div>
          </div>
        </section>
      )}

      {settingsOpen && (
        <div className="hcc3-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="hcc3-modal" role="dialog" aria-modal="true" aria-labelledby="hcc3-dialog-title" aria-describedby="hcc3-dialog-description" ref={modalRef}>
            <div className="hcc3-modal-top">
              <div className="hcc3-modal-icon"><Symbol name="shield" size={23} /></div>
              <button ref={closeButtonRef} type="button" className="hcc3-close" aria-label="Close preferences" onClick={() => setSettingsOpen(false)}>
                <Symbol name="close" size={18} />
              </button>
              <p className="hcc3-modal-eyebrow">HAMPORIUM / PRIVACY PREFERENCES</p>
              <h2 id="hcc3-dialog-title">Your privacy. Your choice.</h2>
              <p id="hcc3-dialog-description" className="hcc3-modal-intro">
                Choose whether to allow optional cookies. You can update these preferences whenever you wish.
              </p>
            </div>

            <div className="hcc3-modal-body">
              <PreferenceRow title="Essential" required description="Necessary for core functionality and remembering your privacy choice." />
              <PreferenceRow title="Analytics" description="Allow measurement of website visits and shopping journeys when analytics is connected." checked={choices.analytics} onChange={(analytics) => setChoices((current) => ({ ...current, analytics }))} />
              <PreferenceRow title="Marketing" description="Allow advertising measurement when marketing tools are connected." checked={choices.marketing} onChange={(marketing) => setChoices((current) => ({ ...current, marketing }))} />
              <Link to="/privacy-policy" className="hcc3-modal-policy" onClick={() => setSettingsOpen(false)}>View Privacy Policy <Symbol name="arrow" size={14} /></Link>
            </div>

            <div className="hcc3-modal-actions">
              <button type="button" className="hcc3-button hcc3-modal-save" onClick={() => saveChoices(choices)}>Save preferences</button>
              <button type="button" className="hcc3-button hcc3-modal-reject" onClick={() => saveChoices(OPTIONAL_OFF)}>Reject optional</button>
            </div>
            <p className="hcc3-modal-footnote">This version saves consent preferences only. Optional tracking services are not installed by this component.</p>
          </section>
        </div>
      )}
    </div>
  );
}

const STYLES = `
.hcc3-root{--hcc-ivory:#FAF8F4;--hcc-stone:#E8E1D6;--hcc-gold:#B79B6A;--hcc-charcoal:#403A32;--hcc-black:#161715;font-family:var(--hmp-font,'Montserrat',Arial,sans-serif);color:var(--hcc-charcoal);-webkit-font-smoothing:antialiased}
.hcc3-root *,.hcc3-root *::before,.hcc3-root *::after{box-sizing:border-box}
.hcc3-root button{font-family:inherit;cursor:pointer}
.hcc3-root :is(button,a,input):focus-visible{outline:2px solid var(--hcc-gold);outline-offset:3px}
.hcc4-banner{position:fixed;inset:auto 0 0;z-index:99990;width:100%;margin:0;border:0;border-top:2px solid var(--hcc-gold);border-radius:0;background:var(--hcc-ivory);color:var(--hcc-charcoal);box-shadow:0 -8px 38px rgba(12,13,11,.14);animation:hcc4-rise .35s cubic-bezier(.22,1,.36,1) both}
.hcc4-inner{width:min(100%,1680px);min-height:112px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:clamp(20px,3vw,52px);padding:20px clamp(22px,4vw,80px) max(20px,env(safe-area-inset-bottom,0px))}
.hcc4-intro{display:flex;align-items:flex-start;gap:17px;min-width:0;flex:1}
.hcc4-symbol{flex:0 0 43px;width:43px;height:43px;display:grid;place-items:center;border:1px solid rgba(183,155,106,.55);border-radius:50%;color:#80673E;background:rgba(183,155,106,.10)}
.hcc4-copy{min-width:0;max-width:780px}
.hcc4-copy h2{margin:0 0 6px;color:#161715;font-size:clamp(18px,1.55vw,22px);line-height:1.22;font-weight:500;letter-spacing:-.025em}
.hcc4-copy p{margin:0;color:#5C574D;font-size:clamp(11.5px,1vw,13px);line-height:1.65;font-weight:400}
.hcc4-policy{display:inline-block;color:#655032;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(130,101,57,.58);font-weight:600;white-space:nowrap}
.hcc4-policy:hover{color:#161715;text-decoration-color:currentColor}
.hcc4-actions{flex:0 0 auto;display:flex;align-items:center;justify-content:flex-end;gap:10px}
.hcc4-actions button{height:45px;min-height:45px;border-radius:3px;font-size:12px;font-weight:600;line-height:1.2;white-space:nowrap;transition:background-color .2s ease,border-color .2s ease,color .2s ease}
.hcc4-accept{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-width:151px;padding:0 17px;background:#161715;border:1px solid #161715;color:#FAF8F4}
.hcc4-accept svg{color:#CFB685;flex:0 0 auto}
.hcc4-accept:hover{background:#403A32;border-color:#403A32}
.hcc4-reject{min-width:140px;padding:0 17px;border:1px solid rgba(64,58,50,.30);color:#403A32;background:transparent}
.hcc4-reject:hover{border-color:#403A32;background:#E8E1D6}
.hcc4-preferences{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:116px;padding:0 7px;border:1px solid transparent;color:#5D5344;background:transparent}
.hcc4-preferences:hover{color:#161715;text-decoration:underline;text-underline-offset:3px}
.hcc4-preferences svg{color:#987D51}
@keyframes hcc4-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.hcc3-backdrop{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(18,19,18,.72);backdrop-filter:blur(6px);overflow-y:auto}
.hcc3-modal{position:relative;display:flex;flex-direction:column;max-height:calc(100dvh - 36px);width:min(570px,100%);border-radius:13px;overflow-y:auto;background:var(--hcc-ivory);border:1px solid rgba(183,155,106,.7);box-shadow:0 30px 100px rgba(0,0,0,.34)}
.hcc3-modal-top{position:relative;background:var(--hcc-black);color:var(--hcc-ivory);padding:24px 30px 27px;border-bottom:3px solid var(--hcc-gold)}
.hcc3-modal-icon{display:grid;place-items:center;width:42px;height:42px;color:#DAC69D;border:1px solid rgba(183,155,106,.55);border-radius:50%;margin-bottom:16px}
.hcc3-close{position:absolute;right:19px;top:19px;display:grid;place-items:center;width:35px;height:35px;border-radius:50%;border:1px solid rgba(250,248,244,.3);color:var(--hcc-ivory);background:transparent}
.hcc3-close:hover{background:rgba(255,255,255,.1)}
.hcc3-modal-eyebrow{margin:0 0 10px;font-size:10px;color:#CAB68E;letter-spacing:.17em;font-weight:600}
.hcc3-modal-top h2{margin:0 0 9px;color:var(--hcc-ivory);font-weight:400;letter-spacing:-.04em;font-size:clamp(25px,3vw,32px);line-height:1.14}
.hcc3-modal-intro{margin:0;max-width:470px;color:#E1DCD0;font-size:12.5px;line-height:1.7}
.hcc3-modal-body{padding:6px 29px 0}
.hcc3-preference-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:19px 0;border-bottom:1px solid rgba(64,58,50,.17)}
.hcc3-preference-copy{min-width:0;flex:1}
.hcc3-preference-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hcc3-preference-title strong{font-size:13px;font-weight:600;color:#28251F}
.hcc3-preference-copy p{margin:5px 0 0;color:#655D52;font-size:11.5px;line-height:1.65}
.hcc3-essential-tag{display:inline-flex;align-items:center;gap:4px;color:#83693F;font-size:10px;white-space:nowrap}
.hcc3-toggle{position:relative;width:48px;height:27px;flex:0 0 48px;cursor:pointer}
.hcc3-toggle input{position:absolute;z-index:2;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.hcc3-toggle-track{display:block;width:48px;height:27px;background:#CDC8BF;border:1px solid #B9B2A7;border-radius:99px;transition:background-color .2s,border-color .2s}
.hcc3-toggle-track::before{content:"";display:block;width:19px;height:19px;margin:3px;background:#FAF8F4;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}
.hcc3-toggle input:checked+.hcc3-toggle-track{background:#8F7448;border-color:#8F7448}
.hcc3-toggle input:checked+.hcc3-toggle-track::before{transform:translateX(21px)}
.hcc3-toggle input:focus-visible+.hcc3-toggle-track{outline:2px solid var(--hcc-black);outline-offset:3px}
.hcc3-modal-policy{display:inline-flex;align-items:center;gap:7px;margin:14px 0 3px;color:#5E4C31;font-size:11px;text-decoration:underline;text-underline-offset:4px}
.hcc3-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px 29px 0}
.hcc3-modal-save{background:var(--hcc-black);color:var(--hcc-ivory);border:1px solid var(--hcc-black)}
.hcc3-modal-save:hover{background:#403A32}
.hcc3-modal-reject{background:transparent;color:#403A32;border:1px solid #B6AA98}
.hcc3-modal-reject:hover{background:var(--hcc-stone)}
.hcc3-modal-footnote{padding:0 29px 20px;margin:10px 0 0;color:#797064;font-size:10px;line-height:1.5}
@media(max-width:1050px){
 .hcc4-inner{flex-wrap:wrap;gap:13px;padding:17px clamp(18px,3vw,35px) max(16px,env(safe-area-inset-bottom,0px))}
 .hcc4-intro{flex:1 1 100%}
 .hcc4-actions{width:100%;justify-content:flex-start;gap:10px}
 .hcc4-actions button{min-height:42px;height:42px}
}
@media(max-width:600px){
 .hcc4-inner{display:block;padding:16px 17px max(14px,env(safe-area-inset-bottom,0px))}
 .hcc4-intro{gap:12px}
 .hcc4-symbol{flex-basis:35px;width:35px;height:35px}
 .hcc4-symbol svg{width:17px;height:17px}
 .hcc4-copy h2{font-size:18px;margin:0 0 7px;line-height:1.22}
 .hcc4-copy p{font-size:11.5px;line-height:1.58}
 .hcc4-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
 .hcc4-actions button{height:43px;min-height:43px;font-size:11.5px}
 .hcc4-accept,.hcc4-reject{min-width:0;width:100%;padding:0 10px}
 .hcc4-preferences{grid-column:1 / -1;width:100%;min-width:0;min-height:28px!important;height:28px!important;font-size:11px!important}
 .hcc3-modal-top{padding:20px 21px 23px}
 .hcc3-modal-body{padding:3px 21px 0}
 .hcc3-modal-actions{padding:15px 21px 0}
 .hcc3-modal-footnote{padding:0 21px 17px}
}
@media(max-width:360px){
 .hcc4-inner{padding:14px 12px max(11px,env(safe-area-inset-bottom,0px))}
 .hcc4-intro{gap:9px}
 .hcc4-symbol{flex-basis:32px;width:32px;height:32px}
 .hcc4-copy h2{font-size:16.5px}
 .hcc4-copy p{font-size:10.5px}
 .hcc4-actions{gap:7px;margin-top:11px}
 .hcc4-actions button{font-size:10.5px;min-height:41px;height:41px}
 .hcc3-preference-row{gap:10px}
 .hcc3-modal-actions{gap:7px}
 .hcc3-modal-actions .hcc3-button{font-size:10px}
}
@media(max-height:580px){
 .hcc4-banner{max-height:90dvh;overflow-y:auto;overscroll-behavior:contain}
 .hcc3-backdrop{align-items:flex-start}
 .hcc3-modal{max-height:calc(100dvh - 20px)}
}
@media(prefers-reduced-motion:reduce){.hcc4-banner{animation:none}.hcc3-root *,.hcc3-root *::before,.hcc3-root *::after{transition:none!important}}
`;
