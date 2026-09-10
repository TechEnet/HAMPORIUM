import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api, {
  deleteCatalogImage,
  uploadCatalogImage,
} from "../../../api/api.js";

import FileUpload from "../../../components/FileUpload.jsx";
import formatCurrency from "../../../utils/formatCurrency.js";

const createEmptyForm = () => ({
  name: "",
  code: "",
  material: "",
  description: "",
  image: "",
  imagePublicId: "",

  externalSku: "",
  skuBarcode: "",
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
  leadTimeDays: "",

  outerDimensions: {
    length: "",
    width: "",
    height: "",
    unit: "cm",
  },

  innerDimensions: {
    length: "",
    width: "",
    height: "",
    unit: "cm",
  },

  maxContentWeight: {
    value: "",
    unit: "kg",
  },

  usableVolumePercent: 85,
  maxItems: 0,
  packingMaterials: [],

  productionLeadTime: {
    personalizationDays: 0,
    assemblyDays: 0,
    packingDays: 0,
  },

  defaultCourierDays: "",

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
    nextAvailableDate: "",
  },

  customerSelectable: true,
  isActive: true,
  sortOrder: 0,
  internalNotes: "",
});

const getId = (value) =>
  value?._id || value || "";

const nullableNumber = (value) =>
  value === "" || value === null
    ? null
    : Number(value);

const toInputDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
};

const Containers = () => {
  const [containers, setContainers] =
    useState([]);

  const [
    packagingComponents,
    setPackagingComponents,
  ] = useState([]);

  const [form, setForm] =
    useState(createEmptyForm);

  const [imageFile, setImageFile] =
    useState(null);

  const [editingId, setEditingId] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const activePackagingComponents =
    useMemo(
      () =>
        packagingComponents.filter(
          (component) =>
            component.type ===
              "packaging" &&
            component.isActive !== false
        ),
      [packagingComponents]
    );

  const loadPackagingComponents =
    async () => {
      const response = await api.get(
        "/catalog/admin/components?type=packaging&isActive=true&limit=100"
      );

      setPackagingComponents(
        response.data.components || []
      );
    };

  const loadContainers = async () => {
    setLoading(true);
    setError("");

    try {
      const params =
        new URLSearchParams({
          limit: "100",
        });

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      if (categoryFilter.trim()) {
        params.set(
          "category",
          categoryFilter.trim()
        );
      }

      const response = await api.get(
        `/catalog/admin/containers?${params.toString()}`
      );

      setContainers(
        response.data.containers || []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to load containers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      loadContainers(),
      loadPackagingComponents(),
    ]).catch((requestError) => {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to load container options"
      );
    });
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

  const changeLeadTime = (
    field,
    value
  ) =>
    updateNested(
      "productionLeadTime",
      field,
      value
    );

  const addPackingMaterial = () => {
    setForm((current) => ({
      ...current,

      packingMaterials: [
        ...current.packingMaterials,
        {
          component: "",
          quantity: 1,
          unit: "pc",
          specification: "",
          notes: "",
        },
      ],
    }));
  };

  const updatePackingMaterial = (
    index,
    field,
    value
  ) => {
    setForm((current) => ({
      ...current,

      packingMaterials:
        current.packingMaterials.map(
          (item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  [field]: value,
                }
              : item
        ),
    }));
  };

  const removePackingMaterial = (
    index
  ) => {
    setForm((current) => ({
      ...current,

      packingMaterials:
        current.packingMaterials.filter(
          (_, itemIndex) =>
            itemIndex !== index
        ),
    }));
  };

  const saveContainer = async (
    event
  ) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    let uploadedImage = null;
    let saved = false;

    const oldPublicId =
      form.imagePublicId;

    try {
      const invalidMaterial =
        form.packingMaterials.some(
          (item) =>
            !item.component ||
            Number(item.quantity) <= 0
        );

      if (invalidMaterial) {
        throw new Error(
          "Select a valid packaging component and quantity for every packing material row"
        );
      }

      if (imageFile) {
        uploadedImage =
          await uploadCatalogImage(
            imageFile,
            "container"
          );
      }

      const imageUrl =
        uploadedImage?.url ||
        form.image;

      const imagePublicId =
        uploadedImage?.publicId ||
        form.imagePublicId;

      const customerSelectable =
        form.hamperUse
          ? form.customerSelectable
          : false;

      const payload = {
        name: form.name,
        code: form.code,
        material: form.material,
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
          externalSku:
            form.externalSku,
        },

        skuBarcode:
          form.skuBarcode,

        sourceProductType:
          form.sourceProductType,

        taxonomyBaseId:
          form.taxonomyBaseId,

        categoryCode:
          form.categoryCode,

        category:
          form.category,

        subcategory:
          form.subcategory,

        segment:
          form.segment,

        productPriority:
          nullableNumber(
            form.productPriority
          ),

        mrp:
          nullableNumber(form.mrp),

        sellingPrice:
          nullableNumber(
            form.sellingPrice
          ),

        latestUnitCost:
          nullableNumber(
            form.latestUnitCost
          ),

        actualLandedCost:
          nullableNumber(
            form.actualLandedCost
          ),

        taxEnabled: Boolean(form.taxEnabled),

        taxPercent:
          form.taxEnabled
            ? nullableNumber(form.taxPercent) ?? 0
            : 0,

        hsnSac:
          form.hsnSac,

        discount: {
          enabled: Boolean(form.discount?.enabled),
          type: form.discount?.type || "percentage",
          value: Number(form.discount?.value || 0),
        },

        pricingSource: "manual",
        taxSource: "manual",

        leadTimeDays:
          nullableNumber(
            form.leadTimeDays
          ),

        outerDimensions: {
          length: Number(
            form.outerDimensions.length
          ),

          width: Number(
            form.outerDimensions.width
          ),

          height: Number(
            form.outerDimensions.height
          ),

          unit:
            form.outerDimensions.unit,
        },

        innerDimensions: {
          length: Number(
            form.innerDimensions.length
          ),

          width: Number(
            form.innerDimensions.width
          ),

          height: Number(
            form.innerDimensions.height
          ),

          unit:
            form.innerDimensions.unit,
        },

        maxContentWeight: {
          value: Number(
            form.maxContentWeight.value
          ),

          unit:
            form.maxContentWeight.unit,
        },

        usableVolumePercent:
          Number(
            form.usableVolumePercent
          ),

        maxItems:
          Number(form.maxItems || 0),

        packingMaterials:
          form.packingMaterials.map(
            (item) => ({
              component:
                item.component,

              quantity:
                Number(
                  item.quantity
                ),

              unit:
                item.unit || "pc",

              specification:
                item.specification ||
                "",

              notes:
                item.notes || "",
            })
          ),

        productionLeadTime: {
          personalizationDays:
            Number(
              form.productionLeadTime
                .personalizationDays ||
                0
            ),

          assemblyDays:
            Number(
              form.productionLeadTime
                .assemblyDays || 0
            ),

          packingDays:
            Number(
              form.productionLeadTime
                .packingDays || 0
            ),
        },

        defaultCourierDays:
          nullableNumber(
            form.defaultCourierDays
          ),

        hamperUse:
          form.hamperUse,

        channels:
          form.channels,

        availability: {
          status:
            form.availability.status,

          availableQuantity:
            nullableNumber(
              form.availability
                .availableQuantity
            ),

          nextAvailableDate:
            form.availability.status ===
            "incoming"
              ? form.availability
                  .nextAvailableDate
              : null,
        },

        customerSelectable,
        isActive:
          form.isActive,

        sortOrder:
          Number(
            form.sortOrder || 0
          ),

        internalNotes:
          form.internalNotes,
      };

      if (editingId) {
        await api.patch(
          `/catalog/admin/containers/${editingId}`,
          payload
        );
      } else {
        await api.post(
          "/catalog/admin/containers",
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
            "Old container image cleanup failed:",
            cleanupError
          );
        }
      }

      resetForm();
      await loadContainers();
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
        requestError.response?.data
          ?.message ||
          requestError.message ||
          "Unable to save container"
      );
    } finally {
      setSaving(false);
    }
  };

  const editContainer = (
    container
  ) => {
    setEditingId(container._id);
    setImageFile(null);

    setForm({
      name:
        container.name || "",

      code:
        container.code || "",

      material:
        container.material || "",

      description:
        container.description || "",

      image:
        container.images?.[0]?.url ||
        "",

      imagePublicId:
        container.images?.[0]
          ?.publicId || "",

      externalSku:
        container.source
          ?.externalSku || "",

      skuBarcode:
        container.skuBarcode || "",

      sourceProductType:
        container.sourceProductType ||
        "",

      taxonomyBaseId:
        container.taxonomyBaseId || "",

      categoryCode:
        container.categoryCode || "",

      category:
        container.category || "",

      subcategory:
        container.subcategory || "",

      segment:
        container.segment || "",

      productPriority:
        container.productPriority ??
        "",

      mrp:
        container.mrp ?? "",

      sellingPrice:
        container.sellingPrice ?? "",

      latestUnitCost:
        container.latestUnitCost ??
        "",

      actualLandedCost:
        container.actualLandedCost ??
        "",

      taxEnabled: container.taxEnabled !== false,

      taxPercent:
        container.taxPercent ?? 0,

      hsnSac:
        container.hsnSac || "",

      discount: {
        enabled: Boolean(container.discount?.enabled),
        type: container.discount?.type || "percentage",
        value: container.discount?.value ?? 0,
      },

      leadTimeDays:
        container.leadTimeDays ?? "",

      outerDimensions: {
        length:
          container.outerDimensions
            ?.length ?? "",

        width:
          container.outerDimensions
            ?.width ?? "",

        height:
          container.outerDimensions
            ?.height ?? "",

        unit:
          container.outerDimensions
            ?.unit || "cm",
      },

      innerDimensions: {
        length:
          container.innerDimensions
            ?.length ?? "",

        width:
          container.innerDimensions
            ?.width ?? "",

        height:
          container.innerDimensions
            ?.height ?? "",

        unit:
          container.innerDimensions
            ?.unit || "cm",
      },

      maxContentWeight: {
        value:
          container.maxContentWeight
            ?.value ?? "",

        unit:
          container.maxContentWeight
            ?.unit || "kg",
      },

      usableVolumePercent:
        container.usableVolumePercent ??
        85,

      maxItems:
        container.maxItems ?? 0,

      packingMaterials:
        Array.isArray(
          container.packingMaterials
        )
          ? container.packingMaterials.map(
              (item) => ({
                component:
                  getId(
                    item.component
                  ),

                quantity:
                  item.quantity ?? 1,

                unit:
                  item.unit || "pc",

                specification:
                  item.specification ||
                  "",

                notes:
                  item.notes || "",
              })
            )
          : [],

      productionLeadTime: {
        personalizationDays:
          container.productionLeadTime
            ?.personalizationDays ??
          0,

        assemblyDays:
          container.productionLeadTime
            ?.assemblyDays ?? 0,

        packingDays:
          container.productionLeadTime
            ?.packingDays ?? 0,
      },

      defaultCourierDays:
        container.defaultCourierDays ??
        "",

      hamperUse:
        container.hamperUse !== false,

      channels: {
        corporate:
          Boolean(
            container.channels
              ?.corporate
          ),

        wedding:
          Boolean(
            container.channels?.wedding
          ),

        diwali:
          Boolean(
            container.channels?.diwali
          ),

        hamperOne:
          Boolean(
            container.channels
              ?.hamperOne
          ),
      },

      availability: {
        status:
          container.availability
            ?.status || "in_stock",

        availableQuantity:
          container.availability
            ?.availableQuantity ?? "",

        nextAvailableDate:
          toInputDate(
            container.availability
              ?.nextAvailableDate
          ),
      },

      customerSelectable:
        container.customerSelectable !==
        false,

      isActive:
        container.isActive !== false,

      sortOrder:
        container.sortOrder ?? 0,

      internalNotes:
        container.internalNotes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const removeContainer = async (
    containerId
  ) => {
    if (
      !window.confirm(
        "Delete this container?"
      )
    )
      return;

    setError("");

    try {
      await api.delete(
        `/catalog/admin/containers/${containerId}`
      );

      await loadContainers();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to delete container"
      );
    }
  };

  const customRequiresPrice =
    form.hamperUse &&
    form.customerSelectable;

  const customCount =
    containers.filter(
      (container) =>
        container.customerSelectable
    ).length;

  return (
    <div className="mx-auto w-full max-w-[1600px] pb-12">
      <PageHeader
        eyebrow="Packaging Master"
        title="Containers"
        description="Manage physical hamper boxes, true inner dimensions, capacity limits and packing configuration."
        stats={[
          ["Total", containers.length],
          ["Custom", customCount],
        ]}
      />

      {error && (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={saveContainer}
        className="mt-7 overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FFF9F2] px-6 py-5 lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F97316]">
              {editingId
                ? "Editing Container"
                : "Container Editor"}
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#171717]">
              {editingId
                ? "Update Container"
                : "Add New Container"}
            </h2>

            <p className="mt-1 text-sm text-black/45">
              Configure all box details in one continuous form.
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
            title="Basic Container"
            description="Core identity and Product Master reference."
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

              <Field
                label="Material"
                value={form.material}
                onChange={(value) =>
                  setForm({
                    ...form,
                    material: value,
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

              <Field
                label="Sort Order"
                type="number"
                value={form.sortOrder}
                onChange={(value) =>
                  setForm({
                    ...form,
                    sortOrder: value,
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
                label="Container Image"
                value={form.image}
                file={imageFile}
                onFileChange={setImageFile}
              />
            </div>
          </FormSection>

          <FormSection
            number="02"
            title="Taxonomy"
            description="Internal catalogue classification."
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
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                  customRequiresPrice
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
            title="Box Dimensions"
            description="Outer dimensions describe the physical box. Inner dimensions are the true usable capacity used by the fit engine."
          >
            <div className="grid gap-7 xl:grid-cols-2">
              <DimensionGroup
                title="Outer Dimensions"
                value={
                  form.outerDimensions
                }
                onChange={(field, value) =>
                  updateNested(
                    "outerDimensions",
                    field,
                    value
                  )
                }
              />

              <DimensionGroup
                title="Inner Dimensions"
                important
                value={
                  form.innerDimensions
                }
                onChange={(field, value) =>
                  updateNested(
                    "innerDimensions",
                    field,
                    value
                  )
                }
              />
            </div>
          </FormSection>

          <FormSection
            number="05"
            title="Capacity"
            description="Operational limits used when validating custom and ready-made hamper contents."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Max Content Weight"
                type="number"
                min="0.001"
                required
                value={
                  form.maxContentWeight
                    .value
                }
                onChange={(value) =>
                  updateNested(
                    "maxContentWeight",
                    "value",
                    value
                  )
                }
              />

              <SelectField
                label="Weight Unit"
                value={
                  form.maxContentWeight
                    .unit
                }
                onChange={(value) =>
                  updateNested(
                    "maxContentWeight",
                    "unit",
                    value
                  )
                }
                options={[
                  "kg",
                  "g",
                ]}
              />

              <Field
                label="Usable Volume %"
                type="number"
                min="1"
                max="100"
                required
                value={
                  form.usableVolumePercent
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    usableVolumePercent:
                      value,
                  })
                }
              />

              <Field
                label="Max Items"
                type="number"
                min="0"
                value={form.maxItems}
                onChange={(value) =>
                  setForm({
                    ...form,
                    maxItems: value,
                  })
                }
                placeholder="0 = no hard limit"
              />
            </div>
          </FormSection>

          <FormSection
            number="06"
            title="Default Packing Materials"
            description="Internal packaging automatically associated with this box."
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={
                  addPackingMaterial
                }
                className="rounded-xl border border-[#D4AF37]/45 bg-[#FFF9F2] px-4 py-2.5 text-xs font-bold text-[#8A6D15] transition hover:border-[#D4AF37]"
              >
                + Add Packing Material
              </button>
            </div>

            {form.packingMaterials
              .length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-black/10 bg-[#FAFAF9] px-5 py-8 text-center text-sm text-black/40">
                No default packing materials added.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {form.packingMaterials.map(
                  (item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-black/[0.07] bg-[#FAFAF9] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">
                          Packing Material #
                          {index + 1}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            removePackingMaterial(
                              index
                            )
                          }
                          className="text-xs font-bold text-red-600"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <label className="block xl:col-span-2">
                          <span className="mb-2 block text-xs font-semibold text-black/60">
                            Packaging Component
                          </span>

                          <select
                            required
                            value={
                              item.component
                            }
                            onChange={(
                              event
                            ) =>
                              updatePackingMaterial(
                                index,
                                "component",
                                event.target
                                  .value
                              )
                            }
                            className={
                              inputClass
                            }
                          >
                            <option value="">
                              Select packaging component
                            </option>

                            {activePackagingComponents.map(
                              (
                                component
                              ) => (
                                <option
                                  key={
                                    component._id
                                  }
                                  value={
                                    component._id
                                  }
                                >
                                  {
                                    component.name
                                  }{" "}
                                  (
                                  {
                                    component.code
                                  }
                                  )
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <Field
                          label="Quantity"
                          type="number"
                          min="0.001"
                          required
                          value={
                            item.quantity
                          }
                          onChange={(
                            value
                          ) =>
                            updatePackingMaterial(
                              index,
                              "quantity",
                              value
                            )
                          }
                        />

                        <Field
                          label="Unit"
                          value={item.unit}
                          onChange={(
                            value
                          ) =>
                            updatePackingMaterial(
                              index,
                              "unit",
                              value
                            )
                          }
                        />

                        <Field
                          label="Specification"
                          value={
                            item.specification
                          }
                          onChange={(
                            value
                          ) =>
                            updatePackingMaterial(
                              index,
                              "specification",
                              value
                            )
                          }
                        />

                        <div className="md:col-span-2 xl:col-span-5">
                          <Field
                            label="Notes"
                            value={
                              item.notes
                            }
                            onChange={(
                              value
                            ) =>
                              updatePackingMaterial(
                                index,
                                "notes",
                                value
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </FormSection>

          <FormSection
            number="07"
            title="Production & Delivery"
            description="Default operational lead times for this container."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Personalization Days"
                type="number"
                min="0"
                value={
                  form.productionLeadTime
                    .personalizationDays
                }
                onChange={(value) =>
                  changeLeadTime(
                    "personalizationDays",
                    value
                  )
                }
              />

              <Field
                label="Assembly Days"
                type="number"
                min="0"
                value={
                  form.productionLeadTime
                    .assemblyDays
                }
                onChange={(value) =>
                  changeLeadTime(
                    "assemblyDays",
                    value
                  )
                }
              />

              <Field
                label="Packing Days"
                type="number"
                min="0"
                value={
                  form.productionLeadTime
                    .packingDays
                }
                onChange={(value) =>
                  changeLeadTime(
                    "packingDays",
                    value
                  )
                }
              />

              <Field
                label="Default Courier Days"
                type="number"
                min="0"
                max="60"
                value={
                  form.defaultCourierDays
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    defaultCourierDays:
                      value,
                  })
                }
                placeholder="Optional"
              />
            </div>
          </FormSection>

          <FormSection
            number="08"
            title="Channels & Availability"
            description="Control where the box can be used and its stock status."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Availability Status"
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
          </FormSection>

          <FormSection
            number="09"
            title="Hamper Usage"
            description="Final visibility and custom-builder controls."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <CheckField
                label="Can be used for hampers"
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
                label="Available in custom hamper builder"
                checked={
                  form.customerSelectable
                }
                disabled={!form.hamperUse}
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
            number="10"
            title="Internal Notes"
            description="Admin-only notes and operational comments."
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
                ? "Update Container"
                : "Create Container"}
          </button>
        </div>
      </form>

      <section className="mt-7 overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
        <div className="border-b border-black/[0.06] px-6 py-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#171717]">
                Container Library
              </h2>

              <p className="mt-1 text-sm text-black/40">
                Browse and manage all available hamper boxes.
              </p>
            </div>

            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#F97316]">
              {containers.length} shown
            </span>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadContainers();
            }}
            className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(300px,1fr)_240px_auto]"
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search name, code, SKU or material"
              className={filterInputClass}
            />

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
            Loading containers...
          </StateMessage>
        ) : containers.length === 0 ? (
          <StateMessage>
            No containers found.
          </StateMessage>
        ) : (
          <div className="divide-y divide-black/[0.05]">
            {containers.map(
              (container) => (
                <div
                  key={container._id}
                  className="px-5 py-5 transition hover:bg-[#FFF9F2]/45 lg:px-7"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 gap-4">
                      {container.images?.[0]
                        ?.url ? (
                        <img
                          src={
                            container
                              .images[0].url
                          }
                          alt={
                            container.name
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
                            {container.name}
                          </h3>

                          {container.customerSelectable && (
                            <Badge orange>
                              Custom Builder
                            </Badge>
                          )}

                          {container.source
                            ?.type &&
                            container.source
                              .type !==
                              "manual" && (
                              <Badge gold>
                                Synced
                              </Badge>
                            )}
                        </div>

                        <p className="mt-2 text-xs font-medium text-black/45">
                          {container.code}

                          {container.source
                            ?.externalSku
                            ? ` · Master ${container.source.externalSku}`
                            : ""}

                          {container.category
                            ? ` · ${container.category}`
                            : ""}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <InfoPill>
                            Inner{" "}
                            {container
                              .innerDimensions
                              ?.length ??
                              "-"}{" "}
                            ×{" "}
                            {container
                              .innerDimensions
                              ?.width ??
                              "-"}{" "}
                            ×{" "}
                            {container
                              .innerDimensions
                              ?.height ??
                              "-"}{" "}
                            {container
                              .innerDimensions
                              ?.unit || ""}
                          </InfoPill>

                          <InfoPill>
                            Max{" "}
                            {container
                              .maxContentWeight
                              ?.value ??
                              "-"}{" "}
                            {container
                              .maxContentWeight
                              ?.unit || ""}
                          </InfoPill>

                          {container.capacity && (
                            <InfoPill>
                              {
                                container
                                  .capacity
                                  .usableVolumeCm3
                              }{" "}
                              cm³ usable
                            </InfoPill>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 xl:justify-end">
                      <div className="text-left xl:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/30">
                          Selling Price
                        </p>

                        <p className="mt-1 font-bold text-[#F97316]">
                          {container.sellingPrice !==
                            null &&
                          container.sellingPrice !==
                            undefined
                            ? formatCurrency(
                                container.sellingPrice
                              )
                            : "Not set"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            editContainer(
                              container
                            )
                          }
                          className="rounded-lg border border-black/10 px-3.5 py-2 text-xs font-bold text-black/60 transition hover:border-[#F97316] hover:text-[#F97316]"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeContainer(
                              container._id
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
        <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A6D15]">
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

const DimensionGroup = ({
  title,
  value,
  onChange,
  important = false,
}) => (
  <div
    className={`rounded-2xl border p-5 ${
      important
        ? "border-[#D4AF37]/35 bg-[#FFF9F2]"
        : "border-black/[0.07] bg-[#FAFAF9]"
    }`}
  >
    <div className="mb-4 flex items-center justify-between gap-3">
      <h4 className="text-sm font-bold text-[#171717]">
        {title}
      </h4>

      {important && (
        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#8A6D15]">
          Fit Engine
        </span>
      )}
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field
        label="Length"
        type="number"
        min="0.001"
        required
        value={value.length}
        onChange={(next) =>
          onChange("length", next)
        }
      />

      <Field
        label="Width"
        type="number"
        min="0.001"
        required
        value={value.width}
        onChange={(next) =>
          onChange("width", next)
        }
      />

      <Field
        label="Height"
        type="number"
        min="0.001"
        required
        value={value.height}
        onChange={(next) =>
          onChange("height", next)
        }
      />

      <SelectField
        label="Unit"
        value={value.unit}
        onChange={(next) =>
          onChange("unit", next)
        }
        options={[
          "cm",
          "mm",
        ]}
      />
    </div>
  </div>
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
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
    </span>

    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className={inputClass}
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
  <span className="rounded-lg bg-black/[0.035] px-2.5 py-1.5 text-[11px] text-black/45">
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

export default Containers;