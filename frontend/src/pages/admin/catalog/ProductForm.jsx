import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api, {
  deleteCatalogImage,
  uploadCatalogImage,
} from "../../../api/api.js";

import FileUpload from "../../../components/FileUpload.jsx";
import formatCurrency from "../../../utils/formatCurrency.js";

const emptyProduct = {
  name: "",
  shortDescription: "",
  description: "",
  brand: "HAMPORIUM",
  category: "",
  collections: [],
  tags: "",
  image: "",
  imagePublicId: "",
  status: "draft",
  isFeatured: false,
};

const createEmptySku = () => ({
  code: "",
  name: "",
  baseSellingPrice: "",
  mrp: "",
  taxEnabled: true,
  taxPercent: "18",
  hsnSac: "",
  discount: {
    enabled: false,
    type: "percentage",
    value: "0",
  },
  price: "",
  compareAtPrice: "",
  size: "",
  image: "",
  imagePublicId: "",
  container: "",
  hamperContents: [],
  internalMaterials: [],
  productionLeadTime: {
    personalizationDays: 0,
    assemblyDays: 0,
    packingDays: 0,
  },
  defaultCourierDays: "",
  sortOrder: 0,
  isActive: true,
});

const getId = (value) => value?._id || value || "";

const roundMoney = (value) =>
  Math.round(Number(value || 0) * 100) / 100;

const calculateSkuPricePreview = (sku) => {
  const base = Number(sku?.baseSellingPrice || 0);
  const discountEnabled = Boolean(sku?.discount?.enabled);
  const discountValue = Number(sku?.discount?.value || 0);
  const discountType = sku?.discount?.type || "percentage";

  let discountAmount = 0;

  if (discountEnabled && discountValue > 0) {
    discountAmount =
      discountType === "fixed"
        ? Math.min(base, discountValue)
        : Math.min(base, (base * discountValue) / 100);
  }

  const taxableValue = Math.max(0, base - discountAmount);
  const taxRate = sku?.taxEnabled === false ? 0 : Number(sku?.taxPercent || 0);
  const taxAmount = (taxableValue * taxRate) / 100;

  return {
    base: roundMoney(base),
    discountAmount: roundMoney(discountAmount),
    taxableValue: roundMoney(taxableValue),
    taxAmount: roundMoney(taxAmount),
    finalPrice: roundMoney(taxableValue + taxAmount),
  };
};

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const ProductForm = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const editing = Boolean(productId);

  const [form, setForm] = useState(emptyProduct);
  const [productImageFile, setProductImageFile] = useState(null);

  const [skuForm, setSkuForm] = useState(createEmptySku);
  const [skuImageFile, setSkuImageFile] = useState(null);

  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [containers, setContainers] = useState([]);
  const [components, setComponents] = useState([]);
  const [skus, setSkus] = useState([]);

  const [editingSkuId, setEditingSkuId] = useState(null);

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingSku, setSavingSku] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [error, setError] = useState("");

  const customerComponents = useMemo(
    () =>
      components.filter(
        (component) =>
          component.type !== "packaging" &&
          (component.hamperRole || "content") !== "decoration" &&
          component.isActive !== false
      ),
    [components]
  );

  const packagingComponents = useMemo(
    () =>
      components.filter(
        (component) =>
          component.type === "packaging" &&
          component.isActive !== false
      ),
    [components]
  );

  const activeContainers = useMemo(
    () =>
      containers.filter(
        (container) => container.isActive !== false
      ),
    [containers]
  );

  const loadProduct = async () => {
    if (!productId) return;

    const response = await api.get(
      `/catalog/admin/products/${productId}`
    );

    const product = response.data.product;

    setForm({
      name: product.name || "",
      shortDescription: product.shortDescription || "",
      description: product.description || "",
      brand: product.brand || "HAMPORIUM",
      category: product.category?._id || "",
      collections:
        product.collections?.map((item) => item._id) || [],
      tags: product.tags?.join(", ") || "",
      image: product.images?.[0]?.url || "",
      imagePublicId: product.images?.[0]?.publicId || "",
      status: product.status || "draft",
      isFeatured: Boolean(product.isFeatured),
    });

    setProductImageFile(null);
    setSkus(product.skus || []);
  };

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      setError("");

      try {
        const [
          categoryResponse,
          collectionResponse,
          containerResponse,
          componentResponse,
        ] = await Promise.all([
          api.get("/catalog/admin/categories"),
          api.get("/catalog/admin/collections"),
          api.get("/catalog/admin/containers?limit=100"),
          api.get("/catalog/admin/components?limit=100"),
        ]);

        setCategories(categoryResponse.data.categories || []);
        setCollections(collectionResponse.data.collections || []);
        setContainers(containerResponse.data.containers || []);
        setComponents(componentResponse.data.components || []);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load catalogue options"
        );
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  useEffect(() => {
    if (!editing) return;

    loadProduct().catch((requestError) => {
      setError(
        requestError.response?.data?.message ||
          "Unable to load product"
      );
    });
  }, [productId, editing]);

  const changeCollection = (id) => {
    setForm((current) => ({
      ...current,
      collections: current.collections.includes(id)
        ? current.collections.filter((item) => item !== id)
        : [...current.collections, id],
    }));
  };

  const saveProduct = async (event) => {
    event.preventDefault();

    setSavingProduct(true);
    setError("");

    let uploadedImage = null;
    let productSaved = false;

    const oldPublicId = form.imagePublicId;

    try {
      if (productImageFile) {
        uploadedImage = await uploadCatalogImage(
          productImageFile,
          "product"
        );
      }

      const imageUrl = uploadedImage?.url || form.image;
      const imagePublicId =
        uploadedImage?.publicId || form.imagePublicId;

      const payload = {
        name: form.name,
        shortDescription: form.shortDescription,
        description: form.description,
        brand: form.brand,
        category: form.category,
        collections: form.collections,

        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),

        images: imageUrl
          ? [
              {
                url: imageUrl,
                publicId: imagePublicId,
                alt: form.name,
              },
            ]
          : [],

        status: form.status,
        isFeatured: form.isFeatured,
      };

      if (editing) {
        await api.patch(
          `/catalog/admin/products/${productId}`,
          payload
        );

        productSaved = true;

        if (
          uploadedImage &&
          oldPublicId &&
          oldPublicId !== uploadedImage.publicId
        ) {
          try {
            await deleteCatalogImage(oldPublicId);
          } catch (cleanupError) {
            console.error(
              "Old product image cleanup failed:",
              cleanupError
            );
          }
        }

        setProductImageFile(null);
        await loadProduct();
      } else {
        const response = await api.post(
          "/catalog/admin/products",
          payload
        );

        productSaved = true;

        navigate(
          `/admin/catalog/products/${response.data.product._id}/edit`,
          { replace: true }
        );
      }
    } catch (requestError) {
      if (uploadedImage && !productSaved) {
        try {
          await deleteCatalogImage(uploadedImage.publicId);
        } catch {
          // Ignore rollback cleanup error.
        }
      }

      setError(
        requestError.response?.data?.message ||
          "Unable to save product"
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const resetSkuForm = () => {
    setSkuForm(createEmptySku());
    setSkuImageFile(null);
    setEditingSkuId(null);
  };

  const addHamperContent = () => {
    setSkuForm((current) => ({
      ...current,
      hamperContents: [
        ...current.hamperContents,
        {
          component: "",
          quantity: 1,
          unit: "pc",
          displayName: "",
          isOptional: false,
        },
      ],
    }));
  };

  const updateHamperContent = (index, field, value) => {
    setSkuForm((current) => ({
      ...current,
      hamperContents: current.hamperContents.map(
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

  const removeHamperContent = (index) => {
    setSkuForm((current) => ({
      ...current,
      hamperContents: current.hamperContents.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const addInternalMaterial = () => {
    setSkuForm((current) => ({
      ...current,
      internalMaterials: [
        ...current.internalMaterials,
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

  const updateInternalMaterial = (index, field, value) => {
    setSkuForm((current) => ({
      ...current,
      internalMaterials: current.internalMaterials.map(
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

  const removeInternalMaterial = (index) => {
    setSkuForm((current) => ({
      ...current,
      internalMaterials: current.internalMaterials.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const changeLeadTime = (field, value) => {
    setSkuForm((current) => ({
      ...current,
      productionLeadTime: {
        ...current.productionLeadTime,
        [field]: value,
      },
    }));
  };

  const saveSku = async (event) => {
    event.preventDefault();

    setSavingSku(true);
    setError("");

    let uploadedImage = null;
    let skuSaved = false;

    const oldPublicId = skuForm.imagePublicId;

    try {
      if (skuImageFile) {
        uploadedImage = await uploadCatalogImage(
          skuImageFile,
          "sku"
        );
      }

      const imageUrl =
        uploadedImage?.url || skuForm.image;

      const imagePublicId =
        uploadedImage?.publicId ||
        skuForm.imagePublicId;

      const invalidContent =
        skuForm.hamperContents.some(
          (item) =>
            !item.component ||
            Number(item.quantity) <= 0
        );

      if (invalidContent) {
        throw new Error(
          "Select a valid component and quantity for every hamper content row"
        );
      }

      const invalidMaterial =
        skuForm.internalMaterials.some(
          (item) =>
            !item.component ||
            Number(item.quantity) <= 0
        );

      if (invalidMaterial) {
        throw new Error(
          "Select a valid packaging component and quantity for every internal material row"
        );
      }

      const pricingPreview = calculateSkuPricePreview(skuForm);
      const parsedMrp =
        skuForm.mrp === "" ? null : Number(skuForm.mrp);

      const payload = {
        code: skuForm.code,
        name: skuForm.name,
        baseSellingPrice: Number(skuForm.baseSellingPrice),
        mrp: parsedMrp,
        taxEnabled: Boolean(skuForm.taxEnabled),
        taxPercent: skuForm.taxEnabled ? Number(skuForm.taxPercent || 0) : 0,
        hsnSac: String(skuForm.hsnSac || "").trim(),
        discount: {
          enabled: Boolean(skuForm.discount?.enabled),
          type: skuForm.discount?.type || "percentage",
          value: Number(skuForm.discount?.value || 0),
        },
        pricingSource: "manual",
        taxSource: "manual",
        compareAtPrice:
          parsedMrp !== null && parsedMrp > pricingPreview.finalPrice
            ? parsedMrp
            : null,

        optionValues: skuForm.size
          ? {
              size: skuForm.size,
            }
          : {},

        images: imageUrl
          ? [
              {
                url: imageUrl,
                publicId: imagePublicId,
                alt: skuForm.name,
              },
            ]
          : [],

        container:
          skuForm.container || null,

        hamperContents:
          skuForm.hamperContents.map(
            (item, index) => ({
              component: item.component,
              quantity: Number(item.quantity),
              unit: item.unit || "pc",
              displayName:
                item.displayName || "",
              sortOrder: index,
              isOptional:
                Boolean(item.isOptional),
            })
          ),

        internalMaterials:
          skuForm.internalMaterials.map(
            (item) => ({
              component: item.component,
              quantity: Number(item.quantity),
              unit: item.unit || "pc",
              specification:
                item.specification || "",
              notes: item.notes || "",
            })
          ),

        productionLeadTime: {
          personalizationDays:
            Number(
              skuForm.productionLeadTime
                .personalizationDays || 0
            ),

          assemblyDays:
            Number(
              skuForm.productionLeadTime
                .assemblyDays || 0
            ),

          packingDays:
            Number(
              skuForm.productionLeadTime
                .packingDays || 0
            ),
        },

        defaultCourierDays:
          skuForm.defaultCourierDays === ""
            ? null
            : Number(
                skuForm.defaultCourierDays
              ),

        sortOrder:
          Number(skuForm.sortOrder || 0),

        isActive: skuForm.isActive,
      };

      if (editingSkuId) {
        await api.patch(
          `/catalog/admin/skus/${editingSkuId}`,
          payload
        );
      } else {
        await api.post(
          `/catalog/admin/products/${productId}/skus`,
          payload
        );
      }

      skuSaved = true;

      if (
        uploadedImage &&
        oldPublicId &&
        oldPublicId !== uploadedImage.publicId
      ) {
        try {
          await deleteCatalogImage(oldPublicId);
        } catch (cleanupError) {
          console.error(
            "Old SKU image cleanup failed:",
            cleanupError
          );
        }
      }

      resetSkuForm();
      await loadProduct();
    } catch (requestError) {
      if (uploadedImage && !skuSaved) {
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
          "Unable to save SKU"
      );
    } finally {
      setSavingSku(false);
    }
  };

  const editSku = (sku) => {
    setEditingSkuId(sku._id);
    setSkuImageFile(null);

    setSkuForm({
      code: sku.code || "",
      name: sku.name || "",
      baseSellingPrice: sku.baseSellingPrice ?? sku.price ?? "",
      mrp: sku.mrp ?? sku.compareAtPrice ?? "",
      taxEnabled: sku.taxEnabled !== false,
      taxPercent: sku.taxPercent ?? 0,
      hsnSac: sku.hsnSac || "",
      discount: {
        enabled: Boolean(sku.discount?.enabled),
        type: sku.discount?.type || "percentage",
        value: sku.discount?.value ?? 0,
      },
      price: sku.price ?? "",
      compareAtPrice: sku.compareAtPrice ?? "",
      size:
        sku.optionValues?.size || "",
      image:
        sku.images?.[0]?.url || "",
      imagePublicId:
        sku.images?.[0]?.publicId || "",

      container:
        getId(sku.container),

      hamperContents:
        Array.isArray(
          sku.hamperContents
        )
          ? sku.hamperContents.map(
              (item) => ({
                component:
                  getId(
                    item.component
                  ),
                quantity:
                  item.quantity ?? 1,
                unit:
                  item.unit || "pc",
                displayName:
                  item.displayName ||
                  "",
                isOptional:
                  Boolean(
                    item.isOptional
                  ),
              })
            )
          : [],

      internalMaterials:
        Array.isArray(
          sku.internalMaterials
        )
          ? sku.internalMaterials.map(
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
          sku.productionLeadTime
            ?.personalizationDays ??
          0,

        assemblyDays:
          sku.productionLeadTime
            ?.assemblyDays ??
          0,

        packingDays:
          sku.productionLeadTime
            ?.packingDays ??
          0,
      },

      defaultCourierDays:
        sku.defaultCourierDays ??
        "",

      sortOrder:
        sku.sortOrder ?? 0,

      isActive:
        sku.isActive !== false,
    });

    window.scrollTo({
      top:
        document.body.scrollHeight,
      behavior: "smooth",
    });
  };

  const removeSku = async (skuId) => {
    if (!window.confirm("Delete this SKU?")) {
      return;
    }

    try {
      await api.delete(
        `/catalog/admin/skus/${skuId}`
      );

      await loadProduct();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to delete SKU"
      );
    }
  };

  return (
    <div className="pb-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#F97316]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F97316]">
              Catalogue Product
            </p>
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#171717] sm:text-4xl">
            {editing ? "Edit Product" : "New Product"}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
            Manage storefront information first, then configure its sellable
            hamper SKU, box, contents and internal packaging.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate(
              "/admin/catalog/products"
            )
          }
          className="rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/60 transition hover:border-[#F97316] hover:text-[#F97316]"
        >
          ← Back to Products
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={saveProduct}
        className="mt-8 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.05)]"
      >
        <div className="border-b border-black/[0.06] bg-[#FFF9F2] px-5 py-5 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F97316]">
            Step 1
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#171717]">
            Product Information
          </h2>
          <p className="mt-1 text-xs text-black/40">
            Customer-facing product identity and merchandising settings.
          </p>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <Field
              label="Product Name"
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
              label="Short Description"
              value={form.shortDescription}
              onChange={(value) =>
                setForm({
                  ...form,
                  shortDescription: value,
                })
              }
            />

            <TextArea
              label="Description"
              rows="5"
              value={form.description}
              onChange={(value) =>
                setForm({
                  ...form,
                  description: value,
                })
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
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

              <SelectNative
                label="Category"
                required
                disabled={loadingOptions}
                value={form.category}
                onChange={(value) =>
                  setForm({
                    ...form,
                    category: value,
                  })
                }
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option
                    key={category._id}
                    value={category._id}
                  >
                    {category.name}
                  </option>
                ))}
              </SelectNative>

              <SelectNative
                label="Status"
                value={form.status}
                onChange={(value) =>
                  setForm({
                    ...form,
                    status: value,
                  })
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </SelectNative>

              <Field
                label="Tags"
                value={form.tags}
                onChange={(value) =>
                  setForm({
                    ...form,
                    tags: value,
                  })
                }
                placeholder="premium, festive, hamper"
              />
            </div>

            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-black/45">
                Collections
              </p>

              {collections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/10 bg-[#FAFAF9] p-4 text-xs text-black/40">
                  No collections available.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {collections.map((collection) => (
                    <label
                      key={collection._id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition ${
                        form.collections.includes(collection._id)
                          ? "border-orange-200 bg-orange-50 text-[#F97316]"
                          : "border-black/[0.07] bg-[#FAFAF9] text-black/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.collections.includes(
                          collection._id
                        )}
                        onChange={() =>
                          changeCollection(
                            collection._id
                          )
                        }
                        className="accent-[#F97316]"
                      />
                      {collection.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#D4AF37]/25 bg-[#FFF9F2] px-4 py-3">
              <div>
                <p className="text-sm font-bold text-[#171717]">
                  Featured Product
                </p>
                <p className="mt-0.5 text-xs text-black/40">
                  Give this product priority in merchandising surfaces.
                </p>
              </div>

              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) =>
                  setForm({
                    ...form,
                    isFeatured:
                      event.target.checked,
                  })
                }
                className="h-4 w-4 accent-[#F97316]"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-[#FAFAF9] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-black/45">
              Product Media
            </p>

            <FileUpload
              label="Product Image"
              value={form.image}
              file={productImageFile}
              onFileChange={
                setProductImageFile
              }
            />

            <div className="mt-5 rounded-xl bg-white p-4 text-xs leading-5 text-black/45">
              Use a clean product hero image. The ready-made hamper SKU can also
              have its own SKU-specific image below.
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-black/[0.06] px-5 py-4 sm:px-7">
          <button
            disabled={savingProduct}
            className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:opacity-50"
          >
            {savingProduct
              ? "Saving..."
              : editing
                ? "Save Product"
                : "Create Product"}
          </button>
        </div>
      </form>

      {editing && (
        <section className="mt-10">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A6D15]">
                Sellable Configuration
              </p>
            </div>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#171717]">
              Product SKUs
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
              Configure the ready-made hamper box, customer-facing contents,
              internal BOM and delivery defaults.
            </p>
          </div>

          <form
            onSubmit={saveSku}
            className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.05)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] bg-[#171717] px-5 py-5 text-white sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#D4AF37]">
                  Step 2
                </p>
                <h3 className="mt-1 text-lg font-bold">
                  {editingSkuId ? "Edit SKU" : "Configure SKU"}
                </h3>
              </div>

              {editingSkuId && (
                <button
                  type="button"
                  onClick={resetSkuForm}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Cancel SKU Edit
                </button>
              )}
            </div>

            <div className="space-y-5 p-5 sm:p-7">
              <SkuSection
                eyebrow="Identity"
                title="SKU Basics"
              >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label="SKU Code"
                    required
                    value={skuForm.code}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        code: value,
                      })
                    }
                  />

                  <Field
                    label="SKU Name"
                    required
                    value={skuForm.name}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        name: value,
                      })
                    }
                  />

                  <Field
                    label="Size / Option"
                    value={skuForm.size}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        size: value,
                      })
                    }
                  />

                  <Field
                    label="Base Selling Price (Pre-GST)"
                    type="number"
                    min="0"
                    required
                    value={skuForm.baseSellingPrice}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        baseSellingPrice: value,
                      })
                    }
                  />

                  <Field
                    label="Retail MRP"
                    type="number"
                    min="0"
                    value={skuForm.mrp}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        mrp: value,
                      })
                    }
                  />

                  <Field
                    label="HSN / SAC"
                    value={skuForm.hsnSac}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        hsnSac: value,
                      })
                    }
                  />

                  <Field
                    label="GST %"
                    type="number"
                    min="0"
                    max="100"
                    value={skuForm.taxPercent}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        taxPercent: value,
                      })
                    }
                  />

                  <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-black/10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={skuForm.taxEnabled}
                      onChange={(event) =>
                        setSkuForm({
                          ...skuForm,
                          taxEnabled: event.target.checked,
                        })
                      }
                    />
                    <span className="text-xs font-bold text-black/60">Apply GST</span>
                  </label>

                  <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-black/10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={skuForm.discount.enabled}
                      onChange={(event) =>
                        setSkuForm({
                          ...skuForm,
                          discount: {
                            ...skuForm.discount,
                            enabled: event.target.checked,
                          },
                        })
                      }
                    />
                    <span className="text-xs font-bold text-black/60">Enable Discount</span>
                  </label>

                  {skuForm.discount.enabled && (
                    <>
                      <label>
                        <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-black/40">
                          Discount Type
                        </span>
                        <select
                          value={skuForm.discount.type}
                          onChange={(event) =>
                            setSkuForm({
                              ...skuForm,
                              discount: {
                                ...skuForm.discount,
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
                        label={skuForm.discount.type === "fixed" ? "Discount Amount" : "Discount %"}
                        type="number"
                        min="0"
                        value={skuForm.discount.value}
                        onChange={(value) =>
                          setSkuForm({
                            ...skuForm,
                            discount: {
                              ...skuForm.discount,
                              value,
                            },
                          })
                        }
                      />
                    </>
                  )}

                  <Field
                    label="Sort Order"
                    type="number"
                    value={skuForm.sortOrder}
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        sortOrder:
                          value,
                      })
                    }
                  />
                </div>

                {(() => {
                  const preview = calculateSkuPricePreview(skuForm);
                  return (
                    <div className="mt-4 grid gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#FFF9F2] p-4 sm:grid-cols-2 lg:grid-cols-4">
                      <InfoPill>Base: {formatCurrency(preview.base)}</InfoPill>
                      <InfoPill>Discount: {formatCurrency(preview.discountAmount)}</InfoPill>
                      <InfoPill>GST: {formatCurrency(preview.taxAmount)}</InfoPill>
                      <InfoPill>Customer Price: {formatCurrency(preview.finalPrice)}</InfoPill>
                    </div>
                  );
                })()}
              </SkuSection>

              <SkuSection
                eyebrow="Box"
                title="Container / Hamper Box"
                description="Select the fixed physical box used by this SKU."
              >
                <select
                  value={skuForm.container}
                  onChange={(event) =>
                    setSkuForm({
                      ...skuForm,
                      container:
                        event.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">No container</option>

                  {activeContainers.map((container) => (
                    <option
                      key={container._id}
                      value={container._id}
                    >
                      {container.name} ({container.code})
                    </option>
                  ))}
                </select>
              </SkuSection>

              <SkuSection
                eyebrow="Composition"
                title="What's Inside"
                description="Customer-facing food and non-food products."
                action={
                  <button
                    type="button"
                    onClick={addHamperContent}
                    className="rounded-xl border border-[#F97316] bg-orange-50 px-4 py-2 text-xs font-bold text-[#F97316] transition hover:bg-[#F97316] hover:text-white"
                  >
                    + Add Content
                  </button>
                }
              >
                {skuForm.hamperContents.length === 0 ? (
                  <EmptyBlock>
                    No hamper contents added.
                  </EmptyBlock>
                ) : (
                  <div className="space-y-3">
                    {skuForm.hamperContents.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-black/[0.07] bg-[#FAFAF9] p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">
                            Content #{index + 1}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              removeHamperContent(index)
                            }
                            className="text-xs font-bold text-red-600"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(240px,2fr)_110px_100px_minmax(180px,1fr)]">
                          <select
                            required
                            value={item.component}
                            onChange={(event) =>
                              updateHamperContent(
                                index,
                                "component",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          >
                            <option value="">Select item</option>

                            {customerComponents.map((component) => (
                              <option
                                key={component._id}
                                value={component._id}
                              >
                                {component.name} ({component.code})
                              </option>
                            ))}
                          </select>

                          <input
                            required
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.quantity}
                            onChange={(event) =>
                              updateHamperContent(
                                index,
                                "quantity",
                                event.target.value
                              )
                            }
                            placeholder="Qty"
                            className={inputClass}
                          />

                          <input
                            value={item.unit}
                            onChange={(event) =>
                              updateHamperContent(
                                index,
                                "unit",
                                event.target.value
                              )
                            }
                            placeholder="Unit"
                            className={inputClass}
                          />

                          <input
                            value={item.displayName}
                            onChange={(event) =>
                              updateHamperContent(
                                index,
                                "displayName",
                                event.target.value
                              )
                            }
                            placeholder="Display name (optional)"
                            className={inputClass}
                          />
                        </div>

                        <label className="mt-3 flex w-fit items-center gap-2 text-xs font-medium text-black/50">
                          <input
                            type="checkbox"
                            checked={item.isOptional}
                            onChange={(event) =>
                              updateHamperContent(
                                index,
                                "isOptional",
                                event.target.checked
                              )
                            }
                            className="accent-[#F97316]"
                          />
                          Optional content
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </SkuSection>

              <SkuSection
                eyebrow="Internal BOM"
                title="Internal Packaging"
                description="These materials remain internal and are not shown on the public product page."
                action={
                  <button
                    type="button"
                    onClick={addInternalMaterial}
                    className="rounded-xl border border-[#D4AF37]/50 bg-[#FFF9F2] px-4 py-2 text-xs font-bold text-[#8A6D15]"
                  >
                    + Add Material
                  </button>
                }
              >
                {skuForm.internalMaterials.length === 0 ? (
                  <EmptyBlock>
                    No SKU-specific internal materials added.
                  </EmptyBlock>
                ) : (
                  <div className="space-y-3">
                    {skuForm.internalMaterials.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-black/[0.07] bg-[#FAFAF9] p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">
                            Material #{index + 1}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              removeInternalMaterial(index)
                            }
                            className="text-xs font-bold text-red-600"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(220px,2fr)_110px_100px_minmax(160px,1fr)_minmax(160px,1fr)]">
                          <select
                            required
                            value={item.component}
                            onChange={(event) =>
                              updateInternalMaterial(
                                index,
                                "component",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          >
                            <option value="">
                              Select packaging
                            </option>

                            {packagingComponents.map((component) => (
                              <option
                                key={component._id}
                                value={component._id}
                              >
                                {component.name} ({component.code})
                              </option>
                            ))}
                          </select>

                          <input
                            required
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.quantity}
                            onChange={(event) =>
                              updateInternalMaterial(
                                index,
                                "quantity",
                                event.target.value
                              )
                            }
                            placeholder="Qty"
                            className={inputClass}
                          />

                          <input
                            value={item.unit}
                            onChange={(event) =>
                              updateInternalMaterial(
                                index,
                                "unit",
                                event.target.value
                              )
                            }
                            placeholder="Unit"
                            className={inputClass}
                          />

                          <input
                            value={item.specification}
                            onChange={(event) =>
                              updateInternalMaterial(
                                index,
                                "specification",
                                event.target.value
                              )
                            }
                            placeholder="Specification"
                            className={inputClass}
                          />

                          <input
                            value={item.notes}
                            onChange={(event) =>
                              updateInternalMaterial(
                                index,
                                "notes",
                                event.target.value
                              )
                            }
                            placeholder="Notes"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SkuSection>

              <SkuSection
                eyebrow="Timeline"
                title="Production & Delivery"
                description="These defaults are used by the delivery estimate engine."
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="Personalization Days"
                    type="number"
                    min="0"
                    value={
                      skuForm.productionLeadTime
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
                      skuForm.productionLeadTime
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
                      skuForm.productionLeadTime
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
                      skuForm.defaultCourierDays
                    }
                    onChange={(value) =>
                      setSkuForm({
                        ...skuForm,
                        defaultCourierDays: value,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="mt-4 rounded-xl border border-[#D4AF37]/20 bg-[#FFF9F2] px-4 py-3 text-xs leading-5 text-black/50">
                  Earliest food expiry is calculated automatically by the
                  backend from the selected hamper contents.
                </div>
              </SkuSection>

              <SkuSection eyebrow="Media" title="SKU Image">
                <FileUpload
                  label="SKU Image"
                  value={skuForm.image}
                  file={skuImageFile}
                  onFileChange={setSkuImageFile}
                />
              </SkuSection>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-black/[0.07] bg-[#FAFAF9] px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-[#171717]">
                    Active SKU
                  </p>
                  <p className="mt-0.5 text-xs text-black/40">
                    Enable this sellable configuration.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={skuForm.isActive}
                  onChange={(event) =>
                    setSkuForm({
                      ...skuForm,
                      isActive: event.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-[#F97316]"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                {editingSkuId && (
                  <button
                    type="button"
                    onClick={resetSkuForm}
                    className="rounded-xl border border-black/10 px-5 py-3 text-sm font-bold text-black/60"
                  >
                    Cancel
                  </button>
                )}

                <button
                  disabled={savingSku}
                  className="rounded-xl bg-[#171717] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:opacity-50"
                >
                  {savingSku
                    ? "Saving..."
                    : editingSkuId
                      ? "Update SKU"
                      : "Add SKU"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-6 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
            <div className="border-b border-black/[0.06] px-5 py-4">
              <h3 className="font-bold text-[#171717]">Existing SKUs</h3>
              <p className="mt-1 text-xs text-black/40">
                {skus.length} SKU{skus.length === 1 ? "" : "s"} configured
              </p>
            </div>

            {skus.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-black/40">
                No SKUs added yet.
              </div>
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {skus.map((sku) => (
                  <div
                    key={sku._id}
                    className="p-5 transition hover:bg-[#FFF9F2]/45"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 gap-4">
                        {sku.images?.[0]?.url ? (
                          <img
                            src={sku.images[0].url}
                            alt={sku.name}
                            className="h-16 w-16 shrink-0 rounded-2xl border border-black/[0.06] object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#FAFAF9] text-[9px] font-bold text-black/20">
                            SKU
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-[#171717]">
                              {sku.name}
                            </p>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${
                                sku.isActive !== false
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-black/10 bg-black/[0.04] text-black/40"
                              }`}
                            >
                              {sku.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs font-medium text-black/45">
                            {sku.code} · {formatCurrency(sku.price)}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-black/45">
                            <InfoPill>Base: {formatCurrency(sku.baseSellingPrice ?? sku.price)}</InfoPill>
                            <InfoPill>GST: {sku.taxEnabled === false ? "0" : sku.taxPercent ?? 0}%</InfoPill>
                            {sku.hsnSac && <InfoPill>HSN/SAC: {sku.hsnSac}</InfoPill>}
                            {sku.discount?.enabled && (
                              <InfoPill>
                                Discount: {sku.discount.value || 0}{sku.discount.type === "fixed" ? " INR" : "%"}
                              </InfoPill>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-black/45">
                            <InfoPill>
                              Box: {sku.container?.name || "Not set"}
                            </InfoPill>
                            <InfoPill>
                              Contents: {sku.hamperContents?.length || 0}
                            </InfoPill>
                            <InfoPill>
                              BOM: {sku.internalMaterials?.length || 0}
                            </InfoPill>

                            {sku.earliestExpiryDate && (
                              <InfoPill>
                                Earliest expiry:{" "}
                                {toInputDate(sku.earliestExpiryDate)}
                              </InfoPill>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => editSku(sku)}
                          className="rounded-lg border border-black/10 px-3.5 py-2 text-xs font-bold transition hover:border-[#F97316] hover:text-[#F97316]"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => removeSku(sku._id)}
                          className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100 disabled:bg-black/[0.03] disabled:text-black/35";

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
      {required && <span className="ml-1 text-[#F97316]">*</span>}
    </span>

    <input
      required={required}
      type={type}
      min={min}
      max={max}
      step={type === "number" ? "any" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  </label>
);

const TextArea = ({ label, value, onChange, rows }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
    </span>

    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} resize-none`}
    />
  </label>
);

const SelectNative = ({
  label,
  value,
  onChange,
  children,
  required = false,
  disabled = false,
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
      {required && <span className="ml-1 text-[#F97316]">*</span>}
    </span>

    <select
      required={required}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    >
      {children}
    </select>
  </label>
);

const SkuSection = ({
  eyebrow,
  title,
  description,
  action,
  children,
}) => (
  <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#F97316]">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-1 font-bold text-[#171717]">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-5 text-black/40">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>

    <div className="mt-4">{children}</div>
  </section>
);

const EmptyBlock = ({ children }) => (
  <div className="rounded-xl border border-dashed border-black/10 bg-[#FAFAF9] p-5 text-center text-xs text-black/40">
    {children}
  </div>
);

const InfoPill = ({ children }) => (
  <span className="rounded-lg bg-black/[0.035] px-2.5 py-1.5">
    {children}
  </span>
);

export default ProductForm;