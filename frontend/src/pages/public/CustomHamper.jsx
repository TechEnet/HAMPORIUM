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
const DESKTOP_ITEMS_PER_PAGE = 8;
const MOBILE_ITEMS_PER_PAGE = 6;

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
  const [contentComponents, setContentComponents] = useState([]);
  const [decorativeComponents, setDecorativeComponents] = useState([]);
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
  const [decorationPage, setDecorationPage] = useState(1);

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

  // Mobile uses a progressive builder so only one decision is visible at a time.
  // Desktop/tablet keep the existing full builder experience.
  const [mobileStep, setMobileStep] = useState(1);
  const [isMobileWizard, setIsMobileWizard] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false
  );
  const mobileFlowRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileWizard(media.matches);

    update();

    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

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

  const itemsPerPage = isMobileWizard
    ? MOBILE_ITEMS_PER_PAGE
    : DESKTOP_ITEMS_PER_PAGE;

  const totalItemPages = Math.max(
    1,
    Math.ceil(visibleComponents.length / itemsPerPage)
  );

  const paginatedComponents = useMemo(() => {
    const start = (itemPage - 1) * itemsPerPage;
    return visibleComponents.slice(start, start + itemsPerPage);
  }, [visibleComponents, itemPage, itemsPerPage]);

  const itemRangeStart =
    visibleComponents.length === 0
      ? 0
      : (itemPage - 1) * itemsPerPage + 1;

  const itemRangeEnd = Math.min(
    itemPage * itemsPerPage,
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

  const totalDecorationPages = isMobileWizard
    ? Math.max(1, Math.ceil(visibleDecorations.length / MOBILE_ITEMS_PER_PAGE))
    : 1;

  const paginatedDecorations = useMemo(() => {
    if (!isMobileWizard) return visibleDecorations;

    const start = (decorationPage - 1) * MOBILE_ITEMS_PER_PAGE;
    return visibleDecorations.slice(start, start + MOBILE_ITEMS_PER_PAGE);
  }, [visibleDecorations, decorationPage, isMobileWizard]);

  const decorationRangeStart =
    visibleDecorations.length === 0
      ? 0
      : (decorationPage - 1) * MOBILE_ITEMS_PER_PAGE + 1;

  const decorationRangeEnd = isMobileWizard
    ? Math.min(decorationPage * MOBILE_ITEMS_PER_PAGE, visibleDecorations.length)
    : visibleDecorations.length;

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
        const containerSuffix = channel
          ? `?channel=${encodeURIComponent(channel)}`
          : "";

        const buildComponentUrl = (hamperRole) => {
          const params = new URLSearchParams({ hamperRole });

          if (channel) {
            params.set("channel", channel);
          }

          return `/catalog/components?${params.toString()}`;
        };

        const [
          containerResponse,
          contentResponse,
          decorationResponse,
        ] = await Promise.all([
          api.get(`/catalog/containers${containerSuffix}`),
          api.get(buildComponentUrl("content")),
          api.get(buildComponentUrl("decoration")),
        ]);

        const loadedContainers = containerResponse.data.containers || [];
        const loadedContentComponents = contentResponse.data.components || [];
        const loadedDecorativeComponents =
          decorationResponse.data.components || [];

        setContainers(loadedContainers);
        setContentComponents(loadedContentComponents);
        setDecorativeComponents(loadedDecorativeComponents);

        const mobileFirstChoice =
          typeof window !== "undefined" &&
          window.matchMedia("(max-width: 767px)").matches;

        setContainerId(mobileFirstChoice ? "" : loadedContainers[0]?._id || "");
        setMobileStep(1);
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
    if (!isMobileWizard) return;

    if (!containerId && mobileStep > 1) {
      setMobileStep(1);
      return;
    }

    if (containerId && selectedItems.length === 0 && mobileStep > 2) {
      setMobileStep(2);
    }
  }, [isMobileWizard, containerId, selectedItems.length, mobileStep]);

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

  useEffect(() => {
    setDecorationPage(1);
  }, [decorationSearch, isMobileWizard]);

  useEffect(() => {
    if (decorationPage > totalDecorationPages) {
      setDecorationPage(totalDecorationPages);
    }
  }, [decorationPage, totalDecorationPages]);

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
    !containerId
      ? 1
      : selectedItems.length === 0
        ? 2
        : selectedDecorationCount === 0 && !personalizationPayload
          ? 3
          : !personalizationPayload
            ? 4
            : 5;

  const moveMobileStep = (nextStep) => {
    const safeStep = Math.min(5, Math.max(1, Number(nextStep) || 1));
    setMobileStep(safeStep);
    setCartError("");

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        mobileFlowRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  const canContinueFromBox =
    Boolean(containerId) && !validating && Boolean(configuration);

  const canContinueFromProducts =
    selectedItemCount > 0 && !validating && !selectionPending;

  return (
    <main
      className="min-h-screen bg-[#FBF8F3] pb-20 pt-[84px] text-[#171717] sm:pt-[92px]"
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


        /* =====================================================
           V20 · REAL-TIME PACKING STUDIO
           Real product imagery drops into the selected box.
        ====================================================== */

        @keyframes v20BoxArrive {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(24px) scale(.91);
          }
          64% {
            opacity: 1;
            transform: translateX(-50%) translateY(-3px) scale(1.018);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes v20LidOpen {
          0% {
            opacity: .45;
            transform: perspective(760px) rotateX(4deg) translateY(82%) scale(.94);
          }
          58% {
            opacity: 1;
            transform: perspective(760px) rotateX(66deg) translateY(-45%) scale(1.015);
          }
          100% {
            opacity: 1;
            transform: perspective(760px) rotateX(60deg) translateY(-39%) scale(1);
          }
        }

        @keyframes v20LidClose {
          0% {
            transform: perspective(760px) rotateX(60deg) translateY(-39%) scale(1);
          }
          60% {
            transform: perspective(760px) rotateX(6deg) translateY(74%) scale(.965);
          }
          100% {
            transform: perspective(760px) rotateX(0deg) translateY(78%) scale(.97);
          }
        }

        @keyframes v20ItemDrop {
          0% {
            opacity: 0;
            transform:
              translate(-50%, -290px)
              rotate(calc(var(--v20-rotate) - 13deg))
              scale(.72);
            filter: blur(2px);
          }
          52% {
            opacity: 1;
            filter: blur(0);
          }
          72% {
            transform:
              translate(-50%, -42%)
              rotate(calc(var(--v20-rotate) + 2deg))
              scale(var(--v20-scale));
          }
          86% {
            transform:
              translate(-50%, -56%)
              rotate(calc(var(--v20-rotate) - 1deg))
              scale(var(--v20-scale));
          }
          100% {
            opacity: 1;
            transform:
              translate(-50%, -50%)
              rotate(var(--v20-rotate))
              scale(var(--v20-scale));
            filter: blur(0);
          }
        }

        @keyframes v20ItemExit {
          0% {
            opacity: 1;
            transform:
              translate(-50%, -50%)
              rotate(var(--v20-rotate))
              scale(var(--v20-scale));
          }
          100% {
            opacity: 0;
            transform:
              translate(-50%, -96%)
              rotate(calc(var(--v20-rotate) + 8deg))
              scale(.68);
          }
        }

        @keyframes v20ItemPulse {
          0%, 100% { box-shadow: 0 8px 18px rgba(33,22,10,.18); }
          50% { box-shadow: 0 12px 28px rgba(244,120,34,.24); }
        }

        @keyframes v20PackingToast {
          0% { opacity: 0; transform: translate(-50%, -7px) scale(.96); }
          14%, 78% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, 5px) scale(.985); }
        }

        @keyframes v20FillerFloat {
          0%, 100% { transform: translateY(0) rotate(var(--v20-filler-turn)); }
          50% { transform: translateY(-3px) rotate(var(--v20-filler-turn)); }
        }

        @keyframes v20RibbonSettle {
          0% { opacity: 0; transform: scaleX(.2); }
          100% { opacity: 1; transform: scaleX(1); }
        }

        @keyframes v20PackedGlow {
          0%, 100% { opacity: .45; transform: translateX(-50%) scale(.94); }
          50% { opacity: .78; transform: translateX(-50%) scale(1.04); }
        }

        .v20-live-stage {
          position: relative;
          isolation: isolate;
          min-height: 286px;
          overflow: hidden;
          border: 1px solid rgba(78,56,31,.06);
          border-radius: 18px;
          background:
            radial-gradient(circle at 50% 9%, rgba(255,255,255,.98), transparent 30%),
            radial-gradient(circle at 50% 86%, rgba(212,175,55,.14), transparent 38%),
            linear-gradient(180deg, #FFFDF9 0%, #F5ECE0 58%, #E9D9C7 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.82),
            0 8px 20px rgba(42,31,19,.035);
        }

        .v20-live-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .24;
          background-image:
            radial-gradient(rgba(99,70,38,.13) .55px, transparent .55px);
          background-size: 8px 8px;
          mask-image: linear-gradient(to bottom, transparent, black 22%, black 84%, transparent);
        }

        .v20-live-stage::after {
          content: "";
          position: absolute;
          z-index: 0;
          left: 50%;
          bottom: 8px;
          width: 76%;
          height: 44px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: rgba(78,48,21,.19);
          filter: blur(16px);
        }

        .v20-studio-grid {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: .22;
          background-image:
            linear-gradient(rgba(116,84,46,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(116,84,46,.12) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(to bottom, transparent 18%, black 54%, transparent 94%);
          transform: perspective(420px) rotateX(64deg) scale(1.5) translateY(28%);
          transform-origin: center bottom;
        }

        .v20-box-world {
          --v20-box-main: #D9A969;
          --v20-box-light: #F3D7AE;
          --v20-box-dark: #8E5A2C;
          --v20-box-deep: #563018;

          position: absolute;
          z-index: 12;
          left: 50%;
          bottom: 4px;
          width: min(94%, 520px);
          height: 292px;
          transform: translateX(-50%);
          perspective: 1000px;
          animation: v20BoxArrive .68s cubic-bezier(.18,.78,.2,1) both;
          will-change: transform, opacity;
        }

        .v20-box-glow {
          position: absolute;
          z-index: 0;
          left: 50%;
          bottom: 0;
          width: 86%;
          height: 42%;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(244,120,34,.18), rgba(212,175,55,.09) 44%, transparent 72%);
          filter: blur(24px);
        }

        .v20-box-lid {
          position: absolute;
          z-index: 4;
          left: 8%;
          top: 2%;
          width: 84%;
          height: 44%;
          transform-origin: 50% 100%;
          transform-style: preserve-3d;
          animation: v20LidOpen .86s cubic-bezier(.16,.82,.22,1) both;
        }

        .v20-box-lid.is-packed {
          z-index: 56;
          animation: v20LidClose .82s cubic-bezier(.2,.75,.2,1) both;
        }

        .v20-box-lid-face {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border: 1px solid rgba(77,45,20,.22);
          border-radius: 12px 12px 8px 8px;
          background:
            linear-gradient(145deg, var(--v20-box-light), var(--v20-box-main) 58%, var(--v20-box-dark));
          box-shadow:
            0 14px 26px rgba(48,28,12,.22),
            inset 0 1px 0 rgba(255,255,255,.38),
            inset 0 -5px 14px rgba(77,40,12,.11);
        }

        .v20-box-lid-face::before {
          content: "";
          position: absolute;
          inset: 9px;
          border: 1px solid rgba(255,247,224,.32);
          border-radius: 8px;
          pointer-events: none;
        }

        .v20-box-lid-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: .19;
          mix-blend-mode: multiply;
          filter: saturate(.7) contrast(.9);
        }

        .v20-box-monogram {
          position: absolute;
          z-index: 2;
          left: 50%;
          top: 50%;
          display: flex;
          width: 52px;
          height: 52px;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255,240,191,.48);
          border-radius: 999px;
          color: #FFF2C8;
          background: rgba(76,40,16,.20);
          box-shadow: inset 0 0 0 5px rgba(255,255,255,.035);
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 25px;
          font-weight: 700;
          text-shadow: 0 2px 8px rgba(0,0,0,.22);
          backdrop-filter: blur(2px);
        }

        .v20-box-back {
          position: absolute;
          z-index: 8;
          left: 8%;
          right: 8%;
          top: 31%;
          height: 31%;
          clip-path: polygon(6% 0, 94% 0, 100% 100%, 0 100%);
          border: 1px solid rgba(70,39,16,.18);
          background: linear-gradient(180deg, var(--v20-box-main), var(--v20-box-dark));
          box-shadow: inset 0 10px 18px rgba(255,255,255,.08);
        }

        .v20-box-well {
          position: absolute;
          z-index: 10;
          left: 11.5%;
          right: 11.5%;
          top: 35%;
          height: 44%;
          overflow: hidden;
          clip-path: polygon(5% 0, 95% 0, 100% 84%, 0 84%);
          background:
            radial-gradient(circle at 50% 68%, rgba(232,205,152,.52), transparent 38%),
            linear-gradient(180deg, #5A361C, #2C180D 78%);
          box-shadow:
            inset 0 18px 32px rgba(0,0,0,.34),
            inset 0 -8px 16px rgba(255,221,154,.06);
        }

        .v20-filler {
          position: absolute;
          z-index: 12;
          left: 14%;
          right: 14%;
          top: 52%;
          height: 24%;
          overflow: hidden;
          opacity: .92;
        }

        .v20-filler span {
          position: absolute;
          bottom: 0;
          width: 26px;
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, #C59654, #E8C982, #9B6B31);
          box-shadow: 0 2px 3px rgba(0,0,0,.12);
          animation: v20FillerFloat 2.8s ease-in-out infinite;
        }

        .v20-item-layer {
          position: absolute;
          z-index: 24;
          inset: 0;
          pointer-events: none;
        }

        .v20-pack-item {
          position: absolute;
          transform:
            translate(-50%, -50%)
            rotate(var(--v20-rotate))
            scale(var(--v20-scale));
          transform-origin: center bottom;
          will-change: transform, opacity;
        }

        .v20-pack-item.is-entering {
          animation: v20ItemDrop .82s cubic-bezier(.17,.78,.2,1.08) both;
        }

        .v20-pack-item.is-exiting {
          animation: v20ItemExit .34s cubic-bezier(.45,0,.8,.4) both;
        }

        .v20-pack-card {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border: 1px solid rgba(61,39,20,.18);
          border-radius: 9px;
          background: linear-gradient(145deg, #FFFDF9, #EEDCC6);
          box-shadow:
            0 9px 18px rgba(36,22,10,.21),
            inset 0 1px 0 rgba(255,255,255,.72);
          animation: v20ItemPulse 2.8s ease-in-out infinite;
        }

        .v20-kind-bottle .v20-pack-card {
          border-radius: 13px 13px 9px 9px;
        }

        .v20-kind-cylinder .v20-pack-card {
          border-radius: 18px 18px 10px 10px;
        }

        .v20-kind-flat .v20-pack-card {
          border-radius: 7px;
        }

        .v20-pack-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
          background: rgba(255,255,255,.90);
        }

        .v20-pack-fallback {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          color: #8A631C;
          background:
            radial-gradient(circle at 30% 22%, rgba(255,255,255,.7), transparent 34%),
            linear-gradient(145deg, #F6E5C9, #C99449);
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
        }

        .v20-pack-label {
          position: absolute;
          left: 4px;
          right: 4px;
          bottom: 4px;
          overflow: hidden;
          padding: 2px 4px;
          border-radius: 5px;
          color: rgba(255,255,255,.94);
          background: rgba(22,17,12,.70);
          font-size: 5.5px;
          font-weight: 800;
          line-height: 1.1;
          text-align: center;
          text-overflow: ellipsis;
          white-space: nowrap;
          backdrop-filter: blur(3px);
        }

        .v20-box-left,
        .v20-box-right,
        .v20-box-front {
          position: absolute;
          z-index: 42;
          pointer-events: none;
          border: 1px solid rgba(69,38,16,.18);
          background: linear-gradient(180deg, var(--v20-box-main), var(--v20-box-dark));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
        }

        .v20-box-left {
          left: 6%;
          top: 45%;
          width: 20%;
          height: 40%;
          clip-path: polygon(0 0, 100% 13%, 100% 100%, 26% 88%);
          background: linear-gradient(135deg, var(--v20-box-main), var(--v20-box-deep));
        }

        .v20-box-right {
          right: 6%;
          top: 45%;
          width: 20%;
          height: 40%;
          clip-path: polygon(0 13%, 100% 0, 74% 88%, 0 100%);
          background: linear-gradient(225deg, var(--v20-box-main), var(--v20-box-deep));
        }

        .v20-box-front {
          left: 16%;
          right: 16%;
          bottom: 2%;
          height: 33%;
          clip-path: polygon(0 8%, 100% 8%, 93% 100%, 7% 100%);
          background:
            linear-gradient(180deg, var(--v20-box-main) 0%, var(--v20-box-dark) 78%, var(--v20-box-deep) 100%);
          box-shadow:
            0 12px 20px rgba(49,28,10,.18),
            inset 0 1px 0 rgba(255,255,255,.20);
        }

        .v20-box-front::after {
          content: "HAMPORIUM";
          position: absolute;
          left: 50%;
          top: 52%;
          transform: translate(-50%, -50%);
          color: rgba(255,240,192,.80);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .18em;
          text-shadow: 0 2px 8px rgba(0,0,0,.15);
        }

        .v20-pack-ribbon-h,
        .v20-pack-ribbon-v {
          position: absolute;
          z-index: 63;
          pointer-events: none;
          background:
            linear-gradient(90deg, #9B6C11, #E8CB67 26%, #FFF0AD 50%, #D5A532 74%, #81530D);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.34), 0 4px 10px rgba(43,26,5,.16);
          animation: v20RibbonSettle .48s cubic-bezier(.2,.8,.2,1) both;
        }

        .v20-pack-ribbon-h {
          left: 17%;
          right: 17%;
          top: 68%;
          height: 9px;
          transform-origin: center;
        }

        .v20-pack-ribbon-v {
          left: 50%;
          top: 41%;
          bottom: 5%;
          width: 9px;
          transform: translateX(-50%);
          background:
            linear-gradient(180deg, #FFF0AD, #D5A532 44%, #81530D);
        }

        .v20-packed-badge {
          position: absolute;
          z-index: 68;
          left: 50%;
          top: 63%;
          display: flex;
          min-width: 82px;
          height: 29px;
          align-items: center;
          justify-content: center;
          transform: translateX(-50%);
          border: 1px solid rgba(255,239,175,.54);
          border-radius: 999px;
          color: #FFF0B5;
          background: radial-gradient(circle at 35% 28%, #C99B33, #7F500D);
          box-shadow: 0 8px 16px rgba(42,24,4,.22), inset 0 1px 0 rgba(255,255,255,.26);
          font-size: 6.5px;
          font-weight: 900;
          letter-spacing: .10em;
          text-transform: uppercase;
        }

        .v20-packing-toast {
          position: absolute;
          z-index: 90;
          left: 50%;
          top: 43px;
          max-width: 76%;
          overflow: hidden;
          transform: translateX(-50%);
          border: 1px solid rgba(212,175,55,.25);
          border-radius: 999px;
          padding: 7px 12px;
          color: #5B4213;
          background: rgba(255,252,244,.92);
          box-shadow: 0 8px 24px rgba(44,29,11,.10);
          font-size: 7.5px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
          backdrop-filter: blur(10px);
          animation: v20PackingToast 1.35s ease both;
        }

        .v20-packing-toast::before {
          content: "";
          display: inline-block;
          width: 6px;
          height: 6px;
          margin-right: 7px;
          border-radius: 999px;
          background: #F47822;
          box-shadow: 0 0 0 4px rgba(244,120,34,.10);
        }

        .v20-empty-cue {
          position: absolute;
          z-index: 30;
          left: 50%;
          top: 50%;
          width: 58%;
          transform: translate(-50%, -50%);
          border: 1px dashed rgba(92,65,34,.20);
          border-radius: 14px;
          padding: 12px 14px;
          color: rgba(38,28,18,.40);
          background: rgba(255,255,255,.46);
          font-size: 8px;
          font-weight: 800;
          line-height: 1.5;
          text-align: center;
          backdrop-filter: blur(4px);
        }

        .v20-capacity-line {
          position: absolute;
          z-index: 80;
          left: 10px;
          right: 10px;
          bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .v20-capacity-track {
          height: 4px;
          flex: 1;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(77,50,25,.10);
        }

        .v20-capacity-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #F47822, #D4AF37);
          box-shadow: 0 0 14px rgba(244,120,34,.18);
          transition: width .72s cubic-bezier(.22,1,.36,1);
        }

        .v20-capacity-copy {
          width: 34px;
          flex: 0 0 auto;
          color: rgba(27,23,18,.46);
          font-size: 7px;
          font-weight: 900;
          text-align: right;
        }

        .v20-decor-band {
          position: absolute;
          z-index: 62;
          left: 18%;
          right: 18%;
          top: 68%;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #875B0B, #EED576 48%, #875B0B);
          box-shadow: 0 3px 10px rgba(87,56,6,.20);
          animation: v20RibbonSettle .46s cubic-bezier(.2,.8,.2,1) both;
        }

        .v20-decor-band-v {
          position: absolute;
          z-index: 61;
          left: 50%;
          top: 45%;
          bottom: 7%;
          width: 8px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: linear-gradient(180deg, #F7E9A8, #C39021 64%, #80520C);
          animation: v20RibbonSettle .46s cubic-bezier(.2,.8,.2,1) both;
        }

        .v20-packed-glow {
          position: absolute;
          z-index: 3;
          left: 50%;
          bottom: 6%;
          width: 72%;
          height: 32%;
          transform: translateX(-50%);
          border-radius: 999px;
          background: rgba(212,175,55,.18);
          filter: blur(28px);
          animation: v20PackedGlow 2.8s ease-in-out infinite;
        }

        @media (min-width: 1280px) {
          .v20-live-stage { min-height: 278px; }
          .v20-box-world { width: 94%; max-width: 520px; height: 282px; }
        }

        @media (max-width: 639px) {
          .v20-live-stage { min-height: 272px; }
          .v20-box-world { width: 98%; height: 258px; bottom: 4px; }
          .v20-pack-label { display: none; }
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

        .v24-fixed-studio {
          scrollbar-width: none;
        }


        .v24-fixed-studio::-webkit-scrollbar {
          display: none;
        }

        @media (min-width: 1280px) {
          .v24-fixed-studio {
            background: #FBF8F3;
          }
        }

        @media (min-width: 1280px) {
          .v24-fixed-studio {
            animation: v7Rise .45s cubic-bezier(.2,.75,.2,1) both;
          }
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
          .v7-reveal, .v7-glow, .v7-spark, .v7-decoration, .v9-svg-box, .v9-svg-item, .v13-modal-backdrop, .v13-modal-panel,
          .v20-box-world, .v20-box-lid, .v20-pack-item, .v20-pack-card, .v20-packing-toast,
          .v20-decor-band, .v20-decor-band-v, .v20-packed-glow, .v20-filler span {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 min-[2200px]:px-16">
        <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_clamp(420px,25vw,520px)] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_clamp(460px,23vw,560px)] 2xl:gap-8">
          <div className="min-w-0 w-full">
            <div className="v7-reveal border-b border-black/[0.07] pb-5 pt-2 sm:pb-6 lg:pt-4">
              <div className="grid gap-5 2xl:grid-cols-[minmax(300px,.72fr)_minmax(480px,1.28fr)] 2xl:items-center 2xl:gap-8">
                <h1
                  style={{
                    fontFamily:
                      DISPLAY_FONT,
                  }}
                  className="max-w-[680px] text-[38px] font-semibold leading-[0.92] tracking-[-0.04em] text-[#171717] sm:text-[clamp(44px,4vw,72px)]"
                >
                  Create Your Own Hamper
                </h1>

                <div className="min-w-0">
                  <div ref={mobileFlowRef} className="scroll-mt-[86px] md:hidden">
                    <MobileBuilderProgress
                      step={mobileStep}
                      orderMode={orderMode}
                    />
                  </div>

                  <div className="v10-soft-scroll hidden overflow-x-auto pb-1 md:block">
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
                            <div className="flex min-w-[82px] flex-col items-center text-center">
                              <span
                                className={`flex h-9 w-9 items-center justify-center rounded-full border text-[9px] font-black transition-all duration-300 ${
                                  active
                                    ? "border-[#F47822] bg-[#F47822] text-white shadow-[0_7px_20px_rgba(244,120,34,.18)]"
                                    : complete
                                      ? "border-[#D4AF37] bg-[#FFF9EC] text-[#987116]"
                                      : "border-black/[0.09] bg-white text-black/34"
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
                                className={`mt-1.5 text-[8.5px] font-black ${
                                  active
                                    ? "text-[#171717]"
                                    : "text-black/34"
                                }`}
                              >
                                {label}
                              </span>
                            </div>

                            {index <
                              list.length -
                                1 && (
                              <span
                                className={`mt-[18px] h-px flex-1 transition-colors duration-300 ${
                                  complete
                                    ? "bg-[#D4AF37]"
                                    : "bg-black/[0.09]"
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

            <div className="mt-6 min-w-0 w-full space-y-5 sm:space-y-10">
            {(!isMobileWizard || mobileStep === 1) && (
              <>
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

            {isMobileWizard && (
              <MobileStepActions
                nextLabel="Continue to gifts"
                nextDisabled={!canContinueFromBox}
                onNext={() => moveMobileStep(2)}
                hint={
                  selectedContainer
                    ? `${selectedContainer.name} selected`
                    : "Select one hamper box to continue."
                }
              />
            )}
              </>
            )}

            {(!isMobileWizard || mobileStep === 2) && (
              <>
            <V7Section
              number="02"
              title="Add Products"
              meta={
                selectedItemCount > 0
                  ? `${selectedItemCount} inside`
                  : "Pick your favourites"
              }
            >
              {isMobileWizard && (
                <MobileLiveHamperStatus
                  selectedContainer={selectedContainer}
                  selectedItemCount={selectedItemCount}
                  fillPercent={fillPercent}
                  configuration={configuration}
                  validating={validating || selectionPending}
                />
              )}

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
                  className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-7 lg:grid-cols-4"
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
                  compact={isMobileWizard}
                />
              )}
            </V7Section>

            {isMobileWizard && (
              <MobileStepActions
                backLabel="Box"
                nextLabel="Continue to finishing"
                nextDisabled={!canContinueFromProducts}
                onBack={() => moveMobileStep(1)}
                onNext={() => moveMobileStep(3)}
                hint={
                  selectedItemCount > 0
                    ? `${selectedItemCount} gift${selectedItemCount === 1 ? "" : "s"} selected`
                    : "Add at least one gift to continue."
                }
              />
            )}
              </>
            )}

            {(!isMobileWizard || mobileStep === 3) && (
              <>
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
              <div className="mb-5 flex flex-col gap-2 border-y border-[#D4AF37]/16 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black text-[#171717]">
                    Decorations don’t use gift space.
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold leading-4 text-black/42">
                    Ribbons, tags and other finishes are priced separately.
                  </p>
                </div>

                <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.08em] text-[#9A7316]">
                  0% capacity
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
                <div
                  data-hamper-decorations-grid="true"
                  className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-7 lg:grid-cols-4 2xl:grid-cols-5"
                >
                  {paginatedDecorations.map((component) => (
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

              {isMobileWizard && visibleDecorations.length > 0 && (
                <ProductPager
                  page={decorationPage}
                  totalPages={totalDecorationPages}
                  totalItems={visibleDecorations.length}
                  rangeStart={decorationRangeStart}
                  rangeEnd={decorationRangeEnd}
                  onPageChange={setDecorationPage}
                  compact
                  label="Finishing touches"
                  scrollSelector='[data-hamper-decorations-grid="true"]'
                />
              )}
            </V7Section>

            {isMobileWizard && (
              <MobileStepActions
                backLabel="Gifts"
                nextLabel={selectedDecorationCount > 0 ? "Continue" : "Skip & continue"}
                onBack={() => moveMobileStep(2)}
                onNext={() => moveMobileStep(4)}
                hint={
                  selectedDecorationCount > 0
                    ? `${selectedDecorationCount} finishing touch${selectedDecorationCount === 1 ? "" : "es"} selected`
                    : "Finishing touches are optional."
                }
              />
            )}
              </>
            )}

            {(!isMobileWizard || mobileStep === 4) && (
              <>
            <V7Section
              number="04"
              title="Personalise Your Hamper"
              meta={personalizationPayload ? "Added" : "Optional"}
            >
              <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)] lg:gap-8">
                <div>
                  <div className="border-t border-black/[0.07] pt-4 sm:pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F47822]">
                          1 · Add a logo or design
                        </p>
                        <p className="mt-1 max-w-xl text-[12px] font-semibold leading-5 text-black/46">
                          Upload an image only if you want branding or custom artwork on the hamper.
                        </p>
                      </div>

                      <span className="text-[9px] font-black text-black/34">
                        {personalization.assets.length} / 4 images
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.08em] text-black/35">
                          What are you uploading?
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
                          Where should it go?
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
                        Placement details (optional)
                      </span>
                      <input
                        value={assetNotes}
                        maxLength={500}
                        onChange={(event) => setAssetNotes(event.target.value)}
                        placeholder="e.g. centred on the lid, small size, use gold logo only"
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
                          {uploadingAsset ? "Uploading…" : "Upload image"}
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
                          Login to upload
                        </button>
                      )}

                      <span className="text-[10px] font-semibold text-black/32">
                        JPG, PNG, WEBP or AVIF · up to 5 MB
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
                              placeholder="Placement details"
                              className="h-9 rounded-lg border border-black/[0.08] bg-white px-2.5 text-[10px] font-semibold outline-none focus:border-[#F47822]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 lg:border-l lg:border-black/[0.07] lg:pl-8">
                  <label className="block border-t border-black/[0.08] pt-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#F47822]">
                      2 · Add a gift message
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold leading-5 text-black/42">
                      Optional — add a short message to include with the gift.
                    </span>
                    <textarea
                      rows="3"
                      maxLength={500}
                      value={personalization.message}
                      onChange={(event) =>
                        setPersonalization((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                      placeholder="e.g. Happy Anniversary, A & R"
                      className="mt-2 w-full resize-none rounded-xl border border-black/[0.08] bg-[#FAF8F5] p-3 text-[12px] font-semibold leading-5 outline-none focus:border-[#F47822] focus:bg-white"
                    />
                    {personalization.message.length > 0 && (
                      <span className="mt-1 block text-right text-[8px] font-bold text-black/25">
                        {personalization.message.length}/500
                      </span>
                    )}
                  </label>

                  <label className="block border-t border-black/[0.08] pt-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#F47822]">
                      3 · Anything we should know?
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold leading-5 text-black/42">
                      Optional — tell us any important styling or packing preference.
                    </span>
                    <textarea
                      rows="4"
                      maxLength={1500}
                      value={personalization.instructions}
                      onChange={(event) =>
                        setPersonalization((current) => ({
                          ...current,
                          instructions: event.target.value,
                        }))
                      }
                      placeholder="e.g. Use ivory ribbon, keep the logo small, no plastic wrap"
                      className="mt-2 w-full resize-none rounded-xl border border-black/[0.08] bg-[#FAF8F5] p-3 text-[12px] font-semibold leading-5 outline-none focus:border-[#F47822] focus:bg-white"
                    />
                    {personalization.instructions.length > 0 && (
                      <span className="mt-1 block text-right text-[8px] font-bold text-black/25">
                        {personalization.instructions.length}/1500
                      </span>
                    )}
                  </label>

                </div>
              </div>
            </V7Section>

            {isMobileWizard && (
              <MobileStepActions
                backLabel="Finishing"
                nextLabel={orderMode === "bulk" ? "Continue to quote" : "Review hamper"}
                onBack={() => moveMobileStep(3)}
                onNext={() => moveMobileStep(5)}
                hint={
                  personalizationPayload
                    ? "Personalisation saved to this hamper."
                    : "Personalisation is optional."
                }
              />
            )}
              </>
            )}

            {orderMode === "bulk" && (!isMobileWizard || mobileStep === 5) && (
              <V7Section
                number="05"
                title="Tell us about the bulk order"
                meta={`${Number(bulkQuantity || 0).toLocaleString(
                  "en-IN"
                )} hampers`}
                gold
              >
                <div className="border-y border-[#D4AF37]/20 bg-[#FFFCF6]/70 px-1 py-4 sm:px-2 sm:py-5">
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

                {isMobileWizard && (
                  <div className="mt-5 md:hidden">
                    <button
                      type="button"
                      onClick={() => moveMobileStep(4)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/[0.09] bg-white px-4 text-[10px] font-black text-black/55"
                    >
                      ← Back to personalise
                    </button>
                  </div>
                )}
              </V7Section>
            )}
            </div>
          </div>

          {(!isMobileWizard || mobileStep === 5) && (
          <aside className="v24-fixed-studio xl:fixed xl:right-10 xl:top-[96px] xl:z-20 xl:h-[calc(100dvh-112px)] xl:w-[clamp(420px,25vw,520px)] xl:overflow-y-auto xl:overscroll-contain xl:border-l xl:border-black/[0.08] xl:pl-7 2xl:right-12 2xl:w-[clamp(460px,23vw,560px)] 2xl:pl-8 min-[2200px]:right-16">
            {isMobileWizard && orderMode !== "bulk" && (
              <div className="mb-5 rounded-[20px] border border-black/[0.07] bg-white p-4 shadow-[0_10px_30px_rgba(40,27,13,.05)] md:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#F47822]">Step 05 · Review</p>
                    <p className="mt-1 text-[12px] font-semibold text-black/45">Check your hamper, price and capacity before adding it to cart.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => moveMobileStep(4)}
                    className="shrink-0 rounded-full border border-black/[0.08] bg-[#FAF8F5] px-3 py-2 text-[9px] font-black text-black/48"
                  >
                    ← Back
                  </button>
                </div>
              </div>
            )}
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
          )}
        </div>
      </section>
    </main>
  );
};

const OrderModeChooser = ({ mode, onChange }) => (
  <div className="mt-3 flex justify-end sm:mt-5">
    <div className="inline-grid w-full grid-cols-2 overflow-hidden rounded-[14px] border border-black/[0.08] bg-white p-1 shadow-[0_6px_18px_rgba(38,28,16,.035)] sm:w-[430px] sm:rounded-none sm:border-x-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      <button
        type="button"
        onClick={() =>
          onChange("personal")
        }
        className={`min-h-[44px] rounded-[10px] px-4 text-center text-[11px] font-black transition sm:min-h-[48px] sm:rounded-none sm:px-5 sm:text-[12px] ${
          mode === "personal"
            ? "bg-[#171717] text-white"
            : "bg-transparent text-black/45 hover:bg-[#FAF8F5] hover:text-[#171717] sm:hover:bg-white"
        }`}
      >
        Personal
      </button>

      <button
        type="button"
        onClick={() =>
          onChange("bulk")
        }
        className={`min-h-[44px] rounded-[10px] px-4 text-center text-[11px] font-black transition sm:min-h-[48px] sm:rounded-none sm:border-l sm:border-black/[0.09] sm:px-5 sm:text-[12px] ${
          mode === "bulk"
            ? "bg-[#F47822] text-white"
            : "bg-transparent text-black/45 hover:bg-[#FFF7F1] hover:text-[#171717] sm:hover:bg-white"
        }`}
      >
        Bulk / Event
      </button>
    </div>
  </div>
);

const MobileBuilderProgress = ({ step, orderMode }) => {
  const labels = [
    "Choose your box",
    "Add your gifts",
    "Finishing touches",
    "Personalise",
    orderMode === "bulk" ? "Quote details" : "Review hamper",
  ];

  return (
    <div className="rounded-[16px] border border-black/[0.07] bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(41,29,15,.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[8px] font-black uppercase tracking-[0.13em] text-[#F47822]">
            Step {String(step).padStart(2, "0")} / 05
          </span>
          <p className="mt-0.5 truncate text-[11px] font-black text-[#171717]">
            {labels[step - 1]}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#F7F1E7] px-2.5 py-1 text-[7.5px] font-black uppercase tracking-[0.07em] text-[#8A6815]">
          {orderMode === "bulk" ? "Bulk / Event" : "Personal"}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-5 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((item) => (
          <span
            key={item}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              item <= step ? "bg-[#F47822]" : "bg-black/[0.07]"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const MobileStepActions = ({
  backLabel = "Back",
  nextLabel,
  nextDisabled = false,
  onBack,
  onNext,
  hint = "",
}) => (
  <div className="md:hidden">
    <div className="rounded-[18px] border border-black/[0.07] bg-white p-3.5 shadow-[0_10px_28px_rgba(40,27,13,.045)]">
      {hint && (
        <p className="mb-3 text-[10px] font-semibold leading-4 text-black/40">
          {hint}
        </p>
      )}

      <div className={`grid gap-2.5 ${onBack ? "grid-cols-[92px_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[10px] font-black text-black/52 transition active:scale-[.98]"
          >
            ← {backLabel}
          </button>
        )}

        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-center text-[10px] font-black uppercase tracking-[0.055em] text-white shadow-[0_10px_24px_rgba(23,23,23,.14)] transition active:scale-[.99] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25 disabled:shadow-none"
        >
          <span className="truncate">{nextLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  </div>
);

const MobileLiveHamperStatus = ({
  selectedContainer,
  selectedItemCount,
  fillPercent,
  configuration,
  validating,
}) => {
  const roundedFill = Math.round(Number(fillPercent || 0));
  const remaining = Math.max(0, 100 - roundedFill);
  const liveTotal =
    configuration?.pricing?.total ??
    selectedContainer?.sellingPrice ??
    null;

  return (
    <div className="sticky top-[76px] z-30 -mx-1 mb-4 md:hidden">
      <div className="overflow-hidden rounded-[18px] border border-[#F47822]/16 bg-[#FFFDF9]/95 shadow-[0_12px_32px_rgba(47,31,13,.10)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.055] px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-[#F47822]">
              Live hamper status
            </p>
            <p className="mt-0.5 truncate text-[10px] font-black text-[#171717]">
              {selectedContainer?.name || "Selected hamper box"}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] ${
              validating
                ? "bg-black/[0.06] text-black/42"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {validating ? "Updating…" : "Live"}
          </span>
        </div>

        <div className="grid grid-cols-[.8fr_.72fr_1.28fr] divide-x divide-black/[0.055]">
          <div className="px-3 py-2.5">
            <p className="text-[7px] font-black uppercase tracking-[0.08em] text-black/28">
              Box filled
            </p>
            <p className="mt-1 text-[15px] font-black leading-none text-[#171717]">
              {roundedFill}%
            </p>
            <p className="mt-1 text-[7px] font-bold text-black/30">
              {remaining}% space left
            </p>
          </div>

          <div className="px-3 py-2.5">
            <p className="text-[7px] font-black uppercase tracking-[0.08em] text-black/28">
              Gifts
            </p>
            <p className="mt-1 text-[15px] font-black leading-none text-[#171717]">
              {selectedItemCount}
            </p>
            <p className="mt-1 text-[7px] font-bold text-black/30">
              selected
            </p>
          </div>

          <div className="min-w-0 px-3 py-2.5 text-right">
            <p className="text-[7px] font-black uppercase tracking-[0.08em] text-black/28">
              Hamper total
            </p>
            <p
              style={{ fontFamily: DISPLAY_FONT }}
              className="mt-0.5 truncate text-[20px] font-semibold leading-none text-[#F47822]"
            >
              {liveTotal === null || liveTotal === undefined
                ? "—"
                : formatCurrency(liveTotal)}
            </p>
            <p className="mt-1 text-[7px] font-bold text-black/30">
              updates as you add
            </p>
          </div>
        </div>

        <div className="h-1.5 bg-black/[0.05]">
          <div
            className="h-full rounded-r-full bg-gradient-to-r from-[#F47822] to-[#D4AF37] transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, roundedFill))}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const BulkField = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.08em] text-black/35">
      {label}
    </span>
    {children}
  </label>
);

const V7Section = ({ number, title, meta, gold = false, children }) => (
  <section className="v7-reveal border-b border-black/[0.08] pb-8 pt-2 sm:pb-10 sm:pt-3">
    <div className="flex items-center justify-between gap-4 pb-5 sm:pb-6">
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
            gold
              ? "bg-[#9B7616] text-white"
              : "bg-[#9A6E32] text-white"
          }`}
        >
          {String(number).replace(/^0/, "")}
          <span className="absolute -bottom-2 left-1/2 h-[2px] w-5 -translate-x-1/2 bg-[#F47822]" />
        </span>

        <div className="min-w-0">
          <h2
            style={{ fontFamily: DISPLAY_FONT }}
            className="truncate text-[24px] font-semibold leading-none tracking-[-.025em] text-[#171717] sm:text-[30px]"
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

      <span className="hidden shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-black/26 sm:block">
        {meta}
      </span>
    </div>

    <div>{children}</div>
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

          <div className="mt-3 grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDetailsOpen(true);
              }}
              className="flex h-10 min-w-0 items-center justify-center rounded-[9px] border border-black/[0.08] bg-white px-2 text-[8.5px] font-black text-black/55 transition active:scale-[.98] hover:border-[#D4AF37]/35 hover:text-[#9A7316] sm:justify-start sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:text-[10px]"
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
              className={`flex h-10 min-w-0 items-center justify-center rounded-[9px] px-2 text-[8.5px] font-black transition active:scale-[.98] sm:min-w-[106px] sm:rounded-none sm:px-4 sm:text-[10px] ${
                active
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 sm:border-0 sm:bg-transparent"
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
  eyebrow = "Product details",
  addLabel = "+ Add to hamper",
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
                  {eyebrow}
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
                    {addLabel}
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
                className="h-full w-full object-contain p-2 sm:p-3 transition duration-500 group-hover:scale-[1.025]"
              />
            ) : (
              <NoImage />
            )}
          </div>

          <span className="absolute bottom-2 left-2 max-w-[82%] truncate bg-white/92 px-2 py-1 text-[6px] font-black uppercase tracking-[0.07em] text-black/42 backdrop-blur-sm sm:bottom-2.5 sm:left-2.5 sm:px-2.5 sm:text-[7px] sm:tracking-[0.08em]">
            {component.subcategory || component.category || "Gift"}
          </span>

          {selected && (
            <span className="absolute right-2.5 top-2.5 bg-[#171717] px-2.5 py-1.5 text-[9px] font-black text-white shadow-lg">
              ×{quantity}
            </span>
          )}
        </div>

        <div className="pt-3">
          <p className="line-clamp-2 min-h-[34px] text-[11px] font-extrabold leading-[1.35] text-[#171717] sm:min-h-[40px] sm:text-[13px] sm:leading-[1.45]">
            {component.name}
          </p>

          <div className="mt-1 flex min-h-[22px] flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:mt-1.5 sm:min-h-[24px]">
            <span className="text-[14px] font-black text-[#171717] sm:text-[16px]">
              {missingPrice
                ? "Price pending"
                : formatCurrency(component.sellingPrice)}
            </span>

            {hasMrp && (
              <span className="text-[8px] font-semibold text-black/28 line-through sm:text-[9px]">
                {formatCurrency(component.mrp)}
              </span>
            )}
          </div>

          <div className="mt-2.5 grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-1.5 border-t border-black/[0.07] pt-2.5 sm:mt-3 sm:grid-cols-[.95fr_1.05fr] sm:gap-2 sm:pt-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDetailsOpen(true);
              }}
              className="flex h-9 min-w-0 items-center justify-center rounded-[9px] border border-black/[0.08] bg-white px-1.5 text-[7.5px] font-black leading-tight text-black/55 transition active:scale-[.98] hover:border-[#D4AF37]/35 hover:text-[#9A7316] sm:h-10 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:text-[10px]"
            >
              View details →
            </button>

            {quantity > 0 ? (
              <div
                className="grid h-9 min-w-0 grid-cols-[28px_1fr_28px] overflow-hidden rounded-[9px] border border-[#F47822]/25 bg-[#FFF8F2] sm:h-10 sm:grid-cols-[36px_1fr_36px] sm:rounded-none"
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
                className="flex h-9 min-w-0 items-center justify-center rounded-[9px] bg-[#F47822] px-1 text-[8px] font-black text-white transition active:scale-[.98] hover:bg-[#171717] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25 sm:h-10 sm:rounded-none sm:px-0 sm:text-[10px]"
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selected = quantity > 0;

  const missingPrice =
    component.sellingPrice === null ||
    component.sellingPrice === undefined;

  const cannotIncrease = missingPrice || quantity >= 99;

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

          <span className="absolute left-2 top-2 bg-white/92 px-2 py-1 text-[6px] font-black uppercase tracking-[0.06em] text-[#8B6817] backdrop-blur-sm sm:left-2.5 sm:top-2.5 sm:px-2.5 sm:text-[7px] sm:tracking-[0.07em]">
            Finishing only
          </span>

          {selected && (
            <span className="absolute right-2 top-2 rounded-full bg-[#171717] px-2 py-1 text-[8px] font-black text-white shadow-lg">
              ×{quantity}
            </span>
          )}
        </div>

        <div className="pt-3">
          <p className="line-clamp-2 min-h-[30px] text-[10px] font-extrabold leading-[1.35] text-[#171717] sm:min-h-0 sm:truncate sm:text-[11px]">
            {component.name}
          </p>

          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-black text-[#9B7616] sm:text-[11px]">
              {missingPrice
                ? "Price pending"
                : formatCurrency(component.sellingPrice)}
            </p>

            <span className="text-[6px] font-black uppercase tracking-[0.05em] text-emerald-600 sm:text-[7px] sm:tracking-[0.06em]">
              0% capacity
            </span>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDetailsOpen(true);
            }}
            className="mt-2 flex h-8 w-full items-center justify-center rounded-[8px] border border-black/[0.08] bg-white px-2 text-[7.5px] font-black text-black/52 transition active:scale-[.98] hover:border-[#D4AF37]/35 hover:text-[#9A7316] sm:h-9 sm:text-[9px]"
          >
            View details →
          </button>

          <div
            className="mt-2 grid h-9 grid-cols-[32px_1fr_32px] overflow-hidden rounded-[8px] border border-[#D4AF37]/18 bg-[#FFFCF7] sm:mt-3 sm:grid-cols-[36px_1fr_36px] sm:rounded-none sm:border-x-0"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              disabled={quantity <= 0}
              onClick={(event) => {
                event.stopPropagation();
                onMinus();
              }}
              className="text-sm disabled:opacity-20"
              aria-label={`Remove ${component.name}`}
            >
              −
            </button>

            <span className="flex items-center justify-center border-x border-[#D4AF37]/15 text-[9px] font-black">
              {quantity}
            </span>

            <button
              type="button"
              disabled={cannotIncrease}
              onClick={(event) => {
                event.stopPropagation();
                onPlus();
              }}
              className="text-sm font-black text-[#9B7616] transition hover:bg-[#D4AF37] hover:text-[#171717] disabled:opacity-20"
              aria-label={`Add ${component.name}`}
            >
              +
            </button>
          </div>
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
          eyebrow="Finishing details"
          addLabel="+ Add finishing"
        />
      )}
    </>
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
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.08] pb-4">
        <div>
          <p
            style={{ fontFamily: DISPLAY_FONT }}
            className="text-[29px] font-semibold leading-none tracking-[-0.025em] text-[#171717]"
          >
            Your Hamper
          </p>
          <p className="mt-1 text-[9px] font-semibold text-black/34">
            Real-time packing preview & summary
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

      <div className="pt-5">
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

        <div className="mt-4 hidden grid-cols-2 border-y border-black/[0.08] bg-transparent md:grid">
          <button
            type="button"
            onClick={() => onModeChange?.("personal")}
            className={`h-10 text-[10px] font-black transition ${
              orderMode === "personal"
                ? "bg-[#FFF8F2] text-[#F47822] shadow-[inset_0_-2px_0_#F47822]"
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
                ? "bg-[#FFFBF1] text-[#9B7616] shadow-[inset_0_-2px_0_#D4AF37]"
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

const V20_PACKING_SLOTS = [
  { x: 22, y: 59, rotate: -8, scale: 0.90, z: 26 },
  { x: 39, y: 52, rotate: 5, scale: 0.92, z: 25 },
  { x: 57, y: 55, rotate: -4, scale: 0.94, z: 27 },
  { x: 75, y: 60, rotate: 7, scale: 0.88, z: 28 },
  { x: 30, y: 67, rotate: 4, scale: 0.92, z: 31 },
  { x: 49, y: 65, rotate: -6, scale: 0.98, z: 32 },
  { x: 68, y: 68, rotate: 5, scale: 0.94, z: 33 },
  { x: 18, y: 69, rotate: -5, scale: 0.84, z: 34 },
  { x: 82, y: 69, rotate: 6, scale: 0.84, z: 35 },
  { x: 38, y: 72, rotate: -2, scale: 0.82, z: 37 },
  { x: 59, y: 73, rotate: 3, scale: 0.84, z: 38 },
  { x: 50, y: 48, rotate: 1, scale: 0.78, z: 24 },
  { x: 25, y: 50, rotate: -3, scale: 0.74, z: 23 },
  { x: 70, y: 49, rotate: 4, scale: 0.74, z: 23 },
  { x: 46, y: 60, rotate: -2, scale: 0.74, z: 29 },
  { x: 63, y: 61, rotate: 3, scale: 0.74, z: 30 },
  { x: 34, y: 61, rotate: -4, scale: 0.72, z: 29 },
  { x: 78, y: 54, rotate: 4, scale: 0.70, z: 25 },
];

const v20ContainerPalette = (container) => {
  const palettes = [
    {
      main: "#C88A4A",
      light: "#F0D2AA",
      dark: "#8B5427",
      deep: "#4D2B14",
    },
    {
      main: "#292824",
      light: "#6A6153",
      dark: "#171612",
      deep: "#090908",
    },
    {
      main: "#A45137",
      light: "#E0A184",
      dark: "#6C2C20",
      deep: "#35150F",
    },
    {
      main: "#34523F",
      light: "#75917E",
      dark: "#20372A",
      deep: "#102018",
    },
    {
      main: "#C5A04B",
      light: "#F0D98A",
      dark: "#846319",
      deep: "#48340B",
    },
  ];

  const seed = String(container?._id || container?.name || "hamper");
  return palettes[v7Hash(seed) % palettes.length];
};

const v20PackingSize = (component, count) => {
  const kind = v7ItemKind(component);
  const base = {
    bottle: [42, 78],
    cylinder: [58, 62],
    snack: [70, 58],
    flat: [72, 48],
    gift: [64, 58],
  }[kind] || [62, 58];

  const crowdScale = count > 14 ? 0.82 : count > 10 ? 0.90 : count > 7 ? 0.96 : 1.06;

  return {
    kind,
    width: Math.round(base[0] * crowdScale),
    height: Math.round(base[1] * crowdScale),
  };
};

const V20PackingItem = ({ entry, index, count }) => {
  const component = entry.component;
  const slot = V20_PACKING_SLOTS[index % V20_PACKING_SLOTS.length];
  const size = v20PackingSize(component, count);
  const image = component?.images?.[0]?.url || "";
  const name = String(component?.name || "Gift");
  const stagger = Math.min(index * 28, 250);

  return (
    <div
      className={`v20-pack-item v20-kind-${size.kind} ${
        entry.phase === "enter"
          ? "is-entering"
          : entry.phase === "exit"
            ? "is-exiting"
            : ""
      }`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: slot.z + index,
        "--v20-rotate": `${slot.rotate}deg`,
        "--v20-scale": slot.scale,
        animationDelay: entry.phase === "enter" ? `${stagger}ms` : "0ms",
      }}
      title={name}
    >
      <div className="v20-pack-card">
        {image ? (
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="v20-pack-image"
            draggable="false"
          />
        ) : (
          <div className="v20-pack-fallback" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <span className="v20-pack-label">{name}</span>
      </div>
    </div>
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
  const [liveItems, setLiveItems] = useState(() =>
    previewItems.map((item) => ({ ...item, phase: "stable" }))
  );
  const [packingNote, setPackingNote] = useState("");
  const previousIdsRef = useRef(new Set(previewItems.map((item) => item.id)));
  const noteTimerRef = useRef(null);
  const settleTimerRef = useRef(null);

  const packed = Boolean(
    selectedItemCount > 0 &&
      configuration &&
      !validating &&
      canIncreaseAnyItem === false
  );

  useEffect(() => {
    previousIdsRef.current = new Set(previewItems.map((item) => item.id));
    setLiveItems(previewItems.map((item) => ({ ...item, phase: "stable" })));

    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);

    if (selectedContainer) {
      setPackingNote(`${selectedContainer.name} opened — start adding gifts`);
      noteTimerRef.current = window.setTimeout(() => setPackingNote(""), 1350);
    } else {
      setPackingNote("");
    }
  }, [selectedContainer?._id]);

  useEffect(() => {
    const previousIds = previousIdsRef.current;
    const nextIds = new Set(previewItems.map((item) => item.id));
    const added = previewItems.filter((item) => !previousIds.has(item.id));
    const removedIds = new Set(
      [...previousIds].filter((id) => !nextIds.has(id))
    );

    setLiveItems((current) => {
      const currentMap = new Map(current.map((item) => [item.id, item]));

      const next = previewItems.map((item) => {
        const existing = currentMap.get(item.id);

        return {
          ...item,
          phase: existing && existing.phase !== "exit" ? existing.phase : "enter",
        };
      });

      const exiting = current
        .filter((item) => removedIds.has(item.id))
        .map((item) => ({ ...item, phase: "exit" }));

      return [...next, ...exiting];
    });

    previousIdsRef.current = nextIds;

    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);

    if (added.length) {
      const latest = added[added.length - 1];
      setPackingNote(`Packing ${latest.component?.name || "your gift"} into the box`);
      noteTimerRef.current = window.setTimeout(() => setPackingNote(""), 1350);
    } else if (removedIds.size) {
      setPackingNote("Item removed — making space in your hamper");
      noteTimerRef.current = window.setTimeout(() => setPackingNote(""), 1100);
    }

    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);

    settleTimerRef.current = window.setTimeout(() => {
      setLiveItems(
        previewItems.map((item) => ({ ...item, phase: "stable" }))
      );
    }, 930);

    return () => {
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [previewItems]);

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    };
  }, []);

  const palette = v20ContainerPalette(selectedContainer);
  const containerImage = selectedContainer?.images?.[0]?.url || "";
  const visibleLiveItems = liveItems.slice(0, 18);

  const fillerBits = Array.from({ length: 16 }, (_, index) => ({
    left: `${4 + ((index * 17) % 88)}%`,
    bottom: `${(index * 9) % 18}px`,
    rotate: `${-28 + ((index * 19) % 58)}deg`,
    delay: `${(index % 5) * 140}ms`,
  }));

  return (
    <div className="v20-live-stage">
      <div className="v20-studio-grid" aria-hidden="true" />


      {!selectedContainer ? (
        <div className="absolute inset-0 z-10" aria-hidden="true" />
      ) : (
        <div
          key={selectedContainer._id}
          className="v20-box-world"
          style={{
            "--v20-box-main": palette.main,
            "--v20-box-light": palette.light,
            "--v20-box-dark": palette.dark,
            "--v20-box-deep": palette.deep,
          }}
        >
          {packed && <div className="v20-packed-glow" aria-hidden="true" />}
          <div className="v20-box-glow" aria-hidden="true" />

          <div className={`v20-box-lid ${packed ? "is-packed" : ""}`}>
            <div className="v20-box-lid-face">
              {containerImage && (
                <img
                  src={containerImage}
                  alt=""
                  aria-hidden="true"
                  className="v20-box-lid-photo"
                  draggable="false"
                />
              )}
              <span className="v20-box-monogram" aria-hidden="true">H</span>
            </div>
          </div>

          <div className="v20-box-back" aria-hidden="true" />
          <div className="v20-box-well" aria-hidden="true" />

          <div className="v20-filler" aria-hidden="true">
            {fillerBits.map((bit, index) => (
              <span
                key={index}
                style={{
                  left: bit.left,
                  bottom: bit.bottom,
                  "--v20-filler-turn": bit.rotate,
                  animationDelay: bit.delay,
                }}
              />
            ))}
          </div>

          <div className="v20-item-layer">
            {visibleLiveItems.map((entry, index) => (
              <V20PackingItem
                key={entry.id}
                entry={entry}
                index={index}
                count={visibleLiveItems.length}
              />
            ))}
          </div>

          <div className="v20-box-left" aria-hidden="true" />
          <div className="v20-box-right" aria-hidden="true" />
          <div className="v20-box-front" aria-hidden="true" />

          {selectedDecorationCount > 0 && !packed && (
            <V7DecorationOverlay decorations={previewDecorations} />
          )}

          {packed && (
            <>
              <span className="v20-pack-ribbon-h" aria-hidden="true" />
              <span className="v20-pack-ribbon-v" aria-hidden="true" />
              <span className="v20-packed-badge">Ready to gift</span>
            </>
          )}
        </div>
      )}

    </div>
  );
};

const V7DecorationOverlay = ({ decorations }) => {
  const positions = [
    "left-[14%] top-[47%] rotate-[-8deg]",
    "right-[14%] top-[47%] rotate-[8deg]",
    "left-[24%] bottom-[10%] rotate-[5deg]",
    "right-[24%] bottom-[10%] rotate-[-5deg]",
  ];

  return (
    <>
      <span className="v20-decor-band pointer-events-none" />
      <span className="v20-decor-band-v pointer-events-none" />

      {decorations.map(({ component }, index) => (
        <div
          key={`${component._id}-${index}`}
          className={`v7-decoration absolute z-[72] ${positions[index]}`}
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
  const image = component?.images?.[0]?.url || "";

  if (image) {
    return (
      <div className="h-11 w-11 overflow-hidden rounded-full border border-[#D4AF37]/30 bg-white p-1 shadow-[0_8px_14px_rgba(0,0,0,.26)]">
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="h-full w-full rounded-full object-contain"
          draggable="false"
        />
      </div>
    );
  }

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
  compact = false,
  label = "Products",
  scrollSelector = '[data-hamper-products-grid="true"]',
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
        .querySelector(scrollSelector)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (compact) {
    return (
      <div className="mt-5 rounded-[14px] border border-black/[0.06] bg-[#FAF8F5] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.08em] text-black/28">
              {label}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-black/42">
              {rangeStart}–{rangeEnd} of {totalItems} · Page {page} of {totalPages}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-[16px] font-black text-[#171717] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
              aria-label={`Previous ${label.toLowerCase()}`}
            >
              ←
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => go(page + 1)}
              className="flex h-10 min-w-[82px] items-center justify-center rounded-full bg-[#171717] px-4 text-[9px] font-black uppercase tracking-[0.07em] text-white transition active:scale-95 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-[12px] border border-black/[0.06] bg-[#FAF8F5] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[10px] font-semibold text-black/40">
        Showing{" "}
        <span className="font-black text-[#171717]">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of <span className="font-black text-[#171717]">{totalItems}</span>{" "}
        {label.toLowerCase()}
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
