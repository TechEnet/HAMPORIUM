import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";

const money = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const titleCase = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

const Status = ({ value }) => (
  <span className="inline-flex border border-black/10 bg-[#FFF9F1] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7A5A21]">
    {titleCase(value || "unknown")}
  </span>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/45">
      {label}
    </span>
    {children}
  </label>
);

const inputClass =
  "min-h-11 w-full border border-black/10 bg-white px-3 text-sm text-[#1D1A16] outline-none transition focus:border-[#C79824]";

const Supply = () => {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [offers, setOffers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [offerForm, setOfferForm] = useState({
    kind: "material",
    name: "",
    category: "",
    supplierSku: "",
    unit: "pc",
    unitPrice: "",
    taxPercent: "",
    moq: "1",
    leadTimeDays: "0",
    monthlyCapacity: "0",
    notes: "",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    purchaseOrderId: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    subtotal: "",
    taxAmount: "",
    total: "",
    documentUrl: "",
    note: "",
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, offersRes, requestsRes, ordersRes, invoicesRes] = await Promise.all([
        api.get("/procurement/partner/summary"),
        api.get("/procurement/partner/offers"),
        api.get("/procurement/partner/requests"),
        api.get("/procurement/partner/orders"),
        api.get("/procurement/partner/invoices"),
      ]);

      setSummary(summaryRes.data?.summary || {});
      setOffers(offersRes.data?.offers || []);
      setRequests(requestsRes.data?.requests || []);
      setOrders(ordersRes.data?.orders || []);
      setInvoices(invoicesRes.data?.invoices || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load your supply workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((order) => !["closed", "cancelled"].includes(order.status)),
    [orders]
  );

  const createOffer = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await api.post("/procurement/partner/offers", {
        ...offerForm,
        unitPrice: Number(offerForm.unitPrice),
        taxPercent: Number(offerForm.taxPercent || 0),
        moq: Number(offerForm.moq || 1),
        leadTimeDays: Number(offerForm.leadTimeDays || 0),
        monthlyCapacity: Number(offerForm.monthlyCapacity || 0),
      });
      setNotice("Supply item submitted for HAMPORIUM review.");
      setOfferForm((current) => ({
        ...current,
        name: "",
        category: "",
        supplierSku: "",
        unitPrice: "",
        taxPercent: "",
        notes: "",
      }));
      await load();
      setTab("catalogue");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to submit supply item.");
    }
  };

  const quoteRequest = async (request) => {
    const lines = request.lines.map((line) => {
      const raw = window.prompt(`Unit price for ${line.description} (${line.quantity} ${line.unit})`);
      if (raw === null) return null;
      return {
        requestLineId: line._id,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: Number(raw),
        taxPercent: 0,
        leadTimeDays: 0,
      };
    });

    if (lines.some((line) => line === null)) return;

    try {
      await api.post(`/procurement/partner/requests/${request._id}/quote`, { lines });
      setNotice("Quotation submitted to HAMPORIUM.");
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to submit quotation.");
    }
  };

  const updateOrder = async (orderId, action) => {
    const payload = { action };
    if (action === "dispatch") {
      payload.carrier = window.prompt("Carrier / courier name") || "";
      payload.trackingNumber = window.prompt("Tracking number / LR number") || "";
    }

    try {
      await api.patch(`/procurement/partner/orders/${orderId}`, payload);
      setNotice("Purchase order updated.");
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update purchase order.");
    }
  };

  const submitInvoice = async (event) => {
    event.preventDefault();
    try {
      await api.post("/procurement/partner/invoices", {
        ...invoiceForm,
        subtotal: Number(invoiceForm.subtotal),
        taxAmount: Number(invoiceForm.taxAmount || 0),
        total: Number(invoiceForm.total),
      });
      setNotice("Invoice submitted for verification.");
      setInvoiceForm((current) => ({
        ...current,
        invoiceNumber: "",
        subtotal: "",
        taxAmount: "",
        total: "",
        documentUrl: "",
        note: "",
      }));
      await load();
      setTab("invoices");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to submit invoice.");
    }
  };

  if (loading && !summary) {
    return <div className="border-y border-black/[0.06] bg-white px-6 py-12 text-sm text-black/45">Loading supply workspace...</div>;
  }

  const tabs = [
    ["overview", "Overview"],
    ["catalogue", "My Supply Catalogue"],
    ["requests", "Quote Requests"],
    ["orders", "Purchase Orders"],
    ["invoices", "Invoices"],
  ];

  return (
    <div className="space-y-7">
      <header className="border-b border-black/[0.08] bg-[#FFFDF9] px-6 py-8 sm:px-8">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#B67824]">Supply business</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-[-0.025em] text-[#1E1B17] sm:text-5xl">Supplier Workspace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/48">Manage materials, supplier quotations, purchase orders and invoice payments separately from referral commissions.</p>
          </div>
          <button type="button" onClick={load} className="min-h-11 border border-black/10 bg-white px-5 text-xs font-extrabold uppercase tracking-[0.08em] hover:border-[#C79824]">Refresh</button>
        </div>
      </header>

      {(error || notice) && (
        <div className={`border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <nav className="flex gap-5 overflow-x-auto border-b border-black/[0.07] text-sm">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-1 pb-3 font-bold ${tab === key ? "border-[#F47822] text-[#A95418]" : "border-transparent text-black/45 hover:text-black"}`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-0 border-y border-black/[0.07] bg-white sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Catalogue items", summary?.offers || 0],
            ["Open quote requests", summary?.openRequests || 0],
            ["Active purchase orders", summary?.activeOrders || 0],
            ["Awaiting payment", money(summary?.amountAwaitingPayment || 0)],
          ].map(([label, value], index) => (
            <div key={label} className={`px-6 py-6 ${index ? "sm:border-l sm:border-black/[0.06]" : ""}`}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-black/38">{label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#1E1B17]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "catalogue" && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section>
            <div className="border-b border-black/[0.07] pb-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#B67824]">Approved and submitted supply</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">My supply catalogue</h2>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {offers.map((offer) => (
                <div key={offer._id} className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-extrabold text-[#201C18]">{offer.name}</p><Status value={offer.status} /></div>
                    <p className="mt-1.5 text-xs text-black/40">{titleCase(offer.kind)} · {offer.category || "Uncategorised"} · MOQ {offer.moq} {offer.unit}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-extrabold text-[#B55D17]">{money(offer.unitPrice)}</p>
                    <p className="mt-1 text-[11px] text-black/38">{offer.leadTimeDays || 0} day lead time</p>
                  </div>
                </div>
              ))}
              {!offers.length && <p className="py-10 text-sm text-black/40">No supplier items submitted yet.</p>}
            </div>
          </section>

          <form onSubmit={createOffer} className="border border-black/[0.08] bg-[#FFF9F1] p-5 sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#B67824]">New supply item</p>
            <h3 className="mt-2 font-serif text-2xl font-semibold">Offer to HAMPORIUM</h3>
            <div className="mt-5 space-y-4">
              <Field label="Type"><select className={inputClass} value={offerForm.kind} onChange={(e) => setOfferForm({ ...offerForm, kind: e.target.value })}><option value="material">Material</option><option value="component">Hamper component</option><option value="container">Hamper box/container</option><option value="service">Service</option></select></Field>
              <Field label="Name"><input className={inputClass} required value={offerForm.name} onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })} placeholder="e.g. Satin ribbon 25 mm" /></Field>
              <Field label="Category"><input className={inputClass} value={offerForm.category} onChange={(e) => setOfferForm({ ...offerForm, category: e.target.value })} placeholder="Ribbon, box, decoration..." /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Unit price"><input className={inputClass} type="number" min="0" step="0.01" required value={offerForm.unitPrice} onChange={(e) => setOfferForm({ ...offerForm, unitPrice: e.target.value })} /></Field><Field label="GST %"><input className={inputClass} type="number" min="0" max="100" step="0.01" value={offerForm.taxPercent} onChange={(e) => setOfferForm({ ...offerForm, taxPercent: e.target.value })} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="MOQ"><input className={inputClass} type="number" min="1" value={offerForm.moq} onChange={(e) => setOfferForm({ ...offerForm, moq: e.target.value })} /></Field><Field label="Lead time days"><input className={inputClass} type="number" min="0" value={offerForm.leadTimeDays} onChange={(e) => setOfferForm({ ...offerForm, leadTimeDays: e.target.value })} /></Field></div>
              <Field label="Notes"><textarea className={`${inputClass} min-h-24 py-3`} value={offerForm.notes} onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })} /></Field>
              <button className="min-h-11 w-full bg-[#1D1A16] px-5 text-xs font-extrabold uppercase tracking-[0.09em] text-white hover:bg-black">Submit for review</button>
            </div>
          </form>
        </div>
      )}

      {tab === "requests" && (
        <section>
          <div className="border-b border-black/[0.07] pb-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#B67824]">HAMPORIUM sourcing</p><h2 className="mt-2 font-serif text-3xl font-semibold">Quote requests</h2></div>
          <div className="divide-y divide-black/[0.06]">
            {requests.map((request) => (
              <div key={request._id} className="py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div><div className="flex flex-wrap gap-2"><p className="font-extrabold">{request.title}</p><Status value={request.status} /></div><p className="mt-1.5 text-xs text-black/40">{request.requestId} · {request.lines.length} line(s)</p></div>
                  {request.myQuote ? <div className="text-sm"><span className="text-black/40">Your quote </span><strong>{money(request.myQuote.total, request.myQuote.currency)}</strong></div> : <button onClick={() => quoteRequest(request)} className="min-h-10 bg-[#F47822] px-4 text-xs font-extrabold uppercase tracking-[0.08em] text-white">Submit quote</button>}
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">{request.lines.map((line) => <div key={line._id} className="border-l-2 border-[#D4AF37] bg-[#FFFDF8] px-3 py-2 text-sm"><strong>{line.description}</strong><span className="ml-2 text-black/40">{line.quantity} {line.unit}</span></div>)}</div>
              </div>
            ))}
            {!requests.length && <p className="py-10 text-sm text-black/40">No open sourcing requests for your business.</p>}
          </div>
        </section>
      )}

      {tab === "orders" && (
        <section>
          <div className="border-b border-black/[0.07] pb-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#B67824]">Confirmed procurement</p><h2 className="mt-2 font-serif text-3xl font-semibold">Purchase orders</h2></div>
          <div className="divide-y divide-black/[0.06]">
            {orders.map((order) => (
              <div key={order._id} className="py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex gap-2"><p className="font-extrabold">{order.purchaseOrderId}</p><Status value={order.status} /></div><p className="mt-1.5 text-xs text-black/40">{order.purchaseRequest?.title || "Purchase order"}</p></div><p className="text-lg font-extrabold text-[#B55D17]">{money(order.total, order.currency)}</p></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status === "issued" && <button onClick={() => updateOrder(order._id, "accept")} className="border border-black/10 px-3 py-2 text-xs font-bold">Accept PO</button>}
                  {order.status === "accepted" && <button onClick={() => updateOrder(order._id, "production")} className="border border-black/10 px-3 py-2 text-xs font-bold">Start production</button>}
                  {["accepted", "in_production"].includes(order.status) && <button onClick={() => updateOrder(order._id, "dispatch")} className="bg-[#1D1A16] px-3 py-2 text-xs font-bold text-white">Mark dispatched</button>}
                </div>
              </div>
            ))}
            {!orders.length && <p className="py-10 text-sm text-black/40">No purchase orders yet.</p>}
          </div>
        </section>
      )}

      {tab === "invoices" && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section>
            <div className="border-b border-black/[0.07] pb-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#B67824]">Supplier billing</p><h2 className="mt-2 font-serif text-3xl font-semibold">Invoices & payment status</h2></div>
            <div className="divide-y divide-black/[0.06]">{invoices.map((invoice) => <div key={invoice._id} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><div className="flex flex-wrap gap-2"><p className="font-extrabold">{invoice.invoiceNumber}</p><Status value={invoice.status} /></div><p className="mt-1.5 text-xs text-black/40">{invoice.purchaseOrder?.purchaseOrderId || "Purchase order"}</p></div><p className="font-extrabold text-[#B55D17]">{money(invoice.total, invoice.currency)}</p></div>)}{!invoices.length && <p className="py-10 text-sm text-black/40">No supplier invoices submitted yet.</p>}</div>
          </section>
          <form onSubmit={submitInvoice} className="border border-black/[0.08] bg-[#FFF9F1] p-5 sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#B67824]">Submit invoice</p>
            <div className="mt-5 space-y-4">
              <Field label="Purchase order"><select required className={inputClass} value={invoiceForm.purchaseOrderId} onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseOrderId: e.target.value })}><option value="">Select PO</option>{activeOrders.map((order) => <option key={order._id} value={order._id}>{order.purchaseOrderId} · {money(order.total, order.currency)}</option>)}</select></Field>
              <Field label="Invoice number"><input required className={inputClass} value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} /></Field>
              <Field label="Invoice date"><input required className={inputClass} type="date" value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Subtotal"><input required className={inputClass} type="number" step="0.01" min="0" value={invoiceForm.subtotal} onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })} /></Field><Field label="Tax"><input className={inputClass} type="number" step="0.01" min="0" value={invoiceForm.taxAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, taxAmount: e.target.value })} /></Field></div>
              <Field label="Invoice total"><input required className={inputClass} type="number" step="0.01" min="0" value={invoiceForm.total} onChange={(e) => setInvoiceForm({ ...invoiceForm, total: e.target.value })} /></Field>
              <Field label="Invoice document URL"><input className={inputClass} value={invoiceForm.documentUrl} onChange={(e) => setInvoiceForm({ ...invoiceForm, documentUrl: e.target.value })} placeholder="Optional document URL" /></Field>
              <button className="min-h-11 w-full bg-[#F47822] px-5 text-xs font-extrabold uppercase tracking-[0.09em] text-white">Submit invoice</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Supply;
