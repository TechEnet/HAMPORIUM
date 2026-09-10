import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import api from "../../../api/api.js";


const initialForm = {
  companyName: "",
  gstNumber: "",

  contactName: "",
  contactEmail: "",
  contactPhone: "",

  title: "",
  objective: "",
  occasion: "",
  recipientType: "",
  description: "",

  quantity: 1,

  budgetPerGift: "",
  totalBudget: "",

  currency: "INR",

  deliveryLocations: "",

  addressModel: "not_decided",

  requiredDeliveryDate: "",

  productInterest: "",

  brandingRequired: false,
  logoRequired: false,
  personalizationRequired: false,

  brandingMethod: "",
  brandingNotes: "",

  packagingRequirements: "",
  dietaryRequirements: "",
  personalizationRequirements: "",

  notes: "",
};


const CreateRFQ = () => {
  const navigate = useNavigate();

  const [form, setForm] =
    useState(initialForm);

  const [logo, setLogo] =
    useState(null);

  const [requirementFile, setRequirementFile] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  const updateField = (
    name,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const toArray = (value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);


  const buildPayload = () => ({
    sourceType: "corporate",

    companyName:
      form.companyName,

    gstNumber:
      form.gstNumber,

    contactName:
      form.contactName,

    contactEmail:
      form.contactEmail,

    contactPhone:
      form.contactPhone,

    title:
      form.title,

    objective:
      form.objective,

    occasion:
      form.occasion,

    recipientType:
      form.recipientType,

    description:
      form.description,

    quantity:
      Number(form.quantity),

    budgetPerGift:
      Number(form.budgetPerGift || 0),

    totalBudget:
      Number(form.totalBudget || 0),

    currency:
      form.currency,

    deliveryLocations:
      toArray(
        form.deliveryLocations
      ),

    addressModel:
      form.addressModel,

    requiredDeliveryDate:
      form.requiredDeliveryDate ||
      null,

    productInterest:
      toArray(
        form.productInterest
      ),

    branding: {
      required:
        form.brandingRequired,

      logoRequired:
        form.logoRequired,

      personalizationRequired:
        form.personalizationRequired,

      method:
        form.brandingMethod,

      notes:
        form.brandingNotes,
    },

    packagingRequirements:
      form.packagingRequirements,

    dietaryRequirements:
      toArray(
        form.dietaryRequirements
      ),

    personalizationRequirements:
      form.personalizationRequirements,

    notes:
      form.notes,
  });


  const uploadDocument = async ({
    rfqId,
    file,
    documentType,
    title,
  }) => {
    if (!file) return;

    const data =
      new FormData();

    data.append(
      "entityType",
      "rfq"
    );

    data.append(
      "entityId",
      rfqId
    );

    data.append(
      "documentType",
      documentType
    );

    data.append(
      "title",
      title
    );

    data.append(
      "file",
      file
    );

    await api.post(
      "/documents",
      data
    );
  };


  const saveRFQ = async (
    submitAfterSave
  ) => {
    try {
      setLoading(true);
      setError("");

      const { data } =
        await api.post(
          "/rfqs",
          buildPayload()
        );

      const rfq =
        data.rfq;


      await uploadDocument({
        rfqId: rfq._id,
        file: logo,
        documentType: "logo",
        title: "Company Logo",
      });


      await uploadDocument({
        rfqId: rfq._id,
        file: requirementFile,
        documentType:
          "requirement",

        title:
          "Requirement Document",
      });


      if (submitAfterSave) {
        await api.post(
          `/rfqs/${rfq._id}/submit`
        );
      }


      navigate(
        `/account/corporate/rfqs/${rfq._id}`
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to create RFQ"
      );
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = (
    event
  ) => {
    event.preventDefault();

    saveRFQ(true);
  };


  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#F26522] focus:ring-2 focus:ring-orange-100";

  const labelClass =
    "text-sm font-medium text-slate-700";


  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#F26522]">
          HAMPORIUM Business
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
          Create Corporate RFQ
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Share your requirement and
          HAMPORIUM will prepare a
          quotation for review.
        </p>
      </div>


      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Company & Contact
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Company Name

              <input
                className={inputClass}
                value={
                  form.companyName
                }
                onChange={(e) =>
                  updateField(
                    "companyName",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              GST Number

              <input
                className={inputClass}
                value={
                  form.gstNumber
                }
                onChange={(e) =>
                  updateField(
                    "gstNumber",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Contact Name *

              <input
                required
                className={inputClass}
                value={
                  form.contactName
                }
                onChange={(e) =>
                  updateField(
                    "contactName",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Contact Email *

              <input
                required
                type="email"
                className={inputClass}
                value={
                  form.contactEmail
                }
                onChange={(e) =>
                  updateField(
                    "contactEmail",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Contact Phone

              <input
                className={inputClass}
                value={
                  form.contactPhone
                }
                onChange={(e) =>
                  updateField(
                    "contactPhone",
                    e.target.value
                  )
                }
              />
            </label>
          </div>
        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Gifting Requirement
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={`${labelClass} md:col-span-2`}>
              RFQ Title *

              <input
                required
                className={inputClass}
                placeholder="Employee Diwali Gifting 2026"
                value={form.title}
                onChange={(e) =>
                  updateField(
                    "title",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Objective

              <input
                className={inputClass}
                placeholder="Employee gifting"
                value={form.objective}
                onChange={(e) =>
                  updateField(
                    "objective",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Occasion

              <input
                className={inputClass}
                placeholder="Diwali"
                value={form.occasion}
                onChange={(e) =>
                  updateField(
                    "occasion",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Recipient Type

              <input
                className={inputClass}
                placeholder="Employees / Clients"
                value={
                  form.recipientType
                }
                onChange={(e) =>
                  updateField(
                    "recipientType",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Quantity *

              <input
                required
                type="number"
                min="1"
                className={inputClass}
                value={form.quantity}
                onChange={(e) =>
                  updateField(
                    "quantity",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Budget Per Gift

              <input
                type="number"
                min="0"
                className={inputClass}
                value={
                  form.budgetPerGift
                }
                onChange={(e) =>
                  updateField(
                    "budgetPerGift",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Total Budget

              <input
                type="number"
                min="0"
                className={inputClass}
                value={
                  form.totalBudget
                }
                onChange={(e) =>
                  updateField(
                    "totalBudget",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Delivery Date

              <input
                type="date"
                className={inputClass}
                value={
                  form.requiredDeliveryDate
                }
                onChange={(e) =>
                  updateField(
                    "requiredDeliveryDate",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Address Model

              <select
                className={inputClass}
                value={
                  form.addressModel
                }
                onChange={(e) =>
                  updateField(
                    "addressModel",
                    e.target.value
                  )
                }
              >
                <option value="not_decided">
                  Not Decided
                </option>

                <option value="single_address">
                  Single Address
                </option>

                <option value="multiple_addresses">
                  Multiple Addresses
                </option>
              </select>
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Delivery Locations

              <input
                className={inputClass}
                placeholder="Delhi, Noida, Gurugram"
                value={
                  form.deliveryLocations
                }
                onChange={(e) =>
                  updateField(
                    "deliveryLocations",
                    e.target.value
                  )
                }
              />

              <span className="mt-1 block text-xs font-normal text-slate-400">
                Separate locations with commas.
              </span>
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Product Interest

              <input
                className={inputClass}
                placeholder="Dry fruit hamper, wellness hamper"
                value={
                  form.productInterest
                }
                onChange={(e) =>
                  updateField(
                    "productInterest",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Requirement Description

              <textarea
                rows="4"
                className={inputClass}
                value={
                  form.description
                }
                onChange={(e) =>
                  updateField(
                    "description",
                    e.target.value
                  )
                }
              />
            </label>
          </div>
        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Branding & Personalization
          </h2>

          <div className="mt-5 flex flex-wrap gap-4">
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#F26522]"
                checked={
                  form.brandingRequired
                }
                onChange={(e) =>
                  updateField(
                    "brandingRequired",
                    e.target.checked
                  )
                }
              />

              Branding Required
            </label>


            <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#F26522]"
                checked={
                  form.logoRequired
                }
                onChange={(e) =>
                  updateField(
                    "logoRequired",
                    e.target.checked
                  )
                }
              />

              Logo Required
            </label>


            <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#F26522]"
                checked={
                  form.personalizationRequired
                }
                onChange={(e) =>
                  updateField(
                    "personalizationRequired",
                    e.target.checked
                  )
                }
              />

              Personalization Required
            </label>
          </div>


          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Branding Method

              <input
                className={inputClass}
                placeholder="Logo printing"
                value={
                  form.brandingMethod
                }
                onChange={(e) =>
                  updateField(
                    "brandingMethod",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Dietary Requirements

              <input
                className={inputClass}
                placeholder="Vegetarian, vegan"
                value={
                  form.dietaryRequirements
                }
                onChange={(e) =>
                  updateField(
                    "dietaryRequirements",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Packaging Requirements

              <textarea
                rows="3"
                className={inputClass}
                value={
                  form.packagingRequirements
                }
                onChange={(e) =>
                  updateField(
                    "packagingRequirements",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Personalization Requirements

              <textarea
                rows="3"
                className={inputClass}
                value={
                  form.personalizationRequirements
                }
                onChange={(e) =>
                  updateField(
                    "personalizationRequirements",
                    e.target.value
                  )
                }
              />
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Branding Notes

              <textarea
                rows="3"
                className={inputClass}
                value={
                  form.brandingNotes
                }
                onChange={(e) =>
                  updateField(
                    "brandingNotes",
                    e.target.value
                  )
                }
              />
            </label>
          </div>
        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Documents
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Company Logo

              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,.pdf"
                className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#F26522]`}
                onChange={(e) =>
                  setLogo(
                    e.target.files?.[0] ||
                      null
                  )
                }
              />
            </label>


            <label className={labelClass}>
              Requirement File

              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#F26522]`}
                onChange={(e) =>
                  setRequirementFile(
                    e.target.files?.[0] ||
                      null
                  )
                }
              />
            </label>


            <label className={`${labelClass} md:col-span-2`}>
              Additional Notes

              <textarea
                rows="4"
                className={inputClass}
                value={form.notes}
                onChange={(e) =>
                  updateField(
                    "notes",
                    e.target.value
                  )
                }
              />
            </label>
          </div>
        </section>


        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              saveRFQ(false)
            }
            className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading
              ? "Saving..."
              : "Save Draft"}
          </button>


          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#F26522] px-6 py-3 text-sm font-semibold text-white hover:bg-[#d95416] disabled:opacity-60"
          >
            {loading
              ? "Submitting..."
              : "Submit RFQ"}
          </button>
        </div>
      </form>
    </div>
  );
};


export default CreateRFQ;