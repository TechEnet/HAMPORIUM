import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";

import api from "../../api/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useDeliveryLocation } from "../../context/LocationContext.jsx";
import formatCurrency from "../../utils/formatCurrency.js";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const CHANNELS = ["corporate", "wedding", "diwali", "hamperOne"];
const ITEMS_PER_PAGE = 8;

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const BULK_PURPOSE_OPTIONS = [
  { value: "corporate", label: "Corporate" },
  { value: "wedding", label: "Wedding" },
  { value: "diwali", label: "Diwali" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDimensions = (dimensions, fallback = "—") => {
  if (!dimensions) return fallback;

  const { length, width, height, unit } = dimensions;

  if (
    [length, width, height].some(
      (value) => value === null || value === undefined || value === ""
    )
  ) {
    return fallback;
  }

  return `${length} × ${width} × ${height} ${unit || "cm"}`;
};

const formatWeight = (weight, fallback = "—") => {
  if (
    !weight ||
    weight.value === null ||
    weight.value === undefined ||
    weight.value === ""
  ) {
    return fallback;
  }

  return `${weight.value} ${weight.unit || "g"}`;
};

const formatPackSize = (component) => {
  const sizePack = String(component?.sizePack || "").trim();
  if (sizePack) return sizePack;

  const pieces = component?.piecesPerUom;
  const uom = String(component?.uom || "").trim();

  if (
    pieces !== null &&
    pieces !== undefined &&
    pieces !== "" &&
    Number.isFinite(Number(pieces)) &&
    uom
  ) {
    return `${pieces} ${uom}`;
  }

  return "—";
};

const taxLabel = (item) => {
  if (!item || item.taxEnabled === false) return "No GST";

  const rate = Number(item.taxPercent || 0);
  return rate > 0 ? `Includes ${rate}% GST` : "GST included";
};

const roleOf = (component) =>
  component?.hamperRole === "decoration" ? "decoration" : "content";

const PERSONALIZATION_ASSET_OPTIONS = [
  { value: "logo", label: "Logo" },
  { value: "icon", label: "Icon / mark" },
  { value: "gift_wrap", label: "Gift-wrap reference" },
  { value: "reference_design", label: "Design inspiration" },
];

const PERSONALIZATION_PLACEMENT_OPTIONS = [
  { value: "top_lid", label: "Top lid" },
  { value: "front", label: "Front of box" },
  { value: "inside_lid", label: "Inside lid" },
  { value: "gift_tag", label: "Gift tag" },
  { value: "message_card", label: "Message card" },
  { value: "ribbon_tag", label: "Ribbon tag" },
  { value: "full_wrap", label: "Full gift wrap" },
  { value: "other", label: "Other / see instructions" },
];

const emptyPersonalization = () => ({
  assets: [],
  message: "",
  instructions: "",
});

const personalizationLabel = (value, options) =>
  options.find((option) => option.value === value)?.label ||
  String(value || "").replaceAll("_", " ");

const CustomHamper = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addCustomHamper } = useCart();
  const { deliveryLocation } = useDeliveryLocation();

  const [searchParams] = useSearchParams();
  const requestedChannel = searchParams.get("channel") || "";
  const channel = CHANNELS.includes(requestedChannel)
    ? requestedChannel
    : "";

  const requestedMode =
    searchParams.get("mode") === "bulk" ? "bulk" : "personal";

  const defaultBulkPurpose = ["corporate", "wedding", "diwali"].includes(
    channel
  )
    ? channel
    : "other";

  const [containers, setContainers] = useState([]);
  const [components, setComponents] = useState([]);
  const [containerId, setContainerId] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedDecorations, setSelectedDecorations] = useState([]);
  const [configuration, setConfiguration] = useState(null);
  const [personalization, setPersonalization] = useState(
    emptyPersonalization
  );
  const [assetType, setAssetType] = useState("logo");
  const [assetPlacement, setAssetPlacement] = useState("top_lid");
  const [assetNotes, setAssetNotes] = useState("");
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [personalizationError, setPersonalizationError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [decorationSearch, setDecorationSearch] = useState("");
  const [itemPage, setItemPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [selectionPending, setSelectionPending] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [error, setError] = useState("");
  const [cartError, setCartError] = useState("");

  const [orderMode, setOrderMode] = useState(requestedMode);
  const [bulkQuantity, setBulkQuantity] = useState(25);
  const [bulkPurpose, setBulkPurpose] = useState(defaultBulkPurpose);
  const [bulkCompanyName, setBulkCompanyName] = useState("");
  const [bulkGstNumber, setBulkGstNumber] = useState("");
  const [bulkRequiredDate, setBulkRequiredDate] = useState("");
  const [bulkAddressModel, setBulkAddressModel] = useState("not_decided");
  const [bulkDeliveryLocations, setBulkDeliveryLocations] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [requestingQuote, setRequestingQuote] = useState(false);

  const contentComponents = useMemo(
    () => components.filter((component) => roleOf(component) === "content"),
    [components]
  );

  const decorativeComponents = useMemo(
    () =>
      components.filter((component) => roleOf(component) === "decoration"),
    [components]
  );

  const contentMap = useMemo(
    () =>
      new Map(
        contentComponents.map((component) => [
          String(component._id),
          component,
        ])
      ),
    [contentComponents]
  );

  const decorationComponentMap = useMemo(
    () =>
      new Map(
        decorativeComponents.map((component) => [
          String(component._id),
          component,
        ])
      ),
    [decorativeComponents]
  );

  const selectedContainer = useMemo(
    () =>
      containers.find((container) => container._id === containerId) || null,
    [containers, containerId]
  );

  const selectedMap = useMemo(
    () =>
      new Map(
        selectedItems.map((item) => [item.componentId, item.quantity])
      ),
    [selectedItems]
  );

  const decorationMap = useMemo(
    () =>
      new Map(
        selectedDecorations.map((item) => [
          item.componentId,
          item.quantity,
        ])
      ),
    [selectedDecorations]
  );

  const candidateMap = useMemo(
    () =>
      new Map(
        (configuration?.candidates || []).map((candidate) => [
          String(candidate.componentId),
          candidate,
        ])
      ),
    [configuration]
  );

  const categories = useMemo(
    () =>
      [
        ...new Set(
          contentComponents
            .map((component) => component.category)
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [contentComponents]
  );

  const subcategories = useMemo(() => {
    const source = categoryFilter
      ? contentComponents.filter(
          (component) => component.category === categoryFilter
        )
      : contentComponents;

    return [
      ...new Set(
        source.map((component) => component.subcategory).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [contentComponents, categoryFilter]);

  const visibleComponents = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = contentComponents.filter((component) => {
      if (categoryFilter && component.category !== categoryFilter) {
        return false;
      }

      if (
        subcategoryFilter &&
        component.subcategory !== subcategoryFilter
      ) {
        return false;
      }

      if (!query) return true;

      return [
        component.name,
        component.code,
        component.brand,
        component.category,
        component.subcategory,
        component.segment,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    if (!containerId || !configuration) {
      return filtered;
    }

    return filtered
      .filter((component) => {
        const quantity = selectedMap.get(component._id) || 0;

        if (quantity > 0) return true;

        const candidate = candidateMap.get(String(component._id));
        const missingPrice =
          component.sellingPrice === null ||
          component.sellingPrice === undefined;

        if (missingPrice) return false;
        if (!candidate) return true;

        return (
          candidate.selectable !== false &&
          Number(candidate.maxAdditionalQuantity || 0) > 0
        );
      })
      .sort((left, right) => {
        const leftSelected = (selectedMap.get(left._id) || 0) > 0;
        const rightSelected = (selectedMap.get(right._id) || 0) > 0;

        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1;
        }

        return 0;
      });
  }, [
    contentComponents,
    search,
    categoryFilter,
    subcategoryFilter,
    containerId,
    configuration,
    selectedMap,
    candidateMap,
  ]);

  const totalItemPages = Math.max(
    1,
    Math.ceil(visibleComponents.length / ITEMS_PER_PAGE)
  );

  const paginatedComponents = useMemo(() => {
    const start = (itemPage - 1) * ITEMS_PER_PAGE;
    return visibleComponents.slice(start, start + ITEMS_PER_PAGE);
  }, [visibleComponents, itemPage]);

  const itemRangeStart =
    visibleComponents.length === 0
      ? 0
      : (itemPage - 1) * ITEMS_PER_PAGE + 1;

  const itemRangeEnd = Math.min(
    itemPage * ITEMS_PER_PAGE,
    visibleComponents.length
  );

  const visibleDecorations = useMemo(() => {
    const query = decorationSearch.trim().toLowerCase();

    if (!query) return decorativeComponents;

    return decorativeComponents.filter((component) =>
      [
        component.name,
        component.code,
        component.brand,
        component.category,
        component.subcategory,
        component.segment,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [decorativeComponents, decorationSearch]);

  const selectedItemCount = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      ),
    [selectedItems]
  );

  const selectedDecorationCount = useMemo(
    () =>
      selectedDecorations.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      ),
    [selectedDecorations]
  );

  const previewItems = useMemo(() => {
    const result = [];

    for (const selection of selectedItems) {
      const component = contentMap.get(String(selection.componentId));
      if (!component) continue;

      const copies = Math.min(Number(selection.quantity || 1), 6);

      for (let index = 0; index < copies; index += 1) {
        result.push({
          id: `${component._id}-copy-${index}`,
          component,
          copyIndex: index,
        });
      }
    }

    return result.slice(0, 24);
  }, [selectedItems, contentMap]);

  const previewDecorations = useMemo(
    () =>
      selectedDecorations
        .map((selection) => ({
          selection,
          component: decorationComponentMap.get(
            String(selection.componentId)
          ),
        }))
        .filter((entry) => entry.component)
        .slice(0, 4),
    [selectedDecorations, decorationComponentMap]
  );

  const fillPercent = useMemo(() => {
    const used = Number(configuration?.capacity?.usedVolumeCm3 || 0);
    const total = Number(configuration?.capacity?.usableVolumeCm3 || 0);

    if (!total) return 0;
    return Math.min(100, Math.max(0, (used / total) * 100));
  }, [configuration?.capacity]);

  const canIncreaseAnyItem = useMemo(() => {
    if (!containerId || !configuration || validating || selectionPending) {
      return true;
    }

    return contentComponents.some((component) => {
      const candidate = candidateMap.get(String(component._id));
      const quantity = selectedMap.get(component._id) || 0;
      const hasSellingPrice =
        component.sellingPrice !== null &&
        component.sellingPrice !== undefined;

      return Boolean(
        hasSellingPrice &&
          quantity < 99 &&
          candidate &&
          candidate.selectable !== false &&
          Number(candidate.maxAdditionalQuantity || 0) > 0
      );
    });
  }, [
    containerId,
    configuration,
    validating,
    selectionPending,
    contentComponents,
    candidateMap,
    selectedMap,
  ]);

  const personalizationPayload = useMemo(() => {
    const assets = (personalization.assets || []).map((asset) => ({
      type: asset.type,
      url: asset.url,
      publicId: asset.publicId,
      uploadProof: asset.uploadProof || "",
      fileName: asset.fileName || "",
      mimeType: asset.mimeType || "",
      size: Number(asset.size || 0),
      placement: asset.placement || "top_lid",
      notes: asset.notes || "",
    }));

    const message = personalization.message.trim();
    const instructions = personalization.instructions.trim();
    const enabled = Boolean(assets.length || message || instructions);

    return enabled
      ? {
          enabled: true,
          assets,
          message,
          instructions,
        }
      : null;
  }, [personalization]);

  useEffect(() => {
    const loadBuilderData = async () => {
      setLoading(true);
      setError("");

      try {
        const suffix = channel
          ? `?channel=${encodeURIComponent(channel)}`
          : "";

        const [containerResponse, componentResponse] = await Promise.all([
          api.get(`/catalog/containers${suffix}`),
          api.get(`/catalog/components${suffix}`),
        ]);

        const loadedContainers = containerResponse.data.containers || [];
        const loadedComponents = componentResponse.data.components || [];

        setContainers(loadedContainers);
        setComponents(loadedComponents);
        setContainerId(loadedContainers[0]?._id || "");
        setSelectedItems([]);
        setSelectedDecorations([]);
        setConfiguration(null);
        setPersonalization(emptyPersonalization());
        setPersonalizationError("");
        setSelectionPending(false);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load custom hamper options"
        );
      } finally {
        setLoading(false);
      }
    };

    loadBuilderData();
  }, [channel]);

  useEffect(() => {
    setOrderMode(requestedMode);
  }, [requestedMode]);

  useEffect(() => {
    if (["corporate", "wedding", "diwali"].includes(channel)) {
      setBulkPurpose(channel);
    }
  }, [channel]);

  useEffect(() => {
    if (!containerId) {
      setConfiguration(null);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setValidating(true);

      try {
        const response = await api.post(
          "/catalog/configurations/validate",
          {
            containerId,
            items: selectedItems,
            decorations: selectedDecorations,
            candidateIds: contentComponents.map(
              (component) => component._id
            ),
            channel: channel || undefined,
          }
        );

        if (!cancelled) {
          setConfiguration(response.data.configuration || null);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setConfiguration(null);
          setError(
            requestError.response?.data?.message ||
              "Unable to validate this hamper"
          );
        }
      } finally {
        if (!cancelled) {
          setValidating(false);
          setSelectionPending(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    containerId,
    selectedItems,
    selectedDecorations,
    contentComponents,
    channel,
  ]);

  useEffect(() => {
    if (categoryFilter && !categories.includes(categoryFilter)) {
      setCategoryFilter("");
    }
  }, [categories, categoryFilter]);

  useEffect(() => {
    if (
      subcategoryFilter &&
      !subcategories.includes(subcategoryFilter)
    ) {
      setSubcategoryFilter("");
    }
  }, [subcategories, subcategoryFilter]);

  useEffect(() => {
    setItemPage(1);
  }, [search, categoryFilter, subcategoryFilter, containerId]);

  useEffect(() => {
    if (itemPage > totalItemPages) {
      setItemPage(totalItemPages);
    }
  }, [itemPage, totalItemPages]);

  const setSelectionQuantity = (setter, componentId, quantity) => {
    const nextQuantity = Number(quantity);

    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) return;

    setter((current) => {
      const withoutItem = current.filter(
        (item) => item.componentId !== componentId
      );

      if (nextQuantity === 0) return withoutItem;

      return [
        ...withoutItem,
        {
          componentId,
          quantity: Math.min(99, nextQuantity),
        },
      ];
    });
  };

  const incrementItem = (component) => {
    const currentQuantity = selectedMap.get(component._id) || 0;
    const candidate = candidateMap.get(String(component._id));

    if (selectionPending || validating || !configuration) return;

    if (
      component.sellingPrice === null ||
      component.sellingPrice === undefined
    ) {
      return;
    }

    if (
      !candidate ||
      candidate.selectable === false ||
      Number(candidate.maxAdditionalQuantity || 0) <= 0 ||
      currentQuantity >= 99
    ) {
      return;
    }

    setSelectionPending(true);
    setSelectionQuantity(
      setSelectedItems,
      component._id,
      currentQuantity + 1
    );
  };

  const decrementItem = (component) => {
    const currentQuantity = selectedMap.get(component._id) || 0;
    if (currentQuantity <= 0) return;

    setSelectionQuantity(
      setSelectedItems,
      component._id,
      currentQuantity - 1
    );
  };

  const incrementDecoration = (component) => {
    const currentQuantity = decorationMap.get(component._id) || 0;

    if (
      component.sellingPrice === null ||
      component.sellingPrice === undefined
    ) {
      return;
    }

    setSelectionQuantity(
      setSelectedDecorations,
      component._id,
      currentQuantity + 1
    );
  };

  const decrementDecoration = (component) => {
    const currentQuantity = decorationMap.get(component._id) || 0;
    if (currentQuantity <= 0) return;

    setSelectionQuantity(
      setSelectedDecorations,
      component._id,
      currentQuantity - 1
    );
  };

  const updatePersonalizationAsset = (index, field, value) => {
    setPersonalization((current) => ({
      ...current,
      assets: current.assets.map((asset, assetIndex) =>
        assetIndex === index
          ? {
              ...asset,
              [field]: value,
            }
          : asset
      ),
    }));
  };

  const handlePersonalizationUpload = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    if (!user) {
      setPersonalizationError("Login before uploading artwork.");
      return;
    }

    if ((personalization.assets || []).length >= 4) {
      setPersonalizationError("You can upload up to 4 personalization images.");
      return;
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ]);

    if (!allowedTypes.has(file.type)) {
      setPersonalizationError("Upload JPG, PNG, WEBP or AVIF images only.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPersonalizationError(
        "Each personalization image must be 5 MB or smaller."
      );
      return;
    }

    setUploadingAsset(true);
    setPersonalizationError("");

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", assetType);

      const response = await api.post(
        "/cart/custom-hampers/personalization-assets",
        formData
      );

      const uploaded = response.data.asset;

      setPersonalization((current) => ({
        ...current,
        assets: [
          ...current.assets,
          {
            ...uploaded,
            placement: assetPlacement,
            notes: assetNotes.trim(),
          },
        ].slice(0, 4),
      }));

      setAssetNotes("");
    } catch (requestError) {
      setPersonalizationError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to upload personalization image"
      );
    } finally {
      setUploadingAsset(false);
    }
  };

  const removePersonalizationAsset = async (index) => {
    const asset = personalization.assets[index];
    if (!asset) return;

    setPersonalizationError("");

    try {
      if (user && asset.publicId) {
        await api.delete("/cart/custom-hampers/personalization-assets", {
          data: {
            publicId: asset.publicId,
            url: asset.url,
            uploadProof: asset.uploadProof,
          },
        });
      }

      setPersonalization((current) => ({
        ...current,
        assets: current.assets.filter((_, assetIndex) => assetIndex !== index),
      }));
    } catch (requestError) {
      setPersonalizationError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to remove personalization image"
      );
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (
      !containerId ||
      selectedItems.length === 0 ||
      !configuration?.orderable
    ) {
      setCartError(
        "Choose at least one hamper item and make sure the hamper is Ready before adding it to cart."
      );
      return;
    }

    setAddingToCart(true);
    setCartError("");

    try {
      await addCustomHamper({
        containerId,
        items: selectedItems,
        decorations: selectedDecorations,
        channel,
        personalization: personalizationPayload,
        quantity: 1,
        source: "custom_hamper",
        pagePath: `${window.location.pathname}${window.location.search}`,
        location: deliveryLocation,
      });

      navigate("/cart");
    } catch (requestError) {
      setCartError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to add custom hamper to cart"
      );
    } finally {
      setAddingToCart(false);
    }
  };

  const handleRequestQuotation = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (
      !containerId ||
      selectedItems.length === 0 ||
      !configuration?.orderable
    ) {
      setCartError(
        "Choose at least one hamper item and make sure the hamper is Ready before requesting a quotation."
      );
      return;
    }

    const parsedQuantity = Number(bulkQuantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 100000
    ) {
      setCartError("Enter a valid bulk quantity between 1 and 100000.");
      return;
    }

    if (!bulkRequiredDate) {
      setCartError("Choose the date by which you need the bulk order.");
      return;
    }

    const deliveryLocations = bulkDeliveryLocations
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 100);

    setRequestingQuote(true);
    setCartError("");

    try {
      const response = await api.post("/rfqs/custom-hamper", {
        containerId,
        items: selectedItems,
        decorations: selectedDecorations,
        channel,
        personalization: personalizationPayload,
        quantity: parsedQuantity,
        purpose: bulkPurpose,
        companyName: bulkCompanyName.trim(),
        gstNumber: bulkGstNumber.trim(),
        requiredDeliveryDate: bulkRequiredDate,
        addressModel: bulkAddressModel,
        deliveryLocations,
        notes: bulkNotes.trim(),
      });

      const rfqId = response.data?.rfq?._id;

      if (!rfqId) {
        throw new Error("RFQ was created but its ID was not returned.");
      }

      navigate(`/account/corporate/rfqs/${rfqId}`);
    } catch (requestError) {
      setCartError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to submit quotation request"
      );
    } finally {
      setRequestingQuote(false);
    }
  };

  if (loading) {
    return <CustomHamperSkeleton />;
  }

  const canAddToCart =
    Boolean(containerId) &&
    selectedItems.length > 0 &&
    Boolean(configuration?.orderable) &&
    !validating &&
    !selectionPending &&
    !addingToCart;

  const canRequestQuote =
    Boolean(containerId) &&
    selectedItems.length > 0 &&
    Boolean(configuration?.orderable) &&
    Boolean(bulkRequiredDate) &&
    Number.isInteger(Number(bulkQuantity)) &&
    Number(bulkQuantity) >= 1 &&
    Number(bulkQuantity) <= 100000 &&
    !validating &&
    !selectionPending &&
    !requestingQuote;

  const canPrimaryAction =
    orderMode === "bulk" ? canRequestQuote : canAddToCart;

  const primaryBusy =
    orderMode === "bulk" ? requestingQuote : addingToCart;

  const currentBuilderStep =
    selectedItems.length === 0
      ? 2
      : selectedDecorationCount === 0 && !personalizationPayload
        ? 3
        : !personalizationPayload
          ? 4
          : 5;

  return (
    <main
      className="min-h-screen bg-[#FBF8F3] pb-20 pt-[92px] text-[#171717]"
      style={{ fontFamily: "'Manrope', Arial, sans-serif" }}
    >
      <style>{`
        @keyframes v7Rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes v7Glow {
          0%, 100% { opacity: .2; transform: translateX(-50%) scale(.95); }
          50% { opacity: .38; transform: translateX(-50%) scale(1.04); }
        }

        @keyframes v7Spark {
          0%, 100% { opacity: .18; transform: translateY(0) rotate(0deg) scale(.9); }
          50% { opacity: .8; transform: translateY(-5px) rotate(12deg) scale(1.12); }
        }

        @keyframes v7DecorationPop {
          from { opacity: 0; transform: scale(.65) rotate(-7deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        @keyframes v9SvgDrop {
          0% { opacity: 0; transform: translateY(-150px) scale(.72) rotate(-7deg); }
          58% { opacity: 1; transform: translateY(10px) scale(1.04) rotate(2deg); }
          76% { transform: translateY(-4px) scale(.985) rotate(-1deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--v9-turn)); }
        }

        @keyframes v9BoxPop {
          from { opacity: .35; transform: translateY(10px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes v9LidClose {
          0% { opacity: 0; transform: translateY(-28px) scale(.96); }
          56% { opacity: 1; transform: translateY(6px) scale(1.012); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        .v7-reveal { animation: v7Rise .45s cubic-bezier(.2,.75,.2,1) both; }
        .v7-glow { animation: v7Glow 3.6s ease-in-out infinite; }
        .v7-spark { animation: v7Spark 2.8s ease-in-out infinite; }
        .v7-decoration { animation: v7DecorationPop .36s ease-out both; }

        .v9-svg-box {
          transform-origin: 50% 56%;
          animation: v9BoxPop .45s cubic-bezier(.2,.76,.2,1) both;
        }

        .v9-lid-close {
          transform-origin: 50% 50%;
          animation: v9LidClose .66s cubic-bezier(.2,.76,.2,1) both;
        }

        .v9-svg-item {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: v9SvgDrop .74s cubic-bezier(.18,.78,.2,1) both;
          will-change: transform, opacity;
        }

        @keyframes v10Shimmer {
          0% { transform: translateX(-140%); }
          100% { transform: translateX(420%); }
        }

        .v10-soft-scroll {
          scrollbar-width: none;
        }

        .v10-soft-scroll::-webkit-scrollbar {
          display: none;
        }

        .v10-primary-cta {
          position: relative;
          overflow: hidden;
        }

        .v10-primary-cta::after {
          content: "";
          position: absolute;
          inset: -60% auto -60% -34%;
          width: 22%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.38), transparent);
          transform: skewX(-18deg);
          pointer-events: none;
        }

        .v10-primary-cta:hover::after {
          animation: v10Shimmer .8s cubic-bezier(.16,1,.3,1);
        }

        @keyframes v13ModalBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes v13ModalPanelIn {
          from { opacity: 0; transform: translateY(16px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .v13-modal-backdrop {
          animation: v13ModalBackdropIn .18s ease-out both;
        }

        .v13-modal-panel {
          animation: v13ModalPanelIn .24s cubic-bezier(.2,.78,.2,1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .v7-reveal, .v7-glow, .v7-spark, .v7-decoration, .v9-svg-box, .v9-svg-item, .v13-modal-backdrop, .v13-modal-panel {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 min-[2200px]:px-16">
        <div className="v7-reveal border-b border-black/[0.07] pb-6 pt-3 sm:pb-7">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-black/36">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="transition hover:text-[#F47822]"
            >
              Home
            </button>
            <span>›</span>
            <span className="text-black/58">
              Build Your Own Hamper
            </span>
          </div>

          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(560px,.92fr)] lg:items-end 2xl:grid-cols-[minmax(0,1.05fr)_minmax(650px,.95fr)]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F47822]">
                Curate it your way
              </p>

              <h1
                style={{
                  fontFamily:
                    DISPLAY_FONT,
                }}
                className="mt-2 max-w-[980px] text-[clamp(48px,5vw,94px)] font-semibold leading-[0.88] tracking-[-0.045em] text-[#171717]"
              >
                Create Your Own Hamper
              </h1>

              <p className="mt-3 max-w-[760px] text-[13px] font-medium leading-6 text-black/48 sm:text-[14px] 2xl:text-[15px]">
                Choose the box, add the gifts, finish the details and make it unmistakably yours.
              </p>
            </div>

            <div className="min-w-0">
              <div className="v10-soft-scroll overflow-x-auto">
                <div className="flex min-w-[560px] items-start">
                  {[
                    [1, "Choose Box"],
                    [2, "Add Items"],
                    [3, "Finishing"],
                    [4, "Personalise"],
                    [5, orderMode === "bulk" ? "Quote" : "Review"],
                  ].map(([step, label], index, list) => {
                    const active =
                      currentBuilderStep ===
                      step;

                    const complete =
                      currentBuilderStep >
                      step;

                    return (
                      <div
                        key={step}
                        className="flex flex-1 items-start"
                      >
                        <div className="flex min-w-[88px] flex-col items-center text-center">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-full border text-[10px] font-black transition ${
                              active
                                ? "border-[#F47822] bg-[#F47822] text-white shadow-[0_8px_22px_rgba(244,120,34,.22)]"
                                : complete
                                  ? "border-[#D4AF37] bg-[#FFF8E8] text-[#9A7316]"
                                  : "border-black/[0.10] bg-white text-black/38"
                            }`}
                          >
                            {complete
                              ? "✓"
                              : String(
                                  step
                                ).padStart(
                                  2,
                                  "0"
                                )}
                          </span>

                          <span
                            className={`mt-2 text-[9px] font-black ${
                              active
                                ? "text-[#171717]"
                                : "text-black/38"
                            }`}
                          >
                            {label}
                          </span>
                        </div>

                        {index <
                          list.length -
                            1 && (
                          <span
                            className={`mt-5 h-px flex-1 ${
                              complete
                                ? "bg-[#D4AF37]"
                                : "bg-black/[0.10]"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <OrderModeChooser
                mode={orderMode}
                onChange={(nextMode) => {
                  setOrderMode(nextMode);
                  setCartError("");
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="v7-reveal mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_clamp(420px,25vw,520px)] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_clamp(460px,23vw,560px)] 2xl:gap-8">
          <div className="min-w-0 w-full space-y-5">
            <V7Section
              number="01"
              title="Choose Your Hamper Box"
              meta={selectedContainer ? selectedContainer.name : "Select a base"}
            >
              {containers.length === 0 ? (
                <V7Empty>No custom hamper boxes are available right now.</V7Empty>
              ) : (
                <V15ContainerCarousel>
                  {containers.map((container) => (
                    <div
                      key={container._id}
                      data-hamper-box-slide="true"
                      className="w-[82%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-3rem)/4)]"
                    >
                      <V7ContainerCard
                        container={container}
                        active={container._id === containerId}
                        onClick={() => {
                          if (container._id === containerId) return;

                          setContainerId(container._id);
                          setSelectedItems([]);
                          setSelectedDecorations([]);
                          setConfiguration(null);
                          setSelectionPending(false);
                          setCartError("");
                        }}
                      />
                    </div>
                  ))}
                </V15ContainerCarousel>
              )}
            </V7Section>

            <V7Section
              number="02"
              title="Add Products"
              meta={
                selectedItemCount > 0
                  ? `${selectedItemCount} inside`
                  : "Pick your favourites"
              }
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-black/24">
                    ⌕
                  </span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search products..."
                    className="h-12 w-full rounded-full border border-black/[0.08] bg-[#FAF8F5] pl-11 pr-4 text-[12px] font-semibold outline-none transition focus:border-[#F47822] focus:bg-white focus:ring-4 focus:ring-[#F47822]/10"
                  />
                </div>

                <select
                  value={subcategoryFilter}
                  onChange={(event) => setSubcategoryFilter(event.target.value)}
                  className="h-12 rounded-full border border-black/[0.08] bg-[#FAF8F5] px-4 text-[11px] font-bold outline-none transition focus:border-[#F47822] focus:bg-white"
                >
                  <option value="">All subcategories</option>
                  {subcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
              </div>

              <div className="v10-soft-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("");
                    setSubcategoryFilter("");
                  }}
                  className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black transition ${
                    !categoryFilter
                      ? "border-[#F47822] bg-[#F47822] text-white"
                      : "border-black/[0.08] bg-white text-black/50 hover:border-[#F47822]/40 hover:text-[#F47822]"
                  }`}
                >
                  All Products
                </button>

                {categories.slice(0, 8).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(category);
                      setSubcategoryFilter("");
                    }}
                    className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black transition ${
                      categoryFilter === category
                        ? "border-[#171717] bg-[#171717] text-white"
                        : "border-black/[0.08] bg-white text-black/50 hover:border-[#F47822]/40 hover:text-[#F47822]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-black/35">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Only gift items that still fit stay visible
                </div>

                {(validating || selectionPending) && (
                  <span className="rounded-full bg-[#171717] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                    Checking fit…
                  </span>
                )}
              </div>

              {visibleComponents.length === 0 ? (
                <V7Empty>
                  This box has reached its practical limit. Remove an item or
                  choose a larger box.
                </V7Empty>
              ) : (
                <div
                  data-hamper-products-grid="true"
                  className="mt-5 grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4"
                >
                  {paginatedComponents.map((component) => {
                    const quantity = selectedMap.get(component._id) || 0;
                    const candidate = candidateMap.get(String(component._id));
                    const missingPrice =
                      component.sellingPrice === null ||
                      component.sellingPrice === undefined;
                    const cannotAddMore = Boolean(
                      !candidate ||
                        candidate.selectable === false ||
                        Number(candidate.maxAdditionalQuantity || 0) <= 0
                    );

                    return (
                      <V7ProductCard
                        key={component._id}
                        component={component}
                        quantity={quantity}
                        selected={quantity > 0}
                        locked={missingPrice || cannotAddMore}
                        checking={validating || selectionPending}
                        fitLeft={Number(candidate?.maxAdditionalQuantity || 0)}
                        onMinus={() => decrementItem(component)}
                        onPlus={() => incrementItem(component)}
                      />
                    );
                  })}
                </div>
              )}

              {visibleComponents.length > 0 && (
                <ProductPager
                  page={itemPage}
                  totalPages={totalItemPages}
                  totalItems={visibleComponents.length}
                  rangeStart={itemRangeStart}
                  rangeEnd={itemRangeEnd}
                  onPageChange={setItemPage}
                />
              )}
            </V7Section>

            <V7Section
              number="03"
              title="Finishing Touches"
              meta={
                selectedDecorationCount > 0
                  ? `${selectedDecorationCount} selected`
                  : "Optional"
              }
              gold
            >
              <div className="mb-4 flex flex-col gap-3 rounded-[16px] border border-[#D4AF37]/18 bg-[#FFFCF5] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black text-[#171717]">
                    Finishing materials stay outside the gift-capacity calculation.
                  </p>
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-black/42">
                    Ribbons, flowers, tags, sleeves and similar decorative finishes are priced separately and do not consume the box volume reserved for gift products.
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-[#D4AF37]/28 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#8B6817]">
                  0% box capacity
                </span>
              </div>

              {decorativeComponents.length > 0 && (
                <div className="relative max-w-md">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-black/25">
                    ⌕
                  </span>
                  <input
                    value={decorationSearch}
                    onChange={(event) => setDecorationSearch(event.target.value)}
                    placeholder="Search ribbon, flowers, tags…"
                    className="h-11 w-full rounded-xl border border-[#D4AF37]/20 bg-[#FFFCF6] pl-9 pr-3 text-[12px] font-semibold outline-none transition focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/10"
                  />
                </div>
              )}

              {visibleDecorations.length === 0 ? (
                <V7Empty>No decorative finishes are available yet.</V7Empty>
              ) : (
                <div className="mt-5 grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                  {visibleDecorations.map((component) => (
                    <V7DecorationCard
                      key={component._id}
                      component={component}
                      quantity={decorationMap.get(component._id) || 0}
                      onMinus={() => decrementDecoration(component)}
                      onPlus={() => incrementDecoration(component)}
                    />
                  ))}
                </div>
              )}
            </V7Section>

            <V7Section
              number="04"
              title="Personalisation"
              meta={personalizationPayload ? "Personalised" : "Optional"}
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)]">
                <div>
                  <div className="rounded-[18px] border border-black/[0.07] bg-[#FAF8F5] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F47822]">
                          Upload your artwork
                        </p>
                        <p className="mt-1 max-w-xl text-[12px] font-semibold leading-5 text-black/48">
                          Add a logo, icon, gift-wrap reference or design image.
                          This is a production reference, not a photorealistic
                          print proof.
                        </p>
                      </div>

                      <span className="rounded-full border border-black/[0.07] bg-white px-3 py-1.5 text-[9px] font-black text-black/40">
                        {personalization.assets.length}/4 files
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.08em] text-black/35">
                          Artwork type
                        </span>
                        <select
                          value={assetType}
                          onChange={(event) => setAssetType(event.target.value)}
                          className="h-11 w-full rounded-xl border border-black/[0.09] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#F47822]"
                        >
                          {PERSONALIZATION_ASSET_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.08em] text-black/35">
                          Preferred placement
                        </span>
                        <select
                          value={assetPlacement}
                          onChange={(event) =>
                            setAssetPlacement(event.target.value)
                          }
                          className="h-11 w-full rounded-xl border border-black/[0.09] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#F47822]"
                        >
                          {PERSONALIZATION_PLACEMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="mt-3 block">
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.08em] text-black/35">
                        Placement note
                      </span>
                      <input
                        value={assetNotes}
                        maxLength={500}
                        onChange={(event) => setAssetNotes(event.target.value)}
                        placeholder="Example: centre aligned, small mark, use only the gold part"
                        className="h-11 w-full rounded-xl border border-black/[0.09] bg-white px-3 text-[12px] font-semibold outline-none focus:border-[#F47822]"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {user ? (
                        <label
                          className={`inline-flex h-11 cursor-pointer items-center justify-center rounded-xl px-4 text-[10px] font-black uppercase tracking-[0.08em] text-white transition ${
                            uploadingAsset || personalization.assets.length >= 4
                              ? "pointer-events-none bg-black/25"
                              : "bg-[#171717] hover:bg-[#F47822]"
                          }`}
                        >
                          {uploadingAsset ? "Uploading…" : "Choose image"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            disabled={
                              uploadingAsset || personalization.assets.length >= 4
                            }
                            onChange={handlePersonalizationUpload}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate("/login")}
                          className="h-11 rounded-xl bg-[#171717] px-4 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#F47822]"
                        >
                          Login to upload artwork
                        </button>
                      )}

                      <span className="text-[10px] font-semibold text-black/32">
                        JPG, PNG, WEBP or AVIF · max 5 MB each
                      </span>
                    </div>

                    {personalizationError && (
                      <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold leading-4 text-red-700">
                        {personalizationError}
                      </p>
                    )}
                  </div>

                  {personalization.assets.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {personalization.assets.map((asset, index) => (
                        <div
                          key={asset.publicId || `${asset.url}-${index}`}
                          className="overflow-hidden rounded-[18px] border border-black/[0.07] bg-white"
                        >
                          <div className="flex gap-3 p-3">
                            <img
                              src={asset.url}
                              alt={asset.fileName || "Personalization artwork"}
                              className="h-20 w-20 shrink-0 rounded-xl border border-black/[0.06] bg-[#F6F2EC] object-contain p-1"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-black text-[#171717]">
                                    {asset.fileName ||
                                      personalizationLabel(
                                        asset.type,
                                        PERSONALIZATION_ASSET_OPTIONS
                                      )}
                                  </p>
                                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#F47822]">
                                    {personalizationLabel(
                                      asset.type,
                                      PERSONALIZATION_ASSET_OPTIONS
                                    )}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removePersonalizationAsset(index)}
                                  className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[9px] font-black text-red-600 hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-2 border-t border-black/[0.055] bg-[#FAF8F5] p-3">
                            <select
                              value={asset.placement || "top_lid"}
                              onChange={(event) =>
                                updatePersonalizationAsset(
                                  index,
                                  "placement",
                                  event.target.value
                                )
                              }
                              className="h-9 rounded-lg border border-black/[0.08] bg-white px-2.5 text-[10px] font-bold outline-none focus:border-[#F47822]"
                            >
                              {PERSONALIZATION_PLACEMENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            <input
                              value={asset.notes || ""}
                              maxLength={500}
                              onChange={(event) =>
                                updatePersonalizationAsset(
                                  index,
                                  "notes",
                                  event.target.value
                                )
                              }
                              placeholder="Artwork note"
                              className="h-9 rounded-lg border border-black/[0.08] bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-[#F47822]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block rounded-[18px] border border-black/[0.07] bg-white p-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-black/35">
                      Text to print / add
                    </span>
                    <textarea
                      rows="4"
                      maxLength={500}
                      value={personalization.message}
                      onChange={(event) =>
                        setPersonalization((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                      placeholder="Example: Happy Anniversary, A & R"
                      className="mt-2 w-full resize-none rounded-xl border border-black/[0.08] bg-[#FAF8F5] p-3 text-[12px] font-semibold leading-5 outline-none focus:border-[#F47822] focus:bg-white"
                    />
                    <span className="mt-1 block text-right text-[8px] font-bold text-black/25">
                      {personalization.message.length}/500
                    </span>
                  </label>

                  <label className="block rounded-[18px] border border-black/[0.07] bg-white p-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-black/35">
                      Production instructions
                    </span>
                    <textarea
                      rows="6"
                      maxLength={1500}
                      value={personalization.instructions}
                      onChange={(event) =>
                        setPersonalization((current) => ({
                          ...current,
                          instructions: event.target.value,
                        }))
                      }
                      placeholder="Tell us the look you want: colours, wrap style, logo size, what must not change, etc."
                      className="mt-2 w-full resize-none rounded-xl border border-black/[0.08] bg-[#FAF8F5] p-3 text-[12px] font-semibold leading-5 outline-none focus:border-[#F47822] focus:bg-white"
                    />
                    <span className="mt-1 block text-right text-[8px] font-bold text-black/25">
                      {personalization.instructions.length}/1500
                    </span>
                  </label>

                </div>
              </div>
            </V7Section>

            {orderMode === "bulk" && (
              <V7Section
                number="05"
                title="Tell us about the bulk order"
                meta={`${Number(bulkQuantity || 0).toLocaleString(
                  "en-IN"
                )} hampers`}
                gold
              >
                <div className="rounded-[20px] border border-[#D4AF37]/20 bg-[#FFFCF6] p-4 sm:p-5">
                  <p className="text-[11px] font-extrabold text-[#171717]">
                    No payment is taken now. Submit this hamper as a quotation
                    request, review the commercial quote from HAMPORIUM, accept
                    it, and then pay to place the final order.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <BulkField label="Bulk quantity *">
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={bulkQuantity}
                      onChange={(event) => setBulkQuantity(event.target.value)}
                      className="h-11 w-full rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[12px] font-bold outline-none focus:border-[#F47822] focus:bg-white"
                    />
                  </BulkField>

                  <BulkField label="Required by *">
                    <input
                      type="date"
                      min={getToday()}
                      value={bulkRequiredDate}
                      onChange={(event) => setBulkRequiredDate(event.target.value)}
                      className="h-11 w-full rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[12px] font-bold outline-none focus:border-[#F47822] focus:bg-white"
                    />
                  </BulkField>

                  <BulkField label="Purpose">
                    <select
                      value={bulkPurpose}
                      onChange={(event) => setBulkPurpose(event.target.value)}
                      className="h-11 w-full rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[12px] font-bold outline-none focus:border-[#F47822] focus:bg-white"
                    >
                      {BULK_PURPOSE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </BulkField>

                  <BulkField label="Delivery model">
                    <select
                      value={bulkAddressModel}
                      onChange={(event) => setBulkAddressModel(event.target.value)}
                      className="h-11 w-full rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[12px] font-bold outline-none focus:border-[#F47822] focus:bg-white"
                    >
                      <option value="not_decided">Not decided yet</option>
                      <option value="single_address">Single address</option>
                      <option value="multiple_addresses">Multiple addresses</option>
                    </select>
                  </BulkField>

                  <BulkField label="Company / organisation">
                    <input
                      value={bulkCompanyName}
                      maxLength={200}
                      onChange={(event) => setBulkCompanyName(event.target.value)}
                      placeholder="Optional"
                      className="h-11 w-full rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[12px] font-semibold outline-none focus:border-[#F47822] focus:bg-white"
                    />
                  </BulkField>

                  <BulkField label="GSTIN">
                    <input
                      value={bulkGstNumber}
                      maxLength={40}
                      onChange={(event) =>
                        setBulkGstNumber(event.target.value.toUpperCase())
                      }
                      placeholder="Optional"
                      className="h-11 w-full rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[12px] font-semibold uppercase outline-none focus:border-[#F47822] focus:bg-white"
                    />
                  </BulkField>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <BulkField label="Delivery locations">
                    <textarea
                      rows="4"
                      value={bulkDeliveryLocations}
                      onChange={(event) =>
                        setBulkDeliveryLocations(event.target.value)
                      }
                      placeholder="City, office, venue or one location per line. You can leave this blank if not decided."
                      className="w-full resize-none rounded-xl border border-black/[0.09] bg-[#FAF8F5] p-3 text-[12px] font-semibold leading-5 outline-none focus:border-[#F47822] focus:bg-white"
                    />
                  </BulkField>

                  <BulkField label="Anything else for the quotation">
                    <textarea
                      rows="4"
                      maxLength={2000}
                      value={bulkNotes}
                      onChange={(event) => setBulkNotes(event.target.value)}
                      placeholder="Delivery split, branding expectation, timeline or any commercial note."
                      className="w-full resize-none rounded-xl border border-black/[0.09] bg-[#FAF8F5] p-3 text-[12px] font-semibold leading-5 outline-none focus:border-[#F47822] focus:bg-white"
                    />
                  </BulkField>
                </div>
              </V7Section>
            )}
          </div>

          <aside className="xl:sticky xl:top-[96px] xl:self-start">
            <V7Studio
              selectedContainer={selectedContainer}
              previewItems={previewItems}
              previewDecorations={previewDecorations}
              selectedItemCount={selectedItemCount}
              selectedDecorationCount={selectedDecorationCount}
              fillPercent={fillPercent}
              configuration={configuration}
              personalization={personalizationPayload}
              canIncreaseAnyItem={canIncreaseAnyItem}
              validating={validating || selectionPending}
              cartError={cartError}
              canAddToCart={canPrimaryAction}
              addingToCart={primaryBusy}
              user={user}
              orderMode={orderMode}
              bulkQuantity={Number(bulkQuantity || 0)}
              onModeChange={(nextMode) => {
                setOrderMode(nextMode);
                setCartError("");
              }}
              onAddToCart={
                orderMode === "bulk"
                  ? handleRequestQuotation
                  : handleAddToCart
              }
            />
          </aside>
        </div>
      </section>
    </main>
  );
};

const OrderModeChooser = ({ mode, onChange }) => (
  <div className="mt-5 flex justify-end">
    <div className="inline-grid w-full grid-cols-2 border-y border-black/[0.09] sm:w-[430px]">
      <button
        type="button"
        onClick={() =>
          onChange("personal")
        }
        className={`min-h-[48px] px-5 text-center text-[12px] font-black transition ${
          mode === "personal"
            ? "bg-[#171717] text-white"
            : "bg-transparent text-black/45 hover:bg-white hover:text-[#171717]"
        }`}
      >
        Personal
      </button>

      <button
        type="button"
        onClick={() =>
          onChange("bulk")
        }
        className={`min-h-[48px] border-l border-black/[0.09] px-5 text-center text-[12px] font-black transition ${
          mode === "bulk"
            ? "bg-[#F47822] text-white"
            : "bg-transparent text-black/45 hover:bg-white hover:text-[#171717]"
        }`}
      >
        Bulk / Event
      </button>
    </div>
  </div>
);

const BulkField = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.08em] text-black/35">
      {label}
    </span>
    {children}
  </label>
);

const V7Section = ({ number, title, meta, gold = false, children }) => (
  <section className="v7-reveal overflow-hidden rounded-[18px] border border-black/[0.07] bg-white shadow-[0_12px_34px_rgba(34,27,18,.035)]">
    <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
            gold
              ? "bg-[#9B7616] text-white"
              : "bg-[#9A6E32] text-white"
          }`}
        >
          {String(number).replace(/^0/, "")}
        </span>

        <div className="min-w-0">
          <h2
            style={{ fontFamily: DISPLAY_FONT }}
            className="truncate text-[26px] font-semibold leading-none tracking-[-.025em] text-[#171717]"
          >
            {title}
          </h2>
          {meta && (
            <p className="mt-1 truncate text-[9px] font-semibold text-black/34 sm:hidden">
              {meta}
            </p>
          )}
        </div>
      </div>

      <span className="hidden shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-black/28 sm:block">
        {meta}
      </span>
    </div>

    <div className="p-4 sm:p-5 lg:p-6 2xl:p-7">{children}</div>
  </section>
);

const DetailModalPortal = ({ children, onClose }) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(children, document.body);
};

const V11ContainerDetailsModal = ({
  container,
  active,
  onSelect,
  onClose,
}) => {
  const hasPrice =
    container.sellingPrice !== null &&
    container.sellingPrice !== undefined;

  const hasMrp =
    hasPrice &&
    container.mrp !== null &&
    container.mrp !== undefined &&
    Number(container.mrp) > Number(container.sellingPrice);

  const detailRows = [
    ["Material", container.material],
    ["Code / SKU", container.code],
    ["Outer dimensions", formatDimensions(container.outerDimensions)],
    ["Inner dimensions", formatDimensions(container.innerDimensions)],
    ["Max content weight", formatWeight(container.maxContentWeight)],
    [
      "Usable volume",
      container.usableVolumePercent !== null &&
      container.usableVolumePercent !== undefined
        ? `${container.usableVolumePercent}%`
        : "Not specified",
    ],
    [
      "Maximum items",
      Number(container.maxItems || 0) > 0
        ? String(container.maxItems)
        : "Not specified",
    ],
  ];

  return (
    <DetailModalPortal onClose={onClose}>
      <div
        className="v13-modal-backdrop fixed inset-0 z-[99999] flex items-center justify-center bg-black/62 p-3 backdrop-blur-[5px] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`${container.name} details`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="v13-modal-panel flex max-h-[calc(100dvh-24px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[22px] border border-white/15 bg-white shadow-[0_35px_120px_rgba(0,0,0,.38)] sm:max-h-[88dvh] sm:rounded-[28px]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-5 border-b border-black/[0.07] bg-white px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#F47822]" />
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#F47822]">
                  Box details
                </p>
              </div>

              <h3
                style={{ fontFamily: DISPLAY_FONT }}
                className="mt-1.5 truncate text-[27px] font-semibold leading-none tracking-[-0.025em] text-[#171717] sm:text-[32px]"
              >
                {container.name}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-[#FAF8F5] text-[22px] leading-none text-black/48 transition hover:border-[#F47822]/35 hover:bg-[#FFF7F1] hover:text-[#F47822]"
              aria-label="Close box details"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            <div className="grid lg:grid-cols-[350px_minmax(0,1fr)]">
              <div className="border-b border-black/[0.07] bg-[#F7F2EB] p-5 lg:border-b-0 lg:border-r lg:p-6">
                <div className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_12px_30px_rgba(0,0,0,.04)]">
                  <div className="aspect-[4/3] bg-[#FBF8F4]">
                    {container.images?.[0]?.url ? (
                      <img
                        src={container.images[0].url}
                        alt={container.name}
                        className="h-full w-full object-contain p-4"
                      />
                    ) : (
                      <NoImage />
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.11em] text-black/30">
                      Box price
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-[25px] font-black text-[#171717]">
                        {hasPrice
                          ? formatCurrency(container.sellingPrice)
                          : "Price pending"}
                      </span>
                      {hasMrp && (
                        <span className="text-[11px] font-semibold text-black/30 line-through">
                          {formatCurrency(container.mrp)}
                        </span>
                      )}
                    </div>
                  </div>

                  {active && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700">
                      ✓ Selected
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6 lg:p-7">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#9A7316]">
                    Box information
                  </p>
                  <span className="text-[9px] font-semibold text-black/28">
                    All available catalogue data
                  </span>
                </div>

                <div className="mt-3 grid gap-x-7 sm:grid-cols-2">
                  {detailRows.map(([label, value]) => (
                    <V10DetailRow
                      key={label}
                      label={label}
                      value={value}
                    />
                  ))}
                </div>

                {container.description && (
                  <div className="mt-5 rounded-[16px] bg-[#FAF8F5] p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/32">
                      About this box
                    </p>
                    <p className="mt-2 text-[11px] font-semibold leading-5 text-black/52">
                      {container.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-black/[0.07] bg-white px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-[11px] border border-black/[0.09] bg-white px-5 text-[10px] font-black text-[#171717] transition hover:bg-[#FAF8F5]"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!active) onSelect();
                  onClose();
                }}
                className={`h-11 rounded-[11px] px-6 text-[10px] font-black transition ${
                  active
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "bg-[#F47822] text-white hover:bg-[#171717]"
                }`}
              >
                {active ? "✓ Selected box" : "Select this box"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DetailModalPortal>
  );
};

const V15ContainerCarousel = ({ children }) => {
  const railRef = useRef(null);

  const scrollRail = (direction) => {
    const rail = railRef.current;
    if (!rail) return;

    const firstSlide =
      rail.querySelector(
        "[data-hamper-box-slide='true']"
      );

    const slideWidth =
      firstSlide?.getBoundingClientRect()
        ?.width || 260;

    const gap = 16;

    rail.scrollBy({
      left:
        direction === "next"
          ? (slideWidth + gap) * 4
          : -(slideWidth + gap) * 4,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      <div
        ref={railRef}
        className="v10-soft-scroll flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() =>
          scrollRail("prev")
        }
        className="absolute left-2 top-[38%] z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[18px] font-black text-[#171717] shadow-[0_8px_24px_rgba(0,0,0,.14)] backdrop-blur-sm transition hover:bg-[#171717] hover:text-white lg:flex"
        aria-label="Previous hamper boxes"
      >
        ←
      </button>

      <button
        type="button"
        onClick={() =>
          scrollRail("next")
        }
        className="absolute right-2 top-[38%] z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#171717] text-[18px] font-black text-white shadow-[0_8px_24px_rgba(0,0,0,.16)] transition hover:bg-[#F47822] lg:flex"
        aria-label="Next hamper boxes"
      >
        →
      </button>

      <div className="mt-3 flex justify-end gap-2 lg:hidden">
        <button
          type="button"
          onClick={() =>
            scrollRail("prev")
          }
          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.09] bg-white text-[16px] font-black text-[#171717]"
          aria-label="Previous hamper boxes"
        >
          ←
        </button>

        <button
          type="button"
          onClick={() =>
            scrollRail("next")
          }
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] text-[16px] font-black text-white"
          aria-label="Next hamper boxes"
        >
          →
        </button>
      </div>
    </div>
  );
};

const V7ContainerCard = ({ container, active, onClick }) => {
  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const hasPrice =
    container.sellingPrice !== null &&
    container.sellingPrice !== undefined;

  const handleCardClick = (event) => {
    if (
      event.target.closest("button")
    ) {
      return;
    }

    setDetailsOpen(true);
  };

  return (
    <>
      <article
        onClick={handleCardClick}
        className="group min-w-0 cursor-pointer"
      >
        {/* FULL-BLEED IMAGE · NO CARD BORDER */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F1ECE5]">
          {container.images?.[0]?.url ? (
            <img
              src={
                container.images[0]
                  .url
              }
              alt={container.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <NoImage />
          )}

          {active && (
            <>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-[#F47822]" />

              <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#F47822] text-[14px] font-black text-white shadow-[0_8px_22px_rgba(244,120,34,.30)]">
                ✓
              </span>
            </>
          )}
        </div>

        {/* DETAILS DIRECTLY UNDER IMAGE */}
        <div className="pt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 min-h-[38px] text-[13px] font-black leading-[1.4] text-[#171717]">
                {container.name}
              </p>

              {container.material && (
                <p className="mt-1 truncate text-[8px] font-black uppercase tracking-[0.08em] text-black/30">
                  {container.material}
                </p>
              )}
            </div>

            <span className="shrink-0 text-[15px] font-black text-[#171717]">
              {hasPrice
                ? formatCurrency(
                    container.sellingPrice
                  )
                : "Price pending"}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDetailsOpen(true);
              }}
              className="h-10 text-left text-[10px] font-black text-black/42 transition hover:text-[#9A7316]"
            >
              View details →
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                if (!active) {
                  onClick();
                }
              }}
              className={`h-10 min-w-[106px] px-4 text-[10px] font-black transition ${
                active
                  ? "text-emerald-700"
                  : "bg-[#F47822] text-white hover:bg-[#171717]"
              }`}
            >
              {active
                ? "✓ Selected"
                : "Select box"}
            </button>
          </div>
        </div>
      </article>

      {detailsOpen && (
        <V11ContainerDetailsModal
          container={container}
          active={active}
          onSelect={onClick}
          onClose={() =>
            setDetailsOpen(false)
          }
        />
      )}
    </>
  );
};

const V7ContainerSpecRow = ({ label, value, divider = false }) => (
  <div
    className={`grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 ${
      divider ? "border-t border-black/[0.05]" : ""
    }`}
  >
    <span className="text-[7px] font-black uppercase tracking-[0.08em] text-black/28">
      {label}
    </span>
    <span
      className="truncate text-right text-[9px] font-extrabold text-black/58"
      title={value}
    >
      {value}
    </span>
  </div>
);

const V7ContainerMetric = ({ label, value }) => (
  <div className="min-w-0 rounded-[12px] border border-black/[0.055] bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(23,23,23,.02)]">
    <p className="text-[7px] font-black uppercase tracking-[0.08em] text-black/25">
      {label}
    </p>
    <p className="mt-1 truncate text-[9px] font-extrabold text-black/60" title={value}>
      {value}
    </p>
  </div>
);

const V7ProductSpec = ({ label, value, wide = false }) => (
  <div
    className={`min-w-0 rounded-[11px] border border-black/[0.055] bg-[#FAF8F5] px-2.5 py-2 ${
      wide ? "col-span-2" : ""
    }`}
  >
    <p className="text-[7px] font-black uppercase tracking-[0.075em] text-black/24">
      {label}
    </p>
    <p
      className="mt-1 truncate text-[8px] font-extrabold text-black/55"
      title={value}
    >
      {value}
    </p>
  </div>
);

const V7FoodInfo = ({ component }) => {
  const hasExpiry = Boolean(component.expiryDate);
  const hasShelfLife =
    component.shelfLifeDays !== null &&
    component.shelfLifeDays !== undefined;

  return (
    <div className="mt-2.5 overflow-hidden rounded-[12px] border border-[#E9C66A]/28 bg-[#FFFCF4]">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[7px] font-black uppercase tracking-[0.08em] text-[#9B7616]/70">
            Best before / expiry
          </p>
          <p className="mt-1 truncate text-[9px] font-extrabold text-[#6D5313]">
            {hasExpiry ? formatDate(component.expiryDate) : "Not specified"}
          </p>
        </div>

        {hasShelfLife && (
          <span className="shrink-0 rounded-full bg-[#D4AF37]/12 px-2.5 py-1 text-[8px] font-black text-[#8A6815]">
            {component.shelfLifeDays} days
          </span>
        )}
      </div>

      {component.dietary && (
        <div className="border-t border-[#D4AF37]/12 px-3 py-2 text-[8px] font-bold text-[#8A6815]/75">
          {component.dietary}
        </div>
      )}
    </div>
  );
};

const V10QuickSpec = ({ label, value }) => (
  <div className="min-w-0 rounded-[9px] border border-black/[0.06] bg-[#FAF8F5] px-2 py-2">
    <p className="text-[6px] font-black uppercase tracking-[0.08em] text-black/25">
      {label}
    </p>
    <p
      className="mt-1 truncate text-[8px] font-extrabold text-black/58"
      title={value}
    >
      {value || "—"}
    </p>
  </div>
);

const V10DetailRow = ({ label, value, accent = false }) => (
  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-b border-black/[0.055] py-3 last:border-b-0">
    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-black/32">
      {label}
    </span>
    <span
      className={`min-w-0 break-words text-[11px] font-bold leading-5 ${
        accent ? "text-[#F47822]" : "text-[#171717]"
      }`}
    >
      {value || "Not specified"}
    </span>
  </div>
);

const V10ProductDetailsModal = ({
  component,
  quantity,
  cannotIncrease,
  onMinus,
  onPlus,
  onClose,
}) => {
  const missingPrice =
    component.sellingPrice === null ||
    component.sellingPrice === undefined;

  const hasMrp =
    !missingPrice &&
    component.mrp !== null &&
    component.mrp !== undefined &&
    Number(component.mrp) > Number(component.sellingPrice);

  const isFood = component.type === "food";
  const expiryValue = component.expiryDate
    ? formatDate(component.expiryDate)
    : component.expiryTracked === false
      ? "Not expiry tracked"
      : "Not specified";

  const shelfLifeValue =
    component.shelfLifeDays !== null &&
    component.shelfLifeDays !== undefined
      ? `${component.shelfLifeDays} days`
      : "Not specified";

  const details = [
    ["Brand", component.brand || "HAMPORIUM selection"],
    ["Code / SKU", component.code],
    ["Category", component.category],
    ["Subcategory", component.subcategory],
    ["Segment", component.segment],
    ["Size / pack", formatPackSize(component)],
    ["Weight", formatWeight(component.weight)],
    ["Dimensions", formatDimensions(component.dimensions)],
    ["Expiry", expiryValue],
    ["Shelf life", shelfLifeValue],
    ["Dietary", component.dietary],
    [
      "Fragile",
      component.fragile === true
        ? "Yes"
        : component.fragile === false
          ? "No"
          : "Not specified",
    ],
    [
      "Personalisation",
      component.personalizable
        ? component.personalizationMethod || "Available"
        : "Not available",
    ],
    ["GST", missingPrice ? "Not specified" : taxLabel(component)],
  ];

  return (
    <DetailModalPortal onClose={onClose}>
      <div
        className="v13-modal-backdrop fixed inset-0 z-[99999] flex items-center justify-center bg-black/62 p-3 backdrop-blur-[5px] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`${component.name} details`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="v13-modal-panel flex max-h-[calc(100dvh-24px)] w-full max-w-[980px] flex-col overflow-hidden rounded-[22px] border border-white/15 bg-white shadow-[0_35px_120px_rgba(0,0,0,.38)] sm:max-h-[88dvh] sm:rounded-[28px]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-5 border-b border-black/[0.07] bg-white px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#F47822]" />
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#F47822]">
                  Product details
                </p>
              </div>

              <h3
                style={{ fontFamily: DISPLAY_FONT }}
                className="mt-1.5 truncate text-[27px] font-semibold leading-none tracking-[-0.025em] text-[#171717] sm:text-[32px]"
              >
                {component.name}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-[#FAF8F5] text-[22px] leading-none text-black/48 transition hover:border-[#F47822]/35 hover:bg-[#FFF7F1] hover:text-[#F47822]"
              aria-label="Close product details"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="border-b border-black/[0.07] bg-[#F7F2EB] p-5 lg:border-b-0 lg:border-r lg:p-6">
                <div className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_12px_30px_rgba(0,0,0,.04)]">
                  <div className="aspect-square bg-[#FBF8F4]">
                    {component.images?.[0]?.url ? (
                      <img
                        src={component.images[0].url}
                        alt={component.name}
                        className="h-full w-full object-contain p-4"
                      />
                    ) : (
                      <NoImage />
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.11em] text-black/30">
                      Selling price
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-[25px] font-black text-[#171717]">
                        {missingPrice
                          ? "Price pending"
                          : formatCurrency(component.sellingPrice)}
                      </span>
                      {hasMrp && (
                        <span className="text-[11px] font-semibold text-black/30 line-through">
                          {formatCurrency(component.mrp)}
                        </span>
                      )}
                    </div>
                    {!missingPrice && (
                      <p className="mt-1 text-[9px] font-semibold text-black/34">
                        {taxLabel(component)}
                      </p>
                    )}
                  </div>

                  <span className="max-w-[46%] truncate rounded-full bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-black/42">
                    {component.subcategory || component.category || "Gift"}
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6 lg:p-7">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#9A7316]">
                    Complete product information
                  </p>
                  <span className="text-[9px] font-semibold text-black/28">
                    Catalogue details
                  </span>
                </div>

                <div className="mt-3 grid gap-x-7 sm:grid-cols-2">
                  {details.map(([label, value]) => (
                    <V10DetailRow
                      key={label}
                      label={label}
                      value={value}
                      accent={label === "Expiry" && Boolean(component.expiryDate)}
                    />
                  ))}
                </div>

                {component.description && (
                  <div className="mt-5 rounded-[16px] bg-[#FAF8F5] p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/32">
                      Description
                    </p>
                    <p className="mt-2 text-[11px] font-semibold leading-5 text-black/52">
                      {component.description}
                    </p>
                  </div>
                )}

                {isFood && (
                  <div className="mt-4 flex items-start gap-3 border-l-[3px] border-[#D4AF37] bg-[#FFFCF5] px-4 py-3.5">
                    <span className="mt-0.5 text-[#9A7316]">✦</span>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8B6817]">
                        Food freshness
                      </p>
                      <p className="mt-1.5 text-[10px] font-semibold leading-5 text-black/48">
                        Expiry and shelf-life values are shown directly from this catalogue item. Missing values are not invented.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-black/[0.07] bg-white px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="hidden sm:block">
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/28">
                  In your hamper
                </p>
                <p className="mt-0.5 text-[12px] font-black text-[#171717]">
                  {quantity > 0 ? `${quantity} selected` : "Not added yet"}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:min-w-[310px] sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 flex-1 rounded-[11px] border border-black/[0.09] bg-white px-5 text-[10px] font-black text-[#171717] transition hover:bg-[#FAF8F5] sm:flex-none"
                >
                  Close
                </button>

                {quantity > 0 ? (
                  <div className="grid h-11 flex-1 grid-cols-[44px_1fr_44px] overflow-hidden rounded-[11px] border border-[#F47822]/25 bg-[#FFF8F2] sm:w-[170px] sm:flex-none">
                    <button
                      type="button"
                      onClick={onMinus}
                      className="text-base font-black transition hover:bg-black/[0.04]"
                      aria-label={`Remove ${component.name}`}
                    >
                      −
                    </button>
                    <span className="flex items-center justify-center border-x border-[#F47822]/15 text-[11px] font-black">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={cannotIncrease}
                      onClick={onPlus}
                      className="text-base font-black text-[#F47822] transition hover:bg-[#F47822] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                      aria-label={`Add ${component.name}`}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={cannotIncrease}
                    onClick={onPlus}
                    className="h-11 flex-1 rounded-[11px] bg-[#F47822] px-6 text-[10px] font-black text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25 sm:flex-none"
                  >
                    + Add to hamper
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DetailModalPortal>
  );
};

const V7ProductCard = ({
  component,
  quantity,
  selected,
  locked,
  checking,
  fitLeft,
  onMinus,
  onPlus,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const missingPrice =
    component.sellingPrice === null ||
    component.sellingPrice === undefined;

  const cannotIncrease =
    checking || missingPrice || locked || quantity >= 99;

  const hasMrp =
    !missingPrice &&
    component.mrp !== null &&
    component.mrp !== undefined &&
    Number(component.mrp) > Number(component.sellingPrice);

  const handleCardClick = (event) => {
    if (event.target.closest("button")) return;
    setDetailsOpen(true);
  };

  return (
    <>
      <article
        onClick={handleCardClick}
        className="group min-w-0 cursor-pointer"
      >
        <div
          className={`relative overflow-hidden bg-[#F3EEE7] transition duration-300 ${
            selected
              ? "ring-2 ring-[#F47822]/80 ring-offset-2 ring-offset-white"
              : ""
          }`}
        >
          <div className="aspect-[4/3]">
            {component.images?.[0]?.url ? (
              <img
                src={component.images[0].url}
                alt={component.name}
                className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-[1.025]"
              />
            ) : (
              <NoImage />
            )}
          </div>

          <span className="absolute bottom-2.5 left-2.5 max-w-[80%] truncate bg-white/92 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-black/42 backdrop-blur-sm">
            {component.subcategory || component.category || "Gift"}
          </span>

          {selected && (
            <span className="absolute right-2.5 top-2.5 bg-[#171717] px-2.5 py-1.5 text-[9px] font-black text-white shadow-lg">
              ×{quantity}
            </span>
          )}
        </div>

        <div className="pt-3">
          <p className="line-clamp-2 min-h-[40px] text-[13px] font-extrabold leading-[1.45] text-[#171717]">
            {component.name}
          </p>

          <div className="mt-1.5 flex min-h-[24px] items-baseline gap-1.5">
            <span className="text-[16px] font-black text-[#171717]">
              {missingPrice
                ? "Price pending"
                : formatCurrency(component.sellingPrice)}
            </span>

            {hasMrp && (
              <span className="text-[9px] font-semibold text-black/28 line-through">
                {formatCurrency(component.mrp)}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-[.95fr_1.05fr] gap-2 border-t border-black/[0.07] pt-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDetailsOpen(true);
              }}
              className="h-10 text-[10px] font-black text-black/48 transition hover:text-[#9A7316]"
            >
              View details →
            </button>

            {quantity > 0 ? (
              <div
                className="grid h-10 grid-cols-[36px_1fr_36px] overflow-hidden border border-[#F47822]/25 bg-[#FFF8F2]"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMinus();
                  }}
                  className="text-sm font-black transition hover:bg-black/[0.04]"
                  aria-label={`Remove ${component.name}`}
                >
                  −
                </button>

                <span className="flex items-center justify-center border-x border-[#F47822]/15 text-[10px] font-black">
                  {quantity}
                </span>

                <button
                  type="button"
                  disabled={cannotIncrease}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPlus();
                  }}
                  className="text-sm font-black text-[#F47822] transition hover:bg-[#F47822] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                  aria-label={`Add ${component.name}`}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={cannotIncrease}
                onClick={(event) => {
                  event.stopPropagation();
                  onPlus();
                }}
                className="flex h-10 items-center justify-center bg-[#F47822] text-[10px] font-black text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25"
              >
                + Add
              </button>
            )}
          </div>

          {selected && fitLeft <= 0 && (
            <p className="mt-1.5 text-center text-[7px] font-bold text-amber-600">
              Box limit reached
            </p>
          )}
        </div>
      </article>

      {detailsOpen && (
        <V10ProductDetailsModal
          component={component}
          quantity={quantity}
          cannotIncrease={cannotIncrease}
          onMinus={onMinus}
          onPlus={onPlus}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </>
  );
};

const V7DecorationCard = ({
  component,
  quantity,
  onMinus,
  onPlus,
}) => {
  const selected = quantity > 0;

  const missingPrice =
    component.sellingPrice === null ||
    component.sellingPrice === undefined;

  return (
    <article className="group min-w-0">
      <div
        className={`relative overflow-hidden bg-[#F3EEE7] transition duration-300 ${
          selected
            ? "ring-2 ring-[#D4AF37]/70 ring-offset-2 ring-offset-white"
            : ""
        }`}
      >
        <div className="aspect-square">
          {component.images?.[0]?.url ? (
            <img
              src={component.images[0].url}
              alt={component.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <V7DecorPlaceholder component={component} />
          )}
        </div>

        <span className="absolute left-2.5 top-2.5 bg-white/92 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.07em] text-[#8B6817] backdrop-blur-sm">
          Finishing only
        </span>
      </div>

      <div className="pt-3">
        <p className="truncate text-[11px] font-extrabold text-[#171717]">
          {component.name}
        </p>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] font-black text-[#9B7616]">
            {missingPrice
              ? "Price pending"
              : formatCurrency(component.sellingPrice)}
          </p>

          <span className="text-[7px] font-black uppercase tracking-[0.06em] text-emerald-600">
            0% capacity
          </span>
        </div>

        <div className="mt-3 grid h-9 grid-cols-[36px_1fr_36px] overflow-hidden border-y border-[#D4AF37]/18 bg-[#FFFCF7]">
          <button
            type="button"
            disabled={quantity <= 0}
            onClick={onMinus}
            className="text-sm disabled:opacity-20"
          >
            −
          </button>

          <span className="flex items-center justify-center border-x border-[#D4AF37]/15 text-[9px] font-black">
            {quantity}
          </span>

          <button
            type="button"
            disabled={missingPrice || quantity >= 99}
            onClick={onPlus}
            className="text-sm font-black text-[#9B7616] transition hover:bg-[#D4AF37] hover:text-[#171717] disabled:opacity-20"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
};

const V7DecorPlaceholder = ({ component }) => {
  const name = String(component?.name || "").toLowerCase();

  if (/flower|rose|floral/.test(name)) {
    return (
      <div className="flex h-full items-center justify-center text-[28px] text-[#B7697C]">
        ✿
      </div>
    );
  }

  if (/ribbon|bow/.test(name)) {
    return (
      <div className="flex h-full items-center justify-center text-[26px] text-[#B78B18]">
        ⌁
      </div>
    );
  }

  if (/tag|card|note/.test(name)) {
    return (
      <div className="flex h-full items-center justify-center text-[24px] text-[#8A6B24]">
        ◇
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-[24px] text-[#B78B18]">
      ✦
    </div>
  );
};

const V7Studio = ({
  selectedContainer,
  previewItems,
  previewDecorations,
  selectedItemCount,
  selectedDecorationCount,
  fillPercent,
  configuration,
  personalization,
  canIncreaseAnyItem,
  validating,
  cartError,
  canAddToCart,
  addingToCart,
  user,
  orderMode = "personal",
  bulkQuantity = 0,
  onModeChange,
  onAddToCart,
}) => {
  const pricing = configuration?.pricing;
  const timing = configuration?.deliveryEstimate;
  const notReadyMessage =
    configuration && !configuration.orderable ? configuration.message : "";

  return (
    <div className="overflow-hidden rounded-[18px] border border-black/[0.08] bg-white shadow-[0_18px_50px_rgba(34,27,18,.07)]">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
        <div>
          <p
            style={{ fontFamily: DISPLAY_FONT }}
            className="text-[29px] font-semibold leading-none tracking-[-0.025em] text-[#171717]"
          >
            Your Hamper
          </p>
          <p className="mt-1 text-[9px] font-semibold text-black/34">
            Live preview & summary
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${
            validating
              ? "bg-black/[0.05] text-black/34"
              : configuration?.orderable
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          {validating
            ? "Checking"
            : configuration?.orderable
              ? "Ready"
              : selectedItemCount
                ? "Adjust"
                : "Start"}
        </span>
      </div>

      <div className="p-4">
        <V7OpenTop3D
          selectedContainer={selectedContainer}
          previewItems={previewItems}
          previewDecorations={previewDecorations}
          selectedItemCount={selectedItemCount}
          selectedDecorationCount={selectedDecorationCount}
          fillPercent={fillPercent}
          configuration={configuration}
          canIncreaseAnyItem={canIncreaseAnyItem}
          validating={validating}
        />

        <div className="mt-3 flex items-center justify-between gap-3 border-y border-black/[0.06] py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/28">
              Selected box
            </p>
            <p className="mt-1 truncate text-[12px] font-black text-[#171717]">
              {selectedContainer?.name || "Choose a hamper box"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4 text-right">
            <V7TinyStat label="Items" value={selectedItemCount} />
            <V7TinyStat label="Gift fill" value={`${Math.round(fillPercent)}%`} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-[10px] border border-black/[0.08] bg-[#F7F3ED]">
          <button
            type="button"
            onClick={() => onModeChange?.("personal")}
            className={`h-10 text-[10px] font-black transition ${
              orderMode === "personal"
                ? "bg-white text-[#F47822] shadow-[inset_0_-2px_0_#F47822]"
                : "text-black/48 hover:text-[#171717]"
            }`}
          >
            Personal Order
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.("bulk")}
            className={`h-10 border-l border-black/[0.07] text-[10px] font-black transition ${
              orderMode === "bulk"
                ? "bg-white text-[#9B7616] shadow-[inset_0_-2px_0_#D4AF37]"
                : "text-black/48 hover:text-[#171717]"
            }`}
          >
            Bulk Quote
          </button>
        </div>

        {personalization?.enabled && (
          <div className="mt-3 border-b border-black/[0.06] pb-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9B7616]">
                Personalisation added
              </p>
              <span className="text-[9px] font-bold text-black/34">
                {personalization.assets?.length || 0} artwork
              </span>
            </div>
            {personalization.message && (
              <p className="mt-1 line-clamp-2 text-[9px] font-semibold leading-4 text-black/42">
                “{personalization.message}”
              </p>
            )}
          </div>
        )}

        {pricing && (
          <div className="mt-4">
            <div className="space-y-2.5 text-[11px]">
              <V7PriceRow label="Box" value={pricing.containerPrice} />
              <V7PriceRow label="Items" value={pricing.itemsTotal} />
              <V7PriceRow label="Finishing" value={pricing.decorationsTotal || 0} />
            </div>

            <div className="mt-3 flex items-end justify-between gap-4 border-t border-black/[0.08] pt-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/30">
                  {orderMode === "bulk" ? "Indicative / hamper" : "Total (incl. GST)"}
                </p>
                <p className="mt-1 text-[9px] font-medium text-black/34">
                  {orderMode === "bulk"
                    ? "Final amount comes from the accepted quote"
                    : "Secure checkout"}
                </p>
              </div>

              <p
                style={{ fontFamily: DISPLAY_FONT }}
                className="text-[31px] font-semibold leading-none text-[#F47822]"
              >
                {pricing.total === null || pricing.total === undefined
                  ? "—"
                  : formatCurrency(pricing.total)}
              </p>
            </div>
          </div>
        )}

        {orderMode === "bulk" &&
          pricing?.total !== null &&
          pricing?.total !== undefined && (
            <div className="mt-3 flex items-center justify-between gap-3 bg-[#FFFCF3] px-3 py-2.5">
              <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#9B7616]">
                {Number(bulkQuantity || 0).toLocaleString("en-IN")} hampers
              </span>
              <span className="text-[12px] font-black text-[#171717]">
                {formatCurrency(Number(pricing.total || 0) * Number(bulkQuantity || 0))}
              </span>
            </div>
          )}

        {configuration?.capacity && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[9px] font-bold text-black/36">
              <span>Gift items capacity</span>
              <span>{Math.round(fillPercent)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F47822] to-[#D4AF37] transition-all duration-500"
                style={{ width: `${Math.min(100, fillPercent)}%` }}
              />
            </div>
            <p className="mt-2 text-[7px] font-semibold leading-3 text-black/28">
              Finishing materials are excluded from this meter.
            </p>
          </div>
        )}

        {(configuration?.earliestExpiryDate || timing?.expectedDeliveryDate) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[8px] font-semibold text-black/32">
            {timing?.expectedDeliveryDate && (
              <span>Delivery {formatDate(timing.expectedDeliveryDate)}</span>
            )}
            {configuration?.earliestExpiryDate && (
              <span>Earliest expiry {formatDate(configuration.earliestExpiryDate)}</span>
            )}
          </div>
        )}

        {notReadyMessage && selectedItemCount > 0 && (
          <div className="mt-3 border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2.5 text-[9px] font-semibold leading-4 text-amber-800">
            {notReadyMessage}
          </div>
        )}

        {cartError && (
          <div className="mt-3 border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5 text-[9px] font-semibold leading-4 text-red-700">
            {cartError}
          </div>
        )}

        <button
          type="button"
          onClick={onAddToCart}
          disabled={!canAddToCart}
          className={`v10-primary-cta mt-4 flex h-[48px] w-full items-center justify-center gap-3 rounded-[10px] px-5 text-[10px] font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-black/10 disabled:text-black/25 disabled:shadow-none ${
            orderMode === "bulk"
              ? "bg-[#171717] text-white shadow-[0_12px_28px_rgba(23,23,23,.16)] hover:bg-[#9B7616]"
              : "bg-[#F47822] text-white shadow-[0_12px_28px_rgba(244,120,34,.20)] hover:bg-[#171717]"
          }`}
        >
          {addingToCart
            ? orderMode === "bulk"
              ? "Submitting request…"
              : "Adding…"
            : user
              ? orderMode === "bulk"
                ? "Request quotation"
                : "Add to cart"
              : orderMode === "bulk"
                ? "Login to request quote"
                : "Login to add"}
          {!addingToCart && <span>→</span>}
        </button>

        <div className="mt-3 grid grid-cols-3 divide-x divide-black/[0.07] border-t border-black/[0.06] pt-3 text-center">
          <span className="text-[8px] font-bold text-black/34">Secure Checkout</span>
          <span className="text-[8px] font-bold text-black/34">Pan India Delivery</span>
          <span className="text-[8px] font-bold text-black/34">Premium Gifting</span>
        </div>
      </div>
    </div>
  );
};

const V7TinyStat = ({ label, value }) => (
  <div className="min-w-[48px] text-right">
    <p className="text-[7px] font-black uppercase tracking-[0.09em] text-black/26">
      {label}
    </p>
    <p className="mt-1 text-[12px] font-black text-[#171717]">{value}</p>
  </div>
);

const V7PriceRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-black/42">{label}</span>
    <span className="font-bold text-[#171717]">
      {value === null || value === undefined ? "—" : formatCurrency(value)}
    </span>
  </div>
);

const v7Clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value || 0)));

const v7Cm = (value, unit = "cm") => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return unit === "mm" ? number / 10 : number;
};

const v7Geometry = (container) => {
  const d = container?.innerDimensions || {};
  const unit = d.unit || "cm";
  const length = v7Cm(d.length, unit) || 28;
  const width = v7Cm(d.width, unit) || 22;
  const height = v7Cm(d.height, unit) || 10;
  const volume = Math.max(1, length * width * height);
  const maxFoot = Math.max(length, width, 1);
  const scale = v7Clamp(Math.cbrt(volume) / 24, 0.78, 1.18);
  const displayWidth = v7Clamp(
    (205 + 64 * (length / maxFoot)) * scale,
    184,
    292
  );
  const displayDepth = v7Clamp(
    (124 + 60 * (width / maxFoot)) * scale,
    110,
    192
  );
  const wallHeight = v7Clamp(
    (48 + 70 * (height / maxFoot)) * scale,
    50,
    102
  );

  return {
    length,
    width,
    height,
    volume,
    displayWidth,
    displayDepth,
    wallHeight,
  };
};

const V7_PALETTES = [
  ["#F59A5A", "#9B4F24", "#FFD8B9"],
  ["#E6C45D", "#7C5B16", "#FFF0A7"],
  ["#77B88B", "#315E40", "#D6F0DD"],
  ["#D98EA3", "#7C4051", "#F8D9E2"],
  ["#8199D7", "#40558C", "#DDE6FB"],
  ["#BA8FD0", "#654676", "#F0DFF5"],
];

const v7Hash = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const v7Palette = (component) =>
  V7_PALETTES[
    v7Hash(String(component?._id || component?.name || "gift")) %
      V7_PALETTES.length
  ];

const v7ItemKind = (component) => {
  const source = [
    component?.name,
    component?.category,
    component?.subcategory,
    component?.segment,
    component?.sourceProductType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/bottle|juice|drink|beverage|water|syrup|oil/.test(source)) {
    return "bottle";
  }
  if (/candle|jar|mug|cup|tin|can/.test(source)) return "cylinder";
  if (/chocolate|cookie|biscuit|snack|chips|wafer|bar/.test(source)) {
    return "snack";
  }
  if (/book|card|notebook|diary|frame/.test(source)) return "flat";
  return "gift";
};

const v9PointString = (points = []) =>
  points
    .map(([x, y]) => `${Number(x).toFixed(1)},${Number(y).toFixed(1)}`)
    .join(" ");

const v9LerpPoint = (from, to, amount) => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
];

const v9BoxGeometry = (container) => {
  const real = v7Geometry(container);
  const maxHorizontal = Math.max(real.length, real.width, 1);
  const widthRatio = real.length / maxHorizontal;
  const depthRatio = real.width / maxHorizontal;
  const heightRatio = real.height / maxHorizontal;

  const openingWidth = v7Clamp(278 + widthRatio * 62, 280, 340);
  const openingDepth = v7Clamp(94 + depthRatio * 52, 102, 148);
  const wallScreenHeight = v7Clamp(62 + heightRatio * 78, 66, 122);

  const centerX = 220;
  const backY = 48;
  const frontY = backY + openingDepth;
  const backHalf = openingWidth * 0.43;
  const frontHalf = openingWidth * 0.5;

  const outer = {
    backLeft: [centerX - backHalf, backY],
    backRight: [centerX + backHalf, backY],
    frontRight: [centerX + frontHalf, frontY],
    frontLeft: [centerX - frontHalf, frontY],
  };

  const horizontalInset = v7Clamp(openingWidth * 0.065, 18, 24);
  const floorDropBack = wallScreenHeight * 0.6;
  const floorDropFront = wallScreenHeight * 0.42;

  const inner = {
    backLeft: [
      outer.backLeft[0] + horizontalInset,
      outer.backLeft[1] + floorDropBack,
    ],
    backRight: [
      outer.backRight[0] - horizontalInset,
      outer.backRight[1] + floorDropBack,
    ],
    frontRight: [
      outer.frontRight[0] - horizontalInset * 1.15,
      outer.frontRight[1] + floorDropFront,
    ],
    frontLeft: [
      outer.frontLeft[0] + horizontalInset * 1.15,
      outer.frontLeft[1] + floorDropFront,
    ],
  };

  return {
    ...real,
    openingWidth,
    openingDepth,
    wallScreenHeight,
    outer,
    inner,
    viewWidth: 440,
    viewHeight: 320,
  };
};

const v9FloorPoint = (geometry, u, v) => {
  const left = v9LerpPoint(
    geometry.inner.backLeft,
    geometry.inner.frontLeft,
    v
  );
  const right = v9LerpPoint(
    geometry.inner.backRight,
    geometry.inner.frontRight,
    v
  );

  return v9LerpPoint(left, right, u);
};

const v9OuterPoint = (geometry, u, v) => {
  const left = v9LerpPoint(
    geometry.outer.backLeft,
    geometry.outer.frontLeft,
    v
  );
  const right = v9LerpPoint(
    geometry.outer.backRight,
    geometry.outer.frontRight,
    v
  );

  return v9LerpPoint(left, right, u);
};

const v9RibbonBand = (
  geometry,
  { axis = "vertical", center = 0.5, width = 0.1 } = {}
) => {
  const start = Math.max(0, center - width / 2);
  const end = Math.min(1, center + width / 2);

  if (axis === "horizontal") {
    return [
      v9OuterPoint(geometry, 0, start),
      v9OuterPoint(geometry, 1, start),
      v9OuterPoint(geometry, 1, end),
      v9OuterPoint(geometry, 0, end),
    ];
  }

  return [
    v9OuterPoint(geometry, start, 0),
    v9OuterPoint(geometry, end, 0),
    v9OuterPoint(geometry, end, 1),
    v9OuterPoint(geometry, start, 1),
  ];
};

const v9SvgItemSize = (component, geometry, kind, count) => {
  const dimensions = component?.dimensions || {};
  const unit = dimensions.unit || "cm";
  let length = v7Cm(dimensions.length, unit);
  let width = v7Cm(dimensions.width, unit);
  let height = v7Cm(dimensions.height, unit);

  const fallback = {
    bottle: [5, 5, 17],
    cylinder: [8, 8, 10],
    snack: [9, 5, 12],
    flat: [11, 4, 7],
    gift: [8, 7, 8],
  }[kind];

  if (!length || !width || !height) {
    [length, width, height] = fallback;
  }

  const crowdScale =
    count > 14 ? 0.72 : count > 10 ? 0.8 : count > 7 ? 0.88 : 1;

  return {
    width: v7Clamp(
      (28 + 34 * (length / Math.max(geometry.length, 1))) * crowdScale,
      24,
      kind === "flat" ? 52 : 48
    ),
    depth: v7Clamp(
      (15 + 24 * (width / Math.max(geometry.width, 1))) * crowdScale,
      13,
      30
    ),
    height: v7Clamp(
      (27 + 48 * (height / Math.max(geometry.height, 1))) * crowdScale,
      kind === "bottle" ? 38 : 24,
      kind === "bottle" ? 68 : 56
    ),
  };
};

const v9SvgPlacement = ({ index, count, geometry, itemSize }) => {
  const layerCapacity = count > 12 ? 9 : count > 7 ? 8 : 6;
  const layer = Math.floor(index / layerCapacity);
  const slot = index % layerCapacity;
  const slotsThisLayer = Math.min(
    layerCapacity,
    Math.max(1, count - layer * layerCapacity)
  );
  const aspect = geometry.length / Math.max(geometry.width, 1);
  const columns = Math.max(
    2,
    Math.min(4, Math.ceil(Math.sqrt(slotsThisLayer * aspect)))
  );
  const rows = Math.max(1, Math.ceil(slotsThisLayer / columns));
  const row = Math.floor(slot / columns);
  const column = slot % columns;
  const sidePadding = 0.1;
  const depthPadding = 0.12;
  const centeredU = columns === 1 ? 0.5 : (column + 0.5) / columns;
  const centeredV = rows === 1 ? 0.55 : (row + 0.5) / rows;
  const u = sidePadding + centeredU * (1 - sidePadding * 2);
  const v = depthPadding + centeredV * (1 - depthPadding * 2);
  const point = v9FloorPoint(geometry, u, v);
  const layerLift = layer * v7Clamp(itemSize.height * 0.26, 9, 16);
  const turn = columns > 2 ? (column - (columns - 1) / 2) * 1.15 : 0;

  return {
    x: point[0],
    y: point[1] - layerLift,
    turn,
  };
};

const V9SvgGift = ({ component, index, count, geometry }) => {
  const kind = v7ItemKind(component);
  const palette = v7Palette(component);
  const size = v9SvgItemSize(component, geometry, kind, count);
  const placement = v9SvgPlacement({
    index,
    count,
    geometry,
    itemSize: size,
  });
  const [primary, dark, light] = palette;
  const width = size.width;
  const depth = size.depth;
  const height = size.height;
  const skew = depth * 0.48;
  const depthRise = depth * 0.3;
  const topY = -height;
  const hash = v7Hash(String(component?._id || component?.name || index));
  const animationStyle = {
    "--v9-turn": `${placement.turn}deg`,
    animationDelay: `${Math.min(index * 55, 520)}ms`,
  };

  if (kind === "bottle") {
    const bodyWidth = Math.max(18, width * 0.64);
    const bodyHeight = Math.max(34, height * 0.82);
    const neckWidth = Math.max(8, bodyWidth * 0.42);
    const neckHeight = Math.max(8, height * 0.18);

    return (
      <g transform={`translate(${placement.x} ${placement.y})`}>
        <g className="v9-svg-item" style={animationStyle}>
          <ellipse
            cx="0"
            cy="4"
            rx={bodyWidth * 0.62}
            ry="6"
            fill="rgba(0,0,0,.22)"
          />
          <rect
            x={-bodyWidth / 2}
            y={-bodyHeight}
            width={bodyWidth}
            height={bodyHeight}
            rx={bodyWidth * 0.24}
            fill={`url(#v9-item-${hash})`}
            stroke="rgba(20,15,10,.32)"
            strokeWidth="1"
          />
          <ellipse
            cx="0"
            cy={-bodyHeight}
            rx={bodyWidth / 2}
            ry={Math.max(4, bodyWidth * 0.16)}
            fill={light}
            stroke="rgba(20,15,10,.25)"
          />
          <rect
            x={-neckWidth / 2}
            y={-bodyHeight - neckHeight}
            width={neckWidth}
            height={neckHeight}
            rx="3"
            fill={primary}
            stroke="rgba(20,15,10,.25)"
          />
          <ellipse
            cx="0"
            cy={-bodyHeight - neckHeight}
            rx={neckWidth / 2}
            ry="3"
            fill={light}
          />
        </g>
      </g>
    );
  }

  if (kind === "cylinder") {
    const bodyWidth = Math.max(24, width * 0.82);
    const bodyHeight = Math.max(26, height * 0.72);

    return (
      <g transform={`translate(${placement.x} ${placement.y})`}>
        <g className="v9-svg-item" style={animationStyle}>
          <ellipse
            cx="0"
            cy="4"
            rx={bodyWidth * 0.62}
            ry="6"
            fill="rgba(0,0,0,.20)"
          />
          <rect
            x={-bodyWidth / 2}
            y={-bodyHeight}
            width={bodyWidth}
            height={bodyHeight}
            rx="8"
            fill={`url(#v9-item-${hash})`}
            stroke="rgba(20,15,10,.28)"
          />
          <ellipse
            cx="0"
            cy={-bodyHeight}
            rx={bodyWidth / 2}
            ry={Math.max(7, bodyWidth * 0.24)}
            fill={light}
            stroke="rgba(20,15,10,.25)"
          />
        </g>
      </g>
    );
  }

  const a = [-width / 2, topY];
  const b = [width / 2, topY];
  const c = [width / 2 + skew, topY + depthRise];
  const d = [-width / 2 + skew, topY + depthRise];
  const bb = [b[0], b[1] + height];
  const cc = [c[0], c[1] + height];
  const dd = [d[0], d[1] + height];

  return (
    <g transform={`translate(${placement.x} ${placement.y})`}>
      <g className="v9-svg-item" style={animationStyle}>
        <ellipse
          cx={skew * 0.18}
          cy="6"
          rx={width * 0.66}
          ry="7"
          fill="rgba(0,0,0,.20)"
        />
        <polygon
          points={v9PointString([d, c, cc, dd])}
          fill={dark}
          stroke="rgba(20,15,10,.28)"
          strokeWidth="1"
        />
        <polygon
          points={v9PointString([b, c, cc, bb])}
          fill={primary}
          stroke="rgba(20,15,10,.24)"
          strokeWidth="1"
        />
        <polygon
          points={v9PointString([a, b, c, d])}
          fill={kind === "snack" ? `url(#v9-snack-${hash})` : light}
          stroke="rgba(20,15,10,.30)"
          strokeWidth="1"
        />

        {kind === "gift" && (
          <>
            <path
              d={`M ${skew * 0.15} ${topY + 1} L ${skew * 0.42} ${
                topY + depthRise - 1
              }`}
              stroke={dark}
              strokeWidth="4"
              opacity=".52"
            />
            <path
              d={`M ${-width * 0.13} ${topY + depthRise * 0.52} L ${
                width * 0.78
              } ${topY + depthRise * 0.52}`}
              stroke={dark}
              strokeWidth="4"
              opacity=".52"
            />
          </>
        )}
      </g>
    </g>
  );
};

const V9HamperSvg = ({
  selectedContainer,
  previewItems,
  selectedItemCount,
  fillPercent,
  packed = false,
}) => {
  const geometry = v9BoxGeometry(selectedContainer);
  const visibleItems = previewItems.slice(0, 18);
  const organizedItems = [...visibleItems].sort((left, right) => {
    const leftKind = v7ItemKind(left.component);
    const rightKind = v7ItemKind(right.component);
    const leftSize = v9SvgItemSize(
      left.component,
      geometry,
      leftKind,
      visibleItems.length
    );
    const rightSize = v9SvgItemSize(
      right.component,
      geometry,
      rightKind,
      visibleItems.length
    );
    const leftScore = leftSize.width * leftSize.depth + leftSize.height * 0.35;
    const rightScore =
      rightSize.width * rightSize.depth + rightSize.height * 0.35;
    return rightScore - leftScore;
  });

  const overflowCount = Math.max(0, selectedItemCount - visibleItems.length);
  const { outer, inner } = geometry;

  const outerPoints = [
    outer.backLeft,
    outer.backRight,
    outer.frontRight,
    outer.frontLeft,
  ];

  const floorPoints = [
    inner.backLeft,
    inner.backRight,
    inner.frontRight,
    inner.frontLeft,
  ];

  return (
    <svg
      viewBox={`0 0 ${geometry.viewWidth} ${geometry.viewHeight}`}
      className="h-full w-full overflow-visible"
      role="img"
      aria-label="Animated open hamper packing preview"
    >
      <defs>
        <linearGradient id="v9-floor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B6231" />
          <stop offset="52%" stopColor="#5F3D1E" />
          <stop offset="100%" stopColor="#2E1A0D" />
        </linearGradient>
        <linearGradient id="v9-back-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B07A3B" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#5D391A" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id="v9-side-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#96632D" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#432612" stopOpacity="0.96" />
        </linearGradient>
        <linearGradient id="v9-front-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#AA7334" stopOpacity="0.56" />
          <stop offset="100%" stopColor="#4A2A14" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="v11-ribbon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7E1717" />
          <stop offset="46%" stopColor="#D74A39" />
          <stop offset="72%" stopColor="#B52822" />
          <stop offset="100%" stopColor="#671515" />
        </linearGradient>
        <linearGradient
          id="v11-ribbon-light"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor="#F07A65" />
          <stop offset="50%" stopColor="#C83D34" />
          <stop offset="100%" stopColor="#7F1C1B" />
        </linearGradient>
        <radialGradient id="v11-knot" cx="35%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#F58A70" />
          <stop offset="58%" stopColor="#C83D34" />
          <stop offset="100%" stopColor="#741A19" />
        </radialGradient>
        <pattern
          id="v9-wicker"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(18)"
        >
          <rect width="12" height="12" fill="transparent" />
          <rect
            x="0"
            y="0"
            width="5"
            height="12"
            fill="rgba(255,226,169,.12)"
          />
          <rect
            x="6"
            y="0"
            width="2"
            height="12"
            fill="rgba(38,20,8,.18)"
          />
        </pattern>
        <pattern
          id="v9-liner"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="5" cy="6" r="2" fill="rgba(255,238,190,.18)" />
          <circle cx="14" cy="14" r="2" fill="rgba(244,194,94,.12)" />
        </pattern>
        <filter id="v9-shadow" x="-40%" y="-60%" width="180%" height="220%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter
          id="v9-item-shadow"
          x="-50%"
          y="-80%"
          width="200%"
          height="260%"
        >
          <feDropShadow
            dx="0"
            dy="7"
            stdDeviation="5"
            floodColor="#000000"
            floodOpacity="0.36"
          />
        </filter>

        {organizedItems.map(({ id, component }, index) => {
          const [primary, dark, light] = v7Palette(component);
          const hash = v7Hash(
            String(component?._id || component?.name || index)
          );

          return (
            <g key={`defs-${id}`}>
              <linearGradient
                id={`v9-item-${hash}`}
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor={light} />
                <stop offset="55%" stopColor={primary} />
                <stop offset="100%" stopColor={dark} />
              </linearGradient>
              <pattern
                id={`v9-snack-${hash}`}
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <rect width="10" height="10" fill={light} />
                <rect width="5" height="10" fill={primary} opacity=".88" />
              </pattern>
            </g>
          );
        })}
      </defs>

      <ellipse
        cx="220"
        cy="275"
        rx={geometry.openingWidth * 0.54}
        ry="24"
        fill="rgba(0,0,0,.58)"
        filter="url(#v9-shadow)"
      />

      <g className="v9-svg-box">
        <polygon
          points={v9PointString(floorPoints)}
          fill="url(#v9-floor)"
          stroke="rgba(239,204,129,.34)"
          strokeWidth="2"
        />
        <polygon
          points={v9PointString(floorPoints)}
          fill="url(#v9-liner)"
          opacity={0.4 + Math.min(100, fillPercent) / 420}
        />

        <polygon
          points={v9PointString([
            outer.backLeft,
            outer.backRight,
            inner.backRight,
            inner.backLeft,
          ])}
          fill="url(#v9-back-wall)"
          stroke="rgba(246,213,145,.38)"
          strokeWidth="2"
        />
        <polygon
          points={v9PointString([
            outer.backLeft,
            outer.backRight,
            inner.backRight,
            inner.backLeft,
          ])}
          fill="url(#v9-wicker)"
          opacity=".82"
        />

        <polygon
          points={v9PointString([
            outer.backLeft,
            outer.frontLeft,
            inner.frontLeft,
            inner.backLeft,
          ])}
          fill="url(#v9-side-wall)"
          stroke="rgba(241,202,124,.34)"
          strokeWidth="2"
        />
        <polygon
          points={v9PointString([
            outer.backRight,
            outer.frontRight,
            inner.frontRight,
            inner.backRight,
          ])}
          fill="url(#v9-side-wall)"
          stroke="rgba(241,202,124,.34)"
          strokeWidth="2"
        />

        {fillPercent > 0 && (
          <polygon
            points={v9PointString(
              floorPoints.map(([x, y]) => [
                220 + (x - 220) * (0.9 + Math.min(100, fillPercent) / 1000),
                y - Math.min(18, fillPercent * 0.1),
              ])
            )}
            fill="rgba(224,177,91,.18)"
            stroke="rgba(240,207,139,.16)"
            strokeWidth="1"
          />
        )}

        <g filter="url(#v9-item-shadow)">
          {organizedItems.map(({ id, component }, index) => (
            <V9SvgGift
              key={id}
              component={component}
              index={index}
              count={organizedItems.length}
              geometry={geometry}
            />
          ))}
        </g>

        <polygon
          points={v9PointString([
            outer.frontLeft,
            outer.frontRight,
            inner.frontRight,
            inner.frontLeft,
          ])}
          fill="url(#v9-front-wall)"
          stroke="rgba(246,210,140,.52)"
          strokeWidth="2.5"
        />
        <polygon
          points={v9PointString([
            outer.frontLeft,
            outer.frontRight,
            inner.frontRight,
            inner.frontLeft,
          ])}
          fill="url(#v9-wicker)"
          opacity=".42"
        />

        <polygon
          points={v9PointString(outerPoints)}
          fill="none"
          stroke="#E7C56F"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <polygon
          points={v9PointString(floorPoints)}
          fill="none"
          stroke="rgba(244,213,153,.26)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {Object.values(outer).map(([x, y], index) => (
          <g key={`corner-${index}`}>
            <circle cx={x} cy={y} r="6" fill="#F1D47E" opacity=".95" />
            <circle cx={x} cy={y} r="2.4" fill="#6A421B" />
          </g>
        ))}

        {packed && (
          <g className="v9-lid-close">
            <polygon
              points={v9PointString(outerPoints)}
              fill="url(#v9-back-wall)"
              stroke="#E7C56F"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <polygon
              points={v9PointString(outerPoints)}
              fill="url(#v9-wicker)"
              opacity=".90"
            />

            <polygon
              points={v9PointString(
                v9RibbonBand(geometry, {
                  axis: "vertical",
                  center: 0.5,
                  width: 0.105,
                })
              )}
              fill="url(#v11-ribbon)"
              opacity=".98"
            />
            <polygon
              points={v9PointString(
                v9RibbonBand(geometry, {
                  axis: "horizontal",
                  center: 0.51,
                  width: 0.16,
                })
              )}
              fill="url(#v11-ribbon)"
              opacity=".98"
            />

            {(() => {
              const knot = v9OuterPoint(geometry, 0.5, 0.51);

              return (
                <g transform={`translate(${knot[0]} ${knot[1]})`}>
                  <path
                    d="M -4 0 C -18 -18 -42 -17 -48 -4 C -52 8 -31 14 -7 7 Z"
                    fill="url(#v11-ribbon-light)"
                    stroke="rgba(91,24,19,.58)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 4 0 C 18 -18 42 -17 48 -4 C 52 8 31 14 7 7 Z"
                    fill="url(#v11-ribbon-light)"
                    stroke="rgba(91,24,19,.58)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M -8 7 L -25 31 L -2 20 L 0 9 Z"
                    fill="#A62F28"
                    opacity=".96"
                  />
                  <path
                    d="M 8 7 L 25 31 L 2 20 L 0 9 Z"
                    fill="#8F211E"
                    opacity=".96"
                  />
                  <ellipse
                    cx="0"
                    cy="1"
                    rx="11"
                    ry="8"
                    fill="url(#v11-knot)"
                    stroke="rgba(91,24,19,.55)"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })()}

            <text
              x="220"
              y={v9OuterPoint(geometry, 0.5, 0.76)[1]}
              textAnchor="middle"
              fill="rgba(255,244,214,.78)"
              fontSize="8"
              fontWeight="800"
              letterSpacing="2.1"
            >
              HAMPORIUM
            </text>
          </g>
        )}
      </g>

      {overflowCount > 0 && (
        <g transform="translate(360 245)">
          <rect
            x="-38"
            y="-14"
            width="76"
            height="28"
            rx="14"
            fill="rgba(23,23,23,.92)"
            stroke="rgba(212,175,55,.35)"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fill="#E4C666"
            fontSize="11"
            fontWeight="800"
          >
            +{overflowCount} packed
          </text>
        </g>
      )}
    </svg>
  );
};

const V7OpenTop3D = ({
  selectedContainer,
  previewItems,
  previewDecorations,
  selectedItemCount,
  selectedDecorationCount,
  fillPercent,
  configuration,
  canIncreaseAnyItem,
  validating,
}) => {
  const geometry = v9BoxGeometry(selectedContainer);

  const packed = Boolean(
    selectedItemCount > 0 &&
      configuration &&
      !validating &&
      canIncreaseAnyItem === false
  );

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-black/[0.06] bg-[radial-gradient(circle_at_50%_12%,#FFFDF9_0%,#F2E8DB_55%,#E4D4C1_100%)] px-2.5 pb-1.5 pt-2.5">
      <div className="pointer-events-none absolute inset-0">
        <div className="v7-glow absolute left-1/2 top-[62%] h-44 w-80 -translate-x-1/2 rounded-full bg-[#D4AF37]/12 blur-[64px]" />
        <span className="v7-spark absolute left-[8%] top-[22%] text-[9px] text-[#D4AF37]">
          ✦
        </span>
        <span
          className="v7-spark absolute right-[10%] top-[16%] text-[7px] text-[#9B7616]/45"
          style={{ animationDelay: ".8s" }}
        >
          ✦
        </span>
      </div>

      <div className="relative z-10 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-extrabold text-[#171717]/72">
            {selectedContainer?.name || "Choose a hamper"}
          </p>

          {selectedContainer && (
            <p className="mt-1 text-[7px] font-semibold text-black/34">
              Inner {geometry.length.toFixed(0)} × {geometry.width.toFixed(0)} ×{" "}
              {geometry.height.toFixed(0)} cm
            </p>
          )}
        </div>

        {selectedContainer && (
          <span className="rounded-full border border-black/[0.08] bg-white/70 px-2 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-[#D4AF37]">
            {packed ? "Gift wrapped" : "Open hamper"}
          </span>
        )}
      </div>

      <div className="relative z-10 mx-auto h-[285px] max-w-[390px] xl:h-[215px]">
        {!selectedContainer ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-black/10 px-5 py-4 text-center text-[9px] font-bold text-black/30">
              Choose a box to start packing
            </div>
          </div>
        ) : (
          <>
            <V9HamperSvg
              selectedContainer={selectedContainer}
              previewItems={previewItems}
              selectedItemCount={selectedItemCount}
              fillPercent={fillPercent}
              packed={packed}
            />

            {selectedDecorationCount > 0 && (
              <V7DecorationOverlay decorations={previewDecorations} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const V7DecorationOverlay = ({ decorations }) => {
  const positions = [
    "left-[8%] top-[24%] rotate-[-8deg]",
    "right-[8%] top-[24%] rotate-[8deg]",
    "left-[14%] bottom-[11%] rotate-[5deg]",
    "right-[14%] bottom-[11%] rotate-[-5deg]",
  ];

  return (
    <>
      <span className="v7-decoration pointer-events-none absolute left-1/2 top-[49%] z-30 h-[10px] w-[68%] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#8D6616] via-[#E8CB67] to-[#8D6616] opacity-80 shadow-[0_3px_10px_rgba(212,175,55,.18)]" />
      <span className="v7-decoration pointer-events-none absolute left-1/2 top-[28%] z-30 h-[52%] w-[9px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#F0D778] via-[#D4AF37] to-[#8D6616] opacity-78" />

      {decorations.map(({ component }, index) => (
        <div
          key={`${component._id}-${index}`}
          className={`v7-decoration absolute z-40 ${positions[index]}`}
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <Decoration3DToken component={component} />
        </div>
      ))}
    </>
  );
};

const Decoration3DToken = ({ component }) => {
  const name = String(component?.name || "").toLowerCase();

  if (/flower|floral|rose|petal/.test(name)) {
    return (
      <div className="relative h-10 w-10 drop-shadow-[0_7px_6px_rgba(0,0,0,.35)]">
        {[0, 45, 90, 135].map((rotate) => (
          <span
            key={rotate}
            className="absolute left-1/2 top-1/2 h-3.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#F7C4CF] to-[#B75D75]"
            style={{
              transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
            }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37] shadow-inner" />
      </div>
    );
  }

  if (/ribbon|bow/.test(name)) {
    return (
      <div className="relative h-9 w-11 drop-shadow-[0_7px_6px_rgba(0,0,0,.35)]">
        <span className="absolute left-0 top-2 h-6 w-7 rotate-[18deg] rounded-[70%_30%_65%_35%] bg-gradient-to-br from-[#E7CA63] to-[#9C7315]" />
        <span className="absolute right-0 top-2 h-6 w-7 rotate-[-18deg] rounded-[30%_70%_35%_65%] bg-gradient-to-bl from-[#F0D979] to-[#9C7315]" />
        <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5DE88]" />
      </div>
    );
  }

  if (/tag|card|note/.test(name)) {
    return (
      <div className="relative h-9 w-11 rotate-[-8deg] rounded-[5px] border border-[#D4AF37]/35 bg-[#FFF7E5] shadow-[0_7px_9px_rgba(0,0,0,.28)]">
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border border-[#9A7316]" />
        <span className="absolute left-2 top-3 h-1 w-6 rounded bg-[#D4AF37]/35" />
        <span className="absolute left-2 top-5 h-1 w-5 rounded bg-[#D4AF37]/20" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5C85D]/45 bg-[#FFF9F2] text-base text-[#A77812] shadow-[0_8px_13px_rgba(0,0,0,.3)]">
      ✦
    </div>
  );
};

const ProductPager = ({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
}) => {
  const pages = [];
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);

  for (
    let current = Math.max(1, end - 2);
    current <= end;
    current += 1
  ) {
    pages.push(current);
  }

  const go = (nextPage) => {
    const safePage = Math.min(totalPages, Math.max(1, nextPage));
    onPageChange(safePage);

    window.requestAnimationFrame(() => {
      document
        .querySelector('[data-hamper-products-grid="true"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-[12px] border border-black/[0.06] bg-[#FAF8F5] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[10px] font-semibold text-black/40">
        Showing{" "}
        <span className="font-black text-[#171717]">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of <span className="font-black text-[#171717]">{totalItems}</span>{" "}
        products
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          className="h-9 rounded-xl border border-black/10 bg-white px-3 text-[9px] font-black uppercase tracking-[0.07em] text-black/55 transition hover:border-[#F47822] hover:text-[#F47822] disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← Prev
        </button>

        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => go(pageNumber)}
            className={`h-9 min-w-9 rounded-xl px-3 text-[10px] font-black transition ${
              pageNumber === page
                ? "bg-[#171717] text-white shadow-sm"
                : "border border-black/10 bg-white text-black/45 hover:border-[#F47822] hover:text-[#F47822]"
            }`}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          className="h-9 rounded-xl border border-black/10 bg-white px-3 text-[9px] font-black uppercase tracking-[0.07em] text-black/55 transition hover:border-[#F47822] hover:text-[#F47822] disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

const V7Empty = ({ children }) => (
  <div className="mt-3 rounded-[14px] border border-dashed border-black/10 bg-[#FAF8F5] px-5 py-6 text-center text-[12px] font-semibold leading-5 text-black/40">
    {children}
  </div>
);

const NoImage = () => (
  <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#F1ECE5] to-[#E8DFD4] text-[10px] font-bold uppercase tracking-[0.1em] text-black/25">
    No image
  </div>
);

const CustomHamperSkeleton = () => (
  <main className="min-h-screen bg-[#FBF8F3] px-4 pb-20 pt-[112px] sm:px-6 lg:px-8">
    <div className="w-full">
      <div className="h-[280px] animate-pulse rounded-[30px] bg-black/[0.08]" />
      <div className="mt-5 h-[74px] animate-pulse rounded-[22px] bg-black/[0.05]" />
      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-7">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[420px] animate-pulse rounded-[28px] bg-black/[0.05]"
            />
          ))}
        </div>
        <div className="h-[720px] animate-pulse rounded-[30px] bg-black/[0.09]" />
      </div>
    </div>
  </main>
);

export default CustomHamper;
