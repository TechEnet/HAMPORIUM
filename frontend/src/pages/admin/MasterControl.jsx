import { useEffect, useMemo, useState } from "react";

import api from "../../api/api.js";

const ENTITY_TYPES = [
  { value: "product", label: "Hampers", help: "Product pages and website visibility" },
  { value: "sku", label: "Selling Options", help: "Price, contents, delivery and margin" },
  { value: "component", label: "Gift Items", help: "Items customers can add to hampers" },
  { value: "container", label: "Gift Boxes", help: "Boxes, stock, price and capacity" },
];

const PROMOTION_TYPES = [
  ["automatic_sale", "Automatic sale"],
  ["public_coupon", "Public coupon"],
  ["client_coupon", "Selected customer coupon"],
  ["customer_care", "Customer care coupon"],
  ["first_order", "First order offer"],
];

const emptyPromotion = {
  name: "",
  type: "public_coupon",
  code: "",
  status: "draft",
  discountType: "percentage",
  discountValue: "10",
  minDiscountPercent: "5",
  targetDiscountPercent: "10",
  maxDiscountPercent: "15",
  minGrossMarginPercent: "",
  minOrderValue: "0",
  maxDiscountAmount: "0",
  stackWithAutomaticSale: false,
  scopeMode: "all",
  scopeItems: [],
  audienceUsers: [],
  audienceEmails: "",
  startsAt: "",
  endsAt: "",
  priority: "0",
  customerLabel: "",
  internalNote: "",
  websiteDisplay: {
    enabled: false,
    announcementBar: false,
    homeBanner: false,
    productBadge: false,
    checkoutNote: false,
    popupAd: false,
    floatingAd: false,
    adFrequency: "once_per_session",
    adDelaySeconds: "2",
    floatingPosition: "bottom_right",
    headline: "",
    message: "",
    buttonLabel: "",
    buttonLink: "/gifts",
    badgeText: "",
    theme: "cream",
    imagePosition: "center",
    overlayPercent: "38",
    desktopImage: {},
    mobileImage: {},
  },
};

const emptySafetyControl = {
  minGrossMarginPercent: "",
  unitCostOverride: "",
  extraUnitCost: "0",
  deliverySubsidy: "0",
  paymentFeePercent: "",
  allowAutomaticSale: true,
  allowCoupons: true,
  allowPartnerCode: true,
  note: "",
};

const MasterControl = () => {
  const [tab, setTab] = useState("catalogue");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [entityType, setEntityType] = useState("product");
  const [entitySearch, setEntitySearch] = useState("");
  const [entityState, setEntityState] = useState("all");
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("product");
  const [selectedItem, setSelectedItem] = useState(null);
  const [masterState, setMasterState] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [catalogueOptions, setCatalogueOptions] = useState({
    categories: [],
    collections: [],
    components: [],
    containers: [],
  });

  const [skuSafety, setSkuSafety] = useState(null);
  const [safetyControl, setSafetyControl] = useState(emptySafetyControl);
  const [safetySaving, setSafetySaving] = useState(false);

  const [promotions, setPromotions] = useState([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [promotionForm, setPromotionForm] = useState(emptyPromotion);
  const [editingPromotionId, setEditingPromotionId] = useState("");
  const [promotionSaving, setPromotionSaving] = useState(false);
  const [desktopBannerFile, setDesktopBannerFile] = useState(null);
  const [mobileBannerFile, setMobileBannerFile] = useState(null);

  const [scopeSearch, setScopeSearch] = useState("");
  const [scopeResults, setScopeResults] = useState([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  const selectedMeta = useMemo(
    () => ENTITY_TYPES.find((item) => item.value === entityType),
    [entityType]
  );

  const clearNotice = () => {
    setError("");
    setMessage("");
  };

  const loadItems = async ({ keepSelection = true } = {}) => {
    setItemsLoading(true);
    setError("");
    try {
      const response = await api.get("/promotions/admin/master/items", {
        params: {
          type: entityType,
          state: entityState,
          search: entitySearch.trim() || undefined,
          limit: 80,
        },
      });
      const rows = response.data?.items || [];
      setItems(rows);

      if (!keepSelection || !rows.some((row) => String(row._id) === String(selectedId))) {
        const nextId = rows[0]?._id || "";
        setSelectedEntityType(entityType);
        setSelectedId(nextId);
        if (!nextId) {
          setSelectedItem(null);
          setMasterState(null);
          setSkuSafety(null);
          setSafetyControl(emptySafetyControl);
        }
      } else {
        setSelectedEntityType(entityType);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load catalogue items.");
    } finally {
      setItemsLoading(false);
    }
  };

  const loadItemDetail = async (type = entityType, id = selectedId) => {
    if (!id) return;
    setDetailLoading(true);
    setError("");
    try {
      const response = await api.get(`/promotions/admin/master/items/${type}/${id}`);
      setSelectedItem(response.data?.item || null);
      setMasterState(response.data?.masterState || null);

      if (type === "sku") {
        await loadSkuSafety(id);
      } else {
        setSkuSafety(null);
        setSafetyControl(emptySafetyControl);
      }
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        setSelectedId("");
        setSelectedItem(null);
        setMasterState(null);
        setSkuSafety(null);
        setSafetyControl(emptySafetyControl);
        setMessage("That catalogue item is no longer available. The list was refreshed.");
        await loadItems({ keepSelection: false });
      } else {
        setError(requestError.response?.data?.message || "Unable to load this item.");
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const loadSkuSafety = async (skuId) => {
    try {
      const response = await api.get(`/promotions/admin/skus/${skuId}/safety`);
      const preview = response.data?.preview || null;
      setSkuSafety(preview);
      const policy = preview?.control?.marginPolicy || {};
      const eligibility = preview?.control?.promoEligibility || {};
      setSafetyControl({
        minGrossMarginPercent: nullableInput(policy.minGrossMarginPercent),
        unitCostOverride: nullableInput(policy.unitCostOverride),
        extraUnitCost: String(policy.extraUnitCost ?? 0),
        deliverySubsidy: String(policy.deliverySubsidy ?? 0),
        paymentFeePercent: nullableInput(policy.paymentFeePercent),
        allowAutomaticSale: eligibility.allowAutomaticSale !== false,
        allowCoupons: eligibility.allowCoupons !== false,
        allowPartnerCode: eligibility.allowPartnerCode !== false,
        note: preview?.control?.note || "",
      });
    } catch (requestError) {
      setSkuSafety(null);
      setError(requestError.response?.data?.message || "Unable to load margin protection.");
    }
  };

  const loadCatalogueOptions = async () => {
    try {
      const [categories, collections, components, containers] = await Promise.all([
        api.get("/promotions/admin/master/options", { params: { kind: "categories", limit: 200 } }),
        api.get("/promotions/admin/master/options", { params: { kind: "collections", limit: 200 } }),
        api.get("/promotions/admin/master/options", { params: { kind: "components", limit: 200 } }),
        api.get("/promotions/admin/master/options", { params: { kind: "containers", limit: 200 } }),
      ]);
      setCatalogueOptions({
        categories: categories.data?.options || [],
        collections: collections.data?.options || [],
        components: components.data?.options || [],
        containers: containers.data?.options || [],
      });
    } catch {
      // The editor still works without option labels; IDs already saved on the item remain intact.
    }
  };

  const loadPromotions = async () => {
    setPromotionsLoading(true);
    try {
      const response = await api.get("/promotions/admin", { params: { limit: 100 } });
      setPromotions(response.data?.promotions || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load offers.");
    } finally {
      setPromotionsLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalogueOptions();
    void loadPromotions();
  }, []);

  useEffect(() => {
    // Keep the selected entity type tied to the selected ID. Without this,
    // switching Product -> SKU can briefly request the old product ID as a SKU
    // before React applies setSelectedId("") and produce a false 404.
    setSelectedEntityType(entityType);
    setSelectedId("");
    setSelectedItem(null);
    setMasterState(null);
    setSkuSafety(null);
    setSafetyControl(emptySafetyControl);
    void loadItems({ keepSelection: false });
  }, [entityType, entityState]);

  useEffect(() => {
    if (selectedId && selectedEntityType === entityType) {
      void loadItemDetail(selectedEntityType, selectedId);
    }
  }, [selectedId, selectedEntityType, entityType]);

  useEffect(() => {
    if (tab !== "promotion" || promotionForm.scopeMode === "all") {
      setScopeResults([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setScopeLoading(true);
      try {
        const response = await api.get("/promotions/admin/master/options", {
          params: {
            kind: scopeKind(promotionForm.scopeMode),
            search: scopeSearch.trim() || undefined,
            limit: 60,
          },
        });
        setScopeResults(response.data?.options || []);
      } catch {
        setScopeResults([]);
      } finally {
        setScopeLoading(false);
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [tab, promotionForm.scopeMode, scopeSearch]);

  useEffect(() => {
    if (tab !== "promotion" || !isPrivatePromotion(promotionForm.type)) {
      setCustomerResults([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const response = await api.get("/promotions/admin/master/options", {
          params: {
            kind: "customers",
            search: customerSearch.trim() || undefined,
            limit: 50,
          },
        });
        setCustomerResults(response.data?.options || []);
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerLoading(false);
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [tab, promotionForm.type, customerSearch]);

  const saveItem = async () => {
    if (!selectedItem?._id) return;
    clearNotice();
    setSavingItem(true);
    try {
      const payload = prepareEntityPayload(entityType, selectedItem);
      const response = await api.patch(
        `/promotions/admin/master/items/${entityType}/${selectedItem._id}`,
        payload
      );
      setSelectedItem(response.data?.item || selectedItem);
      setMasterState(response.data?.masterState || masterState);
      setMessage(response.data?.message || "Changes saved.");
      await loadItems();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save changes.");
    } finally {
      setSavingItem(false);
    }
  };

  const archiveOrRestore = async () => {
    if (!selectedItem?._id) return;
    const archived = Boolean(masterState?.archived);
    const action = archived ? "restore" : "archive";
    const confirmed = window.confirm(
      archived
        ? "Restore this item and make its previous availability available again?"
        : "Archive this item? Customers will no longer be able to buy/select it."
    );
    if (!confirmed) return;

    clearNotice();
    try {
      const response = await api.post(
        `/promotions/admin/master/items/${entityType}/${selectedItem._id}/${action}`,
        {}
      );
      setMessage(response.data?.message || (archived ? "Item restored." : "Item archived."));
      await loadItems({ keepSelection: false });
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to ${action} this item.`);
    }
  };

  const deleteItem = async () => {
    if (!selectedItem?._id) return;
    const confirmed = window.confirm(
      "Permanently delete this item? If it has order, cart, RFQ, recipe or promotion history, HAMPORIUM will block the delete and ask you to archive it instead."
    );
    if (!confirmed) return;

    clearNotice();
    try {
      const response = await api.delete(
        `/promotions/admin/master/items/${entityType}/${selectedItem._id}`
      );
      setMessage(response.data?.message || "Item deleted.");
      setSelectedEntityType(entityType);
      setSelectedId("");
      setSelectedItem(null);
      await loadItems({ keepSelection: false });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "This item cannot be deleted.");
    }
  };

  const uploadItemImage = async (file) => {
    if (!file || !selectedItem?._id) return;
    setImageBusy(true);
    clearNotice();
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("alt", selectedItem.name || "HAMPORIUM");
      const response = await api.post(
        `/promotions/admin/master/items/${entityType}/${selectedItem._id}/images`,
        form
      );
      setSelectedItem((current) => ({ ...current, images: response.data?.images || [] }));
      setMessage("Image added.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to upload image.");
    } finally {
      setImageBusy(false);
    }
  };

  const removeItemImage = async (image) => {
    if (!selectedItem?._id || !window.confirm("Remove this image?")) return;
    setImageBusy(true);
    clearNotice();
    try {
      const response = await api.delete(
        `/promotions/admin/master/items/${entityType}/${selectedItem._id}/images`,
        { data: { publicId: image.publicId || "", url: image.url || "" } }
      );
      setSelectedItem((current) => ({ ...current, images: response.data?.images || [] }));
      setMessage("Image removed.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to remove image.");
    } finally {
      setImageBusy(false);
    }
  };

  const saveSafety = async () => {
    if (entityType !== "sku" || !selectedItem?._id) return;
    setSafetySaving(true);
    clearNotice();
    try {
      const response = await api.put(`/promotions/admin/skus/${selectedItem._id}/control`, {
        marginPolicy: {
          minGrossMarginPercent: nullableNumber(safetyControl.minGrossMarginPercent),
          unitCostOverride: nullableNumber(safetyControl.unitCostOverride),
          extraUnitCost: Number(safetyControl.extraUnitCost || 0),
          deliverySubsidy: Number(safetyControl.deliverySubsidy || 0),
          paymentFeePercent: nullableNumber(safetyControl.paymentFeePercent),
        },
        promoEligibility: {
          allowAutomaticSale: safetyControl.allowAutomaticSale,
          allowCoupons: safetyControl.allowCoupons,
          allowPartnerCode: safetyControl.allowPartnerCode,
        },
        note: safetyControl.note,
      });
      setSkuSafety(response.data?.preview || skuSafety);
      setMessage("Margin protection saved.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save margin protection.");
    } finally {
      setSafetySaving(false);
    }
  };

  const resetPromotion = () => {
    setPromotionForm(emptyPromotion);
    setEditingPromotionId("");
    setDesktopBannerFile(null);
    setMobileBannerFile(null);
    setScopeSearch("");
    setCustomerSearch("");
  };

  const savePromotion = async (event) => {
    event.preventDefault();
    clearNotice();

    if (promotionForm.scopeMode !== "all" && !promotionForm.scopeItems.length) {
      setError("Choose at least one item for this offer.");
      return;
    }
    if (
      isPrivatePromotion(promotionForm.type) &&
      !promotionForm.audienceUsers.length &&
      !promotionForm.audienceEmails.trim()
    ) {
      setError("Choose at least one customer for this private offer.");
      return;
    }

    setPromotionSaving(true);
    try {
      const payload = buildPromotionPayload(promotionForm);
      const response = editingPromotionId
        ? await api.patch(`/promotions/admin/${editingPromotionId}`, payload)
        : await api.post("/promotions/admin", payload);

      const promotionId = response.data?.promotion?._id || editingPromotionId;
      if (promotionId && desktopBannerFile) {
        await uploadPromotionBanner(promotionId, "desktop", desktopBannerFile, promotionForm.websiteDisplay.headline || promotionForm.name);
      }
      if (promotionId && mobileBannerFile) {
        await uploadPromotionBanner(promotionId, "mobile", mobileBannerFile, promotionForm.websiteDisplay.headline || promotionForm.name);
      }

      setMessage(editingPromotionId ? "Offer updated." : "Offer created.");
      resetPromotion();
      await loadPromotions();
      setTab("offers");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save this offer.");
    } finally {
      setPromotionSaving(false);
    }
  };

  const editPromotion = (promotion) => {
    setEditingPromotionId(promotion._id);
    setPromotionForm(promotionToForm(promotion));
    setDesktopBannerFile(null);
    setMobileBannerFile(null);
    setTab("promotion");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changePromotionStatus = async (promotion, status) => {
    clearNotice();
    try {
      const response = await api.patch(`/promotions/admin/${promotion._id}`, { status });
      setMessage(response.data?.message || "Offer updated.");
      await loadPromotions();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update offer.");
    }
  };

  const deletePromotion = async (promotion) => {
    if (!window.confirm(`Delete ${promotion.name}? Used offers cannot be deleted and will need to be paused instead.`)) return;
    clearNotice();
    try {
      const response = await api.delete(`/promotions/admin/${promotion._id}`);
      setMessage(response.data?.message || "Offer deleted.");
      await loadPromotions();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete offer.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1540px] pb-16">
      <header className="border-b border-black/[0.08] pb-7">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F97316]">
          HAMPORIUM ADMIN
        </p>
        <h1 className="mt-2 font-serif text-[42px] font-semibold leading-none tracking-[-0.035em] text-[#181715] sm:text-[54px]">
          Master Control
        </h1>
        <p className="mt-4 max-w-3xl text-[14px] font-medium leading-7 text-black/58">
          Manage products, gift items, boxes, prices, availability, hamper contents, offers and website banners from one place.
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-2 mt-6 border-b border-black/[0.08] bg-[#FAF9F6]/95 px-2 py-3 backdrop-blur-md">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "catalogue"} onClick={() => setTab("catalogue")}>Products & Items</TabButton>
          <TabButton active={tab === "promotion"} onClick={() => setTab("promotion")}>Create Offer</TabButton>
          <TabButton active={tab === "offers"} onClick={() => setTab("offers")}>Offers & Banners</TabButton>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      {tab === "catalogue" ? (
        <section className="pt-7">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ENTITY_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setEntityType(type.value)}
                className={`border px-5 py-4 text-left transition ${
                  entityType === type.value
                    ? "border-[#F97316] bg-[#FFF7F0]"
                    : "border-black/[0.09] bg-white hover:border-black/25"
                }`}
              >
                <p className="text-[14px] font-black text-[#202020]">{type.label}</p>
                <p className="mt-1 text-[11px] font-medium leading-5 text-black/50">{type.help}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_auto]">
            <input
              value={entitySearch}
              onChange={(event) => setEntitySearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadItems({ keepSelection: false });
              }}
              placeholder={`Search ${selectedMeta?.label?.toLowerCase() || "items"} by name or code`}
              className={inputClass}
            />
            <select value={entityState} onChange={(event) => setEntityState(event.target.value)} className={inputClass}>
              <option value="all">All items</option>
              <option value="live">Live / available</option>
              <option value="hidden">Hidden / inactive</option>
              <option value="archived">Archived</option>
            </select>
            <button type="button" onClick={() => loadItems({ keepSelection: false })} className={darkButton}>
              Search
            </button>
          </div>

          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
            <aside className="min-w-0 border border-black/[0.08] bg-white">
              <div className="border-b border-black/[0.07] px-5 py-4">
                <p className="text-[12px] font-black text-[#252525]">{selectedMeta?.label}</p>
                <p className="mt-1 text-[10px] font-semibold text-black/42">
                  {itemsLoading ? "Loading..." : `${items.length} shown`}
                </p>
              </div>

              <div className="max-h-[720px] overflow-y-auto">
                {items.map((item) => (
                  <EntityListRow
                    key={item._id}
                    item={item}
                    type={entityType}
                    active={String(item._id) === String(selectedId)}
                    onClick={() => {
                      setSelectedEntityType(entityType);
                      setSelectedId(item._id);
                    }}
                  />
                ))}
                {!items.length && !itemsLoading ? (
                  <p className="p-6 text-[12px] font-medium leading-6 text-black/48">No matching items.</p>
                ) : null}
              </div>
            </aside>

            <main className="min-w-0">
              {detailLoading ? (
                <LoadingBlock text="Loading item..." />
              ) : selectedItem ? (
                <div className="space-y-6">
                  <EntityHeader
                    type={entityType}
                    item={selectedItem}
                    archived={Boolean(masterState?.archived)}
                    saving={savingItem}
                    onSave={saveItem}
                    onArchive={archiveOrRestore}
                    onDelete={deleteItem}
                  />

                  {entityType === "product" ? (
                    <ProductEditor
                      item={selectedItem}
                      setItem={setSelectedItem}
                      options={catalogueOptions}
                    />
                  ) : null}
                  {entityType === "sku" ? (
                    <SkuEditor
                      item={selectedItem}
                      setItem={setSelectedItem}
                      options={catalogueOptions}
                      safety={skuSafety}
                      control={safetyControl}
                      setControl={setSafetyControl}
                      saveControl={saveSafety}
                      safetySaving={safetySaving}
                    />
                  ) : null}
                  {entityType === "component" ? (
                    <ComponentEditor item={selectedItem} setItem={setSelectedItem} />
                  ) : null}
                  {entityType === "container" ? (
                    <ContainerEditor
                      item={selectedItem}
                      setItem={setSelectedItem}
                      options={catalogueOptions}
                    />
                  ) : null}

                  <ImageManager
                    images={selectedItem.images || []}
                    busy={imageBusy}
                    onUpload={uploadItemImage}
                    onRemove={removeItemImage}
                  />
                </div>
              ) : (
                <LoadingBlock text="Choose an item from the list." />
              )}
            </main>
          </div>
        </section>
      ) : null}

      {tab === "promotion" ? (
        <PromotionBuilder
          form={promotionForm}
          setForm={setPromotionForm}
          editing={Boolean(editingPromotionId)}
          onSubmit={savePromotion}
          onCancel={resetPromotion}
          saving={promotionSaving}
          scopeSearch={scopeSearch}
          setScopeSearch={setScopeSearch}
          scopeResults={scopeResults}
          scopeLoading={scopeLoading}
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          customerResults={customerResults}
          customerLoading={customerLoading}
          desktopBannerFile={desktopBannerFile}
          setDesktopBannerFile={setDesktopBannerFile}
          mobileBannerFile={mobileBannerFile}
          setMobileBannerFile={setMobileBannerFile}
        />
      ) : null}

      {tab === "offers" ? (
        <PromotionRegister
          promotions={promotions}
          loading={promotionsLoading}
          onEdit={editPromotion}
          onStatus={changePromotionStatus}
          onDelete={deletePromotion}
        />
      ) : null}
    </div>
  );
};

const EntityHeader = ({ type, item, archived, saving, onSave, onArchive, onDelete }) => (
  <div className="border border-black/[0.08] bg-white px-5 py-5 sm:px-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#F97316]">
            {formatLabel(type)}
          </span>
          {archived ? <StatusBadge text="Archived" tone="muted" /> : <StatusBadge text="Editable" tone="green" />}
        </div>
        <h2 className="mt-2 break-words font-serif text-[31px] font-semibold tracking-[-0.025em] text-[#181715]">
          {item.name || item.code || "Item"}
        </h2>
        {item.code ? <p className="mt-1 text-[11px] font-bold text-black/48">{item.code}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSave} disabled={saving || archived} className={orangeButton}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" onClick={onArchive} className={secondaryButton}>
          {archived ? "Restore" : "Archive"}
        </button>
        <button type="button" onClick={onDelete} className={dangerButton}>
          Delete
        </button>
      </div>
    </div>
    <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-black/48">
      Archive is the safe way to remove an item from the customer website. Permanent delete is only allowed when nothing in orders, carts, RFQs, recipes or promotions depends on it.
    </p>
  </div>
);

const ProductEditor = ({ item, setItem, options }) => (
  <EditorSection title="Product page" text="Control how this hamper appears on the website.">
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Product name">
        <input value={item.name || ""} onChange={(e) => setTop(setItem, "name", e.target.value)} className={inputClass} />
      </Field>
      <Field label="Website URL name" helper="Used in the product page URL.">
        <input value={item.slug || ""} onChange={(e) => setTop(setItem, "slug", e.target.value)} className={inputClass} />
      </Field>
      <Field label="Brand">
        <input value={item.brand || ""} onChange={(e) => setTop(setItem, "brand", e.target.value)} className={inputClass} />
      </Field>
      <Field label="Website visibility">
        <select value={item.status || "draft"} onChange={(e) => setTop(setItem, "status", e.target.value)} className={inputClass}>
          <option value="active">Live</option>
          <option value="draft">Hidden / Draft</option>
        </select>
      </Field>
      <Field label="Category">
        <select
          value={idOf(item.category)}
          onChange={(e) => setTop(setItem, "category", e.target.value)}
          className={inputClass}
        >
          <option value="">Choose category</option>
          {options.categories.map((option) => (
            <option key={option._id} value={option._id}>{option.name || option.slug}</option>
          ))}
        </select>
      </Field>
      <ToggleLine
        checked={Boolean(item.isFeatured)}
        onChange={(value) => setTop(setItem, "isFeatured", value)}
        title="Feature on website"
        text="Use this hamper in featured catalogue areas."
      />
    </div>

    <div className="mt-5 grid gap-5">
      <Field label="Short description">
        <textarea rows="3" value={item.shortDescription || ""} onChange={(e) => setTop(setItem, "shortDescription", e.target.value)} className={textareaClass} />
      </Field>
      <Field label="Full description">
        <textarea rows="6" value={item.description || ""} onChange={(e) => setTop(setItem, "description", e.target.value)} className={textareaClass} />
      </Field>
      <Field label="Tags" helper="Separate with commas.">
        <input
          value={Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || ""}
          onChange={(e) => setTop(setItem, "tags", e.target.value)}
          className={inputClass}
          placeholder="premium, wedding, festive"
        />
      </Field>
      <Field label="Collections">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.collections.map((option) => {
            const checked = toIdArray(item.collections).includes(String(option._id));
            return (
              <label key={option._id} className="flex cursor-pointer items-center gap-3 border border-black/[0.08] bg-[#FCFBF8] px-4 py-3 text-[11px] font-bold">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleIdInField(setItem, "collections", option._id)}
                  className="h-4 w-4 accent-[#F97316]"
                />
                {option.name || option.slug}
              </label>
            );
          })}
        </div>
      </Field>
    </div>
  </EditorSection>
);

const SkuEditor = ({ item, setItem, options, safety, control, setControl, saveControl, safetySaving }) => (
  <div className="space-y-6">
    <EditorSection title="Price & website availability" text="This is the selling option customers actually buy.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <TextInput label="Option name" value={item.name} onChange={(value) => setTop(setItem, "name", value)} />
        <TextInput label="SKU code" value={item.code} onChange={(value) => setTop(setItem, "code", value)} />
        <NumberInput label="Base price before GST" value={item.baseSellingPrice} onChange={(value) => setTop(setItem, "baseSellingPrice", value)} />
        <NumberInput label="MRP" value={item.mrp} onChange={(value) => setTop(setItem, "mrp", value)} />
        <NumberInput label="GST %" value={item.taxPercent} onChange={(value) => setTop(setItem, "taxPercent", value)} max="100" />
        <TextInput label="HSN / SAC" value={item.hsnSac} onChange={(value) => setTop(setItem, "hsnSac", value)} />
        <NumberInput label="Sort order" value={item.sortOrder} onChange={(value) => setTop(setItem, "sortOrder", value)} allowNegative />
        <NumberInput label="Courier days" value={item.defaultCourierDays} onChange={(value) => setTop(setItem, "defaultCourierDays", value)} max="60" />
        <ToggleLine
          checked={item.isActive !== false}
          onChange={(value) => setTop(setItem, "isActive", value)}
          title="Available for sale"
          text="Turn off to stop this option from being purchased."
        />
      </div>

      <DiscountEditor item={item} setItem={setItem} />
    </EditorSection>

    <EditorSection title="Delivery time" text="Set how long this option needs before courier time is added.">
      <div className="grid gap-5 md:grid-cols-3">
        <NumberInput label="Personalisation days" value={item.productionLeadTime?.personalizationDays} onChange={(value) => setNested(setItem, "productionLeadTime", "personalizationDays", value)} />
        <NumberInput label="Assembly days" value={item.productionLeadTime?.assemblyDays} onChange={(value) => setNested(setItem, "productionLeadTime", "assemblyDays", value)} />
        <NumberInput label="Packing days" value={item.productionLeadTime?.packingDays} onChange={(value) => setNested(setItem, "productionLeadTime", "packingDays", value)} />
      </div>
    </EditorSection>

    <EditorSection title="Hamper box & contents" text="Choose the box and exactly what goes inside this ready-made hamper.">
      <Field label="Gift box">
        <select value={idOf(item.container)} onChange={(e) => setTop(setItem, "container", e.target.value)} className={inputClass}>
          <option value="">No linked box</option>
          {options.containers.map((option) => (
            <option key={option._id} value={option._id}>{option.name} · {option.code}</option>
          ))}
        </select>
      </Field>

      <MaterialEditor
        title="Customer-visible contents"
        rows={item.hamperContents || []}
        setRows={(rows) => setTop(setItem, "hamperContents", rows)}
        components={options.components}
        content
      />
      <MaterialEditor
        title="Internal packing materials"
        rows={item.internalMaterials || []}
        setRows={(rows) => setTop(setItem, "internalMaterials", rows)}
        components={options.components}
      />
    </EditorSection>

    <EditorSection title="Margin protection" text="HAMPORIUM blocks an offer when it would sell this option below the protected margin.">
      <div className="grid gap-px border border-black/[0.08] bg-black/[0.08] sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Current price before GST" value={money(safety?.safety?.currentTaxableUnit)} />
        <Metric label="Lowest safe price" value={nullableMoney(safety?.safety?.safeMinimumTaxableUnit)} />
        <Metric label="Safe discount up to" value={`${number(safety?.safety?.safeMaxDiscountPercent)}%`} />
        <Metric label="Current margin" value={nullablePercent(safety?.safety?.estimatedCurrentGrossMarginPercent)} />
      </div>

      {!safety?.safety?.safe && safety?.safety?.reason ? (
        <Notice tone="warning">{safety.safety.reason}</Notice>
      ) : null}

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <NumberInput label="Keep at least this margin %" value={control.minGrossMarginPercent} onChange={(value) => setTop(setControl, "minGrossMarginPercent", value)} max="100" placeholder="Use inherited margin" />
        <NumberInput label="Product cost override" value={control.unitCostOverride} onChange={(value) => setTop(setControl, "unitCostOverride", value)} placeholder="Optional" />
        <NumberInput label="Extra cost per unit" value={control.extraUnitCost} onChange={(value) => setTop(setControl, "extraUnitCost", value)} />
        <NumberInput label="Delivery cost paid by HAMPORIUM" value={control.deliverySubsidy} onChange={(value) => setTop(setControl, "deliverySubsidy", value)} />
        <NumberInput label="Payment fee %" value={control.paymentFeePercent} onChange={(value) => setTop(setControl, "paymentFeePercent", value)} max="100" placeholder="Use global fee" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ToggleLine checked={control.allowAutomaticSale} onChange={(value) => setTop(setControl, "allowAutomaticSale", value)} title="Automatic sales" text="Allow seasonal automatic discounts." />
        <ToggleLine checked={control.allowCoupons} onChange={(value) => setTop(setControl, "allowCoupons", value)} title="HAMPORIUM coupons" text="Allow public and private coupons." />
        <ToggleLine checked={control.allowPartnerCode} onChange={(value) => setTop(setControl, "allowPartnerCode", value)} title="Partner codes" text="Allow partner discount and commission." />
      </div>

      <Field label="Internal note">
        <textarea rows="3" value={control.note || ""} onChange={(e) => setTop(setControl, "note", e.target.value)} className={textareaClass} />
      </Field>
      <button type="button" onClick={saveControl} disabled={safetySaving} className={`${darkButton} mt-5`}>
        {safetySaving ? "Saving..." : "Save Margin Protection"}
      </button>
    </EditorSection>
  </div>
);

const ComponentEditor = ({ item, setItem }) => (
  <div className="space-y-6">
    <EditorSection title="Gift item" text="Control the item customers can add to a custom hamper.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <TextInput label="Item name" value={item.name} onChange={(value) => setTop(setItem, "name", value)} />
        <TextInput label="Item code" value={item.code} onChange={(value) => setTop(setItem, "code", value)} />
        <TextInput label="Brand" value={item.brand} onChange={(value) => setTop(setItem, "brand", value)} />
        <Field label="Item type">
          <select value={item.type || "food"} onChange={(e) => setTop(setItem, "type", e.target.value)} className={inputClass}>
            <option value="food">Food</option>
            <option value="non_food">Non-food</option>
            <option value="packaging">Packaging</option>
          </select>
        </Field>
        <Field label="Use inside hamper">
          <select value={item.hamperRole || "content"} onChange={(e) => setTop(setItem, "hamperRole", e.target.value)} className={inputClass}>
            <option value="content">Gift content</option>
            <option value="decoration">Decoration</option>
          </select>
        </Field>
        <TextInput label="Category" value={item.category} onChange={(value) => setTop(setItem, "category", value)} />
        <TextInput label="Subcategory" value={item.subcategory} onChange={(value) => setTop(setItem, "subcategory", value)} />
        <TextInput label="Segment" value={item.segment} onChange={(value) => setTop(setItem, "segment", value)} />
      </div>
      <Field label="Description">
        <textarea rows="4" value={item.description || ""} onChange={(e) => setTop(setItem, "description", e.target.value)} className={textareaClass} />
      </Field>
    </EditorSection>

    <EditorSection title="Price, cost & margin" text="Keep selling price and cost data current so discounts stay safe.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <NumberInput label="Selling price before GST" value={item.sellingPrice} onChange={(value) => setTop(setItem, "sellingPrice", value)} />
        <NumberInput label="MRP" value={item.mrp} onChange={(value) => setTop(setItem, "mrp", value)} />
        <NumberInput label="Latest unit cost" value={item.latestUnitCost} onChange={(value) => setTop(setItem, "latestUnitCost", value)} />
        <NumberInput label="Actual landed cost" value={item.actualLandedCost} onChange={(value) => setTop(setItem, "actualLandedCost", value)} />
        <NumberInput label="Minimum margin %" value={item.minGrossMarginPercent} onChange={(value) => setTop(setItem, "minGrossMarginPercent", value)} max="100" />
        <NumberInput label="GST %" value={item.taxPercent} onChange={(value) => setTop(setItem, "taxPercent", value)} max="100" />
        <TextInput label="HSN / SAC" value={item.hsnSac} onChange={(value) => setTop(setItem, "hsnSac", value)} />
        <NumberInput label="Lead time days" value={item.leadTimeDays} onChange={(value) => setTop(setItem, "leadTimeDays", value)} />
      </div>
      <DiscountEditor item={item} setItem={setItem} />
    </EditorSection>

    <EditorSection title="Stock & website" text="Control whether customers can see and select this item.">
      <AvailabilityEditor item={item} setItem={setItem} includeUnit />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ToggleLine checked={item.isActive !== false} onChange={(value) => setTop(setItem, "isActive", value)} title="Active" text="Keep this item available to the system." />
        <ToggleLine checked={item.customerSelectable !== false} onChange={(value) => setTop(setItem, "customerSelectable", value)} title="Customer can select" text="Show this item in the custom hamper builder." />
        <ToggleLine checked={item.personalizable === true} onChange={(value) => setTop(setItem, "personalizable", value)} title="Personalisation allowed" text="Allow this item to be personalised." />
      </div>
      <ChannelEditor item={item} setItem={setItem} />
      <Field label="Internal note">
        <textarea rows="3" value={item.internalNotes || ""} onChange={(e) => setTop(setItem, "internalNotes", e.target.value)} className={textareaClass} />
      </Field>
    </EditorSection>
  </div>
);

const ContainerEditor = ({ item, setItem, options }) => (
  <div className="space-y-6">
    <EditorSection title="Gift box" text="Control the box customers use for custom hampers and ready-made hampers.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <TextInput label="Box name" value={item.name} onChange={(value) => setTop(setItem, "name", value)} />
        <TextInput label="Box code" value={item.code} onChange={(value) => setTop(setItem, "code", value)} />
        <TextInput label="Material" value={item.material} onChange={(value) => setTop(setItem, "material", value)} />
        <TextInput label="Category" value={item.category} onChange={(value) => setTop(setItem, "category", value)} />
        <TextInput label="Subcategory" value={item.subcategory} onChange={(value) => setTop(setItem, "subcategory", value)} />
        <TextInput label="Segment" value={item.segment} onChange={(value) => setTop(setItem, "segment", value)} />
      </div>
      <Field label="Description">
        <textarea rows="4" value={item.description || ""} onChange={(e) => setTop(setItem, "description", e.target.value)} className={textareaClass} />
      </Field>
    </EditorSection>

    <EditorSection title="Price, cost & margin" text="These numbers are used when custom hamper pricing is calculated.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <NumberInput label="Selling price before GST" value={item.sellingPrice} onChange={(value) => setTop(setItem, "sellingPrice", value)} />
        <NumberInput label="MRP" value={item.mrp} onChange={(value) => setTop(setItem, "mrp", value)} />
        <NumberInput label="Latest unit cost" value={item.latestUnitCost} onChange={(value) => setTop(setItem, "latestUnitCost", value)} />
        <NumberInput label="Actual landed cost" value={item.actualLandedCost} onChange={(value) => setTop(setItem, "actualLandedCost", value)} />
        <NumberInput label="Minimum margin %" value={item.minGrossMarginPercent} onChange={(value) => setTop(setItem, "minGrossMarginPercent", value)} max="100" />
        <NumberInput label="GST %" value={item.taxPercent} onChange={(value) => setTop(setItem, "taxPercent", value)} max="100" />
        <TextInput label="HSN / SAC" value={item.hsnSac} onChange={(value) => setTop(setItem, "hsnSac", value)} />
        <NumberInput label="Lead time days" value={item.leadTimeDays} onChange={(value) => setTop(setItem, "leadTimeDays", value)} />
        <NumberInput label="Courier days" value={item.defaultCourierDays} onChange={(value) => setTop(setItem, "defaultCourierDays", value)} max="60" />
        <NumberInput label="Usable box volume %" value={item.usableVolumePercent} onChange={(value) => setTop(setItem, "usableVolumePercent", value)} max="100" />
        <NumberInput label="Maximum items" value={item.maxItems} onChange={(value) => setTop(setItem, "maxItems", value)} />
        <NumberInput label="Sort order" value={item.sortOrder} onChange={(value) => setTop(setItem, "sortOrder", value)} allowNegative />
      </div>
      <DiscountEditor item={item} setItem={setItem} />
    </EditorSection>

    <EditorSection title="Stock & website" text="Control whether this box can be selected by customers.">
      <AvailabilityEditor item={item} setItem={setItem} />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ToggleLine checked={item.isActive !== false} onChange={(value) => setTop(setItem, "isActive", value)} title="Active" text="Keep this box available to the system." />
        <ToggleLine checked={item.customerSelectable !== false} onChange={(value) => setTop(setItem, "customerSelectable", value)} title="Customer can select" text="Show this box in the custom hamper builder." />
      </div>
      <ChannelEditor item={item} setItem={setItem} />
    </EditorSection>

    <EditorSection title="Packing materials" text="Internal materials needed to prepare this box.">
      <MaterialEditor
        title="Packing materials"
        rows={item.packingMaterials || []}
        setRows={(rows) => setTop(setItem, "packingMaterials", rows)}
        components={options.components}
      />
    </EditorSection>
  </div>
);

const PromotionBuilder = ({
  form,
  setForm,
  editing,
  onSubmit,
  onCancel,
  saving,
  scopeSearch,
  setScopeSearch,
  scopeResults,
  scopeLoading,
  customerSearch,
  setCustomerSearch,
  customerResults,
  customerLoading,
  desktopBannerFile,
  setDesktopBannerFile,
  mobileBannerFile,
  setMobileBannerFile,
}) => {
  const automatic = form.type === "automatic_sale";
  const privateOffer = isPrivatePromotion(form.type);
  const display = form.websiteDisplay || {};

  return (
    <section className="pt-7">
      <SectionTitle
        eyebrow={editing ? "Edit Offer" : "New Offer"}
        title={editing ? "Update this offer" : "Create an offer"}
        text="Choose who gets the offer, which products it works on and exactly how it appears on the website."
      />

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <EditorSection title="1. Offer basics" text="Start with the simple customer-facing rules.">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <TextInput label="Offer name" value={form.name} onChange={(value) => setTop(setForm, "name", value)} placeholder="Diwali 2026" required />
            <Field label="Offer type">
              <select value={form.type} onChange={(e) => setTop(setForm, "type", e.target.value)} className={inputClass}>
                {PROMOTION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setTop(setForm, "status", e.target.value)} className={inputClass}>
                <option value="draft">Draft</option>
                <option value="active">Live</option>
                <option value="paused">Paused</option>
                <option value="expired">Ended</option>
              </select>
            </Field>
            {!automatic ? (
              <TextInput label="Coupon code" value={form.code} onChange={(value) => setTop(setForm, "code", value.toUpperCase())} placeholder="DIWALI15" required={["public_coupon", "client_coupon", "customer_care"].includes(form.type)} />
            ) : (
              <div className="border border-[#D4AF37]/25 bg-[#FFF9F1] px-4 py-3 text-[11px] font-semibold leading-5 text-[#72581C]">
                Automatic sales need no coupon code.
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {automatic ? (
              <>
                <NumberInput label="Minimum discount %" value={form.minDiscountPercent} onChange={(value) => setTop(setForm, "minDiscountPercent", value)} max="100" />
                <NumberInput label="Preferred discount %" value={form.targetDiscountPercent} onChange={(value) => setTop(setForm, "targetDiscountPercent", value)} max="100" />
                <NumberInput label="Maximum discount %" value={form.maxDiscountPercent} onChange={(value) => setTop(setForm, "maxDiscountPercent", value)} max="100" />
              </>
            ) : (
              <>
                <Field label="Discount type">
                  <select value={form.discountType} onChange={(e) => setTop(setForm, "discountType", e.target.value)} className={inputClass}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </Field>
                <NumberInput label={form.discountType === "fixed" ? "Discount amount" : "Discount %"} value={form.discountValue} onChange={(value) => setTop(setForm, "discountValue", value)} max={form.discountType === "percentage" ? "100" : undefined} />
                <NumberInput label="Maximum total discount" value={form.maxDiscountAmount} onChange={(value) => setTop(setForm, "maxDiscountAmount", value)} helper="Use 0 for no extra cap." />
              </>
            )}
            <NumberInput label="Minimum order value" value={form.minOrderValue} onChange={(value) => setTop(setForm, "minOrderValue", value)} />
          </div>
        </EditorSection>

        <EditorSection title="2. Choose products" text="Apply the offer everywhere or search and pick exactly what it should work on.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["all", "All eligible products"],
              ["product", "Selected hampers"],
              ["sku", "Selected selling options"],
              ["category", "Selected categories"],
              ["collection", "Selected collections"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((current) => ({ ...current, scopeMode: value, scopeItems: [] }))}
                className={`border px-4 py-3 text-left text-[11px] font-black transition ${
                  form.scopeMode === value ? "border-[#F97316] bg-[#FFF7F0] text-[#A5480D]" : "border-black/[0.08] bg-white text-[#292929]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.scopeMode !== "all" ? (
            <MultiPicker
              search={scopeSearch}
              setSearch={setScopeSearch}
              results={scopeResults}
              loading={scopeLoading}
              selected={form.scopeItems}
              onAdd={(option) => addUniqueObject(setForm, "scopeItems", option)}
              onRemove={(id) => removeObject(setForm, "scopeItems", id)}
              placeholder={`Search ${formatLabel(form.scopeMode).toLowerCase()}...`}
            />
          ) : (
            <p className="mt-4 text-[12px] font-semibold text-emerald-700">This offer can run on every SKU that passes the margin guard.</p>
          )}
        </EditorSection>

        {privateOffer ? (
          <EditorSection title="3. Choose customers" text="Only these customers will be able to use and see this private offer when signed in.">
            <MultiPicker
              search={customerSearch}
              setSearch={setCustomerSearch}
              results={customerResults}
              loading={customerLoading}
              selected={form.audienceUsers}
              onAdd={(option) => addUniqueObject(setForm, "audienceUsers", option)}
              onRemove={(id) => removeObject(setForm, "audienceUsers", id)}
              placeholder="Search customer by name, email or phone..."
              customer
            />
            <Field label="Extra allowed emails" helper="Optional. Use commas or new lines.">
              <textarea rows="3" value={form.audienceEmails} onChange={(e) => setTop(setForm, "audienceEmails", e.target.value)} className={textareaClass} placeholder="buyer@company.com" />
            </Field>
          </EditorSection>
        ) : null}

        <EditorSection title={`${privateOffer ? "4" : "3"}. Website banner & ad`} text="Choose where customers see the offer. Add desktop and mobile banner images if you want a visual campaign.">
          <ToggleLine
            checked={display.enabled}
            onChange={(value) => setNested(setForm, "websiteDisplay", "enabled", value)}
            title="Show this offer on the website"
            text={privateOffer ? "Only selected signed-in customers can see this private website offer." : "Show this offer to eligible website visitors."}
          />

          {display.enabled ? (
            <div className="mt-5 space-y-5">
              <div className="border-l-2 border-[#D4AF37] bg-[#FFF9F1] px-4 py-3 text-[12px] leading-6 text-[#5C4820]">
                <strong>Want an image ad?</strong> Turn on <strong>Large image banner</strong> and choose a banner image below. The top strip is text-only.
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <CheckCard label="Top text strip" checked={display.announcementBar} onChange={(value) => setNested(setForm, "websiteDisplay", "announcementBar", value)} />
                <CheckCard label="Large home banner" checked={display.homeBanner} onChange={(value) => setNested(setForm, "websiteDisplay", "homeBanner", value)} />
                <CheckCard label="Popup ad (one-time)" checked={display.popupAd} onChange={(value) => setNested(setForm, "websiteDisplay", "popupAd", value)} />
                <CheckCard label="Side ad (dismissible)" checked={display.floatingAd} onChange={(value) => setNested(setForm, "websiteDisplay", "floatingAd", value)} />
                <CheckCard label="Product badge" checked={display.productBadge} onChange={(value) => setNested(setForm, "websiteDisplay", "productBadge", value)} />
                <CheckCard label="Checkout reminder" checked={display.checkoutNote} onChange={(value) => setNested(setForm, "websiteDisplay", "checkoutNote", value)} />
              </div>

              {(display.popupAd || display.floatingAd) ? (
                <div className="grid gap-5 border border-[#D4AF37]/25 bg-[#FFF9F1] p-4 md:grid-cols-3">
                  <Field label="Show this ad again">
                    <select value={display.adFrequency || "once_per_session"} onChange={(e) => setNested(setForm, "websiteDisplay", "adFrequency", e.target.value)} className={inputClass}>
                      <option value="once_per_session">Only once until the browser tab/session is closed</option>
                      <option value="once_per_day">Once per day</option>
                      <option value="always">Every visit until the customer closes it</option>
                    </select>
                  </Field>
                  <NumberInput label="Show after (seconds)" value={display.adDelaySeconds ?? "2"} onChange={(value) => setNested(setForm, "websiteDisplay", "adDelaySeconds", value)} max="30" />
                  {display.floatingAd ? (
                    <Field label="Side ad position">
                      <select value={display.floatingPosition || "bottom_right"} onChange={(e) => setNested(setForm, "websiteDisplay", "floatingPosition", e.target.value)} className={inputClass}>
                        <option value="bottom_right">Bottom right</option>
                        <option value="bottom_left">Bottom left</option>
                      </select>
                    </Field>
                  ) : <div />}
                  <p className="md:col-span-3 text-[11px] font-semibold leading-5 text-[#6B5527]">Customers always get a close button. If both Popup and Side ad are enabled, the popup is shown first and the side ad is suppressed for that campaign after dismissal.</p>
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <TextInput label="Main headline" value={display.headline} onChange={(value) => setNested(setForm, "websiteDisplay", "headline", value)} placeholder="Celebrate Diwali with thoughtful gifting." />
                <TextInput label="Product badge text" value={display.badgeText} onChange={(value) => setNested(setForm, "websiteDisplay", "badgeText", value)} placeholder="Diwali Offer" />
                <TextInput label="Button text" value={display.buttonLabel} onChange={(value) => setNested(setForm, "websiteDisplay", "buttonLabel", value)} placeholder="Shop Now" />
                <TextInput label="Button goes to" value={display.buttonLink} onChange={(value) => setNested(setForm, "websiteDisplay", "buttonLink", value)} placeholder="/gifts" />
              </div>
              <Field label="Short message">
                <textarea rows="3" value={display.message} onChange={(e) => setNested(setForm, "websiteDisplay", "message", e.target.value)} className={textareaClass} placeholder="Enjoy festive savings on selected HAMPORIUM hampers." />
              </Field>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Banner style">
                  <select value={display.theme} onChange={(e) => setNested(setForm, "websiteDisplay", "theme", e.target.value)} className={inputClass}>
                    <option value="cream">Cream</option>
                    <option value="dark">Dark</option>
                    <option value="orange">Orange</option>
                    <option value="gold">Gold</option>
                  </select>
                </Field>
                <Field label="Image focus">
                  <select value={display.imagePosition} onChange={(e) => setNested(setForm, "websiteDisplay", "imagePosition", e.target.value)} className={inputClass}>
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
                <NumberInput label="Image dark overlay %" value={display.overlayPercent} onChange={(value) => setNested(setForm, "websiteDisplay", "overlayPercent", value)} max="90" />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <BannerFileField
                  label="Desktop banner image"
                  existing={display.desktopImage?.url}
                  file={desktopBannerFile}
                  helper="Used by the popup, side ad or large home banner. If no visual placement is selected, the popup is turned on automatically."
                  onChange={(file) => {
                    setDesktopBannerFile(file);
                    if (file) {
                      setNested(setForm, "websiteDisplay", "enabled", true);
                      if (!display.homeBanner && !display.popupAd && !display.floatingAd) {
                        setNested(setForm, "websiteDisplay", "popupAd", true);
                      }
                    }
                  }}
                />
                <BannerFileField
                  label="Mobile banner image"
                  existing={display.mobileImage?.url}
                  file={mobileBannerFile}
                  helper="Optional mobile version. If blank, the desktop image is used on mobile too."
                  onChange={(file) => {
                    setMobileBannerFile(file);
                    if (file) {
                      setNested(setForm, "websiteDisplay", "enabled", true);
                      if (!display.homeBanner && !display.popupAd && !display.floatingAd) {
                        setNested(setForm, "websiteDisplay", "popupAd", true);
                      }
                    }
                  }}
                />
              </div>

              <PromotionPreview form={form} desktopBannerFile={desktopBannerFile} />
            </div>
          ) : null}
        </EditorSection>

        <details className="border border-black/[0.08] bg-white">
          <summary className="cursor-pointer px-5 py-4 text-[12px] font-black text-[#252525]">Advanced settings</summary>
          <div className="grid gap-5 border-t border-black/[0.07] p-5 md:grid-cols-2 xl:grid-cols-4">
            <NumberInput label="Campaign margin floor %" value={form.minGrossMarginPercent} onChange={(value) => setTop(setForm, "minGrossMarginPercent", value)} max="100" placeholder="Optional" />
            <NumberInput label="Priority" value={form.priority} onChange={(value) => setTop(setForm, "priority", value)} allowNegative />
            <Field label="Starts at"><input type="datetime-local" value={form.startsAt} onChange={(e) => setTop(setForm, "startsAt", e.target.value)} className={inputClass} /></Field>
            <Field label="Ends at"><input type="datetime-local" value={form.endsAt} onChange={(e) => setTop(setForm, "endsAt", e.target.value)} className={inputClass} /></Field>
            <TextInput label="Customer label" value={form.customerLabel} onChange={(value) => setTop(setForm, "customerLabel", value)} placeholder="Festive saving" />
            {!automatic ? (
              <ToggleLine checked={form.stackWithAutomaticSale} onChange={(value) => setTop(setForm, "stackWithAutomaticSale", value)} title="Can combine with automatic sale" text="Final price must still pass the margin guard." />
            ) : null}
            <Field label="Internal note"><textarea rows="3" value={form.internalNote} onChange={(e) => setTop(setForm, "internalNote", e.target.value)} className={textareaClass} /></Field>
          </div>
        </details>

        <div className="flex flex-wrap gap-3">
          <button disabled={saving} className={orangeButton}>{saving ? "Saving..." : editing ? "Save Offer" : "Create Offer"}</button>
          {editing ? <button type="button" onClick={onCancel} className={secondaryButton}>Cancel Edit</button> : null}
        </div>
      </form>
    </section>
  );
};

const PromotionRegister = ({ promotions, loading, onEdit, onStatus, onDelete }) => (
  <section className="pt-7">
    <SectionTitle
      eyebrow="Offers & Banners"
      title="Manage live campaigns"
      text="Edit banner creative, pause an offer instantly or remove an unused draft."
    />

    {loading ? (
      <LoadingBlock text="Loading offers..." />
    ) : (
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {promotions.map((promotion) => {
          const display = promotion.websiteDisplay || {};
          const image = display.desktopImage?.url || display.mobileImage?.url || "";
          return (
            <article key={promotion._id} className="overflow-hidden border border-black/[0.08] bg-white">
              {image ? (
                <div className="h-44 overflow-hidden bg-black/5">
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F97316]">{formatLabel(promotion.type)}</p>
                    <h3 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-[#202020]">{promotion.name}</h3>
                    <p className="mt-2 text-[11px] font-semibold text-black/48">
                      {promotionOffer(promotion)} {promotion.code ? `· ${promotion.code}` : "· No code"}
                    </p>
                  </div>
                  <StatusBadge text={formatLabel(promotion.status)} tone={promotion.status === "active" ? "green" : promotion.status === "paused" ? "amber" : "muted"} />
                </div>

                <div className="mt-5 grid gap-2 text-[11px] font-semibold text-black/55 sm:grid-cols-2">
                  <p><span className="text-black/35">Products:</span> {scopeSummary(promotion)}</p>
                  <p><span className="text-black/35">Customers:</span> {audienceSummary(promotion)}</p>
                  <p><span className="text-black/35">Website:</span> {display.enabled ? displayPlacements(display) : "Not advertised"}</p>
                  <p><span className="text-black/35">Dates:</span> {promotionWindow(promotion)}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-black/[0.07] pt-4">
                  <button type="button" onClick={() => onEdit(promotion)} className={secondaryButton}>Edit</button>
                  {promotion.status === "active" ? (
                    <button type="button" onClick={() => onStatus(promotion, "paused")} className={secondaryButton}>Pause</button>
                  ) : promotion.status !== "expired" ? (
                    <button type="button" onClick={() => onStatus(promotion, "active")} className={darkButton}>Make Live</button>
                  ) : null}
                  <button type="button" onClick={() => onDelete(promotion)} className={dangerButton}>Delete</button>
                </div>
              </div>
            </article>
          );
        })}
        {!promotions.length ? <LoadingBlock text="No offers created yet." /> : null}
      </div>
    )}
  </section>
);

const ImageManager = ({ images, busy, onUpload, onRemove }) => (
  <EditorSection title="Images" text="Add or remove the images used for this catalogue item.">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {(images || []).map((image, index) => (
        <div key={`${image.publicId || image.url}-${index}`} className="overflow-hidden border border-black/[0.08] bg-[#FAF9F6]">
          <div className="aspect-[4/3] bg-black/[0.03]">
            <img src={image.url} alt={image.alt || ""} className="h-full w-full object-cover" />
          </div>
          <button type="button" disabled={busy} onClick={() => onRemove(image)} className="w-full border-t border-black/[0.07] px-3 py-3 text-[10px] font-black text-red-600 hover:bg-red-50">
            Remove Image
          </button>
        </div>
      ))}
      <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center border border-dashed border-black/20 bg-white px-5 text-center hover:border-[#F97316]">
        <span className="text-[28px] font-light text-[#F97316]">+</span>
        <span className="mt-2 text-[11px] font-black text-[#242424]">Add Image</span>
        <span className="mt-1 text-[10px] font-medium text-black/42">JPG, PNG, WEBP or AVIF</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" disabled={busy} onChange={(event) => onUpload(event.target.files?.[0])} />
      </label>
    </div>
  </EditorSection>
);

const MaterialEditor = ({ title, rows, setRows, components, content = false }) => {
  const addRow = () => {
    const first = components[0];
    if (!first) return;
    setRows([
      ...rows,
      {
        component: first._id,
        quantity: 1,
        unit: "pc",
        ...(content ? { displayName: "", sortOrder: rows.length, isOptional: false } : { specification: "", notes: "" }),
      },
    ]);
  };

  const updateRow = (index, field, value) => {
    setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  return (
    <div className="mt-6 border-t border-black/[0.07] pt-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-black text-[#242424]">{title}</p>
          <p className="mt-1 text-[10px] font-medium text-black/45">Add, remove or change quantity.</p>
        </div>
        <button type="button" onClick={addRow} className={secondaryButton}>Add Item</button>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={row._id || `${idOf(row.component)}-${index}`} className="grid gap-3 border border-black/[0.08] bg-[#FCFBF8] p-4 lg:grid-cols-[minmax(0,1fr)_110px_90px_auto] lg:items-end">
            <Field label="Item">
              <select value={idOf(row.component)} onChange={(e) => updateRow(index, "component", e.target.value)} className={inputClass}>
                <option value="">Choose item</option>
                {components.map((option) => <option key={option._id} value={option._id}>{option.name} · {option.code}</option>)}
              </select>
            </Field>
            <NumberInput label="Quantity" value={row.quantity} onChange={(value) => updateRow(index, "quantity", value)} />
            <TextInput label="Unit" value={row.unit || "pc"} onChange={(value) => updateRow(index, "unit", value)} />
            <button type="button" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} className={dangerButton}>Remove</button>
            {content ? (
              <div className="lg:col-span-4 grid gap-3 md:grid-cols-2">
                <TextInput label="Customer display name" value={row.displayName || ""} onChange={(value) => updateRow(index, "displayName", value)} placeholder="Optional" />
                <ToggleLine checked={Boolean(row.isOptional)} onChange={(value) => updateRow(index, "isOptional", value)} title="Optional content" text="Mark this line optional in the recipe." />
              </div>
            ) : null}
          </div>
        ))}
        {!rows.length ? <p className="text-[11px] font-medium text-black/45">No items added.</p> : null}
      </div>
    </div>
  );
};

const DiscountEditor = ({ item, setItem }) => (
  <div className="mt-5 grid gap-5 md:grid-cols-3">
    <ToggleLine checked={Boolean(item.discount?.enabled)} onChange={(value) => setNested(setItem, "discount", "enabled", value)} title="Catalogue discount" text="Apply a permanent catalogue-level discount before GST." />
    <Field label="Discount type">
      <select value={item.discount?.type || "percentage"} onChange={(e) => setNested(setItem, "discount", "type", e.target.value)} className={inputClass}>
        <option value="percentage">Percentage</option>
        <option value="fixed">Fixed amount</option>
      </select>
    </Field>
    <NumberInput label={item.discount?.type === "fixed" ? "Discount amount" : "Discount %"} value={item.discount?.value} onChange={(value) => setNested(setItem, "discount", "value", value)} max={item.discount?.type === "percentage" ? "100" : undefined} />
  </div>
);

const AvailabilityEditor = ({ item, setItem, includeUnit = false }) => (
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
    <Field label="Stock status">
      <select value={item.availability?.status || "in_stock"} onChange={(e) => setNested(setItem, "availability", "status", e.target.value)} className={inputClass}>
        <option value="in_stock">In stock</option>
        <option value="incoming">Incoming</option>
        <option value="out_of_stock">Out of stock</option>
      </select>
    </Field>
    <NumberInput label="Available quantity" value={item.availability?.availableQuantity} onChange={(value) => setNested(setItem, "availability", "availableQuantity", value)} placeholder="Blank = not capped" />
    {includeUnit ? <TextInput label="Stock unit" value={item.availability?.unit || "pc"} onChange={(value) => setNested(setItem, "availability", "unit", value)} /> : null}
    <Field label="Next available date">
      <input type="date" value={dateInput(item.availability?.nextAvailableDate)} onChange={(e) => setNested(setItem, "availability", "nextAvailableDate", e.target.value)} className={inputClass} />
    </Field>
  </div>
);

const ChannelEditor = ({ item, setItem }) => (
  <div className="mt-5">
    <p className={labelClass}>Available channels</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["corporate", "Corporate"],
        ["wedding", "Wedding"],
        ["diwali", "Diwali"],
        ["hamperOne", "Hamper One"],
      ].map(([key, label]) => (
        <CheckCard key={key} label={label} checked={Boolean(item.channels?.[key])} onChange={(value) => setNested(setItem, "channels", key, value)} />
      ))}
    </div>
  </div>
);

const MultiPicker = ({ search, setSearch, results, loading, selected, onAdd, onRemove, placeholder, customer = false }) => (
  <div className="mt-5">
    <div className="relative">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className={inputClass} />
      {loading ? <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-black/40">Searching...</span> : null}
    </div>

    <div className="mt-3 max-h-[260px] overflow-y-auto border border-black/[0.08] bg-white">
      {results.map((option) => {
        const chosen = selected.some((item) => String(item._id) === String(option._id));
        return (
          <button key={option._id} type="button" disabled={chosen} onClick={() => onAdd(option)} className="flex w-full items-center justify-between gap-4 border-b border-black/[0.06] px-4 py-3 text-left last:border-b-0 hover:bg-[#FFF8F2] disabled:bg-black/[0.02]">
            <span className="min-w-0">
              <strong className="block truncate text-[12px] text-[#242424]">{optionLabel(option, customer)}</strong>
              <small className="mt-1 block truncate text-[10px] font-medium text-black/42">{optionSubLabel(option, customer)}</small>
            </span>
            <span className={`text-[10px] font-black ${chosen ? "text-emerald-700" : "text-[#F97316]"}`}>{chosen ? "Selected" : "Add"}</span>
          </button>
        );
      })}
      {!results.length && !loading ? <p className="p-4 text-[11px] font-medium text-black/45">No matches.</p> : null}
    </div>

    {selected.length ? (
      <div className="mt-4 flex flex-wrap gap-2">
        {selected.map((item) => (
          <button key={item._id} type="button" onClick={() => onRemove(item._id)} className="border border-[#D4AF37]/35 bg-[#FFF9F1] px-3 py-2 text-[10px] font-bold text-[#6F5418]">
            {optionLabel(item, customer)} <span className="ml-2">×</span>
          </button>
        ))}
      </div>
    ) : null}
  </div>
);

const BannerFileField = ({ label, existing, file, onChange, helper }) => (
  <Field label={label} helper={helper}>
    <label className="block cursor-pointer border border-dashed border-black/20 bg-[#FCFBF8] p-4 hover:border-[#F97316]">
      {existing ? <img src={existing} alt="" className="mb-3 h-32 w-full object-cover" /> : null}
      <p className="text-[11px] font-black text-[#252525]">{file?.name || (existing ? "Choose a replacement image" : "Choose image")}</p>
      <p className="mt-1 text-[10px] text-black/42">JPG, PNG, WEBP or AVIF · up to 8 MB</p>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} />
    </label>
  </Field>
);

const PromotionPreview = ({ form, desktopBannerFile }) => {
  const display = form.websiteDisplay || {};
  const filePreview = useObjectUrl(desktopBannerFile);
  const image = filePreview || display.desktopImage?.url || display.mobileImage?.url || "";
  return (
    <div className="overflow-hidden border border-black/[0.08] bg-[#17130E]">
      <div className="relative min-h-[280px]">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
        {image ? <div className="absolute inset-0 bg-black" style={{ opacity: Number(display.overlayPercent || 38) / 100 }} /> : null}
        <div className={`relative z-10 flex min-h-[280px] items-end p-6 sm:p-8 ${image ? "text-white" : themePreviewText(display.theme)}`}>
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">Website preview</p>
            <h3 className="mt-3 font-serif text-[38px] font-semibold leading-[0.95]">{display.headline || form.name || "Your campaign headline"}</h3>
            <p className="mt-4 max-w-xl text-[12px] font-medium leading-6 opacity-80">{display.message || "Your short campaign message will appear here."}</p>
            {form.code ? <p className="mt-4 text-[11px] font-black">Use code {form.code}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const EntityListRow = ({ item, type, active, onClick }) => {
  const archived = Boolean(item.masterState?.archived);
  const live = type === "product" ? item.status === "active" : item.isActive !== false;
  return (
    <button type="button" onClick={onClick} className={`block w-full border-b border-black/[0.055] px-5 py-4 text-left transition last:border-b-0 ${active ? "bg-[#FFF7F0]" : "bg-white hover:bg-[#FCFBF8]"}`}>
      <div className="flex items-start gap-3">
        {item.images?.[0]?.url ? <img src={item.images[0].url} alt="" className="h-12 w-12 shrink-0 object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#F8F5EF] text-[16px] text-[#B48723]">H</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold text-[#222]">{item.name || item.code}</p>
          <p className="mt-1 truncate text-[10px] font-semibold text-black/42">{item.code || item.slug || item.product?.name || ""}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge text={archived ? "Archived" : live ? "Live" : "Hidden"} tone={archived ? "muted" : live ? "green" : "amber"} />
            {cataloguePrice(item) !== null ? <span className="text-[10px] font-black text-[#F97316]">{money(cataloguePrice(item))}</span> : null}
          </div>
        </div>
      </div>
    </button>
  );
};

const EditorSection = ({ title, text, children }) => (
  <section className="border border-black/[0.08] bg-white">
    <div className="border-b border-black/[0.07] px-5 py-4 sm:px-6">
      <h3 className="text-[17px] font-black tracking-[-0.02em] text-[#242424]">{title}</h3>
      {text ? <p className="mt-1 text-[11px] font-medium leading-5 text-black/48">{text}</p> : null}
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </section>
);

const SectionTitle = ({ eyebrow, title, text }) => (
  <div className="border-b border-black/[0.08] pb-6">
    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#F97316]">{eyebrow}</p>
    <h2 className="mt-2 font-serif text-[36px] font-semibold tracking-[-0.03em] text-[#181715] sm:text-[43px]">{title}</h2>
    <p className="mt-3 max-w-3xl text-[13px] font-medium leading-6 text-black/55">{text}</p>
  </div>
);

const Field = ({ label, helper = "", children }) => (
  <label className="block min-w-0">
    <span className={labelClass}>{label}</span>
    {children}
    {helper ? <span className="mt-2 block text-[10px] font-medium leading-4 text-black/42">{helper}</span> : null}
  </label>
);

const TextInput = ({ label, value, onChange, placeholder = "", required = false }) => (
  <Field label={label}>
    <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className={inputClass} />
  </Field>
);

const NumberInput = ({ label, value, onChange, max, allowNegative = false, placeholder = "0", helper = "" }) => (
  <Field label={label} helper={helper}>
    <input type="number" min={allowNegative ? undefined : "0"} max={max} step="0.01" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
  </Field>
);

const ToggleLine = ({ checked, onChange, title, text }) => (
  <label className="flex cursor-pointer items-start gap-3 border border-black/[0.08] bg-[#FCFBF8] p-4">
    <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#F97316]" />
    <span>
      <span className="block text-[12px] font-black text-[#252525]">{title}</span>
      <span className="mt-1 block text-[10px] font-medium leading-4 text-black/48">{text}</span>
    </span>
  </label>
);

const CheckCard = ({ label, checked, onChange }) => (
  <label className={`flex cursor-pointer items-center gap-3 border px-4 py-3 text-[11px] font-black ${checked ? "border-[#F97316] bg-[#FFF7F0]" : "border-black/[0.08] bg-white"}`}>
    <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#F97316]" />
    {label}
  </label>
);

const Metric = ({ label, value }) => (
  <div className="bg-white p-5">
    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/42">{label}</p>
    <p className="mt-2 text-[22px] font-black tracking-[-0.03em] text-[#202020]">{value}</p>
  </div>
);

const StatusBadge = ({ text, tone = "muted" }) => {
  const style = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-black/10 bg-black/[0.03] text-black/55";
  return <span className={`inline-flex border px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] ${style}`}>{text}</span>;
};

const Notice = ({ children, tone = "warning" }) => {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-700" : tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#D4AF37]/35 bg-[#FFF9F1] text-[#735615]";
  return <div className={`mt-5 border px-4 py-3 text-[12px] font-semibold leading-6 ${styles}`}>{children}</div>;
};

const LoadingBlock = ({ text }) => <div className="mt-6 border border-black/[0.08] bg-white p-8 text-[12px] font-medium text-black/48">{text}</div>;

const TabButton = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} className={`min-h-10 border px-4 text-[11px] font-black transition ${active ? "border-[#171717] bg-[#171717] text-white" : "border-black/[0.09] bg-white text-[#333] hover:border-[#F97316]"}`}>{children}</button>
);

const setTop = (setter, field, value) => setter((current) => ({ ...current, [field]: value }));
const setNested = (setter, group, field, value) => setter((current) => ({ ...current, [group]: { ...(current?.[group] || {}), [field]: value } }));

const toggleIdInField = (setter, field, id) => setter((current) => {
  const ids = toIdArray(current?.[field]);
  const target = String(id);
  const next = ids.includes(target) ? ids.filter((value) => value !== target) : [...ids, target];
  return { ...current, [field]: next };
});

const addUniqueObject = (setter, field, option) => setter((current) => ({
  ...current,
  [field]: current[field].some((item) => String(item._id) === String(option._id)) ? current[field] : [...current[field], option],
}));

const removeObject = (setter, field, id) => setter((current) => ({
  ...current,
  [field]: current[field].filter((item) => String(item._id) !== String(id)),
}));

const prepareEntityPayload = (type, item) => {
  if (type === "product") {
    return {
      name: item.name,
      slug: item.slug,
      brand: item.brand,
      shortDescription: item.shortDescription,
      description: item.description,
      status: item.status,
      isFeatured: item.isFeatured,
      category: idOf(item.category),
      collections: toIdArray(item.collections),
      tags: Array.isArray(item.tags) ? item.tags : String(item.tags || "").split(",").map((value) => value.trim()).filter(Boolean),
    };
  }

  if (type === "sku") {
    return {
      name: item.name,
      code: item.code,
      skuBarcode: item.skuBarcode,
      baseSellingPrice: item.baseSellingPrice,
      mrp: item.mrp,
      taxEnabled: item.taxEnabled,
      taxPercent: item.taxPercent,
      hsnSac: item.hsnSac,
      discount: item.discount,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
      defaultCourierDays: item.defaultCourierDays,
      earliestExpiryDate: item.earliestExpiryDate,
      productionLeadTime: item.productionLeadTime,
      container: idOf(item.container),
      hamperContents: (item.hamperContents || []).map((row) => ({ ...row, component: idOf(row.component) })),
      internalMaterials: (item.internalMaterials || []).map((row) => ({ ...row, component: idOf(row.component) })),
      optionValues: item.optionValues,
    };
  }

  if (type === "component") {
    return {
      name: item.name,
      code: item.code,
      type: item.type,
      hamperRole: item.hamperRole,
      brand: item.brand,
      description: item.description,
      categoryCode: item.categoryCode,
      category: item.category,
      subcategory: item.subcategory,
      segment: item.segment,
      uom: item.uom,
      mrp: item.mrp,
      sellingPrice: item.sellingPrice,
      latestUnitCost: item.latestUnitCost,
      actualLandedCost: item.actualLandedCost,
      minGrossMarginPercent: item.minGrossMarginPercent,
      taxEnabled: item.taxEnabled,
      taxPercent: item.taxPercent,
      hsnSac: item.hsnSac,
      discount: item.discount,
      moqQty: item.moqQty,
      leadTimeDays: item.leadTimeDays,
      fragile: item.fragile,
      dietary: item.dietary,
      expiryTracked: item.expiryTracked,
      shelfLifeDays: item.shelfLifeDays,
      expiryDate: item.expiryDate,
      personalizable: item.personalizable,
      personalizationMethod: item.personalizationMethod,
      hamperUse: item.hamperUse,
      channels: item.channels,
      availability: item.availability,
      customerSelectable: item.customerSelectable,
      isActive: item.isActive,
      internalNotes: item.internalNotes,
    };
  }

  return {
    name: item.name,
    code: item.code,
    material: item.material,
    description: item.description,
    categoryCode: item.categoryCode,
    category: item.category,
    subcategory: item.subcategory,
    segment: item.segment,
    mrp: item.mrp,
    sellingPrice: item.sellingPrice,
    latestUnitCost: item.latestUnitCost,
    actualLandedCost: item.actualLandedCost,
    minGrossMarginPercent: item.minGrossMarginPercent,
    taxEnabled: item.taxEnabled,
    taxPercent: item.taxPercent,
    hsnSac: item.hsnSac,
    discount: item.discount,
    leadTimeDays: item.leadTimeDays,
    usableVolumePercent: item.usableVolumePercent,
    maxItems: item.maxItems,
    productionLeadTime: item.productionLeadTime,
    defaultCourierDays: item.defaultCourierDays,
    hamperUse: item.hamperUse,
    channels: item.channels,
    availability: item.availability,
    customerSelectable: item.customerSelectable,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    internalNotes: item.internalNotes,
    packingMaterials: (item.packingMaterials || []).map((row) => ({ ...row, component: idOf(row.component) })),
  };
};

const buildPromotionPayload = (form) => {
  const scope = { allSkus: form.scopeMode === "all", skus: [], products: [], categories: [], collections: [] };
  if (form.scopeMode !== "all") scope[scopeKind(form.scopeMode)] = form.scopeItems.map((item) => item._id);

  return {
    name: form.name,
    type: form.type,
    code: form.type === "automatic_sale" ? "" : form.code,
    status: form.status,
    discount: { type: form.discountType, value: Number(form.discountValue || 0) },
    automaticBand: {
      minDiscountPercent: Number(form.minDiscountPercent || 0),
      targetDiscountPercent: Number(form.targetDiscountPercent || 0),
      maxDiscountPercent: Number(form.maxDiscountPercent || 0),
    },
    minGrossMarginPercent: nullableNumber(form.minGrossMarginPercent),
    minOrderValue: Number(form.minOrderValue || 0),
    maxDiscountAmount: Number(form.maxDiscountAmount || 0),
    stackWithAutomaticSale: Boolean(form.stackWithAutomaticSale),
    scope,
    audience: {
      users: form.audienceUsers.map((user) => user._id),
      emails: splitEmails(form.audienceEmails),
    },
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    priority: Number(form.priority || 0),
    customerLabel: form.customerLabel,
    internalNote: form.internalNote,
    websiteDisplay: {
      ...form.websiteDisplay,
      overlayPercent: Number(form.websiteDisplay?.overlayPercent || 38),
      adDelaySeconds: Number(form.websiteDisplay?.adDelaySeconds ?? 2),
    },
  };
};

const promotionToForm = (promotion) => {
  const scope = promotion.scope || {};
  let scopeMode = "all";
  let scopeItems = [];
  if (scope.allSkus === false) {
    if (scope.skus?.length) { scopeMode = "sku"; scopeItems = scope.skus; }
    else if (scope.products?.length) { scopeMode = "product"; scopeItems = scope.products; }
    else if (scope.categories?.length) { scopeMode = "category"; scopeItems = scope.categories; }
    else if (scope.collections?.length) { scopeMode = "collection"; scopeItems = scope.collections; }
  }

  return {
    ...emptyPromotion,
    name: promotion.name || "",
    type: promotion.type || "public_coupon",
    code: promotion.code || "",
    status: promotion.status || "draft",
    discountType: promotion.discount?.type || "percentage",
    discountValue: String(promotion.discount?.value ?? 0),
    minDiscountPercent: String(promotion.automaticBand?.minDiscountPercent ?? 0),
    targetDiscountPercent: String(promotion.automaticBand?.targetDiscountPercent ?? 0),
    maxDiscountPercent: String(promotion.automaticBand?.maxDiscountPercent ?? 0),
    minGrossMarginPercent: nullableInput(promotion.minGrossMarginPercent),
    minOrderValue: String(promotion.minOrderValue ?? 0),
    maxDiscountAmount: String(promotion.maxDiscountAmount ?? 0),
    stackWithAutomaticSale: Boolean(promotion.stackWithAutomaticSale),
    scopeMode,
    scopeItems,
    audienceUsers: promotion.audience?.users || [],
    audienceEmails: (promotion.audience?.emails || []).join(", "),
    startsAt: dateTimeInput(promotion.startsAt),
    endsAt: dateTimeInput(promotion.endsAt),
    priority: String(promotion.priority ?? 0),
    customerLabel: promotion.customerLabel || "",
    internalNote: promotion.internalNote || "",
    websiteDisplay: {
      ...emptyPromotion.websiteDisplay,
      ...(promotion.websiteDisplay || {}),
      overlayPercent: String(promotion.websiteDisplay?.overlayPercent ?? 38),
      adDelaySeconds: String(promotion.websiteDisplay?.adDelaySeconds ?? 2),
    },
  };
};

const uploadPromotionBanner = async (promotionId, slot, file, alt) => {
  const form = new FormData();
  form.append("image", file);
  form.append("alt", alt || "HAMPORIUM offer");
  await api.post(`/promotions/admin/${promotionId}/display-image/${slot}`, form);
};

const scopeKind = (mode) => {
  if (mode === "product") return "products";
  if (mode === "sku") return "skus";
  if (mode === "category") return "categories";
  if (mode === "collection") return "collections";
  return "products";
};

const isPrivatePromotion = (type) => ["client_coupon", "customer_care"].includes(type);
const idOf = (value) => String(value?._id || value || "");
const toIdArray = (values) => (Array.isArray(values) ? values : []).map(idOf).filter(Boolean);
const splitEmails = (value) => String(value || "").split(/[\n,]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
const nullableNumber = (value) => value === "" || value === null || value === undefined ? null : Number(value);
const nullableInput = (value) => value === null || value === undefined ? "" : String(value);
const number = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nullableMoney = (value) => value === null || value === undefined ? "—" : money(value);
const nullablePercent = (value) => value === null || value === undefined ? "—" : `${number(value)}%`;
const formatLabel = (value = "") => String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const dateTimeInput = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "Open";
const promotionWindow = (promotion) => `${dateLabel(promotion.startsAt)} → ${dateLabel(promotion.endsAt)}`;

const cataloguePrice = (item) => {
  const value = item.price ?? item.sellingPrice ?? item.minPrice;
  return value === null || value === undefined || value === "" ? null : Number(value);
};

const optionLabel = (option, customer) => {
  if (customer) return option.name || option.email || "Customer";
  return option.name || option.code || option.slug || "Item";
};

const optionSubLabel = (option, customer) => {
  if (customer) return [option.email, option.phone].filter(Boolean).join(" · ");
  return [option.code, option.slug, option.product?.name].filter(Boolean).join(" · ");
};

const promotionOffer = (promotion) => {
  if (promotion.type === "automatic_sale") {
    return `${number(promotion.automaticBand?.targetDiscountPercent)}% preferred`;
  }
  if (promotion.discount?.type === "fixed") return `${money(promotion.discount?.value)} off`;
  return `${number(promotion.discount?.value)}% off`;
};

const scopeSummary = (promotion) => {
  const scope = promotion.scope || {};
  if (scope.allSkus !== false) return "All eligible products";
  if (scope.products?.length) return `${scope.products.length} hamper(s)`;
  if (scope.skus?.length) return `${scope.skus.length} selling option(s)`;
  if (scope.categories?.length) return `${scope.categories.length} category(s)`;
  if (scope.collections?.length) return `${scope.collections.length} collection(s)`;
  return "Restricted";
};

const audienceSummary = (promotion) => {
  if (!isPrivatePromotion(promotion.type)) return "All eligible customers";
  const users = promotion.audience?.users?.length || 0;
  const emails = promotion.audience?.emails?.length || 0;
  return `${users + emails} selected`;
};

const displayPlacements = (display) => [
  display.announcementBar && "top strip",
  display.homeBanner && "home banner",
  display.productBadge && "product badge",
  display.checkoutNote && "checkout",
  display.popupAd && "popup",
  display.floatingAd && "side ad",
].filter(Boolean).join(", ") || "Enabled";

const useObjectUrl = (file) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) { setUrl(""); return undefined; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
};

const themePreviewText = (theme) => theme === "cream" || theme === "gold" ? "bg-[#FFF1DE] text-[#241C14]" : theme === "orange" ? "bg-[#F47822] text-white" : "bg-[#17130E] text-white";

const labelClass = "mb-2 block text-[10px] font-black uppercase tracking-[0.09em] text-black/55";
const inputClass = "h-12 w-full border border-black/12 bg-white px-4 text-[13px] font-semibold text-[#171717] outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10";
const textareaClass = "w-full border border-black/12 bg-white px-4 py-3 text-[13px] font-medium leading-6 text-[#171717] outline-none transition placeholder:text-black/30 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10";
const darkButton = "inline-flex min-h-11 items-center justify-center border border-[#171717] bg-[#171717] px-5 text-[10px] font-black uppercase tracking-[0.06em] text-white transition hover:border-[#F97316] hover:bg-[#F97316] disabled:opacity-45";
const orangeButton = "inline-flex min-h-11 items-center justify-center border border-[#F97316] bg-[#F97316] px-6 text-[10px] font-black uppercase tracking-[0.06em] text-white transition hover:border-[#171717] hover:bg-[#171717] disabled:opacity-45";
const secondaryButton = "inline-flex min-h-11 items-center justify-center border border-black/12 bg-white px-5 text-[10px] font-black uppercase tracking-[0.05em] text-[#292929] transition hover:border-[#F97316]";
const dangerButton = "inline-flex min-h-11 items-center justify-center border border-red-200 bg-white px-5 text-[10px] font-black uppercase tracking-[0.05em] text-red-600 transition hover:bg-red-50";

export default MasterControl;
