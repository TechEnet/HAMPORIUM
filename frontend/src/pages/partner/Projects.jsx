import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../../api/api.js";
import {
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  StatusPill,
  formatMoney,
  formatPartnerDate,
  inputClass,
  textareaClass,
} from "../../components/partner/PartnerUI.jsx";

const emptyProject = {
  title: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientCompany: "",
  eventType: "",
  eventDate: "",
  deliveryCity: "",
  requiredDeliveryDate: "",
  quantity: "1",
  budgetPerGift: "",
  totalBudget: "",
  requirements: "",
  brandingRequirements: "",
};

const emptyItem = () => ({ requestedTitle: "", quantity: 1, personalization: "", partnerNote: "" });

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyProject);
  const [items, setItems] = useState([emptyItem()]);
  const [status, setStatus] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/partners/projects/mine", {
        params: status ? { status } : {},
      });
      setProjects(response.data.projects || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const totals = useMemo(
    () => ({
      total: projects.length,
      review: projects.filter((item) => ["submitted", "under_review"].includes(item.status)).length,
      live: projects.filter((item) => ["showcase_live", "client_review"].includes(item.status)).length,
    }),
    [projects]
  );

  const createProject = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await api.post("/partners/projects", {
        title: form.title,
        client: {
          name: form.clientName,
          email: form.clientEmail,
          phone: form.clientPhone,
          company: form.clientCompany,
        },
        eventType: form.eventType,
        eventDate: form.eventDate || null,
        deliveryCity: form.deliveryCity,
        requiredDeliveryDate: form.requiredDeliveryDate || null,
        quantity: Number(form.quantity || 1),
        budgetPerGift: Number(form.budgetPerGift || 0),
        totalBudget: Number(form.totalBudget || 0),
        requirements: form.requirements,
        brandingRequirements: form.brandingRequirements,
        items: items
          .filter((item) => item.requestedTitle.trim())
          .map((item) => ({ ...item, quantity: Number(item.quantity || 1) })),
      });

      navigate(`/partner/projects/${response.data.project._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Client Work"
        title="Projects"
        description="Create client gifting briefs, submit them for HAMPORIUM validation and turn approved pricing into private showcases."
        action={
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="rounded-xl bg-[#F97316] px-5 py-3 text-xs font-black text-white hover:bg-[#171717]">
            {showCreate ? "Close form" : "+ New project"}
          </button>
        }
      />

      {error && <Notice type="error">{error}</Notice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Mini label="Loaded" value={totals.total} />
        <Mini label="In review" value={totals.review} />
        <Mini label="Showcase live/review" value={totals.live} />
      </div>

      {showCreate && (
        <Panel>
          <form onSubmit={createProject} className="space-y-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F97316]">New Client Project</p>
              <h2 className="mt-1 text-2xl font-black">Project brief</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Project title" value={form.title} setValue={(value) => setForm((current) => ({ ...current, title: value }))} required />
              <Input label="Event type" value={form.eventType} setValue={(value) => setForm((current) => ({ ...current, eventType: value }))} />
              <Input label="Client name" value={form.clientName} setValue={(value) => setForm((current) => ({ ...current, clientName: value }))} required />
              <Input label="Client email" type="email" value={form.clientEmail} setValue={(value) => setForm((current) => ({ ...current, clientEmail: value }))} required />
              <Input label="Client phone" value={form.clientPhone} setValue={(value) => setForm((current) => ({ ...current, clientPhone: value }))} />
              <Input label="Client company" value={form.clientCompany} setValue={(value) => setForm((current) => ({ ...current, clientCompany: value }))} />
              <Input label="Event date" type="date" value={form.eventDate} setValue={(value) => setForm((current) => ({ ...current, eventDate: value }))} />
              <Input label="Required delivery" type="date" value={form.requiredDeliveryDate} setValue={(value) => setForm((current) => ({ ...current, requiredDeliveryDate: value }))} />
              <Input label="Delivery city" value={form.deliveryCity} setValue={(value) => setForm((current) => ({ ...current, deliveryCity: value }))} />
              <Input label="Total quantity" type="number" value={form.quantity} setValue={(value) => setForm((current) => ({ ...current, quantity: value }))} />
              <Input label="Budget / gift" type="number" value={form.budgetPerGift} setValue={(value) => setForm((current) => ({ ...current, budgetPerGift: value }))} />
              <Input label="Total budget" type="number" value={form.totalBudget} setValue={(value) => setForm((current) => ({ ...current, totalBudget: value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Area label="Requirements" value={form.requirements} setValue={(value) => setForm((current) => ({ ...current, requirements: value }))} />
              <Area label="Branding / personalisation" value={form.brandingRequirements} setValue={(value) => setForm((current) => ({ ...current, brandingRequirements: value }))} />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-black">Gift options</h3>
                <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="text-xs font-black text-[#F97316]">+ Add option</button>
              </div>
              <div className="mt-4 space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid gap-3 rounded-xl bg-[#FFF9F2] p-4 md:grid-cols-2">
                    <Input label="Gift / product request" value={item.requestedTitle} setValue={(value) => updateItem(setItems, index, "requestedTitle", value)} />
                    <Input label="Quantity" type="number" value={item.quantity} setValue={(value) => updateItem(setItems, index, "quantity", value)} />
                    <Input label="Personalisation" value={item.personalization} setValue={(value) => updateItem(setItems, index, "personalization", value)} />
                    <Input label="Partner note" value={item.partnerNote} setValue={(value) => updateItem(setItems, index, "partnerNote", value)} />
                    {items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="w-fit text-xs font-bold text-red-500">Remove option</button>}
                  </div>
                ))}
              </div>
            </div>

            <button disabled={saving} className="rounded-xl bg-[#171717] px-6 py-3.5 text-xs font-black text-white hover:bg-[#F97316] disabled:opacity-40">
              {saving ? "Creating..." : "Create draft project →"}
            </button>
          </form>
        </Panel>
      )}

      <div className="flex justify-end">
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold">
          <option value="">All statuses</option>
          {["draft", "submitted", "under_review", "changes_requested", "client_price_approved", "showcase_live", "client_review", "client_approved", "enquiry", "order_attributed", "cancelled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </div>

      {loading ? (
        <Panel><p className="text-sm text-black/40">Loading projects...</p></Panel>
      ) : !projects.length ? (
        <EmptyState title="No projects found" text="Create a client gifting brief to start the partner workflow." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <Link key={project._id} to={`/partner/projects/${project._id}`} className="group rounded-[20px] border border-black/[0.07] bg-white p-5 transition hover:-translate-y-1 hover:border-[#D4AF37]/60 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#D4AF37]">{project.projectId}</p>
                  <h2 className="mt-2 text-lg font-black">{project.title}</h2>
                  <p className="mt-1 text-xs text-black/40">{project.client?.name} {project.client?.company ? `· ${project.client.company}` : ""}</p>
                </div>
                <StatusPill value={project.status} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-black/[0.06] pt-4">
                <Small label="Budget" value={formatMoney(project.totalBudget || project.clientPriceTotal || 0)} />
                <Small label="Options" value={project.items?.length || 0} />
                <Small label="Updated" value={formatPartnerDate(project.updatedAt)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const updateItem = (setItems, index, field, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
const Input = ({ label, value, setValue, type = "text", required = false }) => <label><span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-black/40">{label}</span><input type={type} required={required} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} /></label>;
const Area = ({ label, value, setValue }) => <label><span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-black/40">{label}</span><textarea rows="4" value={value} onChange={(event) => setValue(event.target.value)} className={textareaClass} /></label>;
const Mini = ({ label, value }) => <div className="rounded-xl border border-black/[0.06] bg-white p-4"><p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
const Small = ({ label, value }) => <div><p className="text-[8px] font-black uppercase tracking-wider text-black/30">{label}</p><p className="mt-1 truncate text-xs font-bold">{value}</p></div>;

export default Projects;
