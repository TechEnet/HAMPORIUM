import { useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/api.js";

const ENQUIRY_TYPES = [
  { value: "general", label: "General enquiry" },
  { value: "bulk", label: "Corporate / bulk gifting" },
  { value: "partnership", label: "Business partnership" },
  { value: "website", label: "Website feedback" },
  { value: "other", label: "Other enquiry" },
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  enquiryType: "",
  message: "",
  website: "", // Hidden honeypot field. Keep it empty.
};

const ArrowIcon = ({ diagonal = false }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px] shrink-0"
  >
    {diagonal ? (
      <path d="M6 18 18 6M8 6h10v10" />
    ) : (
      <path d="M4 12h16m-7-7 7 7-7 7" />
    )}
  </svg>
);

const Field = ({ label, id, required = false, children }) => (
  <div className="min-w-0">
    <label
      htmlFor={id}
      className="mb-2 block text-[14px] font-semibold leading-5 text-[#24231f]"
    >
      {label}
      {required && <span className="ml-1 text-[#A97B23]">*</span>}
    </label>
    {children}
  </div>
);

const Contact = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [feedback, setFeedback] = useState("");

  const onFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    if (feedback) setFeedback("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      enquiryType: form.enquiryType,
      message: form.message.trim(),
      website: form.website,
    };

    if (payload.message.length < 15) {
      setFeedback("Please write at least 15 characters in your message.");
      return;
    }

    setSubmitting(true);
    setFeedback("");

    try {
      const response = await api.post("/contact", payload);
      if (!response.data?.success) {
        throw new Error("Message could not be sent.");
      }
      setSent(true);
      setForm(EMPTY_FORM);
    } catch (requestError) {
      setFeedback(
        requestError.response?.data?.message ||
          "Your enquiry could not be sent right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "contact-input block min-h-[52px] w-full rounded-[8px] border border-[#dedbd4] bg-white px-4 text-[15px] font-medium text-[#24231f] outline-none transition duration-200 placeholder:text-[#99968e] hover:border-[#bcb6aa] focus:border-[#A98034] focus:ring-[3px] focus:ring-[#d4af37]/[0.12]";

  return (
    <main
      className="contact-page relative w-full min-w-0 overflow-x-clip bg-[#FAF9F6] text-[#24231f]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <style>{`
        .contact-page { min-height: 76vh; }
        .contact-page .contact-input { font-family: 'Manrope', Arial, sans-serif; }
        .contact-page .contact-input:disabled { opacity: 0.65; cursor: not-allowed; }
        .contact-page .contact-in { animation: contactIn .6s cubic-bezier(.22, 1, .36, 1) both; }
        .contact-page .contact-in-delayed { animation-delay: .12s; }
        @keyframes contactIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .contact-page .contact-in { animation: none; }
          .contact-page *, .contact-page *::before, .contact-page *::after {
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1460px] px-5 pb-16 pt-7 sm:px-8 sm:pb-20 sm:pt-10 lg:px-12 lg:pb-24 xl:px-16">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-medium text-[#817d73]">
          <Link to="/" className="transition hover:text-[#A47724]">Home</Link>
          <span className="text-[#c7c1b6]">/</span>
          <span className="font-semibold text-[#2e2a23]">Contact Us</span>
        </nav>

        <div className="mt-9 grid min-w-0 gap-11 sm:mt-12 lg:grid-cols-[minmax(0,.86fr)_minmax(0,1fr)] lg:items-start lg:gap-16 xl:gap-24">
          <section className="contact-in min-w-0 lg:pt-4">
            <div className="flex items-center gap-3">
              <span className="h-[2px] w-9 bg-[#BD913A]" />
              <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#8f6a2d]">
                Get in touch
              </span>
            </div>

            <h1
              className="mt-5 max-w-[690px] pb-[9px] text-[clamp(43px,5.2vw,76px)] font-semibold leading-[1.06] tracking-[-0.045em] text-[#1b1a17]"
              style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}
            >
              Contact <span className="italic text-[#B38936]">Us.</span>
            </h1>

            <p className="mt-4 max-w-[490px] text-[16px] font-medium leading-[1.85] text-[#656156]">
              Have a question about gifting, corporate orders, or a potential partnership?
              Send us a message and our team can respond by email.
            </p>

            <div className="mt-10 max-w-[490px] space-y-7 sm:mt-12">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f1eadd] text-[#a77c2c]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
                </span>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-bold text-[#24231f]">Send a general enquiry</h2>
                  <p className="mt-1 text-[14px] leading-6 text-[#78736a]">
                    Use the form for questions, suggestions, partnerships, and general assistance.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f1eadd] text-[#a77c2c]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true"><path d="M4 7h16l-1.5 13h-13z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
                </span>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-bold text-[#24231f]">Already placed an order?</h2>
                  <p className="mt-1 text-[14px] leading-6 text-[#78736a]">
                    For tracking, cancellations, or order-specific help, use your account support area.
                  </p>
                  <Link
                    to="/account/support"
                    className="mt-2.5 inline-flex items-center gap-2 text-[14px] font-bold text-[#956a24] transition hover:gap-3 hover:text-[#F47822]"
                  >
                    Customer Help & Support <ArrowIcon diagonal />
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-12 hidden max-w-[490px] items-center gap-4 lg:flex">
              <span className="h-px w-8 bg-[#c5b491]" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9b968d]">
                HAMPORIUM / Thoughtful gifting
              </span>
            </div>
          </section>

          <section
            aria-labelledby="contact-form-heading"
            className="contact-in contact-in-delayed min-w-0 rounded-[14px] border border-[#eae6df] bg-white p-5 shadow-[0_12px_52px_rgba(43,31,19,.045)] sm:p-8 lg:p-9 xl:p-11"
          >
            {sent ? (
              <div role="status" className="flex min-h-[440px] flex-col items-start justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#edf5ed] text-[#26824f]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true"><path d="M5 12.5 10 17l9-10" /></svg>
                </div>
                <h2 className="mt-6 text-[30px] font-bold tracking-[-0.025em]">Enquiry sent</h2>
                <p className="mt-3 max-w-md text-[15px] leading-7 text-[#69665e]">
                  Thank you for reaching out. Your message has been sent to our team. We can reply to the email address you provided.
                </p>
                <button
                  type="button"
                  onClick={() => { setSent(false); setFeedback(""); }}
                  className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-[7px] bg-[#24231f] px-6 text-[14px] font-bold text-white transition hover:bg-[#a57927]"
                >
                  Send another message <ArrowIcon />
                </button>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <span className="text-[12px] font-bold uppercase tracking-[0.13em] text-[#AB802C]">
                    Enquiry form
                  </span>
                  <h2 id="contact-form-heading" className="mt-2 text-[26px] font-bold tracking-[-0.03em] sm:text-[29px]">
                    Send us a message
                  </h2>
                  <p className="mt-2 text-[14px] leading-6 text-[#7b776e]">
                    Fields marked * are required.
                  </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-5" aria-busy={submitting}>
                  <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                    <Field id="contact-name" label="Full name" required>
                      <input
                        id="contact-name"
                        name="name"
                        autoComplete="name"
                        value={form.name}
                        onChange={onFieldChange}
                        placeholder="Your full name"
                        required
                        minLength={2}
                        maxLength={100}
                        disabled={submitting}
                        className={inputClass}
                      />
                    </Field>

                    <Field id="contact-email" label="Email address" required>
                      <input
                        id="contact-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={onFieldChange}
                        placeholder="you@example.com"
                        required
                        maxLength={254}
                        disabled={submitting}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                    <Field id="contact-phone" label="Phone number (optional)">
                      <input
                        id="contact-phone"
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={onFieldChange}
                        placeholder="Your phone number"
                        maxLength={25}
                        disabled={submitting}
                        className={inputClass}
                      />
                    </Field>

                    <Field id="contact-type" label="Enquiry type" required>
                      <select
                        id="contact-type"
                        name="enquiryType"
                        value={form.enquiryType}
                        onChange={onFieldChange}
                        required
                        disabled={submitting}
                        className={inputClass}
                      >
                        <option value="" disabled>Select a topic</option>
                        {ENQUIRY_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field id="contact-message" label="Your message" required>
                    <textarea
                      id="contact-message"
                      name="message"
                      value={form.message}
                      onChange={onFieldChange}
                      placeholder="How can we help you?"
                      required
                      minLength={15}
                      maxLength={2000}
                      rows={5}
                      disabled={submitting}
                      className={`${inputClass} min-h-[156px] resize-y py-3.5 leading-7`}
                    />
                    <p className="mt-1.5 text-right text-[12px] font-medium text-[#979187]">
                      {form.message.length} / 2000
                    </p>
                  </Field>

                  <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                    <label htmlFor="contact-website">Website</label>
                    <input
                      id="contact-website"
                      name="website"
                      type="text"
                      value={form.website}
                      onChange={onFieldChange}
                      autoComplete="off"
                      tabIndex={-1}
                    />
                  </div>

                  {feedback && (
                    <p role="alert" className="rounded-[7px] bg-[#fff3ef] px-4 py-3 text-[14px] font-semibold leading-6 text-[#ad422e]">
                      {feedback}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="group inline-flex min-h-[54px] w-full items-center justify-center gap-3 rounded-[8px] bg-[#24231f] px-6 text-[15px] font-bold text-white transition duration-200 hover:bg-[#A67A2C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#A67A2C] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {submitting ? "Sending enquiry..." : "Send enquiry"}
                    {!submitting && (
                      <span className="transition-transform duration-200 group-hover:translate-x-1">
                        <ArrowIcon />
                      </span>
                    )}
                  </button>

                  <p className="text-[12px] leading-6 text-[#918a7e]">
                    We use the details you provide to respond to your enquiry. Please avoid sharing passwords or payment card information.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default Contact;
