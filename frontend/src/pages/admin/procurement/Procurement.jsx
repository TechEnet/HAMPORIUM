import { useEffect, useState } from "react";
import api from "../../../api/api.js";

const money = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const titleCase = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
const Status = ({ value }) => <span className="border border-black/10 bg-[#FFF9F1] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#795B22]">{titleCase(value)}</span>;

const Procurement = () => {
  const [tab, setTab] = useState("offers");
  const [offers, setOffers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setError("");
    try {
      const [a, b, c, d, e] = await Promise.all([
        api.get("/procurement/admin/offers"),
        api.get("/procurement/admin/requests"),
        api.get("/procurement/admin/orders"),
        api.get("/procurement/admin/invoices"),
        api.get("/procurement/admin/payments"),
      ]);
      setOffers(a.data?.offers || []);
      setRequests(b.data?.requests || []);
      setOrders(c.data?.orders || []);
      setInvoices(d.data?.invoices || []);
      setPayments(e.data?.payments || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load procurement workspace.");
    }
  };

  useEffect(() => { void load(); }, []);

  const reviewOffer = async (id, status) => {
    try {
      await api.patch(`/procurement/admin/offers/${id}/review`, { status });
      setNotice(`Supplier offer ${status}.`);
      await load();
    } catch (err) { setError(err?.response?.data?.message || "Unable to update supplier offer."); }
  };

  const loadQuotes = async (requestId) => {
    try {
      const { data } = await api.get(`/procurement/admin/requests/${requestId}/quotes`);
      setQuotes((current) => ({ ...current, [requestId]: data.quotes || [] }));
    } catch (err) { setError(err?.response?.data?.message || "Unable to load supplier quotations."); }
  };

  const awardQuote = async (quoteId) => {
    try {
      await api.post(`/procurement/admin/quotes/${quoteId}/award`, {});
      setNotice("Supplier selected and purchase order issued.");
      await load();
    } catch (err) { setError(err?.response?.data?.message || "Unable to award supplier quotation."); }
  };

  const reviewInvoice = async (id, status) => {
    try {
      await api.patch(`/procurement/admin/invoices/${id}/review`, { status });
      setNotice(`Supplier invoice ${status}.`);
      await load();
    } catch (err) { setError(err?.response?.data?.message || "Unable to review supplier invoice."); }
  };

  const createPayment = async (invoice) => {
    try {
      await api.post("/procurement/admin/payments", { invoiceId: invoice._id, method: "bank_transfer" });
      setNotice("Supplier payment record created.");
      await load();
      setTab("payments");
    } catch (err) { setError(err?.response?.data?.message || "Unable to create supplier payment."); }
  };

  const markPaid = async (payment) => {
    const reference = window.prompt("Bank / UTR payment reference");
    if (!reference) return;
    try {
      await api.patch(`/procurement/admin/payments/${payment._id}`, { status: "paid", reference });
      setNotice("Supplier payment marked paid.");
      await load();
    } catch (err) { setError(err?.response?.data?.message || "Unable to update supplier payment."); }
  };

  const tabs = [["offers", "Supplier Offers"], ["requests", "Purchase Requests"], ["orders", "Purchase Orders"], ["invoices", "Supplier Invoices"], ["payments", "Supplier Payments"]];

  return (
    <div className="space-y-7">
      <header className="border-b border-black/[0.08] bg-[#FFFDF9] px-6 py-8 sm:px-8">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#B67824]">Operations · Procurement</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="font-serif text-4xl font-semibold tracking-[-0.025em] text-[#1E1B17] sm:text-5xl">Supplier Procurement</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-black/48">Approve supplier items, source materials, issue purchase orders, receive goods and settle supplier invoices.</p></div><button onClick={load} className="min-h-11 border border-black/10 bg-white px-5 text-xs font-extrabold uppercase tracking-[0.08em] hover:border-[#C79824]">Refresh</button></div>
      </header>

      {(error || notice) && <div className={`border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || notice}</div>}

      <nav className="flex gap-5 overflow-x-auto border-b border-black/[0.07]">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-bold ${tab === key ? "border-[#F47822] text-[#A95418]" : "border-transparent text-black/45"}`}>{label}</button>)}</nav>

      {tab === "offers" && <div className="divide-y divide-black/[0.06]">{offers.map((offer) => <div key={offer._id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"><div><div className="flex flex-wrap gap-2"><p className="font-extrabold">{offer.name}</p><Status value={offer.status} /></div><p className="mt-1.5 text-xs text-black/40">{offer.partner?.businessName || "Supplier"} · {titleCase(offer.kind)} · MOQ {offer.moq} {offer.unit}</p></div><p className="font-extrabold text-[#B55D17]">{money(offer.unitPrice)}</p><div className="flex gap-2">{offer.status !== "approved" && <button onClick={() => reviewOffer(offer._id, "approved")} className="bg-[#1D1A16] px-3 py-2 text-xs font-bold text-white">Approve</button>}<button onClick={() => reviewOffer(offer._id, "rejected")} className="border border-black/10 px-3 py-2 text-xs font-bold">Reject</button></div></div>)}{!offers.length && <p className="py-10 text-sm text-black/40">No supplier offers.</p>}</div>}

      {tab === "requests" && <div className="divide-y divide-black/[0.06]">{requests.map((request) => <div key={request._id} className="py-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex gap-2"><p className="font-extrabold">{request.title}</p><Status value={request.status} /></div><p className="mt-1.5 text-xs text-black/40">{request.requestId} · {request.invitedSuppliers?.length || 0} invited supplier(s)</p></div><button onClick={() => loadQuotes(request._id)} className="border border-black/10 px-3 py-2 text-xs font-bold">View quotes</button></div>{quotes[request._id] && <div className="mt-4 divide-y divide-black/[0.05] border-l-2 border-[#D4AF37] pl-4">{quotes[request._id].map((quote) => <div key={quote._id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{quote.partner?.businessName || quote.quoteId}</p><p className="text-xs text-black/40">{quote.quoteId} · {titleCase(quote.status)}</p></div><div className="flex items-center gap-3"><strong>{money(quote.total, quote.currency)}</strong>{quote.status === "submitted" && <button onClick={() => awardQuote(quote._id)} className="bg-[#F47822] px-3 py-2 text-xs font-bold text-white">Award & issue PO</button>}</div></div>)}</div>}</div>)}{!requests.length && <p className="py-10 text-sm text-black/40">No purchase requests yet.</p>}</div>}

      {tab === "orders" && <div className="divide-y divide-black/[0.06]">{orders.map((order) => <div key={order._id} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><div className="flex gap-2"><p className="font-extrabold">{order.purchaseOrderId}</p><Status value={order.status} /></div><p className="mt-1.5 text-xs text-black/40">{order.partner?.businessName || "Supplier"} · {order.purchaseRequest?.title || "Purchase request"}</p></div><p className="text-lg font-extrabold text-[#B55D17]">{money(order.total, order.currency)}</p></div>)}{!orders.length && <p className="py-10 text-sm text-black/40">No purchase orders yet.</p>}</div>}

      {tab === "invoices" && <div className="divide-y divide-black/[0.06]">{invoices.map((invoice) => <div key={invoice._id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"><div><div className="flex gap-2"><p className="font-extrabold">{invoice.invoiceNumber}</p><Status value={invoice.status} /></div><p className="mt-1.5 text-xs text-black/40">{invoice.partner?.businessName || "Supplier"} · {invoice.purchaseOrder?.purchaseOrderId}</p></div><p className="font-extrabold text-[#B55D17]">{money(invoice.total, invoice.currency)}</p><div className="flex flex-wrap gap-2">{invoice.status === "submitted" && <button onClick={() => reviewInvoice(invoice._id, "verified")} className="border border-black/10 px-3 py-2 text-xs font-bold">Verify</button>}{["submitted", "verified"].includes(invoice.status) && <button onClick={() => reviewInvoice(invoice._id, "approved")} className="bg-[#1D1A16] px-3 py-2 text-xs font-bold text-white">Approve</button>}{invoice.status === "approved" && <button onClick={() => createPayment(invoice)} className="bg-[#F47822] px-3 py-2 text-xs font-bold text-white">Create payment</button>}</div></div>)}{!invoices.length && <p className="py-10 text-sm text-black/40">No supplier invoices yet.</p>}</div>}

      {tab === "payments" && <div className="divide-y divide-black/[0.06]">{payments.map((payment) => <div key={payment._id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"><div><div className="flex gap-2"><p className="font-extrabold">{payment.paymentId}</p><Status value={payment.status} /></div><p className="mt-1.5 text-xs text-black/40">{payment.partner?.businessName || "Supplier"} · {payment.invoice?.invoiceNumber || "Invoice"}</p></div><p className="font-extrabold text-[#B55D17]">{money(payment.amount, payment.currency)}</p>{payment.status !== "paid" ? <button onClick={() => markPaid(payment)} className="bg-[#1D1A16] px-3 py-2 text-xs font-bold text-white">Mark paid</button> : <span className="text-xs text-black/40">{payment.reference}</span>}</div>)}{!payments.length && <p className="py-10 text-sm text-black/40">No supplier payments yet.</p>}</div>}
    </div>
  );
};

export default Procurement;
