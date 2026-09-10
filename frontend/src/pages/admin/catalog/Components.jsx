import { useEffect, useState } from "react";

import api, {
  deleteCatalogImage,
  uploadCatalogImage,
} from "../../../api/api.js";
import FileUpload from "../../../components/FileUpload.jsx";
import formatCurrency from "../../../utils/formatCurrency.js";

const createEmptyForm = () => ({
  name: "",
  code: "",
  type: "non_food",
  hamperRole: "content",
  brand: "",
  description: "",
  image: "",
  imagePublicId: "",

  externalSku: "",
  skuBarcode: "",
  sizePack: "",
  uom: "",
  piecesPerUom: "",
  sourceProductType: "",
  taxonomyBaseId: "",
  categoryCode: "",
  category: "",
  subcategory: "",
  segment: "",
  productPriority: "",

  mrp: "",
  sellingPrice: "",
  latestUnitCost: "",
  actualLandedCost: "",
  taxEnabled: true,
  taxPercent: "18",
  hsnSac: "",
  discount: {
    enabled: false,
    type: "percentage",
    value: "0",
  },
  minGrossMarginPercent: "",
  moqQty: "",
  leadTimeDays: "",

  dimensions: {
    length: "",
    width: "",
    height: "",
    unit: "cm",
  },
  weight: {
    value: "",
    unit: "g",
  },
  fragile: false,

  dietary: "",
  expiryTracked: false,
  shelfLifeDays: "",
  expiryDate: "",

  personalizable: false,
  personalizationMethod: "",
  hamperUse: true,
  channels: {
    corporate: false,
    wedding: false,
    diwali: false,
    hamperOne: false,
  },

  availability: {
    status: "in_stock",
    availableQuantity: "",
    unit: "pc",
    nextAvailableDate: "",
  },

  customerSelectable: false,
  isActive: true,
  internalNotes: "",
});

const toInputDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
};

const nullableNumber = (value) =>
  value === "" || value === null
    ? null
    : Number(value);

const Components = () => {
  const [components, setComponents] = useState([]);
  const [form, setForm] = useState(createEmptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadComponents = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: "100",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (typeFilter) {
        params.set("type", typeFilter);
      }

      if (categoryFilter.trim()) {
        params.set(
          "category",
          categoryFilter.trim()
        );
      }

      const response = await api.get(
        `/catalog/admin/components?${params.toString()}`
      );

      setComponents(
        response.data.components || []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load components"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComponents();
  }, []);

  const resetForm = () => {
    setForm(createEmptyForm());
    setImageFile(null);
    setEditingId(null);
  };

  const updateNested = (
    section,
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };

  const saveComponent = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    let uploadedImage = null;
    let saved = false;

    const oldPublicId = form.imagePublicId;

    try {
      if (imageFile) {
        uploadedImage =
          await uploadCatalogImage(
            imageFile,
            "component"
          );
      }

      const imageUrl =
        uploadedImage?.url || form.image;

      const imagePublicId =
        uploadedImage?.publicId ||
        form.imagePublicId;

      const hamperUse =
        form.type === "packaging"
          ? true
          : form.hamperUse;

      const customerSelectable =
        form.type === "packaging" ||
        !hamperUse
          ? false
          : form.customerSelectable;

      const payload = {
        name: form.name,
        code: form.code,
        type: form.type,
        hamperRole:
          form.type === "packaging"
            ? "content"
            : form.hamperRole,
        brand: form.brand,
        description: form.description,

        images: imageUrl
          ? [
              {
                url: imageUrl,
                publicId: imagePublicId,
                alt: form.name,
              },
            ]
          : [],

        source: {
          externalSku: form.externalSku,
        },

        skuBarcode: form.skuBarcode,
        sizePack: form.sizePack,
        uom: form.uom,
        piecesPerUom: nullableNumber(
          form.piecesPerUom
        ),

        sourceProductType:
          form.sourceProductType,

        taxonomyBaseId:
          form.taxonomyBaseId,

        categoryCode: form.categoryCode,
        category: form.category,
        subcategory: form.subcategory,
        segment: form.segment,

        productPriority: nullableNumber(
          form.productPriority
        ),

        mrp: nullableNumber(form.mrp),

        sellingPrice: nullableNumber(
          form.sellingPrice
        ),

        latestUnitCost: nullableNumber(
          form.latestUnitCost
        ),

        actualLandedCost: nullableNumber(
          form.actualLandedCost
        ),

        taxEnabled: Boolean(form.taxEnabled),

        taxPercent:
          form.taxEnabled
            ? nullableNumber(form.taxPercent) ?? 0
            : 0,

        hsnSac: form.hsnSac,

        discount: {
          enabled: Boolean(form.discount?.enabled),
          type: form.discount?.type || "percentage",
          value: Number(form.discount?.value || 0),
        },

        pricingSource: "manual",
        taxSource: "manual",

        minGrossMarginPercent:
          nullableNumber(
            form.minGrossMarginPercent
          ),

        moqQty: nullableNumber(form.moqQty),

        leadTimeDays: nullableNumber(
          form.leadTimeDays
        ),

        dimensions: {
          length: nullableNumber(
            form.dimensions.length
          ),
          width: nullableNumber(
            form.dimensions.width
          ),
          height: nullableNumber(
            form.dimensions.height
          ),
          unit: form.dimensions.unit,
        },

        weight: {
          value: nullableNumber(
            form.weight.value
          ),
          unit: form.weight.unit,
        },

        fragile: form.fragile,

        dietary: form.dietary,

        expiryTracked:
          form.type === "packaging" || form.hamperRole === "decoration"
            ? false
            : form.expiryTracked,

        shelfLifeDays: nullableNumber(
          form.shelfLifeDays
        ),

        expiryDate:
          form.type === "packaging" || form.hamperRole === "decoration"
            ? null
            : form.expiryDate || null,

        personalizable:
          form.personalizable,

        personalizationMethod:
          form.personalizable
            ? form.personalizationMethod
            : "",

        hamperUse,
        channels: form.channels,

        availability: {
          status: form.availability.status,

          availableQuantity:
            nullableNumber(
              form.availability
                .availableQuantity
            ),

          unit: form.availability.unit,

          nextAvailableDate:
            form.availability.status ===
            "incoming"
              ? form.availability
                  .nextAvailableDate
              : null,
        },

        customerSelectable,
        isActive: form.isActive,
        internalNotes: form.internalNotes,
      };

      if (editingId) {
        await api.patch(
          `/catalog/admin/components/${editingId}`,
          payload
        );
      } else {
        await api.post(
          "/catalog/admin/components",
          payload
        );
      }

      saved = true;

      if (
        uploadedImage &&
        oldPublicId &&
        oldPublicId !==
          uploadedImage.publicId
      ) {
        try {
          await deleteCatalogImage(
            oldPublicId
          );
        } catch (cleanupError) {
          console.error(
            "Old component image cleanup failed:",
            cleanupError
          );
        }
      }

      resetForm();
      await loadComponents();
    } catch (requestError) {
      if (
        uploadedImage &&
        !saved
      ) {
        try {
          await deleteCatalogImage(
            uploadedImage.publicId
          );
        } catch {
          // Ignore rollback cleanup error.
        }
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to save component"
      );
    } finally {
      setSaving(false);
    }
  };

  const editComponent = (component) => {
    setEditingId(component._id);
    setImageFile(null);

    setForm({
      name: component.name || "",
      code: component.code || "",
      type:
        component.type || "non_food",
      hamperRole:
        component.hamperRole || "content",
      brand: component.brand || "",
      description:
        component.description || "",
      image:
        component.images?.[0]?.url || "",
      imagePublicId:
        component.images?.[0]?.publicId ||
        "",

      externalSku:
        component.source?.externalSku ||
        "",

      skuBarcode:
        component.skuBarcode || "",

      sizePack:
        component.sizePack || "",

      uom: component.uom || "",

      piecesPerUom:
        component.piecesPerUom ?? "",

      sourceProductType:
        component.sourceProductType || "",

      taxonomyBaseId:
        component.taxonomyBaseId || "",

      categoryCode:
        component.categoryCode || "",

      category:
        component.category || "",

      subcategory:
        component.subcategory || "",

      segment:
        component.segment || "",

      productPriority:
        component.productPriority ?? "",

      mrp:
        component.mrp ?? "",

      sellingPrice:
        component.sellingPrice ?? "",

      latestUnitCost:
        component.latestUnitCost ?? "",

      actualLandedCost:
        component.actualLandedCost ?? "",

      taxEnabled: component.taxEnabled !== false,

      taxPercent:
        component.taxPercent ?? 0,

      hsnSac:
        component.hsnSac || "",

      discount: {
        enabled: Boolean(component.discount?.enabled),
        type: component.discount?.type || "percentage",
        value: component.discount?.value ?? 0,
      },

      minGrossMarginPercent:
        component.minGrossMarginPercent ??
        "",

      moqQty:
        component.moqQty ?? "",

      leadTimeDays:
        component.leadTimeDays ?? "",

      dimensions: {
        length:
          component.dimensions?.length ??
          "",
        width:
          component.dimensions?.width ??
          "",
        height:
          component.dimensions?.height ??
          "",
        unit:
          component.dimensions?.unit ||
          "cm",
      },

      weight: {
        value:
          component.weight?.value ?? "",
        unit:
          component.weight?.unit || "g",
      },

      fragile:
        Boolean(component.fragile),

      dietary:
        component.dietary || "",

      expiryTracked:
        Boolean(
          component.expiryTracked
        ),

      shelfLifeDays:
        component.shelfLifeDays ?? "",

      expiryDate:
        toInputDate(
          component.expiryDate
        ),

      personalizable:
        Boolean(
          component.personalizable
        ),

      personalizationMethod:
        component.personalizationMethod ||
        "",

      hamperUse:
        component.hamperUse !== false,

      channels: {
        corporate:
          Boolean(
            component.channels?.corporate
          ),

        wedding:
          Boolean(
            component.channels?.wedding
          ),

        diwali:
          Boolean(
            component.channels?.diwali
          ),

        hamperOne:
          Boolean(
            component.channels?.hamperOne
          ),
      },

      availability: {
        status:
          component.availability
            ?.status || "in_stock",

        availableQuantity:
          component.availability
            ?.availableQuantity ?? "",

        unit:
          component.availability?.unit ||
          "pc",

        nextAvailableDate:
          toInputDate(
            component.availability
              ?.nextAvailableDate
          ),
      },

      customerSelectable:
        Boolean(
          component.customerSelectable
        ),

      isActive:
        component.isActive !== false,

      internalNotes:
        component.internalNotes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const removeComponent = async (
    componentId
  ) => {
    if (
      !window.confirm(
        "Delete this component?"
      )
    )
      return;

    setError("");

    try {
      await api.delete(
        `/catalog/admin/components/${componentId}`
      );

      await loadComponents();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to delete component"
      );
    }
  };

  const selectableRequiresPhysical =
    form.customerSelectable &&
    form.hamperUse &&
    form.type !== "packaging" &&
    form.hamperRole !== "decoration";

  const customerSelectableCount =
    components.filter(
      (component) =>
        component.customerSelectable
    ).length;

  return (
    <div className="mx-auto w-full max-w-[1600px] pb-12">
      <PageHeader
        eyebrow="Product Master"
        title="Components"
        description="Manage food, non-food, capacity-free decorative materials and internal packaging from one organized catalogue master."
        stats={[
          ["Total", components.length],
          [
            "Custom",
            customerSelectableCount,
          ],
        ]}
      />

      {error && (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={saveComponent}
        className="mt-7 overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FFF9F2] px-6 py-5 lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F97316]">
              {editingId
                ? "Editing Component"
                : "Component Editor"}
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#171717]">
              {editingId
                ? "Update Component"
                : "Add New Component"}
            </h2>

            <p className="mt-1 text-sm text-black/45">
              Complete the relevant sections below and save once.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black/55 transition hover:border-[#F97316] hover:text-[#F97316]"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="px-6 lg:px-8">
          <FormSection
            number="01"
            title="Basic Product"
            description="Identity and customer-facing information."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Name"
                required
                value={form.name}
                onChange={(value) =>
                  setForm({
                    ...form,
                    name: value,
                  })
                }
              />

              <Field
                label="HAMPORIUM Code"
                required
                value={form.code}
                onChange={(value) =>
                  setForm({
                    ...form,
                    code: value,
                  })
                }
              />

              <Field
                label="Product Master SKU"
                value={form.externalSku}
                onChange={(value) =>
                  setForm({
                    ...form,
                    externalSku: value,
                  })
                }
              />

              <Field
                label="SKU Barcode"
                value={form.skuBarcode}
                onChange={(value) =>
                  setForm({
                    ...form,
                    skuBarcode: value,
                  })
                }
              />

              <SelectField
                label="Type"
                value={form.type}
                onChange={(nextType) =>
                  setForm((current) => ({
                    ...current,
                    type: nextType,

                    hamperRole:
                      nextType === "packaging" ||
                      (nextType === "food" && current.hamperRole === "decoration")
                        ? "content"
                        : current.hamperRole,

                    customerSelectable:
                      nextType === "packaging"
                        ? false
                        : current.customerSelectable,

                    expiryTracked:
                      nextType === "packaging"
                        ? false
                        : nextType === "food"
                          ? true
                          : current.hamperRole === "decoration"
                            ? false
                            : current.expiryTracked,
                  }))
                }
                options={[
                  ["food", "Food"],
                  [
                    "non_food",
                    "Non-food",
                  ],
                  [
                    "packaging",
                    "Packaging",
                  ],
                ]}
              />

              <SelectField
                label="Hamper Role"
                value={
                  form.type === "packaging"
                    ? "content"
                    : form.hamperRole
                }
                disabled={form.type === "packaging"}
                onChange={(nextRole) =>
                  setForm((current) => ({
                    ...current,
                    hamperRole: nextRole,
                    type:
                      nextRole === "decoration"
                        ? "non_food"
                        : current.type,
                    expiryTracked:
                      nextRole === "decoration"
                        ? false
                        : current.expiryTracked,
                    expiryDate:
                      nextRole === "decoration"
                        ? ""
                        : current.expiryDate,
                  }))
                }
                options={[
                  ["content", "Hamper Content"],
                  ["decoration", "Decorative Material"],
                ]}
              />

              <Field
                label="Brand"
                value={form.brand}
                onChange={(value) =>
                  setForm({
                    ...form,
                    brand: value,
                  })
                }
              />

              <Field
                label="Size / Pack"
                value={form.sizePack}
                onChange={(value) =>
                  setForm({
                    ...form,
                    sizePack: value,
                  })
                }
              />

              <Field
                label="UOM"
                value={form.uom}
                onChange={(value) =>
                  setForm({
                    ...form,
                    uom: value,
                  })
                }
              />

              <Field
                label="Pieces per UOM"
                type="number"
                min="0"
                value={form.piecesPerUom}
                onChange={(value) =>
                  setForm({
                    ...form,
                    piecesPerUom: value,
                  })
                }
              />

              <Field
                label="Source Product Type"
                value={
                  form.sourceProductType
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    sourceProductType:
                      value,
                  })
                }
              />
            </div>

            <TextArea
              label="Description"
              rows="4"
              value={form.description}
              onChange={(value) =>
                setForm({
                  ...form,
                  description: value,
                })
              }
              className="mt-5"
            />

            <div className="mt-5 rounded-2xl bg-[#FAFAF9] p-5">
              <FileUpload
                label="Component Image"
                value={form.image}
                file={imageFile}
                onFileChange={setImageFile}
              />
            </div>
          </FormSection>

          <FormSection
            number="02"
            title="Taxonomy"
            description="Internal classification used for search, grouping and catalogue organization."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Taxonomy Base ID"
                value={form.taxonomyBaseId}
                onChange={(value) =>
                  setForm({
                    ...form,
                    taxonomyBaseId:
                      value,
                  })
                }
              />

              <Field
                label="Category Code"
                value={form.categoryCode}
                onChange={(value) =>
                  setForm({
                    ...form,
                    categoryCode: value,
                  })
                }
              />

              <Field
                label="Category"
                value={form.category}
                onChange={(value) =>
                  setForm({
                    ...form,
                    category: value,
                  })
                }
              />

              <Field
                label="Subcategory"
                value={form.subcategory}
                onChange={(value) =>
                  setForm({
                    ...form,
                    subcategory: value,
                  })
                }
              />

              <Field
                label="Segment"
                value={form.segment}
                onChange={(value) =>
                  setForm({
                    ...form,
                    segment: value,
                  })
                }
              />

              <Field
                label="Product Priority"
                type="number"
                min="0"
                value={form.productPriority}
                onChange={(value) =>
                  setForm({
                    ...form,
                    productPriority:
                      value,
                  })
                }
              />
            </div>
          </FormSection>

          <FormSection
            number="03"
            title="Commercial"
            description="Base selling price is stored pre-GST. Discount is applied first, then GST; the public selling price is computed by the backend."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Retail MRP"
                type="number"
                min="0"
                value={form.mrp}
                onChange={(value) =>
                  setForm({
                    ...form,
                    mrp: value,
                  })
                }
              />

              <Field
                label="Base Selling Price (Pre-GST)"
                type="number"
                min="0"
                required={
                  selectableRequiresPhysical
                }
                value={form.sellingPrice}
                onChange={(value) =>
                  setForm({
                    ...form,
                    sellingPrice: value,
                  })
                }
              />

              <Field
                label="Latest Unit Cost"
                type="number"
                min="0"
                value={form.latestUnitCost}
                onChange={(value) =>
                  setForm({
                    ...form,
                    latestUnitCost: value,
                  })
                }
              />

              <Field
                label="Actual Landed Cost"
                type="number"
                min="0"
                value={form.actualLandedCost}
                onChange={(value) =>
                  setForm({
                    ...form,
                    actualLandedCost:
                      value,
                  })
                }
              />

              <Field
                label="GST %"
                type="number"
                min="0"
                max="100"
                value={form.taxPercent}
                onChange={(value) =>
                  setForm({
                    ...form,
                    taxPercent: value,
                  })
                }
              />

              <Field
                label="HSN / SAC"
                value={form.hsnSac}
                onChange={(value) =>
                  setForm({
                    ...form,
                    hsnSac: value,
                  })
                }
              />

              <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-black/10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={form.taxEnabled}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      taxEnabled: event.target.checked,
                    })
                  }
                />
                <span className="text-xs font-bold text-black/60">Apply GST</span>
              </label>

              <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-black/10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={form.discount.enabled}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      discount: {
                        ...form.discount,
                        enabled: event.target.checked,
                      },
                    })
                  }
                />
                <span className="text-xs font-bold text-black/60">Enable Customer Discount</span>
              </label>

              {form.discount.enabled && (
                <>
                  <label>
                    <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/40">
                      Discount Type
                    </span>
                    <select
                      value={form.discount.type}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          discount: {
                            ...form.discount,
                            type: event.target.value,
                          },
                        })
                      }
                      className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                  </label>

                  <Field
                    label={form.discount.type === "fixed" ? "Discount Amount" : "Discount %"}
                    type="number"
                    min="0"
                    value={form.discount.value}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        discount: {
                          ...form.discount,
                          value,
                        },
                      })
                    }
                  />
                </>
              )}

              <Field
                label="Min Gross Margin %"
                type="number"
                min="0"
                max="100"
                value={
                  form.minGrossMarginPercent
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    minGrossMarginPercent:
                      value,
                  })
                }
              />

              <Field
                label="MOQ Qty"
                type="number"
                min="0"
                value={form.moqQty}
                onChange={(value) =>
                  setForm({
                    ...form,
                    moqQty: value,
                  })
                }
              />

              <Field
                label="Lead Time Days"
                type="number"
                min="0"
                value={form.leadTimeDays}
                onChange={(value) =>
                  setForm({
                    ...form,
                    leadTimeDays: value,
                  })
                }
              />
            </div>
          </FormSection>

          <FormSection
            number="04"
            title="Physical Data"
            description={
              form.hamperRole === "decoration"
                ? "Decorative materials are capacity-free, so dimensions and weight are optional and ignored by the custom-hamper fit engine."
                : "Dimensions and weight used by the hamper fit engine."
            }
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              <Field
                label="Length"
                type="number"
                min="0"
                required={
                  selectableRequiresPhysical
                }
                value={form.dimensions.length}
                onChange={(value) =>
                  updateNested(
                    "dimensions",
                    "length",
                    value
                  )
                }
              />

              <Field
                label="Width"
                type="number"
                min="0"
                required={
                  selectableRequiresPhysical
                }
                value={form.dimensions.width}
                onChange={(value) =>
                  updateNested(
                    "dimensions",
                    "width",
                    value
                  )
                }
              />

              <Field
                label="Height"
                type="number"
                min="0"
                required={
                  selectableRequiresPhysical
                }
                value={form.dimensions.height}
                onChange={(value) =>
                  updateNested(
                    "dimensions",
                    "height",
                    value
                  )
                }
              />

              <SelectField
                label="Dimension Unit"
                value={form.dimensions.unit}
                onChange={(value) =>
                  updateNested(
                    "dimensions",
                    "unit",
                    value
                  )
                }
                options={["cm", "mm"]}
              />

              <Field
                label="Weight"
                type="number"
                min="0"
                required={
                  selectableRequiresPhysical
                }
                value={form.weight.value}
                onChange={(value) =>
                  updateNested(
                    "weight",
                    "value",
                    value
                  )
                }
              />

              <SelectField
                label="Weight Unit"
                value={form.weight.unit}
                onChange={(value) =>
                  updateNested(
                    "weight",
                    "unit",
                    value
                  )
                }
                options={["g", "kg"]}
              />
            </div>

            <div className="mt-5 max-w-sm">
              <CheckField
                label="Fragile Item"
                checked={form.fragile}
                onChange={(checked) =>
                  setForm({
                    ...form,
                    fragile: checked,
                  })
                }
              />
            </div>
          </FormSection>

          <FormSection
            number="05"
            title="Food & Expiry"
            description="Shelf-life and actual expiry details for tracked products."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Dietary"
                value={form.dietary}
                onChange={(value) =>
                  setForm({
                    ...form,
                    dietary: value,
                  })
                }
                placeholder="Veg, Vegan, Jain..."
              />

              <Field
                label="Shelf Life Days"
                type="number"
                min="0"
                value={form.shelfLifeDays}
                onChange={(value) =>
                  setForm({
                    ...form,
                    shelfLifeDays: value,
                  })
                }
              />

              <Field
                label="Actual Expiry Date"
                type="date"
                value={form.expiryDate}
                onChange={(value) =>
                  setForm({
                    ...form,
                    expiryDate: value,
                  })
                }
              />
            </div>

            <div className="mt-5 max-w-sm">
              <CheckField
                label="Expiry Tracked"
                checked={form.expiryTracked}
                disabled={
                  form.type === "packaging"
                }
                onChange={(checked) =>
                  setForm({
                    ...form,
                    expiryTracked: checked,
                  })
                }
              />
            </div>
          </FormSection>

          <FormSection
            number="06"
            title="Personalization & Channels"
            description="Control personalization capability and channel availability."
          >
            <div className="max-w-md">
              <CheckField
                label="Personalizable"
                checked={form.personalizable}
                onChange={(checked) =>
                  setForm({
                    ...form,
                    personalizable: checked,
                  })
                }
              />
            </div>

            {form.personalizable && (
              <div className="mt-5 max-w-xl">
                <Field
                  label="Personalization Method"
                  value={
                    form.personalizationMethod
                  }
                  onChange={(value) =>
                    setForm({
                      ...form,
                      personalizationMethod:
                        value,
                    })
                  }
                  placeholder="Printing, engraving, label..."
                />
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "corporate",
                  "Corporate",
                ],
                [
                  "wedding",
                  "Wedding",
                ],
                [
                  "diwali",
                  "Diwali",
                ],
                [
                  "hamperOne",
                  "HAMPER ONE",
                ],
              ].map(([key, label]) => (
                <CheckField
                  key={key}
                  label={label}
                  checked={
                    form.channels[key]
                  }
                  onChange={(checked) =>
                    updateNested(
                      "channels",
                      key,
                      checked
                    )
                  }
                />
              ))}
            </div>
          </FormSection>

          <FormSection
            number="07"
            title="Availability & Usage"
            description="Stock state and customer-facing hamper availability."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Stock Status"
                value={
                  form.availability.status
                }
                onChange={(value) =>
                  updateNested(
                    "availability",
                    "status",
                    value
                  )
                }
                options={[
                  [
                    "in_stock",
                    "In stock",
                  ],
                  [
                    "incoming",
                    "Incoming",
                  ],
                  [
                    "out_of_stock",
                    "Out of stock",
                  ],
                ]}
              />

              <Field
                label="Available Quantity"
                type="number"
                min="0"
                value={
                  form.availability
                    .availableQuantity
                }
                onChange={(value) =>
                  updateNested(
                    "availability",
                    "availableQuantity",
                    value
                  )
                }
                placeholder="Optional"
              />

              <SelectField
                label="Stock Unit"
                value={
                  form.availability.unit
                }
                onChange={(value) =>
                  updateNested(
                    "availability",
                    "unit",
                    value
                  )
                }
                options={[
                  "pc",
                  "g",
                  "kg",
                  "ml",
                  "l",
                  "mm",
                  "cm",
                  "m",
                ]}
              />

              {form.availability.status ===
                "incoming" && (
                <Field
                  label="Next Available Date"
                  type="date"
                  required
                  value={
                    form.availability
                      .nextAvailableDate
                  }
                  onChange={(value) =>
                    updateNested(
                      "availability",
                      "nextAvailableDate",
                      value
                    )
                  }
                />
              )}
            </div>

            {form.hamperRole === "decoration" && form.type !== "packaging" && (
              <div className="mt-6 rounded-2xl border border-[#D4AF37]/25 bg-[#FFF9F2] px-5 py-4">
                <p className="text-xs font-bold text-[#171717]">Decorative Material</p>
                <p className="mt-1 text-xs leading-5 text-black/45">
                  This component can be selected as ribbon, flower, bow, tag or other finishing material. Its price and stock are validated, but it does not consume hamper volume, weight, item-count or packing-fit capacity.
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <CheckField
                label="Can be used in hampers"
                checked={form.hamperUse}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,

                    hamperUse: checked,

                    customerSelectable:
                      checked
                        ? current.customerSelectable
                        : false,
                  }))
                }
              />

              <CheckField
                label={
                  form.hamperRole === "decoration"
                    ? "Available as custom hamper decoration"
                    : "Available in custom hamper builder"
                }
                checked={
                  form.type === "packaging"
                    ? false
                    : form.customerSelectable
                }
                disabled={
                  form.type === "packaging" ||
                  !form.hamperUse
                }
                onChange={(checked) =>
                  setForm({
                    ...form,
                    customerSelectable:
                      checked,
                  })
                }
              />

              <CheckField
                label="Active"
                checked={form.isActive}
                onChange={(checked) =>
                  setForm({
                    ...form,
                    isActive: checked,
                  })
                }
              />
            </div>
          </FormSection>

          <FormSection
            number="08"
            title="Internal Notes"
            description="Admin-only operational notes."
            last
          >
            <TextArea
              label="Notes"
              rows="3"
              value={form.internalNotes}
              onChange={(value) =>
                setForm({
                  ...form,
                  internalNotes: value,
                })
              }
            />
          </FormSection>
        </div>

        <div className="flex justify-end border-t border-black/[0.06] bg-[#FAFAF9] px-6 py-5 lg:px-8">
          <button
            type="submit"
            disabled={saving}
            className="min-w-[190px] rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Component"
                : "Create Component"}
          </button>
        </div>
      </form>

      <section className="mt-7 overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
        <div className="border-b border-black/[0.06] px-6 py-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#171717]">
                Component Library
              </h2>

              <p className="mt-1 text-sm text-black/40">
                Search, inspect and edit all component records.
              </p>
            </div>

            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#F97316]">
              {components.length} shown
            </span>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadComponents();
            }}
            className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(300px,1fr)_180px_220px_auto]"
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search name, code, SKU or brand"
              className={filterInputClass}
            />

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
              className={filterInputClass}
            >
              <option value="">
                All types
              </option>
              <option value="food">
                Food
              </option>
              <option value="non_food">
                Non-food
              </option>
              <option value="packaging">
                Packaging
              </option>
            </select>

            <input
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              placeholder="Category"
              className={filterInputClass}
            />

            <button className="rounded-xl bg-[#171717] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#F97316]">
              Apply Filter
            </button>
          </form>
        </div>

        {loading ? (
          <StateMessage>
            Loading components...
          </StateMessage>
        ) : components.length === 0 ? (
          <StateMessage>
            No components found.
          </StateMessage>
        ) : (
          <div className="divide-y divide-black/[0.05]">
            {components.map(
              (component) => (
                <div
                  key={component._id}
                  className="px-5 py-5 transition hover:bg-[#FFF9F2]/45 lg:px-7"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 gap-4">
                      {component.images?.[0]
                        ?.url ? (
                        <img
                          src={
                            component
                              .images[0].url
                          }
                          alt={
                            component.name
                          }
                          className="h-20 w-20 shrink-0 rounded-2xl border border-black/[0.06] object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#FAFAF9] text-[9px] font-bold uppercase text-black/20">
                          No Image
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-[#171717]">
                            {component.name}
                          </h3>

                          <Badge>
                            {String(
                              component.type
                            ).replace(
                              "_",
                              " "
                            )}
                          </Badge>

                          {component.customerSelectable && (
                            <Badge orange>
                              Custom Builder
                            </Badge>
                          )}

                          {component.source
                            ?.type &&
                            component.source
                              .type !==
                              "manual" && (
                              <Badge gold>
                                Synced
                              </Badge>
                            )}
                        </div>

                        <p className="mt-2 text-xs font-medium text-black/45">
                          {component.code}

                          {component.source
                            ?.externalSku
                            ? ` · Master ${component.source.externalSku}`
                            : ""}

                          {component.category
                            ? ` · ${component.category}`
                            : ""}

                          {component.subcategory
                            ? ` / ${component.subcategory}`
                            : ""}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <InfoPill>
                            {
                              component
                                .dimensions
                                ?.length ??
                              "-"
                            }{" "}
                            ×{" "}
                            {
                              component
                                .dimensions
                                ?.width ??
                              "-"
                            }{" "}
                            ×{" "}
                            {
                              component
                                .dimensions
                                ?.height ??
                              "-"
                            }{" "}
                            {component
                              .dimensions
                              ?.unit || ""}
                          </InfoPill>

                          <InfoPill>
                            {
                              component
                                .weight?.value ??
                              "-"
                            }{" "}
                            {component.weight
                              ?.unit || ""}
                          </InfoPill>

                          {component.hamperRole === "decoration" && (
                            <InfoPill>
                              Decorative Material · No Capacity
                            </InfoPill>
                          )}

                          <InfoPill>
                            {String(
                              component
                                .availability
                                ?.status ||
                                "in_stock"
                            ).replaceAll(
                              "_",
                              " "
                            )}
                          </InfoPill>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 xl:justify-end">
                      <div className="text-left xl:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/30">
                          Selling Price
                        </p>

                        <p className="mt-1 font-bold text-[#F97316]">
                          {component.sellingPrice !==
                            null &&
                          component.sellingPrice !==
                            undefined
                            ? formatCurrency(
                                component.sellingPrice
                              )
                            : "Not set"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            editComponent(
                              component
                            )
                          }
                          className="rounded-lg border border-black/10 px-3.5 py-2 text-xs font-bold text-black/60 transition hover:border-[#F97316] hover:text-[#F97316]"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeComponent(
                              component._id
                            )
                          }
                          className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
};

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm text-[#171717] outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100 disabled:bg-black/[0.03] disabled:text-black/35";

const filterInputClass =
  "w-full rounded-xl border border-black/[0.08] bg-[#FAFAF9] px-4 py-3 text-sm outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:bg-white";

const PageHeader = ({
  eyebrow,
  title,
  description,
  stats,
}) => (
  <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#F97316]" />

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F97316]">
          {eyebrow}
        </p>
      </div>

      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#171717] sm:text-4xl">
        {title}
      </h1>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
        {description}
      </p>
    </div>

    <div className="flex gap-3">
      {stats.map(
        ([label, value]) => (
          <div
            key={label}
            className="min-w-[90px] rounded-2xl border border-black/[0.06] bg-white px-4 py-3"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-black/35">
              {label}
            </p>

            <p className="mt-1 text-xl font-bold text-[#171717]">
              {value}
            </p>
          </div>
        )
      )}
    </div>
  </header>
);

const FormSection = ({
  number,
  title,
  description,
  children,
  last = false,
}) => (
  <section
    className={`py-7 lg:py-8 ${
      last
        ? ""
        : "border-b border-black/[0.06]"
    }`}
  >
    <div className="mb-5 flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF1E8] text-[10px] font-bold text-[#F97316]">
        {number}
      </span>

      <div>
        <h3 className="font-bold text-[#171717]">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-black/40">
          {description}
        </p>
      </div>
    </div>

    {children}
  </section>
);

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  max,
  placeholder = "",
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}

      {required && (
        <span className="ml-1 text-[#F97316]">
          *
        </span>
      )}
    </span>

    <input
      required={required}
      type={type}
      min={min}
      max={max}
      step={
        type === "number"
          ? "any"
          : undefined
      }
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      placeholder={placeholder}
      className={inputClass}
    />
  </label>
);

const SelectField = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
    </span>

    <select
      value={value}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className={`${inputClass} disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/35`}
    >
      {options.map((option) => {
        const [
          optionValue,
          optionLabel,
        ] = Array.isArray(option)
          ? option
          : [option, option];

        return (
          <option
            key={optionValue}
            value={optionValue}
          >
            {optionLabel}
          </option>
        );
      })}
    </select>
  </label>
);

const TextArea = ({
  label,
  value,
  onChange,
  rows = "3",
  className = "",
}) => (
  <label
    className={`block ${className}`}
  >
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
    </span>

    <textarea
      rows={rows}
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className={`${inputClass} resize-none`}
    />
  </label>
);

const CheckField = ({
  label,
  checked,
  onChange,
  disabled = false,
}) => (
  <label
    className={`flex min-h-[50px] items-center gap-3 rounded-xl border border-black/[0.06] bg-[#FAFAF9] px-4 py-3 text-sm font-medium text-black/60 ${
      disabled
        ? "cursor-not-allowed opacity-45"
        : "cursor-pointer"
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.checked)
      }
      className="h-4 w-4 accent-[#F97316]"
    />

    {label}
  </label>
);

const Badge = ({
  children,
  orange = false,
  gold = false,
}) => (
  <span
    className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
      orange
        ? "border-orange-200 bg-orange-50 text-[#F97316]"
        : gold
          ? "border-[#D4AF37]/30 bg-[#FFF9F2] text-[#8A6D15]"
          : "border-black/[0.08] bg-black/[0.035] text-black/50"
    }`}
  >
    {children}
  </span>
);

const InfoPill = ({ children }) => (
  <span className="rounded-lg bg-black/[0.035] px-2.5 py-1.5 text-[11px] capitalize text-black/45">
    {children}
  </span>
);

const StateMessage = ({
  children,
}) => (
  <div className="px-6 py-16 text-center text-sm text-black/40">
    {children}
  </div>
);

export default Components;