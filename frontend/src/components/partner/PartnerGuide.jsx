import { Link, useLocation } from "react-router-dom";

const PAGE_GUIDES = [
  {
    test: (path) => path === "/partner/status",
    eyebrow: "Application stage",
    title: "This page tells you where your approval stands.",
    description:
      "Before approval, keep your business profile and verification documents accurate. HAMPORIUM unlocks projects, referrals, commissions and supply tools after approval.",
    nextLabel: "Review documents",
    nextTo: "/partner/documents",
  },
  {
    test: (path) => path === "/partner/projects",
    eyebrow: "Client gifting",
    title: "Start here when you already have a client requirement.",
    description:
      "Create a project for a real client, add quantity, budget, delivery details and gift requirements, then submit it to HAMPORIUM for validation.",
    nextLabel: "Create / manage projects",
    nextTo: "/partner/projects",
  },
  {
    test: (path) => /^\/partner\/projects\/[^/]+$/.test(path),
    eyebrow: "Project workflow",
    title: "Work on one client project from brief to approved showcase.",
    description:
      "Edit the draft while it is editable, submit it for HAMPORIUM validation, then create a private showcase after client pricing is approved.",
    nextLabel: "See all projects",
    nextTo: "/partner/projects",
  },
  {
    test: (path) => path === "/partner/showcases",
    eyebrow: "Client review",
    title: "Showcases are secure links you send to your client.",
    description:
      "Only validated client-facing options should be published here. Generate the secure link, share it with the client and revoke access whenever needed.",
    nextLabel: "See client responses",
    nextTo: "/partner/client-actions",
  },
  {
    test: (path) => path === "/partner/client-actions",
    eyebrow: "Client feedback",
    title: "This is where client activity becomes actionable.",
    description:
      "Shortlists, comments, change requests, approvals and enquiries from private showcases appear here so you know what to do next inside the related project.",
    nextLabel: "Open projects",
    nextTo: "/partner/projects",
  },
  {
    test: (path) => path === "/partner/orders",
    eyebrow: "Referral attribution",
    title: "These are orders linked to your partner relationship.",
    description:
      "This page is read-only. Use it to confirm which eligible orders were attributed to you and whether a commission record exists for them.",
    nextLabel: "Check commissions",
    nextTo: "/partner/commissions",
  },
  {
    test: (path) => path === "/partner/commissions",
    eyebrow: "Earnings",
    title: "Track how attributed business turns into commission.",
    description:
      "A commission can move through attribution and eligibility before it becomes payable. Paid records are completed earnings; reversed records no longer count because of cancellation, refund or another adjustment.",
    nextLabel: "View payout history",
    nextTo: "/partner/payouts",
  },
  {
    test: (path) => path === "/partner/payouts",
    eyebrow: "Settlement",
    title: "Payouts show money HAMPORIUM has batched for settlement.",
    description:
      "You do not create payout batches here. HAMPORIUM operations moves payable commissions into a payout and this page shows its processing, held or paid state.",
    nextLabel: "Back to commissions",
    nextTo: "/partner/commissions",
  },
  {
    test: (path) => path === "/partner/supply",
    eyebrow: "Supply business",
    title: "Use this only when you supply products, packaging, materials or services to HAMPORIUM.",
    description:
      "Submit your supply catalogue, respond to sourcing requests, accept purchase orders, update production or dispatch, then submit invoices. This flow is separate from referral commission.",
    nextLabel: "Open supply workspace",
    nextTo: "/partner/supply",
  },
  {
    test: (path) => path === "/partner/analytics",
    eyebrow: "Performance",
    title: "Analytics is your summary page, not a place where work starts.",
    description:
      "Use it to understand attributed customers, orders, revenue, projects, showcases, commission and payout movement for the selected time period.",
    nextLabel: "Go to dashboard",
    nextTo: "/partner",
  },
  {
    test: (path) => path === "/partner/documents",
    eyebrow: "Verification",
    title: "Keep KYC and business records here.",
    description:
      "Upload verification or business documents when HAMPORIUM asks for them. These files support approval, compliance and later account updates; they are not client-facing.",
    nextLabel: "Open business profile",
    nextTo: "/partner/profile",
  },
  {
    test: (path) => path === "/partner/profile",
    eyebrow: "Account setup",
    title: "Your business profile controls how HAMPORIUM understands your partner account.",
    description:
      "Keep business, contact, services, supply categories and working details accurate. After approval, the account owner can also manage partner team members here.",
    nextLabel: "Back to dashboard",
    nextTo: "/partner",
  },
];

const journeys = [
  {
    number: "01",
    title: "Client gifting project",
    text: "Use this when you have a client who needs gifting.",
    steps: [
      "Create project",
      "Submit for HAMPORIUM validation",
      "Client pricing approved",
      "Publish private showcase",
      "Client responds",
      "Order / enquiry attributed",
      "Commission becomes payable",
    ],
  },
  {
    number: "02",
    title: "Referral sale",
    text: "Use this when you are simply sending a customer to HAMPORIUM.",
    steps: [
      "Share partner code or link",
      "Customer places an eligible order",
      "Order is attributed",
      "Commission is recorded",
      "Eligible → Payable",
      "HAMPORIUM settles payout",
    ],
  },
  {
    number: "03",
    title: "Supply to HAMPORIUM",
    text: "Use this only if your business supplies goods, packaging or services.",
    steps: [
      "Submit supply item",
      "HAMPORIUM reviews it",
      "Receive quote request / PO",
      "Accept and fulfil PO",
      "Dispatch",
      "Submit invoice",
      "Track payment",
    ],
  },
];

const PartnerGuide = () => {
  const { pathname } = useLocation();

  if (pathname === "/partner") return null;

  const guide = PAGE_GUIDES.find((item) => item.test(pathname));
  if (!guide) return null;

  return (
    <section className="mb-7 overflow-hidden border-y border-black/[0.08] bg-[#FFFDF9]">
      <div className="grid gap-5 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#A86A22]">
            {guide.eyebrow}
          </p>
          <h2 className="mt-1.5 text-[20px] font-extrabold leading-7 tracking-[-0.02em] text-[#1B1815] sm:text-[22px]">
            {guide.title}
          </h2>
          <p className="mt-2 max-w-4xl text-[14px] leading-6 text-black/55">
            {guide.description}
          </p>
        </div>

        <Link
          to={guide.nextTo}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-black/10 bg-white px-4 text-[13px] font-extrabold text-[#6F4A1F] transition hover:border-[#D4AF37]/60 hover:bg-[#FFF7E8] hover:text-[#F97316]"
        >
          {guide.nextLabel}
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <details className="group border-t border-black/[0.07]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-[14px] font-extrabold text-[#27221D] marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
          <span>How the complete HAMPORIUM Partner flow works</span>
          <span className="text-[#F97316] transition group-open:rotate-45" aria-hidden="true">+</span>
        </summary>

        <div className="grid gap-0 border-t border-black/[0.06] lg:grid-cols-3">
          {journeys.map((journey, index) => (
            <div
              key={journey.number}
              className={`px-4 py-5 sm:px-5 ${index ? "border-t border-black/[0.06] lg:border-l lg:border-t-0" : ""}`}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-[24px] font-semibold text-[#D4AF37]">{journey.number}</span>
                <h3 className="text-[16px] font-extrabold text-[#211D19]">{journey.title}</h3>
              </div>
              <p className="mt-2 text-[14px] leading-6 text-black/50">{journey.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {journey.steps.map((step, stepIndex) => (
                  <span key={step} className="inline-flex items-center gap-2 text-[13px] leading-5 text-black/55">
                    <span className="font-bold text-[#F97316]">{stepIndex + 1}.</span>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
};

export default PartnerGuide;
