import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../api/api.js";
import {
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  formatMoney,
  formatPartnerDate,
  inputClass,
  textareaClass,
} from "../../components/partner/PartnerUI.jsx";

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [showcase, setShowcase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [projectResponse, showcasesResponse] = await Promise.all([
        api.get(`/partners/projects/${id}`),
        api.get("/showcases/mine"),
      ]);
      const current = projectResponse.data.project;
      setProject(current);
      setDraft(current);
      const existing = (showcasesResponse.data.showcases || []).find((item) => String(item.project?._id || item.project) === String(id));
      setShowcase(existing || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const saveProject = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/partners/projects/${id}`, {
        title: draft.title,
        client: draft.client,
        eventType: draft.eventType,
        eventDate: draft.eventDate || null,
        deliveryCity: draft.deliveryCity,
        requiredDeliveryDate: draft.requiredDeliveryDate || null,
        quantity: Number(draft.quantity || 1),
        budgetPerGift: Number(draft.budgetPerGift || 0),
        totalBudget: Number(draft.totalBudget || 0),
        requirements: draft.requirements,
        brandingRequirements: draft.brandingRequirements,
        items: (draft.items || []).map((item) => ({
          productId: item.product?._id || item.product || undefined,
          requestedTitle: item.requestedTitle || item.product?.name || "",
          quantity: Number(item.quantity || 1),
          personalization: item.personalization || "",
          partnerNote: item.partnerNote || "",
        })),
      });
      setEditing(false);
      setMessage("Project updated.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update project");
    } finally {
      setBusy(false);
    }
  };

  const submitProject = async () => {
    if (!window.confirm("Submit this project to HAMPORIUM for validation?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post(`/partners/projects/${id}/submit`);
      setMessage(response.data.message || "Project submitted.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to submit project");
    } finally {
      setBusy(false);
    }
  };

  const createShowcase = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/showcases", {
        projectId: project._id,
        title: project.title,
        introduction: `Private gifting showcase prepared for ${project.client?.name}.`,
      });
      setShowcase(response.data.showcase);
      setMessage("Private showcase created.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to create showcase");
    } finally {
      setBusy(false);
    }
  };

  const publishShowcase = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api.post(`/showcases/${showcase._id}/publish`);
      const url = `${window.location.origin}${response.data.sharePath}`;
      setShareUrl(url);
      setMessage("Secure showcase link generated and ready to share.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to publish showcase");
    } finally {
      setBusy(false);
    }
  };

  const revokeShowcase = async () => {
    if (!window.confirm("Revoke client access to this showcase?")) return;
    setBusy(true);
    try {
      await api.post(`/showcases/${showcase._id}/revoke`);
      setMessage("Showcase access revoked.");
      setShareUrl("");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to revoke showcase");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Panel>Loading project...</Panel>;
  if (!project) return <Notice type="error">{error || "Project not found."}</Notice>;

  const editable = ["draft", "changes_requested"].includes(project.status);
  const showcaseAllowed = ["client_price_approved", "showcase_live", "client_review", "client_approved", "enquiry", "order_attributed"].includes(project.status);

  return (
    <div className="space-y-7">
      <div><Link to="/partner/projects" className="text-xs font-black text-[#F97316]">← Back to projects</Link></div>
      <PageHeader
        eyebrow={project.projectId}
        title={project.title}
        description={`${project.client?.name || "Client"}${project.client?.company ? ` · ${project.client.company}` : ""}`}
        action={<StatusPill value={project.status} />}
      />

      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[9px] font-black uppercase tracking-wider text-[#F97316]">Client Requirement</p><h2 className="mt-1 text-xl font-black">Project information</h2></div>
            {editable && <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-black/10 px-3 py-2 text-[10px] font-black">{editing ? "Cancel edit" : "Edit draft"}</button>}
          </div>

          {editing ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Edit label="Title" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
              <Edit label="Event type" value={draft.eventType || ""} onChange={(value) => setDraft((current) => ({ ...current, eventType: value }))} />
              <Edit label="Client name" value={draft.client?.name || ""} onChange={(value) => setDraft((current) => ({ ...current, client: { ...current.client, name: value } }))} />
              <Edit label="Client email" type="email" value={draft.client?.email || ""} onChange={(value) => setDraft((current) => ({ ...current, client: { ...current.client, email: value } }))} />
              <Edit label="Delivery city" value={draft.deliveryCity || ""} onChange={(value) => setDraft((current) => ({ ...current, deliveryCity: value }))} />
              <Edit label="Quantity" type="number" value={draft.quantity || 1} onChange={(value) => setDraft((current) => ({ ...current, quantity: value }))} />
              <label className="sm:col-span-2"><span className={labelClass}>Requirements</span><textarea rows="4" value={draft.requirements || ""} onChange={(event) => setDraft((current) => ({ ...current, requirements: event.target.value }))} className={textareaClass} /></label>
              <button type="button" onClick={saveProject} disabled={busy} className="w-fit rounded-xl bg-[#171717] px-5 py-3 text-xs font-black text-white hover:bg-[#F97316] disabled:opacity-40">{busy ? "Saving..." : "Save changes"}</button>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Info label="Client" value={project.client?.name} />
              <Info label="Email" value={project.client?.email} />
              <Info label="Event" value={project.eventType} />
              <Info label="Delivery city" value={project.deliveryCity} />
              <Info label="Quantity" value={project.quantity} />
              <Info label="Budget / gift" value={formatMoney(project.budgetPerGift)} />
              <Info label="Event date" value={formatPartnerDate(project.eventDate)} />
              <Info label="Required delivery" value={formatPartnerDate(project.requiredDeliveryDate)} />
              <div className="sm:col-span-2 rounded-xl bg-[#FFF9F2] p-4"><p className="text-[9px] font-black uppercase tracking-wider text-black/35">Requirements</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/60">{project.requirements || "—"}</p></div>
            </div>
          )}
        </Panel>

        <Panel className="bg-[#171717] text-white">
          <p className="text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">Workflow</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">Current state</h2>
          <div className="mt-5 space-y-4">
            <Dark label="Status" value={project.status?.replaceAll("_", " ")} />
            <Dark label="Next action" value={project.nextAction || "—"} />
            <Dark label="Client price" value={formatMoney(project.clientPriceTotal || 0)} />
            <Dark label="Priority" value={project.priority || "normal"} />
          </div>
          {editable && <button type="button" onClick={submitProject} disabled={busy} className="mt-6 w-full rounded-xl bg-[#F97316] px-5 py-3 text-xs font-black text-white disabled:opacity-40">Submit for HAMPORIUM validation</button>}
          {project.validation?.note && <p className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-white/55">{project.validation.note}</p>}
        </Panel>
      </div>

      <Panel>
        <p className="text-[9px] font-black uppercase tracking-wider text-[#F97316]">Gift Options</p>
        <h2 className="mt-1 text-xl font-black">Validated client selection</h2>
        <div className="mt-5 space-y-3">
          {(project.items || []).map((item) => (
            <div key={item._id} className="flex flex-col gap-4 rounded-xl bg-[#FFF9F2] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-black">{item.product?.name || item.requestedTitle || "Gift option"}</p><p className="mt-1 text-xs text-black/40">Qty {item.quantity}{item.personalization ? ` · ${item.personalization}` : ""}</p>{item.validationNote && <p className="mt-2 text-xs text-black/50">{item.validationNote}</p>}</div>
              <div className="flex items-center gap-3"><StatusPill value={item.validationStatus} />{Number(item.clientPrice || 0) > 0 && <p className="font-black text-[#F97316]">{formatMoney(item.clientPrice)}</p>}</div>
            </div>
          ))}
        </div>
      </Panel>

      {showcaseAllowed && (
        <Panel className="border-[#D4AF37]/35 bg-[#FFF9F2]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[9px] font-black uppercase tracking-wider text-[#8D6C18]">Private Showcase</p><h2 className="mt-1 text-xl font-black">Secure client review</h2><p className="mt-2 text-xs leading-5 text-black/45">The client sees approved client pricing only — never internal cost, margin or commission rate.</p></div>
            <div className="flex flex-wrap gap-2">
              {!showcase ? <button type="button" onClick={createShowcase} disabled={busy} className="rounded-xl bg-[#171717] px-5 py-3 text-xs font-black text-white">Create showcase</button> : <><button type="button" onClick={publishShowcase} disabled={busy} className="rounded-xl bg-[#F97316] px-5 py-3 text-xs font-black text-white">{showcase.status === "active" ? "Regenerate secure link" : "Publish showcase"}</button>{showcase.status === "active" && <button type="button" onClick={revokeShowcase} disabled={busy} className="rounded-xl border border-red-200 bg-white px-5 py-3 text-xs font-black text-red-600">Revoke</button>}</>}
            </div>
          </div>
          {showcase && <div className="mt-5 flex flex-wrap items-center gap-3"><StatusPill value={showcase.status} /><span className="text-xs text-black/40">{showcase.showcaseId}</span><Link to="/partner/showcases" className="text-xs font-black text-[#F97316]">Manage showcases →</Link></div>}
          {shareUrl && <div className="mt-5 rounded-xl border border-[#D4AF37]/30 bg-white p-4"><p className="break-all text-xs font-semibold">{shareUrl}</p><button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)} className="mt-3 text-xs font-black text-[#F97316]">Copy link</button></div>}
        </Panel>
      )}
    </div>
  );
};

const Info = ({ label, value }) => <div className="rounded-xl bg-[#FFF9F2] p-4"><p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 text-sm font-black">{value || "—"}</p></div>;
const Dark = ({ label, value }) => <div className="border-b border-white/10 pb-4"><p className="text-[9px] font-black uppercase tracking-wider text-white/30">{label}</p><p className="mt-1 text-sm font-bold capitalize">{value}</p></div>;
const Edit = ({ label, value, onChange, type = "text" }) => <label><span className={labelClass}>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>;
const labelClass = "mb-2 block text-[9px] font-black uppercase tracking-wider text-black/40";

export default ProjectDetails;
