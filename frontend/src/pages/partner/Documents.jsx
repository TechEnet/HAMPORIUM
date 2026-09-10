import { useEffect, useState } from "react";

import api from "../../api/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  formatPartnerDate,
  inputClass,
  textareaClass,
} from "../../components/partner/PartnerUI.jsx";

const DOCUMENT_TYPES = [
  ["kyc", "KYC / Verification"],
  ["pan", "PAN"],
  ["gst", "GST"],
  ["business_registration", "Business Registration"],
  ["agreement", "Agreement"],
  ["logo", "Logo"],
  ["other", "Other"],
];

const Documents = () => {
  const { partner } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ documentType: "kyc", title: "", description: "", file: null });

  const load = async () => {
    if (!partner?._id && !partner?.id) return;
    setLoading(true);
    try {
      const response = await api.get(`/documents/entity/partner/${partner._id || partner.id}`);
      setDocuments(response.data.documents || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load partner documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [partner?._id, partner?.id]);

  const upload = async (event) => {
    event.preventDefault();
    if (!form.file) {
      setError("Choose a file to upload.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const data = new FormData();
      data.append("file", form.file);
      data.append("entityType", "partner");
      data.append("entityId", partner._id || partner.id);
      data.append("documentType", form.documentType);
      data.append("title", form.title || form.file.name);
      data.append("description", form.description);

      await api.post("/documents", data);
      setForm({ documentType: "kyc", title: "", description: "", file: null });
      setMessage("Document uploaded.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to upload document");
    } finally {
      setUploading(false);
    }
  };

  const archive = async (document) => {
    if (!window.confirm(`Archive ${document.title || document.fileName}?`)) return;
    try {
      await api.patch(`/documents/${document._id}/archive`, { note: "Archived from Partner Portal." });
      setMessage("Document archived.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to archive document");
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Partner Records" title="Documents" description="Upload verification, registration, agreement and partner business documents. Files stay private and are access-controlled by the backend." />
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <Panel>
        <form onSubmit={upload} className="grid gap-4 lg:grid-cols-2">
          <label><span className={labelClass}>Document type</span><select value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))} className={inputClass}>{DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className={labelClass}>Title</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Optional document title" className={inputClass} /></label>
          <label className="lg:col-span-2"><span className={labelClass}>Description</span><textarea rows="3" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={textareaClass} /></label>
          <label className="lg:col-span-2"><span className={labelClass}>File</span><input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} className="block w-full rounded-xl border border-dashed border-black/15 bg-[#FFF9F2] p-5 text-xs" /></label>
          <button disabled={uploading} className="w-fit rounded-xl bg-[#171717] px-6 py-3 text-xs font-black text-white hover:bg-[#F97316] disabled:opacity-40">{uploading ? "Uploading..." : "Upload document"}</button>
        </form>
      </Panel>

      {loading ? <Panel>Loading documents...</Panel> : !documents.length ? <EmptyState title="No partner documents" text="Upload KYC, PAN, GST, business registration or agreement documents when needed." /> : (
        <Panel className="p-0">
          <div className="divide-y divide-black/[0.06]">
            {documents.map((document) => (
              <article key={document._id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><StatusPill value={document.status} /><span className="text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">{document.documentType?.replaceAll("_", " ")}</span></div>
                  <p className="mt-2 font-black">{document.title || document.fileName}</p>
                  <p className="mt-1 text-[10px] text-black/35">Version {document.version || 1} · {formatPartnerDate(document.createdAt, true)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {document.url && <a href={document.url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#F97316] px-4 py-2.5 text-[10px] font-black text-white">Open</a>}
                  {document.status !== "archived" && <button type="button" onClick={() => archive(document)} className="rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-black">Archive</button>}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
};

const labelClass = "mb-2 block text-[9px] font-black uppercase tracking-[0.1em] text-black/45";

export default Documents;
