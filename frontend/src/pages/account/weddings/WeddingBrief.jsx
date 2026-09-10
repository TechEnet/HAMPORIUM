import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../../../api/api.js";

const initialForm = {
  projectTitle: "",
  coupleName: "",
  familyName: "",

  contactName: "",
  contactEmail: "",
  contactPhone: "",

  weddingStartDate: "",
  weddingEndDate: "",

  city: "",
  state: "",
  country: "India",

  venueName: "",
  hotelName: "",

  estimatedGuestCount: "",
  estimatedRoomCount: "",
  totalGiftQuantity: "",

  budgetPerGift: "",
  totalBudget: "",

  giftingCategories: "",
  theme: "",
  style: "",
  colourPalette: "",

  dietaryRequirements: "",
  culturalRequirements: "",

  personalizationRequirements: "",
  packagingRequirements: "",
  destinationConstraints: "",
  notes: "",
};

const WeddingBrief = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [referenceFile, setReferenceFile] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const { data } = await api.get(`/weddings/projects/${id}`);
        const p = data.project;

        setForm({
          projectTitle: p.projectTitle || "",
          coupleName: p.coupleName || "",
          familyName: p.familyName || "",

          contactName: p.primaryContact?.name || "",
          contactEmail: p.primaryContact?.email || "",
          contactPhone: p.primaryContact?.phone || "",

          weddingStartDate: p.weddingStartDate?.slice(0, 10) || "",
          weddingEndDate: p.weddingEndDate?.slice(0, 10) || "",

          city: p.destination?.city || "",
          state: p.destination?.state || "",
          country: p.destination?.country || "India",

          venueName: p.venueName || "",
          hotelName: p.hotelName || "",

          estimatedGuestCount: p.estimatedGuestCount || "",
          estimatedRoomCount: p.estimatedRoomCount || "",
          totalGiftQuantity: p.totalGiftQuantity || "",

          budgetPerGift: p.budgetPerGift || "",
          totalBudget: p.totalBudget || "",

          giftingCategories: p.giftingCategories?.join(", ") || "",
          theme: p.theme || "",
          style: p.style || "",
          colourPalette: p.colourPalette?.join(", ") || "",

          dietaryRequirements: p.dietaryRequirements?.join(", ") || "",
          culturalRequirements: p.culturalRequirements?.join(", ") || "",

          personalizationRequirements:
            p.personalizationRequirements || "",
          packagingRequirements: p.packagingRequirements || "",
          destinationConstraints: p.destinationConstraints || "",
          notes: p.notes || "",
        });
      } catch (error) {
        setError(error.response?.data?.message || "Unable to load brief.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const list = (value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const payload = () => ({
    projectTitle: form.projectTitle,
    coupleName: form.coupleName,
    familyName: form.familyName,

    primaryContact: {
      name: form.contactName,
      email: form.contactEmail,
      phone: form.contactPhone,
    },

    weddingStartDate: form.weddingStartDate || null,
    weddingEndDate: form.weddingEndDate || null,

    destination: {
      city: form.city,
      state: form.state,
      country: form.country,
    },

    venueName: form.venueName,
    hotelName: form.hotelName,

    estimatedGuestCount: Number(form.estimatedGuestCount || 0),
    estimatedRoomCount: Number(form.estimatedRoomCount || 0),
    totalGiftQuantity: Number(form.totalGiftQuantity || 1),

    budgetPerGift: Number(form.budgetPerGift || 0),
    totalBudget: Number(form.totalBudget || 0),

    giftingCategories: list(form.giftingCategories),
    theme: form.theme,
    style: form.style,
    colourPalette: list(form.colourPalette),

    dietaryRequirements: list(form.dietaryRequirements),
    culturalRequirements: list(form.culturalRequirements),

    personalizationRequirements: form.personalizationRequirements,
    packagingRequirements: form.packagingRequirements,
    destinationConstraints: form.destinationConstraints,
    notes: form.notes,
  });

  const save = async (submitAfter = false) => {
    if (!form.projectTitle.trim()) {
      setError("Wedding project title is required.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      let project;

      if (id) {
        const { data } = await api.patch(
          `/weddings/projects/${id}`,
          payload()
        );

        project = data.project;
      } else {
        const { data } = await api.post("/weddings/projects", payload());
        project = data.project;
      }

      if (referenceFile) {
        const fileData = new FormData();

        fileData.append("entityType", "wedding");
        fileData.append("entityId", project._id);
        fileData.append("documentType", "moodboard");
        fileData.append("title", "Wedding Moodboard / Reference");
        fileData.append("file", referenceFile);

        await api.post("/documents", fileData);
      }

      if (submitAfter) {
        await api.post(`/weddings/projects/${project._id}/submit`);
      }

      navigate(`/account/weddings/${project._id}`);
    } catch (error) {
      setError(
        error.response?.data?.message || "Unable to save wedding brief."
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border bg-white p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-[#F26522]">
          HAMPORIUM Weddings
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          {id ? "Edit Wedding Brief" : "Create Wedding Brief"}
        </h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Wedding Details</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input
            label="Project Title *"
            value={form.projectTitle}
            onChange={(v) => set("projectTitle", v)}
          />

          <Input
            label="Couple Name"
            value={form.coupleName}
            onChange={(v) => set("coupleName", v)}
          />

          <Input
            label="Family Name"
            value={form.familyName}
            onChange={(v) => set("familyName", v)}
          />

          <Input
            label="Venue"
            value={form.venueName}
            onChange={(v) => set("venueName", v)}
          />

          <Input
            label="Wedding Start"
            type="date"
            value={form.weddingStartDate}
            onChange={(v) => set("weddingStartDate", v)}
          />

          <Input
            label="Wedding End"
            type="date"
            value={form.weddingEndDate}
            onChange={(v) => set("weddingEndDate", v)}
          />

          <Input
            label="Destination City"
            value={form.city}
            onChange={(v) => set("city", v)}
          />

          <Input
            label="State"
            value={form.state}
            onChange={(v) => set("state", v)}
          />

          <Input
            label="Hotel"
            value={form.hotelName}
            onChange={(v) => set("hotelName", v)}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Primary Contact</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Input
            label="Name"
            value={form.contactName}
            onChange={(v) => set("contactName", v)}
          />

          <Input
            label="Email"
            type="email"
            value={form.contactEmail}
            onChange={(v) => set("contactEmail", v)}
          />

          <Input
            label="Phone"
            value={form.contactPhone}
            onChange={(v) => set("contactPhone", v)}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Guests & Budget</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Estimated Guests"
            type="number"
            value={form.estimatedGuestCount}
            onChange={(v) => set("estimatedGuestCount", v)}
          />

          <Input
            label="Estimated Rooms"
            type="number"
            value={form.estimatedRoomCount}
            onChange={(v) => set("estimatedRoomCount", v)}
          />

          <Input
            label="Gift Quantity"
            type="number"
            value={form.totalGiftQuantity}
            onChange={(v) => set("totalGiftQuantity", v)}
          />

          <Input
            label="Budget / Gift"
            type="number"
            value={form.budgetPerGift}
            onChange={(v) => set("budgetPerGift", v)}
          />

          <Input
            label="Total Budget"
            type="number"
            value={form.totalBudget}
            onChange={(v) => set("totalBudget", v)}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Style & Gifting</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input
            label="Gifting Categories"
            placeholder="Welcome hampers, VIP, room gifts"
            value={form.giftingCategories}
            onChange={(v) => set("giftingCategories", v)}
          />

          <Input
            label="Theme"
            value={form.theme}
            onChange={(v) => set("theme", v)}
          />

          <Input
            label="Style"
            value={form.style}
            onChange={(v) => set("style", v)}
          />

          <Input
            label="Colour Palette"
            placeholder="Ivory, gold, pastel"
            value={form.colourPalette}
            onChange={(v) => set("colourPalette", v)}
          />

          <Input
            label="Dietary Requirements"
            value={form.dietaryRequirements}
            onChange={(v) => set("dietaryRequirements", v)}
          />

          <Input
            label="Cultural Requirements"
            value={form.culturalRequirements}
            onChange={(v) => set("culturalRequirements", v)}
          />
        </div>

        <div className="mt-4 grid gap-4">
          <TextArea
            label="Personalization"
            value={form.personalizationRequirements}
            onChange={(v) => set("personalizationRequirements", v)}
          />

          <TextArea
            label="Packaging"
            value={form.packagingRequirements}
            onChange={(v) => set("packagingRequirements", v)}
          />

          <TextArea
            label="Destination / Delivery Constraints"
            value={form.destinationConstraints}
            onChange={(v) => set("destinationConstraints", v)}
          />

          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(v) => set("notes", v)}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-bold">Moodboard / Reference File</h2>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
          className="mt-4 w-full rounded-xl border p-3 text-sm"
        />
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          disabled={busy}
          onClick={() => save(false)}
          className="rounded-xl border border-[#F26522] px-6 py-3 font-semibold text-[#F26522]"
        >
          Save Draft
        </button>

        <button
          disabled={busy}
          onClick={() => save(true)}
          className="rounded-xl bg-[#F26522] px-6 py-3 font-semibold text-white"
        >
          {busy ? "Saving..." : "Save & Submit Brief"}
        </button>
      </div>
    </div>
  );
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#F26522]";

const Input = ({ label, value, onChange, type = "text", ...props }) => (
  <label className="text-sm font-medium text-slate-700">
    {label}
    <input
      {...props}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  </label>
);

const TextArea = ({ label, value, onChange }) => (
  <label className="text-sm font-medium text-slate-700">
    {label}
    <textarea
      rows="3"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  </label>
);

export default WeddingBrief;