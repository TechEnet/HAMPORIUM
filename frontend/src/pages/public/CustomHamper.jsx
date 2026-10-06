import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";

import api from "../../api/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useDeliveryLocation } from "../../context/LocationContext.jsx";
import formatCurrency from "../../utils/formatCurrency.js";
import {
  runHamporiumRouteTransition,
  runHamporiumUiTransition,
} from "../../components/HamporiumRouteTransition.jsx";

const DISPLAY_FONT =
  "'Cormorant Garamond', 'Playfair Display', Georgia, serif";

const CHANNELS = ["corporate", "wedding", "diwali", "hamperOne"];
const DESKTOP_ITEMS_PER_PAGE = 20;
const MOBILE_ITEMS_PER_PAGE = 8;

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
  const navigateWithRibbon = (to) =>
    runHamporiumRouteTransition(to, navigate);
  const { user } = useAuth();
  const { addCustomHamper, updateCustomHamper } = useCart();
  const { deliveryLocation } = useDeliveryLocation();

  const [searchParams, setSearchParams] = useSearchParams();
  const editCartItemId = searchParams.get("editCartItemId") || "";
  const isEditingCartHamper = Boolean(editCartItemId);
  const requestedChannel = searchParams.get("channel") || "";
  const channel = CHANNELS.includes(requestedChannel)
    ? requestedChannel
    : "";

  const requestedMode = isEditingCartHamper
    ? "personal"
    : searchParams.get("mode") === "bulk"
      ? "bulk"
      : "personal";

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
  const [editError, setEditError] = useState("");
  const [editCartItem, setEditCartItem] = useState(null);
  const [editLoading, setEditLoading] = useState(Boolean(editCartItemId));

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
  const [deliveryJourney, setDeliveryJourney] = useState("idle");

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

  useEffect(() => {
    let cancelled = false;

    if (!isEditingCartHamper) {
      setEditCartItem(null);
      setEditError("");
      setEditLoading(false);
      return undefined;
    }

    if (!user) {
      setEditLoading(false);
      navigateWithRibbon("/login");
      return undefined;
    }

    const loadCartHamperForEditing = async () => {
      setEditLoading(true);
      setEditError("");

      try {
        const response = await api.get("/cart");
        const item = (response.data?.cart?.items || []).find(
          (cartItem) =>
            cartItem.itemType === "custom_hamper" &&
            String(cartItem.cartItemId) === String(editCartItemId)
        );

        if (!item) {
          if (!cancelled) {
            setEditCartItem(null);
            setEditError(
              "This custom hamper is no longer in your cart. Return to the cart and choose another hamper to edit."
            );
            setEditLoading(false);
          }
          return;
        }

        const savedChannel = item.customHamper?.channel || "";

        if (
          savedChannel &&
          CHANNELS.includes(savedChannel) &&
          savedChannel !== requestedChannel
        ) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("channel", savedChannel);
          nextParams.set("mode", "personal");
          nextParams.set("editCartItemId", String(editCartItemId));
          setSearchParams(nextParams, { replace: true });
        }

        if (!cancelled) {
          setEditCartItem(item);
        }
      } catch (requestError) {
        if (!cancelled) {
          setEditCartItem(null);
          setEditError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Unable to load this custom hamper from your cart"
          );
          setEditLoading(false);
        }
      }
    };

    loadCartHamperForEditing();

    return () => {
      cancelled = true;
    };
  }, [
    editCartItemId,
    isEditingCartHamper,
    navigate,
    requestedChannel,
    searchParams,
    setSearchParams,
    user,
  ]);

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

    // V11.1: Builder catalogue mode must never make imported Excel items
    // disappear just because price, fit or customer-selectable data is pending.
    // Ready/selected rows are sorted first; pending rows remain visible and are
    // disabled by the cards below.
    return [...filtered].sort((left, right) => {
      const leftSelected = (selectedMap.get(left._id) || 0) > 0;
      const rightSelected = (selectedMap.get(right._id) || 0) > 0;

      if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1;
      }

      const leftReady = left.builderStatus?.selectable !== false;
      const rightReady = right.builderStatus?.selectable !== false;

      if (leftReady !== rightReady) {
        return leftReady ? -1 : 1;
      }

      if (configuration) {
        const leftCandidate = candidateMap.get(String(left._id));
        const rightCandidate = candidateMap.get(String(right._id));
        const leftFits =
          leftCandidate?.selectable !== false &&
          Number(leftCandidate?.maxAdditionalQuantity || 0) > 0;
        const rightFits =
          rightCandidate?.selectable !== false &&
          Number(rightCandidate?.maxAdditionalQuantity || 0) > 0;

        if (leftFits !== rightFits) {
          return leftFits ? -1 : 1;
        }
      }

      const recommendationPriority = (component) => {
        if (component.recommendation?.source === "container") return 2;
        if (component.recommendation?.source === "overall") return 1;
        return 0;
      };

      const leftRecommendationPriority = recommendationPriority(left);
      const rightRecommendationPriority = recommendationPriority(right);

      if (leftRecommendationPriority !== rightRecommendationPriority) {
        return rightRecommendationPriority - leftRecommendationPriority;
      }

      const recommendationScoreDiff =
        Number(right.recommendation?.score || 0) -
        Number(left.recommendation?.score || 0);

      if (recommendationScoreDiff !== 0) {
        return recommendationScoreDiff;
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }, [
    contentComponents,
    search,
    categoryFilter,
    subcategoryFilter,
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


  // UI fill is intentionally normalized to 100% when the selected box has
  // reached its practical packing limit. This keeps the visual state honest:
  // the lid closes only when the customer sees 100% filled.
  const displayFillPercent = useMemo(() => {
    const raw = Math.min(100, Math.max(0, Number(fillPercent || 0)));
    const practicallyFull = Boolean(
      selectedItemCount > 0 &&
        configuration &&
        !validating &&
        !selectionPending &&
        canIncreaseAnyItem === false
    );

    if (practicallyFull || raw >= 99.95) return 100;
    return Math.min(99, Math.round(raw));
  }, [
    fillPercent,
    selectedItemCount,
    configuration,
    validating,
    selectionPending,
    canIncreaseAnyItem,
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
        // V11.1: ask the backend for the complete imported builder catalogue.
        // Normal storefront endpoints stay strict; only Custom Hamper uses this
        // broader visibility mode.
        const containerParams = new URLSearchParams({
          builderCatalog: "1",
        });

        if (channel) {
          containerParams.set("channel", channel);
        }

        const buildComponentUrl = (hamperRole) => {
          const params = new URLSearchParams({
            hamperRole,
            builderCatalog: "1",
          });

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
          api.get(`/catalog/containers?${containerParams.toString()}`),
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

        const editCustom =
          isEditingCartHamper && editCartItem?.itemType === "custom_hamper"
            ? editCartItem.customHamper || {}
            : null;

        if (editCustom) {
          const savedContainerId = String(
            editCustom.container?._id ||
              editCustom.containerId ||
              editCustom.container ||
              ""
          );

          const availableContentIds = new Set(
            loadedContentComponents.map((component) => String(component._id))
          );
          const availableDecorationIds = new Set(
            loadedDecorativeComponents.map((component) => String(component._id))
          );

          const savedItems = (editCustom.items || [])
            .map((selection) => ({
              componentId: String(
                selection.component?._id ||
                  selection.componentId ||
                  selection.component ||
                  ""
              ),
              quantity: Number(selection.quantity || 1),
            }))
            .filter(
              (selection) =>
                selection.componentId &&
                Number.isInteger(selection.quantity) &&
                selection.quantity > 0
            );

          const savedDecorations = (editCustom.decorations || [])
            .map((selection) => ({
              componentId: String(
                selection.component?._id ||
                  selection.componentId ||
                  selection.component ||
                  ""
              ),
              quantity: Number(selection.quantity || 1),
            }))
            .filter(
              (selection) =>
                selection.componentId &&
                Number.isInteger(selection.quantity) &&
                selection.quantity > 0
            );

          const nextItems = savedItems.filter((selection) =>
            availableContentIds.has(selection.componentId)
          );
          const nextDecorations = savedDecorations.filter((selection) =>
            availableDecorationIds.has(selection.componentId)
          );

          const removedGiftCount = savedItems.length - nextItems.length;
          const removedDecorationCount =
            savedDecorations.length - nextDecorations.length;

          setContainerId(savedContainerId);
          setMobileStep(nextItems.length ? 2 : 1);
          setSelectedItems(nextItems);
          setSelectedDecorations(nextDecorations);
          setConfiguration(null);
          setPersonalization(
            editCustom.personalization?.enabled
              ? {
                  assets: (editCustom.personalization.assets || []).map(
                    (asset) => ({
                      ...asset,
                      uploadProof: asset.uploadProof || "",
                    })
                  ),
                  message: editCustom.personalization.message || "",
                  instructions: editCustom.personalization.instructions || "",
                }
              : emptyPersonalization()
          );
          setPersonalizationError("");
          setSelectionPending(false);
          setOrderMode("personal");

          if (removedGiftCount || removedDecorationCount) {
            const removedParts = [];
            if (removedGiftCount) {
              removedParts.push(
                `${removedGiftCount} unavailable gift${
                  removedGiftCount === 1 ? "" : "s"
                }`
              );
            }
            if (removedDecorationCount) {
              removedParts.push(
                `${removedDecorationCount} unavailable finishing item${
                  removedDecorationCount === 1 ? "" : "s"
                }`
              );
            }

            setCartError(
              `${removedParts.join(
                " and "
              )} were removed from the editor because they are no longer selectable. Review the hamper and save your changes.`
            );
          } else {
            setCartError("");
          }

          setEditLoading(false);
        } else {
          const mobileFirstChoice =
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 767px)").matches;

          setContainerId(
            mobileFirstChoice ? "" : loadedContainers[0]?._id || ""
          );
          setMobileStep(1);
          setSelectedItems([]);
          setSelectedDecorations([]);
          setConfiguration(null);
          setPersonalization(emptyPersonalization());
          setPersonalizationError("");
          setSelectionPending(false);

          if (!isEditingCartHamper) {
            setEditLoading(false);
          }
        }
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load custom hamper options"
        );

        if (isEditingCartHamper && editCartItem) {
          setEditLoading(false);
        }
      } finally {
        setLoading(false);
      }
    };

    loadBuilderData();
  }, [channel, editCartItem, isEditingCartHamper]);

  useEffect(() => {
    setOrderMode(requestedMode);
  }, [requestedMode]);

  // V51: Once a box is selected, refresh only the content catalogue with
  // purchase-backed recommendations for that specific container. The existing
  // compatibility validator remains the source of truth for whether an item can
  // actually be added to the current configuration.
  useEffect(() => {
    if (!containerId) return;

    let cancelled = false;

    const loadBoxRecommendations = async () => {
      try {
        const params = new URLSearchParams({
          hamperRole: "content",
          builderCatalog: "1",
          recommendForContainer: containerId,
        });

        if (channel) {
          params.set("channel", channel);
        }

        const response = await api.get(
          `/catalog/components?${params.toString()}`
        );

        if (!cancelled) {
          setContentComponents(response.data?.components || []);
        }
      } catch {
        // Recommendation data is enhancement-only. Keep the already-loaded
        // catalogue and the existing physical-fit flow if this request fails.
      }
    };

    loadBoxRecommendations();

    return () => {
      cancelled = true;
    };
  }, [containerId, channel]);

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

    // Imported procurement boxes can be real catalogue boxes while still
    // missing custom-builder capacity/price data. Keep such a box selectable
    // for preview/browsing, but do not call the strict orderability validator.
    if (selectedContainer?.builderStatus?.selectable === false) {
      const reasons = Array.isArray(selectedContainer.builderStatus?.reasons)
        ? selectedContainer.builderStatus.reasons
        : [];

      setConfiguration({
        orderable: false,
        message: reasons.length
          ? `Box data pending: ${reasons.join(", ")}`
          : "This box is visible from Product Master but is not order-ready yet.",
        capacity: null,
        pricing: null,
        candidates: [],
      });
      setError("");
      setValidating(false);
      setSelectionPending(false);
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
    selectedContainer,
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
    if (component.builderStatus?.selectable === false) return;

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

    setCartError("");
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

    setCartError("");
    setSelectionQuantity(
      setSelectedItems,
      component._id,
      currentQuantity - 1
    );
  };

  const incrementDecoration = (component) => {
    const currentQuantity = decorationMap.get(component._id) || 0;

    if (component.builderStatus?.selectable === false) return;

    if (
      component.sellingPrice === null ||
      component.sellingPrice === undefined
    ) {
      return;
    }

    setCartError("");
    setSelectionQuantity(
      setSelectedDecorations,
      component._id,
      currentQuantity + 1
    );
  };

  const decrementDecoration = (component) => {
    const currentQuantity = decorationMap.get(component._id) || 0;
    if (currentQuantity <= 0) return;

    setCartError("");
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
      // Existing artwork loaded from a saved cart hamper has already been
      // attached to the cart, so the storage delete endpoint correctly blocks
      // deleting it at this stage. Remove it locally and let the backend clean
      // up the detached file only after the edited hamper is saved. Newly
      // uploaded artwork still has an uploadProof and can be deleted now.
      if (user && asset.publicId && asset.uploadProof) {
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
      navigateWithRibbon("/login");
      return;
    }

    if (
      !containerId ||
      selectedItems.length === 0 ||
      !configuration?.orderable
    ) {
      setCartError(
        isEditingCartHamper
          ? "Choose at least one hamper item and make sure the hamper is Ready before saving your changes."
          : "Choose at least one hamper item and make sure the hamper is Ready before adding it to cart."
      );
      return;
    }

    setAddingToCart(true);
    setDeliveryJourney("packing");
    setCartError("");

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 900));

      const payload = {
        containerId,
        items: selectedItems,
        decorations: selectedDecorations,
        channel,
        personalization: personalizationPayload,
        source: isEditingCartHamper
          ? "custom_hamper_edit"
          : "custom_hamper",
        pagePath: `${window.location.pathname}${window.location.search}`,
        location: deliveryLocation,
      };

      if (isEditingCartHamper) {
        await updateCustomHamper(editCartItemId, payload);
      } else {
        await addCustomHamper({
          ...payload,
          quantity: 1,
        });
      }

      setDeliveryJourney("shipping");
      await new Promise((resolve) => window.setTimeout(resolve, 1600));
      navigateWithRibbon("/cart");
    } catch (requestError) {
      setDeliveryJourney("idle");
      setCartError(
        requestError.response?.data?.message ||
          requestError.message ||
          (isEditingCartHamper
            ? "Unable to save custom hamper changes"
            : "Unable to add custom hamper to cart")
      );
    } finally {
      setAddingToCart(false);
    }
  };

  const handleRequestQuotation = async () => {
    if (!user) {
      navigateWithRibbon("/login");
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

      navigateWithRibbon(`/account/corporate/rfqs/${rfqId}`);
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

  if (loading || editLoading) {
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

    if (safeStep === mobileStep) return;

    runHamporiumUiTransition(() => {
      setMobileStep(safeStep);
      setCartError("");

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          mobileFlowRef.current?.scrollIntoView({
            behavior: "auto",
            block: "start",
          });
        });
      }
    });
  };

  // A data-pending imported box may still be selected to browse the Excel
  // gift catalogue. Order/cart actions remain blocked by configuration.orderable.
  const canContinueFromBox = Boolean(containerId) && !validating;

  const canContinueFromProducts =
    selectedItemCount > 0 && !validating && !selectionPending;

  return (
    <main
      className="hamporium-mobile-builder min-h-screen bg-[#FAF8F4] pb-14 pt-[84px] text-[14px] text-[#171717] sm:pt-[92px] sm:text-[14px]"
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
           REAL-TIME PACKING STUDIO
        ====================================================== */
        @keyframes v20BoxArrive {
          0% { opacity: 0; transform: translateX(-50%) translateY(24px) scale(.91); }
          64% { opacity: 1; transform: translateX(-50%) translateY(-3px) scale(1.018); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @keyframes v20LidOpen {
          0% { opacity: .45; transform: perspective(820px) rotateX(10deg) translateY(64%) scale(.96); }
          60% { opacity: 1; transform: perspective(820px) rotateX(78deg) translateY(-10%) scale(1.01); }
          100% { opacity: 1; transform: perspective(820px) rotateX(74deg) translateY(-6%) scale(1); }
        }

        @keyframes v20LidClose {
          0% { transform: perspective(820px) rotateX(74deg) translateY(-6%) scale(1); }
          60% { transform: perspective(820px) rotateX(8deg) translateY(52%) scale(.972); }
          100% { transform: perspective(820px) rotateX(0deg) translateY(58%) scale(.978); }
        }

        @keyframes v20ItemDrop {
          0% {
            opacity: 0;
            transform: translate(-50%, -290px) rotate(calc(var(--v20-rotate) - 13deg)) scale(.72);
            filter: blur(2px);
          }
          52% { opacity: 1; filter: blur(0); }
          72% { transform: translate(-50%, -42%) rotate(calc(var(--v20-rotate) + 2deg)) scale(var(--v20-scale)); }
          86% { transform: translate(-50%, -56%) rotate(calc(var(--v20-rotate) - 1deg)) scale(var(--v20-scale)); }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--v20-rotate)) scale(var(--v20-scale));
            filter: blur(0);
          }
        }

        @keyframes v20ItemExit {
          0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--v20-rotate)) scale(var(--v20-scale)); }
          100% { opacity: 0; transform: translate(-50%, -96%) rotate(calc(var(--v20-rotate) + 8deg)) scale(.68); }
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
          min-height: 432px;
          overflow: hidden;
          border: 1px solid rgba(96,68,32,.08);
          border-radius: 24px;
          background:
            radial-gradient(circle at 50% 4%, rgba(255,255,255,.98), transparent 26%),
            radial-gradient(circle at 50% 72%, rgba(255,219,158,.22), transparent 40%),
            linear-gradient(180deg, #FFFDFB 0%, #F7EFE6 54%, #E8D9C8 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.86), inset 0 -1px 0 rgba(112,73,26,.05), 0 16px 36px rgba(42,31,19,.06);
        }

        .v20-live-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .24;
          background-image: radial-gradient(rgba(99,70,38,.13) .55px, transparent .55px);
          background-size: 8px 8px;
          mask-image: linear-gradient(to bottom, transparent, black 22%, black 84%, transparent);
        }

        .v20-live-stage::after {
          content: "";
          position: absolute;
          z-index: 0;
          left: 50%;
          bottom: 6px;
          width: 82%;
          height: 56px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: rgba(78,48,21,.18);
          filter: blur(22px);
        }

        .v20-studio-grid {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: .18;
          background-image:
            linear-gradient(rgba(116,84,46,.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(116,84,46,.10) 1px, transparent 1px);
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
          bottom: 0;
          width: min(100%, 640px);
          height: 362px;
          transform: translateX(-50%);
          perspective: 1200px;
          transform-style: preserve-3d;
          animation: v20BoxArrive .68s cubic-bezier(.18,.78,.2,1) both;
          will-change: transform, opacity;
        }

        .v20-box-glow {
          position: absolute;
          z-index: 0;
          left: 50%;
          bottom: 8px;
          width: 94%;
          height: 44%;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(244,120,34,.18), rgba(212,175,55,.14) 42%, transparent 74%);
          filter: blur(30px);
        }

        .v20-box-floor {
          position: absolute;
          z-index: 1;
          left: 8%;
          right: 8%;
          bottom: 16px;
          height: 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,251,240,.55), rgba(120,86,44,.08));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.6);
        }

        .v20-box-base-shadow {
          position: absolute;
          z-index: 2;
          left: 14%;
          right: 14%;
          bottom: 26px;
          height: 28px;
          border-radius: 999px;
          background: rgba(52,29,8,.20);
          filter: blur(18px);
        }

        .v20-box-base {
          position: absolute;
          z-index: 3;
          left: 16.5%;
          right: 16.5%;
          bottom: 24px;
          height: 12px;
          border: 1px solid rgba(89,57,20,.18);
          border-radius: 0 0 12px 12px;
          background: linear-gradient(180deg, rgba(255,245,222,.56), rgba(183,136,61,.42));
          box-shadow: 0 8px 14px rgba(56,34,12,.10);
        }

        .v20-box-lid {
          position: absolute;
          z-index: 8;
          left: 11%;
          top: 5%;
          width: 78%;
          height: 31%;
          transform-origin: 50% 100%;
          transform-style: preserve-3d;
          animation: v20LidOpen .86s cubic-bezier(.16,.82,.22,1) both;
        }

        .v20-box-lid.is-packed { z-index: 56; animation: v20LidClose .82s cubic-bezier(.2,.75,.2,1) both; }

        .v20-box-lid-face {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border: 1px solid rgba(77,45,20,.24);
          border-radius: 18px 18px 10px 10px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.26), transparent 24%),
            linear-gradient(145deg, var(--v20-box-light) 0%, color-mix(in srgb, var(--v20-box-main) 88%, white 12%) 36%, var(--v20-box-main) 62%, var(--v20-box-dark) 100%);
          box-shadow: 0 14px 26px rgba(48,28,12,.22), inset 0 1px 0 rgba(255,255,255,.42), inset 0 -10px 18px rgba(77,40,12,.14);
        }

        .v20-box-lid-face::before {
          content: "";
          position: absolute;
          inset: 10px;
          border: 1px solid rgba(255,247,224,.38);
          border-radius: 11px;
          pointer-events: none;
        }

        .v20-box-lid-face::after {
          content: "";
          position: absolute;
          left: 12%;
          right: 12%;
          bottom: 8px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(117,73,26,.04), rgba(70,42,16,.18));
          filter: blur(5px);
        }

        .v20-box-lid-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .13; mix-blend-mode: multiply; filter: saturate(.72) contrast(.92); }
        .v20-box-monogram { position: absolute; z-index: 2; left: 50%; top: 50%; display: flex; width: 68px; height: 68px; align-items: center; justify-content: center; transform: translate(-50%, -50%); border: 1px solid rgba(255,240,191,.56); border-radius: 999px; color: #FFF2C8; background: radial-gradient(circle at 30% 25%, rgba(255,252,235,.4), rgba(102,58,23,.2)); box-shadow: inset 0 0 0 7px rgba(255,255,255,.05), 0 10px 24px rgba(60,34,11,.18); font-family: 'Cormorant Garamond', Georgia, serif; font-size: 34px; font-weight: 700; text-shadow: 0 2px 8px rgba(0,0,0,.22); backdrop-filter: blur(2px); }
        .v20-box-back { position: absolute; z-index: 10; left: 17%; right: 17%; top: 29%; height: 21%; border: 1px solid rgba(70,39,16,.18); border-radius: 10px 10px 0 0; background: linear-gradient(180deg, color-mix(in srgb, var(--v20-box-main) 92%, white 8%), var(--v20-box-dark)); box-shadow: inset 0 10px 18px rgba(255,255,255,.10); }
        .v20-box-well { position: absolute; z-index: 12; left: 18%; right: 18%; top: 42%; height: 31%; overflow: hidden; border-radius: 10px 10px 18px 18px; background: radial-gradient(circle at 50% 62%, rgba(232,205,152,.24), transparent 38%), linear-gradient(180deg, #6A4225, #2C180D 82%); box-shadow: inset 0 20px 28px rgba(0,0,0,.34), inset 0 -8px 18px rgba(255,221,154,.08); }
        .v20-box-well::before { content: ""; position: absolute; inset: 7px 8px auto; height: 16px; border-radius: 10px; background: linear-gradient(180deg, rgba(255,237,205,.14), transparent); }
        .v20-box-well::after {
          content: "";
          position: absolute;
          inset: 2px 2px auto;
          height: 8px;
          border-radius: 10px;
          border-top: 1px solid rgba(255,229,177,.22);
          box-shadow: inset 0 3px 5px rgba(255,255,255,.04);
        }
        .v20-box-inner-left, .v20-box-inner-right {
          position: absolute;
          z-index: 18;
          top: 43%;
          width: 7.5%;
          height: 28%;
          border: 1px solid rgba(77,45,20,.14);
          background: linear-gradient(180deg, rgba(235,199,133,.72), rgba(118,72,28,.92));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
          opacity: .82;
        }
        .v20-box-inner-left { left: 18.2%; border-radius: 9px 0 0 12px; transform: skewY(5deg); }
        .v20-box-inner-right { right: 18.2%; border-radius: 0 9px 12px 0; transform: skewY(-5deg); }
        .v20-filler { position: absolute; z-index: 16; left: 21%; right: 21%; top: 58%; height: 12%; overflow: hidden; opacity: .9; }
        .v20-filler span { position: absolute; bottom: 0; width: 28px; height: 6px; border-radius: 999px; background: linear-gradient(90deg, #C59654, #E8C982, #9B6B31); box-shadow: 0 2px 3px rgba(0,0,0,.12); animation: v20FillerFloat 2.8s ease-in-out infinite; }
        .v20-item-layer { position: absolute; z-index: 24; inset: 0; pointer-events: none; }
        .v20-pack-item { position: absolute; transform: translate(-50%, -50%) rotate(var(--v20-rotate)) scale(var(--v20-scale)); transform-origin: center bottom; will-change: transform, opacity; }
        .v20-pack-item.is-entering { animation: v20ItemDrop .82s cubic-bezier(.17,.78,.2,1.08) both; }
        .v20-pack-item.is-exiting { animation: v20ItemExit .34s cubic-bezier(.45,0,.8,.4) both; }
        .v20-pack-card { position: relative; width: 100%; height: 100%; overflow: hidden; border: 1px solid rgba(61,39,20,.18); border-radius: 10px; background: linear-gradient(145deg, #FFFDF9, #EEDCC6); box-shadow: 0 10px 18px rgba(36,22,10,.24), inset 0 1px 0 rgba(255,255,255,.72); animation: v20ItemPulse 2.8s ease-in-out infinite; }
        .v20-kind-bottle .v20-pack-card { border-radius: 13px 13px 9px 9px; }
        .v20-kind-cylinder .v20-pack-card { border-radius: 18px 18px 10px 10px; }
        .v20-kind-flat .v20-pack-card { border-radius: 7px; }
        .v20-pack-image { width: 100%; height: 100%; object-fit: contain; padding: 4px; background: rgba(255,255,255,.92); }
        .v20-pack-fallback { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; color: #8A631C; background: radial-gradient(circle at 30% 22%, rgba(255,255,255,.7), transparent 34%), linear-gradient(145deg, #F6E5C9, #C99449); font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 700; }
        .v20-pack-label { position: absolute; left: 4px; right: 4px; bottom: 4px; overflow: hidden; padding: 2px 4px; border-radius: 5px; color: rgba(255,255,255,.94); background: rgba(22,17,12,.70); font-size: 5.5px; font-weight: 800; line-height: 1.1; text-align: center; text-overflow: ellipsis; white-space: nowrap; backdrop-filter: blur(3px); }
        .v20-box-left, .v20-box-right, .v20-box-front {
          position: absolute;
          z-index: 42;
          pointer-events: none;
          border: 1px solid rgba(69,38,16,.18);
          background: linear-gradient(180deg, var(--v20-box-main), var(--v20-box-dark));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
        }

        /* V41: fixed rigid-box side walls — no outward gate/flap look */
        .v20-box-left {
          left: 17.2%;
          top: 46%;
          width: 7.8%;
          height: 25%;
          border-radius: 12px 2px 2px 14px;
          transform: skewY(4deg);
          background:
            linear-gradient(90deg, rgba(255,255,255,.14), transparent 32%),
            linear-gradient(180deg, color-mix(in srgb, var(--v20-box-main) 93%, white 7%), var(--v20-box-deep));
          box-shadow: inset 1px 0 0 rgba(255,255,255,.16), 3px 6px 10px rgba(58,34,10,.08);
        }

        .v20-box-right {
          right: 17.2%;
          top: 46%;
          width: 7.8%;
          height: 25%;
          border-radius: 2px 12px 14px 2px;
          transform: skewY(-4deg);
          background:
            linear-gradient(270deg, rgba(255,255,255,.14), transparent 32%),
            linear-gradient(180deg, color-mix(in srgb, var(--v20-box-main) 93%, white 7%), var(--v20-box-deep));
          box-shadow: inset -1px 0 0 rgba(255,255,255,.16), -3px 6px 10px rgba(58,34,10,.08);
        }

        .v20-box-front {
          left: 20%;
          right: 20%;
          bottom: 8%;
          height: 23%;
          clip-path: polygon(0 4%, 100% 4%, 96% 100%, 4% 100%);
          border-radius: 5px 5px 14px 14px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--v20-box-main) 90%, white 10%) 0%, var(--v20-box-dark) 76%, var(--v20-box-deep) 100%);
          box-shadow: 0 12px 18px rgba(49,28,10,.18), inset 0 1px 0 rgba(255,255,255,.24);
        }
        .v20-box-front::before {
          content: "";
          position: absolute;
          left: 12%;
          right: 12%;
          top: 8px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,247,224,.55), transparent);
        }
        .v20-box-front::after { content: "HAMPORIUM"; position: absolute; left: 50%; top: 56%; transform: translate(-50%, -50%); color: rgba(255,240,192,.88); font-size: 7.6px; font-weight: 900; letter-spacing: .22em; text-shadow: 0 2px 8px rgba(0,0,0,.16); }
        .v20-pack-ribbon-h, .v20-pack-ribbon-v { position: absolute; z-index: 63; pointer-events: none; background: linear-gradient(90deg, #9B6C11, #E8CB67 26%, #FFF0AD 50%, #D5A532 74%, #81530D); box-shadow: inset 0 1px 0 rgba(255,255,255,.34), 0 4px 10px rgba(43,26,5,.16); animation: v20RibbonSettle .48s cubic-bezier(.2,.8,.2,1) both; }
        .v20-pack-ribbon-h { left: 17%; right: 17%; top: 68%; height: 9px; transform-origin: center; }
        .v20-pack-ribbon-v { left: 50%; top: 41%; bottom: 5%; width: 9px; transform: translateX(-50%); background: linear-gradient(180deg, #FFF0AD, #D5A532 44%, #81530D); }
        .v20-packed-badge { position: absolute; z-index: 68; left: 50%; top: 63%; display: flex; min-width: 82px; height: 29px; align-items: center; justify-content: center; transform: translateX(-50%); border: 1px solid rgba(255,239,175,.54); border-radius: 999px; color: #FFF0B5; background: radial-gradient(circle at 35% 28%, #C99B33, #7F500D); box-shadow: 0 8px 16px rgba(42,24,4,.22), inset 0 1px 0 rgba(255,255,255,.26); font-size: 6.5px; font-weight: 900; letter-spacing: .10em; text-transform: uppercase; }
        .v20-packing-toast { position: absolute; z-index: 90; left: 50%; top: 43px; max-width: 76%; overflow: hidden; transform: translateX(-50%); border: 1px solid rgba(212,175,55,.25); border-radius: 999px; padding: 7px 12px; color: #5B4213; background: rgba(255,252,244,.94); box-shadow: 0 8px 24px rgba(44,29,11,.10); font-size: 7.5px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; backdrop-filter: blur(10px); animation: v20PackingToast 1.35s ease both; }
        .v20-packing-toast::before { content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 999px; background: #F47822; box-shadow: 0 0 0 4px rgba(244,120,34,.10); }
        .v20-empty-cue { position: absolute; z-index: 30; left: 50%; top: 50%; width: 58%; transform: translate(-50%, -50%); border: 1px dashed rgba(92,65,34,.20); border-radius: 14px; padding: 12px 14px; color: rgba(38,28,18,.40); background: rgba(255,255,255,.52); font-size: 8px; font-weight: 800; line-height: 1.5; text-align: center; backdrop-filter: blur(4px); }
        .v20-capacity-line { position: absolute; z-index: 80; left: 10px; right: 10px; bottom: 8px; display: flex; align-items: center; gap: 8px; }
        .v20-capacity-track { height: 4px; flex: 1; overflow: hidden; border-radius: 999px; background: rgba(77,50,25,.10); }
        .v20-capacity-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #F47822, #D4AF37); box-shadow: 0 0 14px rgba(244,120,34,.18); transition: width .72s cubic-bezier(.22,1,.36,1); }
        .v20-capacity-copy { width: 34px; flex: 0 0 auto; color: rgba(27,23,18,.46); font-size: 7px; font-weight: 900; text-align: right; }
        .v20-decor-band { position: absolute; z-index: 62; left: 18%; right: 18%; top: 68%; height: 8px; border-radius: 999px; background: linear-gradient(90deg, #875B0B, #EED576 48%, #875B0B); box-shadow: 0 3px 10px rgba(87,56,6,.20); animation: v20RibbonSettle .46s cubic-bezier(.2,.8,.2,1) both; }
        .v20-decor-band-v { position: absolute; z-index: 61; left: 50%; top: 45%; bottom: 7%; width: 8px; transform: translateX(-50%); border-radius: 999px; background: linear-gradient(180deg, #F7E9A8, #C39021 64%, #80520C); animation: v20RibbonSettle .46s cubic-bezier(.2,.8,.2,1) both; }
        .v20-packed-glow { position: absolute; z-index: 3; left: 50%; bottom: 6%; width: 72%; height: 32%; transform: translateX(-50%); border-radius: 999px; background: rgba(212,175,55,.18); filter: blur(28px); animation: v20PackedGlow 2.8s ease-in-out infinite; }

        @media (min-width: 1280px) {
          .v20-live-stage { min-height: 282px; }
          .v20-box-world { width: 95%; max-width: 540px; height: 292px; }
        }

        .v20-box-world.is-top-view.is-drop-intro {
          animation: v20BoxDropIn .84s cubic-bezier(.2,.9,.2,1.08) both;
        }
        .v20-box-world.is-top-view.is-drop-intro .v20-box-shell {
          animation: v20ShellLand .84s cubic-bezier(.2,.9,.2,1.08) both;
        }
        .v20-box-world.is-top-view.is-drop-intro .v20-box-lid--top {
          top: calc(var(--v20-shell-top) + 4%);
          transform: translateX(-50%) translateY(0) rotateX(0deg) scale(1.02);
          transition: none;
        }
        .v20-box-world.is-top-view.is-drop-intro .v20-box-fill,
        .v20-box-world.is-top-view.is-opening-intro .v20-box-fill {
          opacity: 0;
          transform: scale(.98);
        }
        .v20-box-world.is-top-view.is-opening-intro .v20-box-lid--top {
          animation: v20TopLidOpenIntro .92s cubic-bezier(.22,.86,.24,1) forwards;
        }
        .v20-box-world.is-top-view.is-opening-intro .v20-box-fill {
          animation: v20TopFillReveal .62s ease .18s forwards;
        }
        .v20-box-world.is-top-view.is-opening-intro .v20-box-orbit {
          animation-duration: 1.6s;
          opacity: 1;
        }
        .v20-box-world.is-top-view.is-opening-intro .v20-box-sparkles {
          animation: v20TopSparkBurst .9s ease-out;
        }
        @keyframes v20BoxDropIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-140px) scale(.88);
          }
          62% {
            opacity: 1;
            transform: translateX(-50%) translateY(10px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        @keyframes v20ShellLand {
          0% {
            transform: translateX(-50%) scale(.94);
            filter: drop-shadow(0 28px 24px rgba(35,18,8,.18));
          }
          62% {
            transform: translateX(-50%) scale(1.01);
          }
          100% {
            transform: translateX(-50%) scale(1);
            filter: drop-shadow(0 0 0 rgba(35,18,8,0));
          }
        }
        @keyframes v20TopLidOpenIntro {
          0% {
            top: calc(var(--v20-shell-top) + 4%);
            transform: translateX(-50%) translateY(0) rotateX(0deg) scale(1.02);
          }
          55% {
            top: calc(var(--v20-shell-top) - 2%);
            transform: translateX(-50%) translateY(-8px) rotateX(7deg) scale(1.01);
          }
          100% {
            top: var(--v20-lid-top);
            transform: translateX(-50%) translateY(0) rotateX(10deg) scale(1);
          }
        }
        @keyframes v20TopFillReveal {
          0% {
            opacity: 0;
            transform: scale(.98);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes v20TopSparkBurst {
          0% { opacity: .18; transform: scale(.92); }
          45% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 639px) {
          .v20-live-stage { min-height: 272px; }
          .v20-box-world { width: 100%; height: 244px; bottom: 2px; }
          .v20-box-monogram { width: 46px; height: 46px; font-size: 22px; }
          .v20-box-front::after { font-size: 6.4px; }
          .v20-pack-label { display: none; }
        }

        /* V45 · COUTURE LIVE HAMPER BOX */
        .v20-box-world.is-top-view {
          --v20-shell-width: 94%;
          --v20-shell-height: 66%;
          --v20-shell-top: 21%;
          --v20-shell-radius: 34px;
          --v20-lid-width: 90%;
          --v20-lid-height: 20%;
          --v20-lid-top: 3%;
          left: 50%;
          bottom: 4px;
          width: 100%;
          max-width: 760px;
          height: 408px;
          transform: translateX(-50%);
          perspective: 1400px;
        }
        .v20-box-world.is-top-view[data-box-shape="round"] {
          --v20-shell-width: 76%;
          --v20-shell-height: 72%;
          --v20-shell-top: 16%;
          --v20-shell-radius: 999px;
          --v20-lid-width: 72%;
          --v20-lid-height: 18%;
        }
        .v20-box-world.is-top-view[data-box-shape="tray"] {
          --v20-shell-width: 96%;
          --v20-shell-height: 60%;
          --v20-shell-top: 24%;
          --v20-shell-radius: 24px;
          --v20-lid-width: 92%;
          --v20-lid-height: 16%;
        }
        .v20-box-world.is-top-view[data-box-shape="curved"] {
          --v20-shell-radius: 50px;
        }
        .v20-box-world.is-top-view .v20-box-base,
        .v20-box-world.is-top-view .v20-box-back,
        .v20-box-world.is-top-view .v20-box-inner-left,
        .v20-box-world.is-top-view .v20-box-inner-right,
        .v20-box-world.is-top-view .v20-box-left,
        .v20-box-world.is-top-view .v20-box-right,
        .v20-box-world.is-top-view .v20-box-front {
          display: none;
        }
        .v20-box-pedestal {
          position: absolute;
          left: 50%;
          bottom: 10px;
          width: 94%;
          height: 84px;
          transform: translateX(-50%);
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 18%, rgba(255,255,255,.84), transparent 42%),
            linear-gradient(180deg, rgba(255,251,244,.98), rgba(233,219,201,.88));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.94), 0 20px 42px rgba(60,38,16,.09);
          z-index: 1;
        }
        .v20-box-pedestal::before {
          content: "";
          position: absolute;
          inset: 12px 24px;
          border-radius: inherit;
          border: 1px solid rgba(212,175,55,.18);
          background: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0));
        }
        .v20-box-sparkles {
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
        }
        .v20-box-spark {
          position: absolute;
          width: 14px;
          height: 14px;
          transform: rotate(45deg);
          border-radius: 2px;
          background: linear-gradient(180deg, rgba(255,251,235,.95), rgba(212,175,55,.85));
          box-shadow: 0 0 0 3px rgba(255,245,214,.15), 0 0 20px rgba(244,188,72,.28);
          animation: v20SparkPulse 2.8s ease-in-out infinite;
        }
        .v20-box-spark::before,
        .v20-box-spark::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          background: inherit;
          transform: translate(-50%, -50%);
          border-radius: 999px;
        }
        .v20-box-spark::before { width: 2px; height: 22px; }
        .v20-box-spark::after { width: 22px; height: 2px; }
        .v20-box-spark--1 { left: 14%; top: 13%; animation-delay: 0s; }
        .v20-box-spark--2 { right: 16%; top: 20%; animation-delay: .7s; }
        .v20-box-spark--3 { left: 20%; bottom: 24%; animation-delay: 1.4s; }
        .v20-box-spark--4 { right: 19%; bottom: 31%; animation-delay: 2.1s; }

        .v20-box-world.is-top-view .v20-box-lid--top {
          left: 50%;
          top: var(--v20-lid-top);
          width: var(--v20-lid-width);
          height: var(--v20-lid-height);
          transform: translateX(-50%) translateY(0) rotateX(12deg);
          z-index: 10;
          animation: none;
        }
        .v20-box-world.is-top-view .v20-box-lid--top.is-packed { animation: none; }
        .v20-box-world.is-top-view[data-box-shape="round"] .v20-box-lid-face {
          border-radius: 999px;
        }
        .v20-box-shell {
          position: absolute;
          left: 50%;
          top: var(--v20-shell-top);
          width: var(--v20-shell-width);
          height: var(--v20-shell-height);
          transform: translateX(-50%);
          border-radius: var(--v20-shell-radius);
          background:
            radial-gradient(circle at 50% 6%, rgba(255,255,255,.24), transparent 26%),
            linear-gradient(180deg, color-mix(in srgb, var(--v20-box-light) 46%, white 54%) 0%, color-mix(in srgb, var(--v20-box-main) 82%, white 18%) 16%, color-mix(in srgb, var(--v20-box-main) 92%, black 8%) 72%, color-mix(in srgb, var(--v20-box-dark) 90%, black 10%) 100%);
          border: 1px solid rgba(77,45,20,.22);
          box-shadow: 0 38px 54px rgba(52,31,12,.18), 0 12px 22px rgba(52,31,12,.10), inset 0 1px 0 rgba(255,255,255,.34), inset 0 -18px 20px rgba(95,61,22,.18);
          overflow: visible;
          z-index: 8;
        }
        .v20-box-shell::before {
          content: "";
          position: absolute;
          inset: 10px;
          border-radius: calc(var(--v20-shell-radius) - 10px);
          border: 1px solid rgba(255,244,218,.28);
          background: linear-gradient(180deg, rgba(255,255,255,.12), transparent 18%, transparent 78%, rgba(255,244,212,.08));
          pointer-events: none;
        }
        .v20-box-shell::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -16px;
          width: 74%;
          height: 26px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(53,28,10,.22), rgba(53,28,10,0) 70%);
          filter: blur(8px);
          pointer-events: none;
        }
        .v20-box-world.is-top-view[data-box-shape="round"] .v20-box-shell {
          border-radius: 50% / 40%;
        }
        .v20-box-rim {
          position: absolute;
          inset: 12px;
          border-radius: calc(var(--v20-shell-radius) - 12px);
          background: linear-gradient(180deg, rgba(255,250,236,.24), rgba(116,73,26,.18));
          border: 1px solid rgba(255,244,218,.34);
          box-shadow: inset 0 2px 0 rgba(255,255,255,.26), inset 0 -2px 0 rgba(88,54,22,.16);
        }
        .v20-box-world.is-top-view[data-box-shape="round"] .v20-box-rim,
        .v20-box-world.is-top-view[data-box-shape="round"] .v20-box-fill,
        .v20-box-world.is-top-view[data-box-shape="round"] .v20-box-well {
          border-radius: 50% / 42%;
        }
        .v20-box-fill {
          position: absolute;
          inset: 24px 24px 30px;
          overflow: hidden;
          border-radius: calc(var(--v20-shell-radius) - 18px);
          background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0));
        }
        .v20-box-fill::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 24% 26%, rgba(255,239,210,.11), transparent 22%),
            radial-gradient(circle at 72% 36%, rgba(255,227,176,.1), transparent 20%),
            linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,0));
          pointer-events: none;
        }
        .v20-box-world.is-top-view .v20-box-well {
          position: absolute;
          inset: 0;
          height: auto;
          border-radius: inherit;
          background:
            radial-gradient(circle at 50% 16%, rgba(255,240,205,.22), transparent 18%),
            linear-gradient(180deg, #6F4020 0%, #4B2612 58%, #30160A 100%);
          box-shadow: inset 0 24px 44px rgba(0,0,0,.24), inset 0 -12px 18px rgba(255,227,168,.08), inset 0 0 0 1px rgba(255,239,206,.05);
        }
        .v20-box-world.is-top-view .v20-filler {
          left: 8%;
          right: 8%;
          top: auto;
          bottom: 10%;
          height: 22%;
          z-index: 18;
        }
        .v20-box-world.is-top-view .v20-item-layer {
          position: absolute;
          inset: 8% 7% 13%;
          overflow: hidden;
          z-index: 24;
          border-radius: inherit;
        }
        .v20-box-world.is-top-view .v20-item-layer::before {
          content: "";
          position: absolute;
          inset: 10% 8% 8%;
          border-radius: inherit;
          background: radial-gradient(circle at 50% 20%, rgba(255,255,255,.08), rgba(255,255,255,0) 52%);
          pointer-events: none;
        }
        .v20-box-world.is-top-view .v20-pack-item {
          filter: drop-shadow(0 12px 16px rgba(0,0,0,.18));
        }
        .v20-box-world.is-top-view .v20-pack-card {
          border-radius: 16px;
          background: linear-gradient(145deg, #fffefd, #f3e7d5);
          box-shadow: 0 12px 18px rgba(36,22,10,.2), inset 0 1px 0 rgba(255,255,255,.86);
          animation: none;
        }
        .v20-box-world.is-top-view .v20-pack-image {
          padding: 6px;
          object-fit: cover;
        }
        .v20-box-world.is-top-view .v20-pack-label {
          display: none;
        }
        .v20-box-front-badge {
          position: absolute;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%);
          padding: 10px 22px;
          border-radius: 999px;
          border: 1px solid rgba(255,244,219,.26);
          color: rgba(255,241,204,.97);
          background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(0,0,0,.12));
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .22em;
          text-transform: uppercase;
          box-shadow: 0 10px 20px rgba(40,22,8,.16);
          z-index: 35;
        }
        .v20-box-world.is-top-view .v20-pack-ribbon-h {
          left: 16%;
          right: 16%;
          top: calc(var(--v20-shell-top) + 54%);
          height: 12px;
          z-index: 60;
        }
        .v20-box-world.is-top-view .v20-pack-ribbon-v {
          left: 50%;
          top: calc(var(--v20-shell-top) + 4%);
          bottom: 12%;
          width: 12px;
          z-index: 59;
        }
        .v20-box-world.is-top-view .v20-packed-badge {
          top: calc(var(--v20-shell-top) + 40%);
          z-index: 61;
        }
        @media (max-width: 639px) {
          .v20-live-stage {
            min-height: 336px;
            border-radius: 18px;
          }
          .v20-box-pedestal {
            width: 96%;
            height: 60px;
            bottom: 12px;
          }
          .v20-box-world.is-top-view {
            height: 336px;
            --v20-shell-width: 98%;
            --v20-shell-height: 64%;
            --v20-shell-top: 22%;
            --v20-lid-width: 94%;
            --v20-lid-height: 20%;
            --v20-lid-top: 4%;
          }
          .v20-box-world.is-top-view[data-box-shape="round"] {
            --v20-shell-width: 80%;
            --v20-shell-height: 70%;
            --v20-shell-top: 18%;
            --v20-lid-width: 76%;
          }
          .v20-box-world.is-top-view .v20-box-front-badge {
            font-size: 9px;
            letter-spacing: .14em;
            padding: 7px 14px;
          }
          .v20-box-monogram {
            width: 54px;
            height: 54px;
            font-size: 28px;
          }
        }

        @keyframes v20CinematicPulse {
          0%, 100% { opacity: .55; transform: translateX(-50%) scale(.98); }
          50% { opacity: .92; transform: translateX(-50%) scale(1.04); }
        }
        @keyframes v20BoxSheen {
          0% { transform: translateX(-120%) rotate(10deg); opacity: 0; }
          30% { opacity: .16; }
          100% { transform: translateX(150%) rotate(10deg); opacity: 0; }
        }
        @keyframes v20SparkPulse {
          0%, 100% { opacity: .32; transform: rotate(45deg) scale(.68); }
          50% { opacity: 1; transform: rotate(45deg) scale(1); }
        }
        @keyframes v20ShipAway {
          0% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          16% { transform: translateX(-48%) translateY(-3px) scale(1.01); }
          100% { transform: translateX(88%) translateY(-12px) scale(.96); opacity: .08; }
        }
        @keyframes v20TrailMove {
          0% { opacity: 0; transform: translateX(-10px); }
          25% { opacity: .92; }
          100% { opacity: 0; transform: translateX(48px); }
        }
        .v20-cinematic-halo {
          position: absolute;
          left: 50%;
          top: 8%;
          width: 84%;
          height: 58%;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255,214,127,.3), rgba(255,214,127,.1) 44%, transparent 72%);
          filter: blur(22px);
          animation: v20CinematicPulse 3.4s ease-in-out infinite;
        }
        .v20-box-world.is-top-view .v20-box-lid-face {
          box-shadow: 0 22px 34px rgba(75,44,15,.2), inset 0 1px 0 rgba(255,255,255,.36), inset 0 -12px 20px rgba(112,71,17,.24);
          background: linear-gradient(180deg, rgba(255,247,217,.24), transparent 26%), linear-gradient(155deg, color-mix(in srgb, var(--v20-box-main) 74%, white 26%), color-mix(in srgb, var(--v20-box-dark) 82%, black 18%));
        }
        .v20-box-world.is-top-view .v20-box-lid-face::before {
          inset: 12px;
          border-radius: 16px;
          border-color: rgba(255,247,224,.34);
        }
        .v20-box-world.is-top-view .v20-box-lid-face::after {
          left: 10%;
          right: 10%;
          bottom: 10px;
          height: 16px;
          background: linear-gradient(180deg, rgba(117,73,26,.03), rgba(70,42,16,.18));
          filter: blur(7px);
        }
        .v20-box-world.is-top-view .v20-box-lid-face::selection { background: transparent; }
        .v20-box-world.is-top-view .v20-box-lid--top::after {
          content: "";
          position: absolute;
          top: 6%;
          bottom: 12%;
          left: -24%;
          width: 26%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          transform: skewX(-18deg);
          animation: v20BoxSheen 5.6s linear infinite;
          pointer-events: none;
          z-index: 3;
        }
        .v20-box-world.is-top-view .v20-box-lid--top.is-packed {
          top: calc(var(--v20-shell-top) + 7%);
          transform: translateX(-50%) rotateX(0deg) scale(1.01);
          transition: top .72s cubic-bezier(.2,.84,.2,1), transform .72s cubic-bezier(.2,.84,.2,1);
        }
        .v20-box-world.is-top-view.is-sealed .v20-box-fill {
          opacity: .08;
          transform: scale(.98);
          transition: opacity .55s ease, transform .55s ease;
        }
        .v20-box-world.is-top-view.is-sealed .v20-box-sparkles {
          opacity: .4;
        }
        .v20-box-world.is-top-view.is-shipping {
          animation: v20ShipAway 1.45s cubic-bezier(.3,.75,.18,1) forwards;
        }
        .v20-delivery-trail {
          position: absolute;
          left: 8%;
          bottom: 19%;
          width: 82px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,196,112,.82), rgba(255,255,255,0));
          filter: blur(1px);
          animation: v20TrailMove 1s linear infinite;
        }
        .v20-delivery-chip {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(23,23,23,.92);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          box-shadow: 0 14px 28px rgba(23,23,23,.18);
          z-index: 65;
        }

        /* V46 · NEXT LEVEL CINEMATIC HAMPER BOX */
        .v20-box-orbit {
          position: absolute;
          left: 50%;
          top: 18%;
          width: 78%;
          height: 48%;
          transform: translateX(-50%);
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 50%, rgba(255,255,255,.18), transparent 36%),
            radial-gradient(circle at 50% 50%, var(--v20-box-glow-accent), transparent 70%);
          filter: blur(20px);
          opacity: .95;
          z-index: 2;
          animation: v20CinematicPulse 4.2s ease-in-out infinite;
        }

        .v20-box-shell {
          background:
            radial-gradient(circle at 50% 0%, rgba(255,255,255,.28), transparent 22%),
            linear-gradient(145deg, color-mix(in srgb, var(--v20-box-light) 46%, white 54%) 0%, color-mix(in srgb, var(--v20-box-main) 78%, white 22%) 16%, color-mix(in srgb, var(--v20-box-main) 84%, black 16%) 68%, color-mix(in srgb, var(--v20-box-dark) 92%, black 8%) 100%);
          border-color: rgba(77,45,20,.18);
          box-shadow: 0 40px 54px rgba(52,31,12,.16), 0 10px 22px rgba(52,31,12,.08), inset 0 1px 0 rgba(255,255,255,.34), inset 0 -20px 24px rgba(95,61,22,.18);
        }
        .v20-box-shell::before {
          border-color: color-mix(in srgb, var(--v20-box-trim) 42%, transparent);
          background: linear-gradient(140deg, rgba(255,255,255,.14), transparent 24%, transparent 72%, rgba(255,255,255,.08));
        }
        .v20-box-rim {
          background: linear-gradient(180deg, color-mix(in srgb, var(--v20-box-trim) 40%, rgba(255,255,255,.16)) 0%, rgba(116,73,26,.18) 100%);
          border-color: color-mix(in srgb, var(--v20-box-trim) 55%, transparent);
          box-shadow: inset 0 2px 0 rgba(255,255,255,.28), inset 0 -4px 10px rgba(88,54,22,.14);
        }
        .v20-box-lining {
          position: absolute;
          inset: 10px;
          border-radius: inherit;
          background:
            radial-gradient(circle at 50% 18%, rgba(255,255,255,.25), transparent 20%),
            linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0) 22%),
            linear-gradient(180deg, color-mix(in srgb, var(--v20-box-satin) 78%, white 22%) 0%, color-mix(in srgb, var(--v20-box-satin) 76%, rgba(90,60,25,.10)) 100%);
          border: 1px solid rgba(255,255,255,.34);
          opacity: .96;
        }
        .v20-box-satin {
          position: absolute;
          left: 5%;
          right: 5%;
          bottom: 4%;
          height: 34%;
          border-radius: 0 0 28px 28px;
          background:
            radial-gradient(circle at 18% 74%, rgba(255,255,255,.52), transparent 18%),
            radial-gradient(circle at 82% 74%, rgba(255,255,255,.36), transparent 18%),
            linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,0)),
            repeating-linear-gradient(100deg, rgba(255,255,255,.1) 0 14px, rgba(241,228,208,.22) 14px 28px);
          opacity: .84;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .v20-box-world.is-top-view .v20-box-well {
          background:
            radial-gradient(circle at 50% 16%, rgba(255,241,211,.18), transparent 20%),
            radial-gradient(circle at 50% 56%, rgba(126,67,24,.16), transparent 46%),
            linear-gradient(180deg, color-mix(in srgb, var(--v20-box-dark) 74%, #734121 26%) 0%, color-mix(in srgb, var(--v20-box-deep) 88%, black 12%) 100%);
          box-shadow: inset 0 22px 42px rgba(0,0,0,.24), inset 0 -14px 22px rgba(255,227,168,.12), inset 0 0 0 1px rgba(255,239,206,.04);
        }
        .v20-box-world.is-top-view .v20-pack-card {
          border: 1px solid rgba(84,57,28,.16);
          border-radius: 18px;
          background: linear-gradient(160deg, #fffefd 0%, #fff9f1 26%, #f2e4d0 100%);
          box-shadow: 0 16px 22px rgba(36,22,10,.18), inset 0 1px 0 rgba(255,255,255,.94);
        }
        .v20-box-world.is-top-view .v20-pack-image {
          padding: 6px;
          background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,241,231,.96));
          border-radius: 16px;
        }
        .v20-box-world.is-top-view .v20-box-lid-face {
          border-color: rgba(77,45,20,.18);
          background:
            linear-gradient(180deg, rgba(255,247,217,.22), transparent 26%),
            linear-gradient(135deg, color-mix(in srgb, var(--v20-box-main) 66%, white 34%) 0%, color-mix(in srgb, var(--v20-box-main) 86%, white 14%) 36%, color-mix(in srgb, var(--v20-box-dark) 90%, black 10%) 100%);
        }
        .v20-box-world.is-top-view .v20-box-lid-face::before {
          border-color: color-mix(in srgb, var(--v20-box-trim) 68%, transparent);
        }
        .v20-box-monogram {
          border-color: color-mix(in srgb, var(--v20-box-trim) 74%, transparent);
          color: color-mix(in srgb, var(--v20-box-trim) 92%, white 8%);
          background: radial-gradient(circle at 30% 25%, rgba(255,252,235,.52), rgba(102,58,23,.26));
          box-shadow: inset 0 0 0 8px rgba(255,255,255,.06), 0 12px 28px rgba(60,34,11,.18);
        }
        .v20-box-front-badge {
          padding: 10px 18px;
          border-color: rgba(255,244,219,.34);
          background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(0,0,0,.16));
          color: color-mix(in srgb, var(--v20-box-trim) 90%, white 10%);
          box-shadow: 0 14px 24px rgba(40,22,8,.18);
          letter-spacing: .28em;
        }
        .v20-box-world.is-top-view .v20-pack-ribbon-h,
        .v20-box-world.is-top-view .v20-pack-ribbon-v,
        .v20-decor-band,
        .v20-decor-band-v {
          background: linear-gradient(90deg, var(--v20-ribbon-b), var(--v20-ribbon-a) 32%, #fff4c5 50%, var(--v20-ribbon-a) 68%, var(--v20-ribbon-b));
        }
        .v20-box-world.is-top-view .v20-pack-ribbon-v,
        .v20-decor-band-v {
          background: linear-gradient(180deg, #fff4c5, var(--v20-ribbon-a) 40%, var(--v20-ribbon-b));
        }
        .v20-packed-badge {
          border-color: color-mix(in srgb, var(--v20-box-trim) 70%, transparent);
          color: #fff4c3;
          background: radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--v20-ribbon-a) 76%, white 24%), color-mix(in srgb, var(--v20-ribbon-b) 92%, black 8%));
          box-shadow: 0 10px 18px rgba(42,24,4,.24), inset 0 1px 0 rgba(255,255,255,.28);
        }
        .v20-delivery-trail {
          left: 9%;
          bottom: 18%;
          width: 92px;
          height: 13px;
          background: linear-gradient(90deg, rgba(255,255,255,0), color-mix(in srgb, var(--v20-ribbon-a) 60%, #F47822 40%), rgba(255,255,255,0));
          box-shadow: 0 0 16px rgba(244,120,34,.18);
        }
        .v20-delivery-trail--2 {
          bottom: 14%;
          width: 54px;
          opacity: .72;
          animation-duration: .82s;
        }
        .v20-delivery-chip {
          background: rgba(17,17,17,.92);
          color: #fff;
        }
        .v20-dispatch-burst {
          position: absolute;
          right: 8%;
          top: 16%;
          width: 68px;
          height: 68px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255,245,214,.32), rgba(255,245,214,0) 62%);
          filter: blur(2px);
          z-index: 40;
          animation: v20CinematicPulse 1.8s ease-in-out infinite;
        }

        .v20-box-world[data-box-theme="chest"] .v20-box-shell {
          border-radius: 38px 38px 28px 28px;
        }
        .v20-box-world.is-top-view.is-packing .v20-box-shell {
          animation: v20PackPulse .9s ease-in-out infinite;
        }
        .v20-box-world.is-top-view.is-packing .v20-box-lid--top {
          animation: v20PackingHover .9s ease-in-out infinite;
        }
        .v20-box-world.is-top-view.is-shipping .v20-box-pedestal {
          opacity: .2;
          transition: opacity .22s ease;
        }
        @keyframes v20PackPulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.014); }
        }
        @keyframes v20PackingHover {
          0%, 100% { transform: translateX(-50%) translateY(0) rotateX(8deg); }
          50% { transform: translateX(-50%) translateY(3px) rotateX(4deg); }
        }
        @media (max-width: 639px) {

          .v20-box-front-badge {
            padding: 8px 12px;
            letter-spacing: .18em;
          }
        }

        @keyframes v10Shimmer {
          0% { transform: translateX(-140%); }
          100% { transform: translateX(420%); }
        }

        .v10-soft-scroll { scrollbar-width: none; }
        .v10-soft-scroll::-webkit-scrollbar { display: none; }
        .v24-fixed-studio { scrollbar-width: none; }
        .v24-fixed-studio::-webkit-scrollbar { display: none; }
        .v10-primary-cta { position: relative; overflow: hidden; }
        .v10-primary-cta::after { content: ""; position: absolute; inset: -60% auto -60% -34%; width: 22%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.38), transparent); transform: skewX(-18deg); pointer-events: none; }
        .v10-primary-cta:hover::after { animation: v10Shimmer .8s cubic-bezier(.16,1,.3,1); }

        @keyframes v13ModalBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes v13ModalPanelIn { from { opacity: 0; transform: translateY(16px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .v13-modal-backdrop { animation: v13ModalBackdropIn .18s ease-out both; }
        .v13-modal-panel { animation: v13ModalPanelIn .24s cubic-bezier(.2,.78,.2,1) both; }

        /* V30 · CALM GIFT STUDIO */
        @keyframes v30StepIn { from { opacity: 0; transform: translate3d(0,14px,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        .v30-step-in { animation: v30StepIn .48s cubic-bezier(.2,.78,.2,1) both; }
        .v30-scrollbar-none { scrollbar-width: none; }
        .v30-scrollbar-none::-webkit-scrollbar { display: none; }
        .v30-live-shell .v20-live-stage { border-radius: 22px; border-color: rgba(212,175,55,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 16px 40px rgba(53,36,17,.06); }
        .v30-mobile-live .v20-live-stage { min-height: 238px; border-radius: 18px; }
        .v30-mobile-live .v20-box-world { width: 96%; height: 242px; bottom: -2px; }
        .v30-mobile-live .v20-packing-toast { top: 16px; max-width: 84%; }
        .v30-details > summary { list-style: none; }
        .v30-details > summary::-webkit-details-marker { display: none; }
        .v30-details[open] .v30-details-arrow { transform: rotate(45deg); }

        @keyframes v60MobileGiftDrop {
          0% {
            opacity: 0;
            transform: translate(-50%, -180px) rotate(calc(var(--v20-rotate) - 12deg)) scale(.62);
            filter: blur(2px);
          }
          58% {
            opacity: 1;
            transform: translate(-50%, -36%) rotate(calc(var(--v20-rotate) + 3deg)) scale(var(--v20-scale));
            filter: blur(0);
          }
          78% {
            transform: translate(-50%, -58%) rotate(calc(var(--v20-rotate) - 1deg)) scale(var(--v20-scale));
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--v20-rotate)) scale(var(--v20-scale));
            filter: blur(0);
          }
        }

        @keyframes v61MobileGiftDrop {
          0% {
            opacity: 0;
            transform: translate(-50%, -112px) rotate(calc(var(--v20-rotate) - 10deg)) scale(.64);
            filter: blur(1.5px);
          }
          54% {
            opacity: 1;
            transform: translate(-50%, -34%) rotate(calc(var(--v20-rotate) + 3deg)) scale(var(--v20-scale));
            filter: blur(0);
          }
          78% {
            transform: translate(-50%, -59%) rotate(calc(var(--v20-rotate) - 1deg)) scale(var(--v20-scale));
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--v20-rotate)) scale(var(--v20-scale));
            filter: blur(0);
          }
        }

        @media (max-width: 767px) {
          /* Keep the live packing box visible while the gift catalogue scrolls. */
          .v30-panel-mobile-sticky-safe { overflow: visible !important; }
          .v30-step-in { animation-name: v30StepInMobile; }

          .v30-mobile-live {
            position: sticky;
            top: 0;
            z-index: 70;
            margin: -20px -16px 14px;
            padding: 5px 6px 6px;
            border: 1px solid rgba(244,120,34,.12);
            border-top: 0;
            border-radius: 0 0 18px 18px;
            background: rgba(255,253,249,.99);
            box-shadow: 0 12px 30px rgba(42,29,14,.12);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
          }

          .v30-mobile-live .v20-live-stage {
            min-height: 176px;
            border-radius: 13px;
          }

          .v30-mobile-live .v20-box-world {
            width: 94%;
            height: 182px;
            bottom: -8px;
          }

          .v30-mobile-live .v20-packing-toast {
            top: 10px;
            max-width: 88%;
            padding: 5px 9px;
            font-size: 7px;
          }

          .v30-mobile-live .v20-capacity-line {
            bottom: 5px;
          }

          .v30-mobile-live-summary {
            margin-top: 5px;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,.055);
            border-radius: 12px;
            background: #FAF8F4;
          }

          .v30-mobile-live-summary-grid {
            display: grid;
            grid-template-columns: .72fr .8fr 1.28fr;
          }

          .v30-mobile-live-summary-cell {
            min-width: 0;
            padding: 7px 9px 6px;
          }

          .v30-mobile-live-summary-cell + .v30-mobile-live-summary-cell {
            border-left: 1px solid rgba(0,0,0,.06);
          }

          .v30-mobile-live-box-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-top: 1px solid rgba(0,0,0,.05);
            padding: 9px 11px;
          }

          /* V63 · MOBILE LIVE DOCK — more room for the actual box, no title/status row */
          /* V62: sticky at the real viewport top. While the site header is visible
             it simply sits in normal flow; after the header scrolls away this dock
             occupies that freed space instead of leaving a blank strip. */
          .v30-mobile-live {
            top: 0;
            z-index: 88;
            margin: 0 0 8px;
            padding: 5px;
            border: 1px solid rgba(23,23,23,.065);
            border-radius: 14px;
            background: rgba(255,253,249,.992);
            box-shadow: 0 8px 22px rgba(42,29,14,.09);
          }

          .v30-mobile-live .v60-live-stage {
            min-height: 165px !important;
            border-radius: 11px;
            border-color: rgba(212,175,55,.11);
            box-shadow: inset 0 1px 0 rgba(255,255,255,.98), 0 6px 16px rgba(39,27,14,.04);
          }

          .v30-mobile-live .v60-box-world {
            bottom: -4px !important;
            height: 172px !important;
            width: 91% !important;
            max-width: 420px !important;
          }

          .v30-mobile-live .v60-packing-note {
            top: 3px !important;
            max-width: 72%;
            padding: 3px 7px;
            font-size: 9px;
            line-height: 1.1;
          }

          /* Compact mode owns the stats, so the long capacity rail is hidden here. */
          .v30-mobile-live .v60-capacity-line {
            display: none !important;
          }

          .v30-mobile-live .v20-pack-item.is-entering {
            animation-name: v61MobileGiftDrop;
            animation-duration: .68s;
            animation-timing-function: cubic-bezier(.18,.82,.2,1.06);
          }

          .v61-mobile-mini-stats {
            display: grid;
            grid-template-columns: .7fr .8fr 1.2fr;
            align-items: center;
            min-height: 32px;
            margin-top: 4px;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,.05);
            border-radius: 10px;
            background: #FAF8F4;
          }

          .v61-mobile-mini-stat {
            min-width: 0;
            padding: 4px 8px;
          }

          .v61-mobile-mini-stat + .v61-mobile-mini-stat {
            border-left: 1px solid rgba(0,0,0,.06);
          }

          /* Let products own the screen. Step actions stay in document flow
             instead of floating over the product cards on mobile. */
          .v30-mobile-sticky-actions {
            position: static;
            z-index: auto;
            margin-inline: 0;
            padding: 0;
            background: transparent;
          }

          .hamporium-mobile-builder input,
          .hamporium-mobile-builder select,
          .hamporium-mobile-builder textarea {
            font-size: 16px !important;
          }
        }

        @keyframes v30StepInMobile {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (min-width: 1280px) {
          .v31-studio-compact .v30-live-shell { padding: 14px; border-radius: 22px; }
          .v31-studio-compact .v20-live-stage { min-height: 220px; border-radius: 16px; }
          .v31-studio-compact .v20-box-world { width: 96%; height: 220px; bottom: -3px; }
          .v31-studio-compact .v20-packing-toast { top: 14px; max-width: 86%; }
        }

        /* V34 · FLAT PRODUCT WORKSPACE — product cards are the only catalogue cards */
        .v34-gift-workspace { background: transparent; }
        .v34-live-flat .v20-live-stage {
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }
        .v34-live-flat .v20-live-stage::before,
        .v34-live-flat .v20-live-stage::after { display: none; }
        .v34-live-flat .v20-studio-grid { opacity: .10; }
        @media (min-width: 1280px) {
          .v31-studio-compact.v34-live-flat,
          .v31-studio-compact .v34-live-flat { padding-top: 2px; }
        }

        /* V38 · floating side progress navigator (no outer tracker card) */
        .v38-builder-head {
          position: relative;
          isolation: isolate;
        }

        .v38-progress-dock {
          position: fixed;
          z-index: 96;
          left: 12px;
          top: 50%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          transform: translateY(-50%);
          filter: drop-shadow(0 9px 22px rgba(31,22,12,.12));
        }

        .v38-progress-dock::before {
          content: "";
          position: absolute;
          z-index: 0;
          left: 20px;
          top: 18px;
          bottom: 18px;
          width: 1px;
          background: linear-gradient(180deg, rgba(212,175,55,.58), rgba(23,23,23,.10));
          pointer-events: none;
        }

        .v38-progress-step {
          position: relative;
          z-index: 1;
          display: flex;
          height: 42px;
          width: 42px;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(23,23,23,.08);
          border-radius: 999px;
          background: rgba(255,252,247,.94);
          color: rgba(23,23,23,.50);
          box-shadow: 0 4px 15px rgba(35,25,14,.06);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: width .28s cubic-bezier(.22,1,.36,1), border-color .24s ease, background .24s ease, color .24s ease, transform .24s ease;
        }

        .v38-progress-step:hover:not(:disabled),
        .v38-progress-step:focus-visible:not(:disabled) {
          width: 146px;
          border-color: rgba(212,175,55,.44);
          background: rgba(255,250,235,.98);
          color: #171717;
          transform: translateX(2px);
          outline: none;
        }

        .v38-progress-step.is-active {
          width: 126px;
          border-color: #171717;
          background: #171717;
          color: white;
          box-shadow: 0 9px 25px rgba(23,23,23,.18);
        }

        .v38-progress-step.is-active:hover,
        .v38-progress-step.is-active:focus-visible {
          width: 146px;
          background: #171717;
          color: white;
        }

        .v38-progress-step:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .v38-progress-dot {
          display: flex;
          height: 40px;
          width: 40px;
          flex: 0 0 40px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: white;
          font-size: 9px;
          font-weight: 900;
          color: rgba(23,23,23,.45);
          transition: background .24s ease, color .24s ease;
        }

        .v38-progress-step.is-complete .v38-progress-dot {
          background: #F4E5AF;
          color: #7D5B08;
        }

        .v38-progress-step.is-active .v38-progress-dot {
          background: #D4AF37;
          color: #171717;
        }

        .v38-progress-label {
          min-width: 0;
          max-width: 0;
          overflow: hidden;
          margin-left: 0;
          opacity: 0;
          white-space: nowrap;
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: .055em;
          text-transform: uppercase;
          transition: max-width .28s cubic-bezier(.22,1,.36,1), margin-left .28s cubic-bezier(.22,1,.36,1), opacity .18s ease;
        }

        .v38-progress-step.is-active .v38-progress-label,
        .v38-progress-step:hover .v38-progress-label,
        .v38-progress-step:focus-visible .v38-progress-label {
          max-width: 92px;
          margin-left: 8px;
          opacity: 1;
        }

        @media (max-width: 1279px) {
          .v38-progress-dock {
            left: auto;
            right: 8px;
            top: 46%;
          }
          .v38-progress-step:hover:not(:disabled),
          .v38-progress-step:focus-visible:not(:disabled) {
            transform: translateX(-2px);
          }
        }

        @media (max-width: 767px) {
          .v38-progress-dock {
            right: 6px;
            top: 50%;
            gap: 6px;
          }
          .v38-progress-dock::before { left: 18px; }
          .v38-progress-step {
            width: 36px;
            height: 36px;
          }
          .v38-progress-dot {
            width: 34px;
            height: 34px;
            flex-basis: 34px;
            font-size: 8px;
          }
          .v38-progress-step.is-active {
            width: 36px;
          }
          .v38-progress-step.is-active .v38-progress-label {
            max-width: 0;
            margin-left: 0;
            opacity: 0;
          }
          .v38-progress-step:hover,
          .v38-progress-step:focus-visible,
          .v38-progress-step.is-active:hover,
          .v38-progress-step.is-active:focus-visible {
            width: 118px;
          }
          .v38-progress-step:hover .v38-progress-label,
          .v38-progress-step:focus-visible .v38-progress-label,
          .v38-progress-step.is-active:hover .v38-progress-label,
          .v38-progress-step.is-active:focus-visible .v38-progress-label {
            max-width: 72px;
            margin-left: 7px;
            opacity: 1;
          }
        }



        /* V47 - BLACK BOTANICAL RIGID HAMPER (Tailwind utility driven) */
        @keyframes v47BoxDrop {
          0% { opacity: 0; transform: translateX(-50%) translateY(-190px) scale(.82); filter: blur(3px); }
          62% { opacity: 1; transform: translateX(-50%) translateY(12px) scale(1.025); filter: blur(0); }
          82% { transform: translateX(-50%) translateY(-5px) scale(.992); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); }
        }

        @keyframes v47LidOpen {
          0% { top: 38%; transform: translateX(-50%) perspective(1100px) rotateX(3deg) scale(1.015); }
          42% { top: 24%; transform: translateX(-50%) translateY(-10px) perspective(1100px) rotateX(9deg) scale(1.01); }
          76% { top: 1%; transform: translateX(-50%) translateY(-3px) perspective(1100px) rotateX(16deg) scale(.988); }
          100% { top: 3%; transform: translateX(-50%) perspective(1100px) rotateX(13deg) scale(.99); }
        }

        @keyframes v47InsideReveal {
          0% { opacity: 0; transform: scale(.96); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes v47GoldShine {
          0% { transform: translateX(-170%) skewX(-20deg); opacity: 0; }
          28% { opacity: .32; }
          62%, 100% { transform: translateX(350%) skewX(-20deg); opacity: 0; }
        }

        @keyframes v47BowFloat {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-2px) rotate(1deg); }
        }

        /* V48 - PROPORTION FIXED HINGED BLACK BOTANICAL BOX */
        @keyframes v50BoxDrop {
          0% { opacity: 0; transform: translateY(-260px) scale(.96); filter: blur(1px); }
          54% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          70% { transform: translateY(16px) scale(1.012); }
          84% { transform: translateY(-7px) scale(.998); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }

        @keyframes v48LidOpen {
          0% { transform: translateX(-50%) translateY(92%) perspective(1250px) rotateX(0deg) scale(1); }
          46% { transform: translateX(-50%) translateY(48%) perspective(1250px) rotateX(20deg) scale(1.005); }
          78% { transform: translateX(-50%) translateY(-2%) perspective(1250px) rotateX(51deg) scale(.987); }
          100% { transform: translateX(-50%) translateY(0) perspective(1250px) rotateX(48deg) scale(.99); }
        }

        @keyframes v48InsideReveal {
          0% { opacity: 0; transform: scale(.97); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes v48GoldSheen {
          0% { transform: translateX(-170%) skewX(-18deg); opacity: 0; }
          28% { opacity: .26; }
          62%, 100% { transform: translateX(390%) skewX(-18deg); opacity: 0; }
        }

        @keyframes v48BowSettle {
          0% { opacity: 0; transform: translateX(-50%) translateY(-7px) scale(.92); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .v7-reveal, .v7-glow, .v7-spark, .v7-decoration, .v9-svg-box, .v9-svg-item, .v13-modal-backdrop, .v13-modal-panel,
          .v20-box-world, .v20-box-lid, .v20-pack-item, .v20-pack-card, .v20-packing-toast,
          .v20-decor-band, .v20-decor-band-v, .v20-packed-glow, .v20-filler span, .v30-step-in {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <section className="mx-auto w-full max-w-[1920px] px-3 sm:px-5 lg:px-6 xl:px-7 2xl:px-8">
        <div
          ref={mobileFlowRef}
          className="mb-2 grid scroll-mt-[76px] grid-cols-1 gap-2 sm:mb-4 sm:scroll-mt-[108px] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
        >
          <h1
            style={{ fontFamily: DISPLAY_FONT }}
            className="min-w-0 text-[28px] font-semibold leading-[.96] tracking-[-.04em] text-[#171717] sm:col-start-1 sm:text-[34px] lg:text-[38px]"
          >
            Build your hamper
          </h1>

          <div className="justify-self-start sm:col-start-2 sm:row-start-1 sm:justify-self-center">
            {isEditingCartHamper ? (
              <span className="inline-flex h-9 items-center rounded-full border border-black/[0.08] bg-white px-3 text-[11px] font-bold text-black/55">
                Editing hamper
              </span>
            ) : (
              <OrderModeChooser
                mode={orderMode}
                onChange={(nextMode) => {
                  setOrderMode(nextMode);
                  setCartError("");
                }}
              />
            )}
          </div>

          <div aria-hidden="true" className="hidden sm:block sm:col-start-3 sm:row-start-1" />
        </div>

        <V30Progress
          step={mobileStep}
          orderMode={orderMode}
          canContinueFromBox={canContinueFromBox}
          canContinueFromProducts={canContinueFromProducts}
          onStepChange={moveMobileStep}
        />

        {(editError || error) && (
          <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
            {editError || error}
          </div>
        )}

        <div className="mt-2 grid min-w-0 gap-5 sm:mt-4 xl:grid-cols-[minmax(0,1fr)_410px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_460px] 2xl:gap-6">
          <div className="min-w-0">
            {mobileStep === 1 && (
              <V30Panel
                number="01"
                eyebrow="Start with the base"
                title="Choose your hamper box"
                meta={selectedContainer ? selectedContainer.name : "Choose one box"}
              >
                {containers.length === 0 ? (
                  <V7Empty>No custom hamper boxes are available right now.</V7Empty>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {containers.map((container) => (
                      <div key={container._id} className="min-w-0">
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

                            // Box selection is the end of step 1. Move straight
                            // into gifts behind the HAMPORIUM ribbon transition.
                            moveMobileStep(2);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <V30StepActions
                  nextLabel="Add gifts"
                  nextDisabled={!canContinueFromBox}
                  onNext={() => moveMobileStep(2)}
                  hint={selectedContainer ? `${selectedContainer.name} selected` : "Select one box to continue."}
                />
              </V30Panel>
            )}

            {mobileStep === 2 && (
              <V34GiftWorkspace
                number="02"
                eyebrow="Curate the inside"
                title="Add your gifts"
                meta={selectedItemCount ? `${selectedItemCount} selected` : "Choose your favourites"}
              >
                <V30MobileLivePreview
                  selectedContainer={selectedContainer}
                  previewItems={previewItems}
                  previewDecorations={previewDecorations}
                  selectedItemCount={selectedItemCount}
                  selectedDecorationCount={selectedDecorationCount}
                  fillPercent={displayFillPercent}
                  configuration={configuration}
                  canIncreaseAnyItem={canIncreaseAnyItem}
                  validating={validating || selectionPending}
                  journeyState={deliveryJourney}
                />

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full shrink-0 sm:w-[220px] lg:w-[250px] xl:w-[230px] 2xl:w-[260px]">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-black/24">⌕</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search gifts"
                      className="h-11 w-full rounded-full border border-black/[0.07] bg-white pl-10 pr-4 text-[16px] font-semibold text-[#171717] outline-none transition placeholder:text-black/35 focus:border-[#F47822]/55 focus:ring-4 focus:ring-[#F47822]/[0.06] sm:h-10 sm:text-[13px]"
                    />
                  </div>

                  <div className="v30-scrollbar-none min-w-0 flex-1 overflow-x-auto">
                    <div className="flex w-max items-center gap-2 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter("");
                          setSubcategoryFilter("");
                        }}
                        className={`shrink-0 rounded-full border px-3.5 py-2.5 text-[13px] font-extrabold transition sm:py-2 sm:text-[12px] ${
                          !categoryFilter && !subcategoryFilter
                            ? "border-[#171717] bg-[#171717] text-white"
                            : "border-black/[0.08] bg-white text-black/55 hover:border-black/20 hover:text-[#171717]"
                        }`}
                      >
                        All
                      </button>

                      {categories.slice(0, 8).map((category) => (
                        <button
                          key={`category-${category}`}
                          type="button"
                          onClick={() => {
                            setCategoryFilter(category);
                            setSubcategoryFilter("");
                          }}
                          className={`shrink-0 rounded-full border px-3.5 py-2.5 text-[13px] font-extrabold transition sm:py-2 sm:text-[12px] ${
                            categoryFilter === category && !subcategoryFilter
                              ? "border-[#171717] bg-[#171717] text-white"
                              : "border-black/[0.08] bg-white text-black/55 hover:border-black/20 hover:text-[#171717]"
                          }`}
                        >
                          {category}
                        </button>
                      ))}

                      {subcategories.map((subcategory) => (
                        <button
                          key={`subcategory-${subcategory}`}
                          type="button"
                          onClick={() => setSubcategoryFilter(subcategory)}
                          className={`shrink-0 rounded-full border px-3.5 py-2.5 text-[13px] font-extrabold transition sm:py-2 sm:text-[12px] ${
                            subcategoryFilter === subcategory
                              ? "border-[#F47822] bg-[#FFF4EC] text-[#D85E0F]"
                              : "border-black/[0.08] bg-white text-black/55 hover:border-[#F47822]/35 hover:text-[#D85E0F]"
                          }`}
                        >
                          {subcategory}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>


                {visibleComponents.length === 0 ? (
                  <V7Empty>This box has reached its practical limit. Remove an item or choose a larger box.</V7Empty>
                ) : (
                  <div
                    data-hamper-products-grid="true"
                    className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4 2xl:grid-cols-5"
                  >
                    {paginatedComponents.map((component) => {
                      const quantity = selectedMap.get(component._id) || 0;
                      const candidate = candidateMap.get(String(component._id));
                      const missingPrice = component.sellingPrice === null || component.sellingPrice === undefined;
                      const builderBlocked = component.builderStatus?.selectable === false;
                      const cannotAddMore = Boolean(
                        builderBlocked ||
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
                          locked={missingPrice || builderBlocked || cannotAddMore}
                          checking={validating || selectionPending}
                          fitLeft={Number(candidate?.maxAdditionalQuantity || 0)}
                          recommendation={
                            cannotAddMore ? null : component.recommendation || null
                          }
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
                    compact
                  />
                )}

                <V30StepActions
                  backLabel="Box"
                  nextLabel="Finishing touches"
                  nextDisabled={!canContinueFromProducts}
                  onBack={() => moveMobileStep(1)}
                  onNext={() => moveMobileStep(3)}
                  hint={selectedItemCount ? `${selectedItemCount} gift${selectedItemCount === 1 ? "" : "s"} in your hamper` : "Add at least one gift to continue."}
                />
              </V34GiftWorkspace>
            )}

            {mobileStep === 3 && (
              <V30Panel
                number="03"
                eyebrow="Optional finish"
                title="Add the finishing touch"
                meta={selectedDecorationCount ? `${selectedDecorationCount} selected` : "Optional"}
              >
                {decorativeComponents.length > 0 && (
                  <div className="relative max-w-md">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-black/25">⌕</span>
                    <input
                      value={decorationSearch}
                      onChange={(event) => setDecorationSearch(event.target.value)}
                      placeholder="Search ribbon, flowers, tags…"
                      className="h-11 w-full rounded-full border border-[#D4AF37]/18 bg-[#FFFCF6] pl-9 pr-4 text-[11px] font-semibold outline-none transition focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/8"
                    />
                  </div>
                )}

                {visibleDecorations.length === 0 ? (
                  <V7Empty>No decorative finishes are available yet.</V7Empty>
                ) : (
                  <div
                    data-hamper-decorations-grid="true"
                    className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4 2xl:grid-cols-5"
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

                <V30StepActions
                  backLabel="Gifts"
                  nextLabel={selectedDecorationCount ? "Personalise" : "Skip & personalise"}
                  onBack={() => moveMobileStep(2)}
                  onNext={() => moveMobileStep(4)}
                  hint={selectedDecorationCount ? `${selectedDecorationCount} finishing touch${selectedDecorationCount === 1 ? "" : "es"} selected` : "Finishing touches are optional."}
                />
              </V30Panel>
            )}

            {mobileStep === 4 && (
              <V30Panel
                number="04"
                eyebrow="Make it personal"
                title="Personalise only what matters"
                meta={personalizationPayload ? "Personalisation added" : "Optional"}
              >
                <div className="space-y-3">
                  <details className="v30-details group rounded-[18px] border border-black/[0.07] bg-[#FBF9F5]" open={personalization.assets.length > 0}>
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 sm:px-5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-[#171717]">Artwork / logo</p>
                      </div>
                      <span className="v30-details-arrow flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[18px] leading-none text-black/40 transition-transform duration-300">+</span>
                    </summary>

                    <div className="border-t border-black/[0.06] px-4 pb-5 pt-4 sm:px-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className="mb-1.5 block text-[12px] font-black uppercase tracking-[0.08em] text-black/32">Artwork type</span>
                          <select value={assetType} onChange={(event) => setAssetType(event.target.value)} className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[11px] font-bold outline-none focus:border-[#D4AF37]">
                            {PERSONALIZATION_ASSET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span className="mb-1.5 block text-[12px] font-black uppercase tracking-[0.08em] text-black/32">Placement</span>
                          <select value={assetPlacement} onChange={(event) => setAssetPlacement(event.target.value)} className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[11px] font-bold outline-none focus:border-[#D4AF37]">
                            {PERSONALIZATION_PLACEMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                      </div>

                      <input
                        value={assetNotes}
                        maxLength={500}
                        onChange={(event) => setAssetNotes(event.target.value)}
                        placeholder="Placement note (optional)"
                        className="mt-3 h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[11px] font-semibold outline-none focus:border-[#D4AF37]"
                      />

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {user ? (
                          <label className={`inline-flex h-11 cursor-pointer items-center justify-center rounded-xl px-4 text-[11px] font-black uppercase tracking-[0.08em] text-white transition ${uploadingAsset || personalization.assets.length >= 4 ? "pointer-events-none bg-black/25" : "bg-[#171717] hover:bg-[#9A7316]"}`}>
                            {uploadingAsset ? "Uploading…" : "Upload image"}
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingAsset || personalization.assets.length >= 4} onChange={handlePersonalizationUpload} className="hidden" />
                          </label>
                        ) : (
                          <button type="button" onClick={() => navigateWithRibbon("/login")} className="h-11 rounded-xl bg-[#171717] px-4 text-[11px] font-black uppercase tracking-[0.08em] text-white">Login to upload</button>
                        )}
                        <span className="text-[11px] font-semibold text-black/30">{personalization.assets.length}/4 images · max 5 MB</span>
                      </div>

                      {personalizationError && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{personalizationError}</p>}

                      {personalization.assets.length > 0 && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {personalization.assets.map((asset, index) => (
                            <div key={asset.publicId || `${asset.url}-${index}`} className="rounded-[14px] border border-black/[0.07] bg-white p-3">
                              <div className="flex gap-3">
                                <img src={asset.url} alt={asset.fileName || "Personalization artwork"} className="h-16 w-16 shrink-0 rounded-lg bg-[#F6F2EC] object-contain p-1" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-black">{asset.fileName || personalizationLabel(asset.type, PERSONALIZATION_ASSET_OPTIONS)}</p>
                                  <select value={asset.placement || "top_lid"} onChange={(event) => updatePersonalizationAsset(index, "placement", event.target.value)} className="mt-2 h-8 w-full rounded-lg border border-black/[0.07] bg-[#FAF8F5] px-2 text-[11px] font-bold outline-none">
                                    {PERSONALIZATION_PLACEMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                  </select>
                                  <input
                                    value={asset.notes || ""}
                                    maxLength={500}
                                    onChange={(event) => updatePersonalizationAsset(index, "notes", event.target.value)}
                                    placeholder="Placement details"
                                    className="mt-2 h-8 w-full rounded-lg border border-black/[0.07] bg-[#FAF8F5] px-2 text-[11px] font-semibold outline-none"
                                  />
                                </div>
                                <button type="button" onClick={() => removePersonalizationAsset(index)} className="h-8 shrink-0 rounded-lg bg-red-50 px-2 text-[12px] font-black text-red-600">Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>

                  <details className="v30-details group rounded-[18px] border border-black/[0.07] bg-[#FBF9F5]" open={Boolean(personalization.message)}>
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 sm:px-5">
                      <div>
                        <p className="text-[11px] font-black text-[#171717]">Gift message</p>
                      </div>
                      <span className="v30-details-arrow flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[18px] text-black/40 transition-transform duration-300">+</span>
                    </summary>
                    <div className="border-t border-black/[0.06] px-4 pb-5 pt-4 sm:px-5">
                      <textarea rows="3" maxLength={500} value={personalization.message} onChange={(event) => setPersonalization((current) => ({ ...current, message: event.target.value }))} placeholder="e.g. Happy Anniversary, A & R" className="w-full resize-none rounded-xl border border-black/[0.08] bg-white p-3 text-[11px] font-semibold leading-5 outline-none focus:border-[#D4AF37]" />
                      <span className="mt-1 block text-right text-[12px] font-bold text-black/24">{personalization.message.length}/500</span>
                    </div>
                  </details>

                  <details className="v30-details group rounded-[18px] border border-black/[0.07] bg-[#FBF9F5]" open={Boolean(personalization.instructions)}>
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 sm:px-5">
                      <div>
                        <p className="text-[11px] font-black text-[#171717]">Packing notes</p>
                      </div>
                      <span className="v30-details-arrow flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[18px] text-black/40 transition-transform duration-300">+</span>
                    </summary>
                    <div className="border-t border-black/[0.06] px-4 pb-5 pt-4 sm:px-5">
                      <textarea rows="4" maxLength={1500} value={personalization.instructions} onChange={(event) => setPersonalization((current) => ({ ...current, instructions: event.target.value }))} placeholder="e.g. ivory ribbon, small logo, no plastic wrap" className="w-full resize-none rounded-xl border border-black/[0.08] bg-white p-3 text-[11px] font-semibold leading-5 outline-none focus:border-[#D4AF37]" />
                      <span className="mt-1 block text-right text-[12px] font-bold text-black/24">{personalization.instructions.length}/1500</span>
                    </div>
                  </details>
                </div>

                <V30StepActions
                  backLabel="Finishing"
                  nextLabel={orderMode === "bulk" ? "Quote details" : "Review hamper"}
                  onBack={() => moveMobileStep(3)}
                  onNext={() => moveMobileStep(5)}
                  hint={personalizationPayload ? "Personalisation saved to this hamper." : "Personalisation is optional."}
                />
              </V30Panel>
            )}

            {mobileStep === 5 && orderMode === "bulk" && (
              <V30Panel
                number="05"
                eyebrow="Final step"
                title="Tell us about the bulk order"
                meta={`${Number(bulkQuantity || 0).toLocaleString("en-IN")} hampers`}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <BulkField label="Bulk quantity *">
                    <input type="number" min="1" max="100000" value={bulkQuantity} onChange={(event) => setBulkQuantity(event.target.value)} className="h-11 w-full rounded-xl border border-black/[0.08] bg-[#FAF8F5] px-3 text-[11px] font-bold outline-none focus:border-[#D4AF37] focus:bg-white" />
                  </BulkField>
                  <BulkField label="Required by *">
                    <input type="date" min={getToday()} value={bulkRequiredDate} onChange={(event) => setBulkRequiredDate(event.target.value)} className="h-11 w-full rounded-xl border border-black/[0.08] bg-[#FAF8F5] px-3 text-[11px] font-bold outline-none focus:border-[#D4AF37] focus:bg-white" />
                  </BulkField>
                  <BulkField label="Purpose">
                    <select value={bulkPurpose} onChange={(event) => setBulkPurpose(event.target.value)} className="h-11 w-full rounded-xl border border-black/[0.08] bg-[#FAF8F5] px-3 text-[11px] font-bold outline-none focus:border-[#D4AF37] focus:bg-white">
                      {BULK_PURPOSE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </BulkField>
                  <BulkField label="Delivery model">
                    <select value={bulkAddressModel} onChange={(event) => setBulkAddressModel(event.target.value)} className="h-11 w-full rounded-xl border border-black/[0.08] bg-[#FAF8F5] px-3 text-[11px] font-bold outline-none focus:border-[#D4AF37] focus:bg-white">
                      <option value="not_decided">Not decided yet</option>
                      <option value="single_address">Single address</option>
                      <option value="multiple_addresses">Multiple addresses</option>
                    </select>
                  </BulkField>
                  <BulkField label="Company / organisation">
                    <input value={bulkCompanyName} maxLength={200} onChange={(event) => setBulkCompanyName(event.target.value)} placeholder="Optional" className="h-11 w-full rounded-xl border border-black/[0.08] bg-[#FAF8F5] px-3 text-[11px] font-semibold outline-none focus:border-[#D4AF37] focus:bg-white" />
                  </BulkField>
                  <BulkField label="GSTIN">
                    <input value={bulkGstNumber} maxLength={40} onChange={(event) => setBulkGstNumber(event.target.value.toUpperCase())} placeholder="Optional" className="h-11 w-full rounded-xl border border-black/[0.08] bg-[#FAF8F5] px-3 text-[11px] font-semibold uppercase outline-none focus:border-[#D4AF37] focus:bg-white" />
                  </BulkField>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <BulkField label="Delivery locations">
                    <textarea rows="4" value={bulkDeliveryLocations} onChange={(event) => setBulkDeliveryLocations(event.target.value)} placeholder="City, office, venue or one location per line." className="w-full resize-none rounded-xl border border-black/[0.08] bg-[#FAF8F5] p-3 text-[11px] font-semibold leading-5 outline-none focus:border-[#D4AF37] focus:bg-white" />
                  </BulkField>
                  <BulkField label="Anything else for the quotation">
                    <textarea rows="4" maxLength={2000} value={bulkNotes} onChange={(event) => setBulkNotes(event.target.value)} placeholder="Delivery split, branding expectation, timeline or commercial note." className="w-full resize-none rounded-xl border border-black/[0.08] bg-[#FAF8F5] p-3 text-[11px] font-semibold leading-5 outline-none focus:border-[#D4AF37] focus:bg-white" />
                  </BulkField>
                </div>

                <div className="mt-5 xl:hidden">
                  <V7Studio
                    selectedContainer={selectedContainer}
                    previewItems={previewItems}
                    previewDecorations={previewDecorations}
                    selectedItemCount={selectedItemCount}
                    selectedDecorationCount={selectedDecorationCount}
                    fillPercent={displayFillPercent}
                    configuration={configuration}
                    personalization={personalizationPayload}
                    canIncreaseAnyItem={canIncreaseAnyItem}
                    validating={validating || selectionPending}
                    cartError={cartError}
                    canAddToCart={canPrimaryAction}
                    addingToCart={primaryBusy}
                    deliveryJourney={deliveryJourney}
                    user={user}
                    isEditingCartHamper={isEditingCartHamper}
                    orderMode={orderMode}
                    bulkQuantity={Number(bulkQuantity || 0)}
                    onModeChange={(nextMode) => { setOrderMode(nextMode); setCartError(""); }}
                    onAddToCart={handleRequestQuotation}
                  />
                </div>

                <V30StepActions backLabel="Personalise" onBack={() => moveMobileStep(4)} hint="Review the live hamper and submit the quotation from the summary." />
              </V30Panel>
            )}

            {mobileStep === 5 && orderMode !== "bulk" && (
              <V30Panel
                number="05"
                eyebrow="Final check"
                title={isEditingCartHamper ? "Review your changes" : "Review your hamper"}
                meta={
                  configuration?.orderable
                    ? isEditingCartHamper
                      ? "Ready to save"
                      : "Ready to add"
                    : "Review required"
                }
              >
                <div className="grid gap-2 sm:grid-cols-4">
                  <V30ReviewStat label="Box" value={selectedContainer?.name || "Not selected"} />
                  <V30ReviewStat label="Gifts" value={String(selectedItemCount)} />
                  <V30ReviewStat label="Gift fill" value={`${Math.round(displayFillPercent)}%`} />
                  <V30ReviewStat label="Personalisation" value={personalizationPayload ? "Added" : "None"} />
                </div>

                <div className="mt-5 xl:hidden">
                  <V7Studio
                    selectedContainer={selectedContainer}
                    previewItems={previewItems}
                    previewDecorations={previewDecorations}
                    selectedItemCount={selectedItemCount}
                    selectedDecorationCount={selectedDecorationCount}
                    fillPercent={displayFillPercent}
                    configuration={configuration}
                    personalization={personalizationPayload}
                    canIncreaseAnyItem={canIncreaseAnyItem}
                    validating={validating || selectionPending}
                    cartError={cartError}
                    canAddToCart={canPrimaryAction}
                    addingToCart={primaryBusy}
                    deliveryJourney={deliveryJourney}
                    user={user}
                    isEditingCartHamper={isEditingCartHamper}
                    orderMode={orderMode}
                    bulkQuantity={Number(bulkQuantity || 0)}
                    onModeChange={(nextMode) => { setOrderMode(nextMode); setCartError(""); }}
                    onAddToCart={handleAddToCart}
                  />
                </div>

                <V30StepActions backLabel="Personalise" onBack={() => moveMobileStep(4)} hint={isEditingCartHamper ? "Review the changes, then save the same cart hamper from the summary." : "Your live hamper summary is ready."} />
              </V30Panel>
            )}
          </div>

          <aside className="hidden xl:block xl:w-[410px] 2xl:w-[460px]" aria-label="Live hamper preview">
            <div
              className="v31-studio-compact v30-scrollbar-none fixed top-[88px] z-30 max-h-[calc(100vh-104px)] w-[410px] overflow-y-auto overscroll-contain pr-1 2xl:w-[460px]"
              style={{
                right: "max(1.75rem, calc((100vw - 1920px) / 2 + 1.75rem))",
              }}
            >
              <V7Studio
                selectedContainer={selectedContainer}
                previewItems={previewItems}
                previewDecorations={previewDecorations}
                selectedItemCount={selectedItemCount}
                selectedDecorationCount={selectedDecorationCount}
                fillPercent={displayFillPercent}
                configuration={configuration}
                personalization={personalizationPayload}
                canIncreaseAnyItem={canIncreaseAnyItem}
                validating={validating || selectionPending}
                cartError={cartError}
                canAddToCart={canPrimaryAction}
                addingToCart={primaryBusy}
                deliveryJourney={deliveryJourney}
                user={user}
                isEditingCartHamper={isEditingCartHamper}
                orderMode={orderMode}
                bulkQuantity={Number(bulkQuantity || 0)}
                onModeChange={(nextMode) => {
                  setOrderMode(nextMode);
                  setCartError("");
                }}
                onAddToCart={orderMode === "bulk" ? handleRequestQuotation : handleAddToCart}
              />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
};

const V30Progress = ({
  step,
  orderMode,
  canContinueFromBox,
  canContinueFromProducts,
  onStepChange,
}) => {
  const steps = [
    [1, "Choose box"],
    [2, "Add gifts"],
    [3, "Finishing"],
    [4, "Personalise"],
    [5, orderMode === "bulk" ? "Get quote" : "Review"],
  ];

  const maxReachable = !canContinueFromBox ? 1 : !canContinueFromProducts ? 2 : 5;

  return (
    <nav
      className="mb-3 flex flex-wrap items-center gap-2 py-0.5 sm:mb-5 sm:py-1"
      aria-label="Hamper builder progress"
    >
      {steps.map(([number, label]) => {
        const active = step === number;
        const complete = step > number;
        const disabled = number > maxReachable;

        return (
          <button
            key={number}
            type="button"
            disabled={disabled}
            onClick={() => onStepChange(number)}
            aria-current={active ? "step" : undefined}
            aria-label={`${number}. ${label}${complete ? ", completed" : active ? ", current step" : ""}`}
            title={`${number}. ${label}`}
            className={`group/step flex h-8 w-8 items-center overflow-hidden rounded-full border transition-[width,border-color,background-color,color,box-shadow] duration-300 ease-out hover:w-[124px] focus-visible:w-[124px] focus-visible:outline-none sm:h-9 sm:w-9 sm:hover:w-[132px] sm:focus-visible:w-[132px] ${
              active
                ? "border-[#171717] bg-[#171717] text-white shadow-[0_5px_16px_rgba(0,0,0,.10)]"
                : complete
                  ? "border-[#D4AF37]/35 bg-[#FFF8DE] text-[#8A6815]"
                  : "border-black/[0.08] bg-white text-black/45 hover:border-black/15 hover:text-[#171717]"
            } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:w-8 sm:disabled:hover:w-9`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[10px] font-black sm:h-9 sm:w-9 sm:text-[11px]">
              {complete ? "✓" : number}
            </span>
            <span className="pointer-events-none mr-3 whitespace-nowrap text-[11px] font-extrabold opacity-0 transition-opacity duration-200 group-hover/step:opacity-100 group-focus-visible/step:opacity-100">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

const V34GiftWorkspace = ({ title, children }) => (
  <section className="v34-gift-workspace min-w-0">
    <div className="mb-3 sm:mb-5">
      <h2
        style={{ fontFamily: DISPLAY_FONT }}
        className="text-[25px] font-semibold leading-[1.02] tracking-[-.03em] text-[#171717] sm:text-[32px]"
      >
        {title}
      </h2>
    </div>
    <div>{children}</div>
  </section>
);

const V30Panel = ({ title, children }) => (
  <section className="v30-panel-mobile-sticky-safe v30-step-in min-w-0">
    <div className="mb-3 sm:mb-5">
      <h2
        style={{ fontFamily: DISPLAY_FONT }}
        className="text-[25px] font-semibold leading-[1.02] tracking-[-.03em] text-[#171717] sm:text-[32px]"
      >
        {title}
      </h2>
    </div>
    <div>{children}</div>
  </section>
);

const V30StepActions = ({
  backLabel = "Back",
  nextLabel,
  nextDisabled = false,
  onBack,
  onNext,
}) => (
  <div className="v30-mobile-sticky-actions mt-5 pt-1">
    <div className={`grid gap-2 sm:ml-auto sm:w-fit ${
      onBack && nextLabel
        ? "grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[100px_170px]"
        : "grid-cols-1"
    }`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[13px] font-black text-black/55 transition hover:border-black/20 hover:text-[#171717] active:scale-[.98] sm:text-[11px]"
        >
          ← {backLabel}
        </button>
      )}
      {nextLabel && (
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="h-11 rounded-xl bg-[#171717] px-4 text-[13px] font-black text-white transition hover:bg-[#9A7316] active:scale-[.99] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25 sm:text-[11px]"
        >
          {nextLabel} →
        </button>
      )}
    </div>
  </div>
);

const V30MobileLivePreview = (props) => {
  const giftCount = Number(props.selectedItemCount || 0);
  const roundedFill = Math.round(Number(props.fillPercent || 0));
  const liveTotal =
    props.configuration?.pricing?.total ??
    props.selectedContainer?.sellingPrice ??
    null;

  return (
    <section className="v30-mobile-live md:hidden" aria-label="Live hamper preview">
      <V7OpenTop3D {...props} compact />

      <div className="v61-mobile-mini-stats">
        <div className="v61-mobile-mini-stat">
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-black/38">Gifts</p>
          <p className="mt-0.5 text-[15px] font-black leading-none text-[#171717]">{giftCount}</p>
        </div>

        <div className="v61-mobile-mini-stat">
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-black/38">Filled</p>
          <p className="mt-0.5 text-[15px] font-black leading-none text-[#171717]">{roundedFill}%</p>
        </div>

        <div className="v61-mobile-mini-stat text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-black/38">Total</p>
          <p
            style={{ fontFamily: DISPLAY_FONT }}
            className="mt-0.5 truncate text-[18px] font-semibold leading-none text-[#F47822]"
          >
            {liveTotal === null || liveTotal === undefined
              ? "—"
              : formatCurrency(liveTotal)}
          </p>
        </div>
      </div>
    </section>
  );
};

const V30ReviewStat = ({ label, value }) => (
  <div className="min-w-0 border-b border-black/[0.06] px-1 py-3">
    <p className="text-[12px] font-bold text-black/35">{label}</p>
    <p className="mt-1 truncate text-[11px] font-black text-[#171717]" title={value}>{value}</p>
  </div>
);

const OrderModeChooser = ({ mode, onChange }) => (
  <div className="inline-grid w-[286px] max-w-full grid-cols-2 rounded-xl border border-black/[0.07] bg-white p-1 sm:w-[260px]">
    <button
      type="button"
      onClick={() => onChange("personal")}
      className={`h-9 rounded-lg px-4 text-[12px] font-black transition ${
        mode === "personal"
          ? "bg-[#171717] text-white"
          : "text-black/40 hover:text-[#171717]"
      }`}
    >
      Personal
    </button>
    <button
      type="button"
      onClick={() => onChange("bulk")}
      className={`h-9 rounded-lg px-4 text-[12px] font-black transition ${
        mode === "bulk"
          ? "bg-[#171717] text-white"
          : "text-black/40 hover:text-[#171717]"
      }`}
    >
      Bulk / Event
    </button>
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
          <span className="text-[12px] font-black uppercase tracking-[0.11em] text-[#F47822]">
            Step {String(step).padStart(2, "0")} / 05
          </span>
          <p className="mt-0.5 truncate text-[11px] font-black text-[#171717]">
            {labels[step - 1]}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#F7F1E7] px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.07em] text-[#8A6815]">
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
        <p className="mb-3 text-[12px] font-semibold leading-4 text-black/40">
          {hint}
        </p>
      )}

      <div className={`grid gap-2.5 ${onBack ? "grid-cols-[92px_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-black/[0.09] bg-[#FAF8F5] px-3 text-[12px] font-black text-black/52 transition active:scale-[.98]"
          >
            ← {backLabel}
          </button>
        )}

        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-center text-[12px] font-black uppercase tracking-[0.055em] text-white shadow-[0_10px_24px_rgba(23,23,23,.14)] transition active:scale-[.99] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25 disabled:shadow-none"
        >
          <span className="truncate">{nextLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  </div>
);

const MobileLiveHamperStatus = ({
  selectedItemCount,
  fillPercent,
  configuration,
  selectedContainer,
}) => {
  const roundedFill = Math.round(Number(fillPercent || 0));
  const liveTotal =
    configuration?.pricing?.total ??
    selectedContainer?.sellingPrice ??
    null;

  return (
    <div className="mb-3 grid grid-cols-3 divide-x divide-black/[0.06] rounded-[14px] border border-black/[0.06] bg-white md:hidden">
      <div className="px-3 py-2.5">
        <span className="text-[11px] font-black text-[#171717]">{selectedItemCount}</span>
        <span className="ml-1 text-[11px] font-semibold text-black/35">gifts</span>
      </div>
      <div className="px-3 py-2.5 text-center">
        <span className="text-[11px] font-black text-[#171717]">{roundedFill}%</span>
        <span className="ml-1 text-[11px] font-semibold text-black/35">full</span>
      </div>
      <div className="min-w-0 px-3 py-2.5 text-right">
        <span className="truncate text-[11px] font-black text-[#F47822]">
          {liveTotal === null || liveTotal === undefined ? "—" : formatCurrency(liveTotal)}
        </span>
      </div>
    </div>
  );
};

const BulkField = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-black/35">
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
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${
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
            <p className="mt-1 truncate text-[11px] font-semibold text-black/34 sm:hidden">
              {meta}
            </p>
          )}
        </div>
      </div>

      <span className="hidden shrink-0 text-[11px] font-black uppercase tracking-[0.1em] text-black/26 sm:block">
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
  const builderReady = container.builderStatus?.selectable !== false;
  const builderReasons = Array.isArray(container.builderStatus?.reasons)
    ? container.builderStatus.reasons
    : [];

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
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#F47822]">
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
                    <p className="text-[11px] font-black uppercase tracking-[0.11em] text-black/30">
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
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                      ✓ Selected
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6 lg:p-7">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[12px] font-black uppercase tracking-[0.13em] text-[#9A7316]">
                    Box information
                  </p>
                  <span className="text-[11px] font-semibold text-black/28">
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

                {!builderReady && (
                  <div className="mt-5 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-amber-700">
                      Data pending for Custom Hamper
                    </p>
                    <p className="mt-1.5 text-[12px] font-semibold leading-5 text-amber-800/80">
                      {builderReasons.length
                        ? builderReasons.join(" · ")
                        : "This imported box is visible for review, but required builder data is incomplete."}
                    </p>
                  </div>
                )}

                {container.description && (
                  <div className="mt-5 rounded-[16px] bg-[#FAF8F5] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-black/32">
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
                className="h-11 rounded-[11px] border border-black/[0.09] bg-white px-5 text-[11px] font-black text-[#171717] transition hover:bg-[#FAF8F5]"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!active) onSelect();
                  onClose();
                }}
                className={`h-11 rounded-[11px] px-6 text-[12px] font-black transition ${
                  active
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "bg-[#F47822] text-white hover:bg-[#171717]"
                }`}
              >
                {active
                  ? builderReady
                    ? "✓ Selected box"
                    : "✓ Previewing box"
                  : builderReady
                    ? "Select this box"
                    : "Preview this box"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DetailModalPortal>
  );
};

const V7ContainerCard = ({ container, active, onClick }) => {
  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const hasPrice =
    container.sellingPrice !== null &&
    container.sellingPrice !== undefined;
  const builderReady = container.builderStatus?.selectable !== false;
  const builderReasons = Array.isArray(container.builderStatus?.reasons)
    ? container.builderStatus.reasons
    : [];
  const popularity = container.popularity || null;
  const popularityLabel = popularity?.label || "";
  const hamperSoldCount = Number(popularity?.soldCount || 0);

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

          {popularityLabel && (
            <span
              className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full border border-[#E9C861]/45 bg-[#171717]/92 px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.06em] text-[#F4D778] shadow-[0_7px_18px_rgba(0,0,0,.16)] backdrop-blur-sm"
              title={`${popularityLabel}${hamperSoldCount > 0 ? ` · ${hamperSoldCount} hampers chosen` : ""}`}
            >
              <span aria-hidden="true">★</span>
              {popularityLabel}
            </span>
          )}

          {!builderReady && (
            <span
              className={`absolute left-2.5 z-10 max-w-[78%] truncate rounded-full border border-amber-200 bg-amber-50/95 px-2.5 py-1 text-[12px] font-black text-amber-700 shadow-sm backdrop-blur-sm ${
                popularityLabel ? "top-10" : "top-2.5"
              }`}
              title={builderReasons.join(", ")}
            >
              Data pending: {builderReasons[0] || "builder setup incomplete"}
            </span>
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

            </div>

            <span className="shrink-0 text-[15px] font-black text-[#171717]">
              {hasPrice
                ? formatCurrency(
                    container.sellingPrice
                  )
                : "Price pending"}
            </span>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!active) onClick();
              }}
              className={`h-9 rounded-lg px-4 text-[11px] font-black transition active:scale-[.98] sm:text-[12px] ${
                active
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "bg-[#171717] text-white hover:bg-[#9A7316]"
              }`}
            >
              {active ? "✓ Selected" : builderReady ? "Select" : "Preview"}
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
    <span className="text-[12px] font-black uppercase tracking-[0.08em] text-black/28">
      {label}
    </span>
    <span
      className="truncate text-right text-[11px] font-extrabold text-black/58"
      title={value}
    >
      {value}
    </span>
  </div>
);

const V7ContainerMetric = ({ label, value }) => (
  <div className="min-w-0 rounded-[12px] border border-black/[0.055] bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(23,23,23,.02)]">
    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-black/25">
      {label}
    </p>
    <p className="mt-1 truncate text-[11px] font-extrabold text-black/60" title={value}>
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
    <p className="text-[11px] font-black uppercase tracking-[0.07em] text-black/34">
      {label}
    </p>
    <p
      className="mt-1 truncate text-[12px] font-extrabold text-black/60"
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
          <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#9B7616]/70">
            Best before / expiry
          </p>
          <p className="mt-1 truncate text-[11px] font-extrabold text-[#6D5313]">
            {hasExpiry ? formatDate(component.expiryDate) : "Not specified"}
          </p>
        </div>

        {hasShelfLife && (
          <span className="shrink-0 rounded-full bg-[#D4AF37]/12 px-2.5 py-1 text-[12px] font-black text-[#8A6815]">
            {component.shelfLifeDays} days
          </span>
        )}
      </div>

      {component.dietary && (
        <div className="border-t border-[#D4AF37]/12 px-3 py-2 text-[12px] font-bold text-[#8A6815]/75">
          {component.dietary}
        </div>
      )}
    </div>
  );
};

const V10QuickSpec = ({ label, value }) => (
  <div className="min-w-0 rounded-[9px] border border-black/[0.06] bg-[#FAF8F5] px-2 py-2">
    <p className="text-[12px] font-black uppercase tracking-[0.07em] text-black/35">
      {label}
    </p>
    <p
      className="mt-1 truncate text-[12px] font-extrabold text-black/62"
      title={value}
    >
      {value || "—"}
    </p>
  </div>
);

const V10DetailRow = ({ label, value, accent = false }) => (
  <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-b border-black/[0.055] py-3 last:border-b-0">
    <span className="text-[11px] font-black uppercase tracking-[0.08em] text-black/32">
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
  const builderBlocked = component.builderStatus?.selectable === false;
  const builderReasons = Array.isArray(component.builderStatus?.reasons)
    ? component.builderStatus.reasons
    : [];

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
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#F47822]">
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
                    <p className="text-[11px] font-black uppercase tracking-[0.11em] text-black/30">
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
                      <p className="mt-1 text-[11px] font-semibold text-black/34">
                        {taxLabel(component)}
                      </p>
                    )}
                  </div>

                  <span className="max-w-[46%] truncate rounded-full bg-white px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.08em] text-black/42">
                    {component.subcategory || component.category || "Gift"}
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6 lg:p-7">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[12px] font-black uppercase tracking-[0.13em] text-[#9A7316]">
                    Complete product information
                  </p>
                  <span className="text-[11px] font-semibold text-black/28">
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

                {builderBlocked && (
                  <div className="mt-5 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-amber-700">
                      Data pending for Custom Hamper
                    </p>
                    <p className="mt-1.5 text-[12px] font-semibold leading-5 text-amber-800/80">
                      {builderReasons.length
                        ? builderReasons.join(" · ")
                        : "This imported item is visible for review, but required builder data is incomplete."}
                    </p>
                  </div>
                )}

                {component.description && (
                  <div className="mt-5 rounded-[16px] bg-[#FAF8F5] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-black/32">
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
                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#8B6817]">
                        Food freshness
                      </p>
                      <p className="mt-1.5 text-[12px] font-semibold leading-5 text-black/48">
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
                <p className="text-[11px] font-black uppercase tracking-[0.1em] text-black/28">
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
                  className="h-11 flex-1 rounded-[11px] border border-black/[0.09] bg-white px-5 text-[11px] font-black text-[#171717] transition hover:bg-[#FAF8F5] sm:flex-none"
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
                    <span className="flex items-center justify-center border-x border-[#F47822]/15 text-[13px] font-black">
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
                    className="h-11 flex-1 rounded-[11px] bg-[#F47822] px-6 text-[12px] font-black text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25 sm:flex-none"
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
  recommendation = null,
  onMinus,
  onPlus,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const missingPrice =
    component.sellingPrice === null ||
    component.sellingPrice === undefined;
  const builderBlocked = component.builderStatus?.selectable === false;
  const builderReasons = Array.isArray(component.builderStatus?.reasons)
    ? component.builderStatus.reasons
    : [];
  const recommendationLabel =
    recommendation?.source === "container"
      ? Number(recommendation?.rank || 0) === 1
        ? "Top pick"
        : "Recommended"
      : recommendation?.source === "overall"
        ? "Popular"
        : "";
  const recommendationPickedCount = Number(recommendation?.pickedCount || 0);

  const cannotIncrease =
    checking || missingPrice || builderBlocked || locked || quantity >= 99;

  const hasMrp =
    !missingPrice &&
    component.mrp !== null &&
    component.mrp !== undefined &&
    Number(component.mrp) > Number(component.sellingPrice);

  const handleCardClick = (event) => {
    if (event.target.closest("button")) return;
    setDetailsOpen(true);
  };

  const actionLabel = checking
    ? "Checking"
    : missingPrice || builderBlocked
      ? "Pending"
      : Number(fitLeft || 0) <= 0
        ? "No fit"
        : "+ Add";

  return (
    <>
      <article
        onClick={handleCardClick}
        className={`group min-w-0 cursor-pointer rounded-[14px] border bg-white p-2 shadow-[0_7px_22px_rgba(45,31,17,.035)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(45,31,17,.075)] ${
          selected
            ? "border-[#F47822]/35 ring-2 ring-[#F47822]/70 ring-offset-2 ring-offset-[#F6F1E9]"
            : "border-black/[0.065] hover:border-[#D4AF37]/35"
        }`}
        aria-label={`${component.name}. Click for details.`}
      >
        <div className="relative overflow-hidden rounded-[11px] bg-[#F4EFE8]">
          <div className="aspect-[5/4]">
            {component.images?.[0]?.url ? (
              <img
                src={component.images[0].url}
                alt={component.name}
                className="h-full w-full object-contain p-1.5 transition duration-500 group-hover:scale-[1.035] sm:p-2"
              />
            ) : (
              <NoImage />
            )}
          </div>


          {recommendationLabel && !builderBlocked && (
            <span
              className="absolute left-1.5 top-1.5 z-10 max-w-[78%] truncate rounded-full border border-[#E7C65D]/45 bg-[#171717]/92 px-2.5 py-1 text-[12px] font-black text-[#F3D677] shadow-[0_6px_16px_rgba(0,0,0,.14)] backdrop-blur-sm sm:text-[12px]"
              title={`${recommendationLabel}${recommendationPickedCount > 0 ? ` · ${recommendationPickedCount} picked with this box` : ""}`}
            >
              ★ {recommendationLabel}
            </span>
          )}

          {selected && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-[#171717] px-2.5 py-1 text-[12px] font-black text-white shadow-lg sm:text-[12px]">
              ×{quantity}
            </span>
          )}

          {builderBlocked && (
            <span
              className="absolute left-1.5 top-1.5 max-w-[72%] truncate rounded-full border border-amber-200 bg-amber-50/95 px-2.5 py-1 text-[12px] font-black text-amber-700 shadow-sm backdrop-blur-sm sm:text-[12px]"
              title={builderReasons.join(", ")}
            >
              Data pending
            </span>
          )}
        </div>

        <div className="px-0.5 pb-0.5 pt-2">
          <p className="line-clamp-2 min-h-[40px] text-[14px] font-extrabold leading-[1.35] text-[#171717] sm:text-[14px]">
            {component.name}
          </p>


          <div className="mt-2 flex min-w-0 items-baseline gap-1.5 pt-1">
            <span className="truncate text-[16px] font-black text-[#171717] sm:text-[16px]">
              {missingPrice
                ? "Price pending"
                : formatCurrency(component.sellingPrice)}
            </span>
            {hasMrp && (
              <span className="hidden text-[11px] font-semibold text-black/30 line-through sm:inline">
                {formatCurrency(component.mrp)}
              </span>
            )}
          </div>

          <div
            className="mt-2 grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-1.5 sm:flex sm:items-center sm:gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDetailsOpen(true);
              }}
              className="flex h-9 min-w-0 items-center justify-center rounded-[9px] border border-black/[0.09] bg-white px-2 text-[12px] font-black text-black/60 transition hover:border-black/20 hover:bg-black/[0.025] hover:text-[#171717] sm:h-10 sm:min-w-[72px]"
              aria-label={`View details for ${component.name}`}
            >
              Details
            </button>

            {quantity > 0 ? (
              <div className="grid h-9 min-w-0 grid-cols-[30px_1fr_30px] overflow-hidden rounded-[9px] border border-[#F47822]/25 bg-[#FFF8F2] sm:h-10 sm:w-[102px] sm:grid-cols-[32px_1fr_32px]">
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

                <span className="flex items-center justify-center border-x border-[#F47822]/15 text-[12px] font-black">
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
                className="flex h-9 min-w-0 items-center justify-center rounded-[9px] bg-[#F47822] px-2 text-[12px] font-black text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:bg-black/[0.08] disabled:text-black/28 sm:h-10 sm:min-w-[78px]"
              >
                {actionLabel}
              </button>
            )}
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
  const builderBlocked = component.builderStatus?.selectable === false;
  const builderReasons = Array.isArray(component.builderStatus?.reasons)
    ? component.builderStatus.reasons
    : [];

  const cannotIncrease = missingPrice || builderBlocked || quantity >= 99;

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


          {selected && (
            <span className="absolute right-2 top-2 rounded-full bg-[#171717] px-2 py-1 text-[11px] font-black text-white shadow-lg">
              ×{quantity}
            </span>
          )}
        </div>

        <div className="pt-3">
          <p className="line-clamp-2 min-h-[30px] text-[12px] font-extrabold leading-[1.35] text-[#171717] sm:min-h-0 sm:truncate sm:text-[13px]">
            {component.name}
          </p>

          {builderBlocked && (
            <p
              className="mt-1.5 line-clamp-2 text-[11px] font-bold leading-4 text-amber-700"
              title={builderReasons.join(", ")}
            >
              Unavailable
            </p>
          )}

          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[13px] font-black text-[#9B7616] sm:text-[14px]">
              {missingPrice
                ? "Price pending"
                : formatCurrency(component.sellingPrice)}
            </p>
          </div>


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

            <span className="flex items-center justify-center border-x border-[#D4AF37]/15 text-[11px] font-black">
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
  deliveryJourney = "idle",
  user,
  isEditingCartHamper = false,
  orderMode = "personal",
  bulkQuantity = 0,
  onAddToCart,
}) => {
  const pricing = configuration?.pricing;
  const timing = configuration?.deliveryEstimate;
  const notReadyMessage =
    configuration && !configuration.orderable ? configuration.message : "";
  const roundedFill = Math.round(Number(fillPercent || 0));
  const unavailableCartMessage =
    /no longer available for custom gifting|inactive, unavailable for this channel|unavailable for custom hampers/i.test(
      String(cartError || "")
    )
      ? "One of the selected gifts or finishing touches changed availability. Update the selection once and try again."
      : cartError;

  return (
    <div className="v30-live-shell v34-live-flat min-w-0 xl:pl-1 2xl:pl-2">
      <div className="flex items-center justify-between gap-4 pb-2">
        <p style={{ fontFamily: DISPLAY_FONT }} className="text-[30px] font-semibold leading-none tracking-[-.025em] text-[#171717] sm:text-[32px]">Your hamper</p>
        <span className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] sm:text-[12px] ${
          deliveryJourney === "shipping"
            ? "bg-[#171717] text-white"
            : deliveryJourney === "packing"
              ? "bg-[#FFF0D9] text-[#9A5A15]"
              : validating
                ? "bg-black/[0.05] text-black/48"
                : configuration?.orderable
                  ? "bg-emerald-50 text-emerald-700"
                  : selectedItemCount
                    ? "bg-amber-50 text-amber-700"
                    : "bg-black/[0.04] text-black/42"
        }`}>
          {deliveryJourney === "shipping"
            ? "On the way"
            : deliveryJourney === "packing"
              ? "Packing"
              : validating
                ? "Updating"
                : configuration?.orderable
                  ? "Ready"
                  : selectedItemCount
                    ? "Adjust"
                    : "Start"}
        </span>
      </div>

      <div className="pt-4">
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
          journeyState={deliveryJourney}
        />

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-black/[0.035] px-3 py-3.5">
            <p className="text-[12px] font-black uppercase tracking-[0.07em] text-black/45 sm:text-[11px]">Gifts</p>
            <p className="mt-1.5 text-[19px] font-black leading-none text-[#171717] sm:text-[21px]">{selectedItemCount}</p>
          </div>
          <div className="rounded-xl bg-black/[0.035] px-3 py-3.5">
            <p className="text-[12px] font-black uppercase tracking-[0.07em] text-black/45 sm:text-[11px]">Filled</p>
            <p className="mt-1.5 text-[19px] font-black leading-none text-[#171717] sm:text-[21px]">{roundedFill}%</p>
          </div>
          <div className="min-w-0 rounded-xl bg-black/[0.035] px-3 py-3.5 text-right">
            <p className="text-[12px] font-black uppercase tracking-[0.07em] text-black/45 sm:text-[11px]">{orderMode === "bulk" ? "Per hamper" : "Total"}</p>
            <p style={{ fontFamily: DISPLAY_FONT }} className="mt-1 truncate text-[21px] font-semibold leading-none text-[#F47822] sm:text-[23px]">
              {pricing?.total === null || pricing?.total === undefined ? "—" : formatCurrency(pricing.total)}
            </p>
          </div>
        </div>


        {orderMode === "bulk" && pricing?.total !== null && pricing?.total !== undefined && (
          <div className="mt-3 flex items-center justify-between gap-3 border-y border-black/[0.10] py-2.5 text-[#171717]">
            <span className="text-[12px] font-black uppercase tracking-[0.07em] text-black/45 sm:text-[11px]">{Number(bulkQuantity || 0).toLocaleString("en-IN")} hampers</span>
            <span className="text-[13px] font-black sm:text-[14px]">{formatCurrency(Number(pricing.total || 0) * Number(bulkQuantity || 0))}</span>
          </div>
        )}

        {(timing?.expectedDeliveryDate || configuration?.earliestExpiryDate) && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {timing?.expectedDeliveryDate && (
              <div className="flex items-center gap-2.5 border-t border-black/[0.06] py-2.5 text-[11px] font-bold text-black/62 sm:text-[12px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F47822]" />
                <span><strong className="font-black text-[#171717]">Delivery</strong> · {formatDate(timing.expectedDeliveryDate)}</span>
              </div>
            )}
            {configuration?.earliestExpiryDate && (
              <div className="flex items-center gap-2.5 border-t border-[#D4AF37]/18 py-2.5 text-[11px] font-bold text-black/62 sm:text-[12px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" />
                <span><strong className="font-black text-[#171717]">Earliest expiry</strong> · {formatDate(configuration.earliestExpiryDate)}</span>
              </div>
            )}
          </div>
        )}

        {notReadyMessage && selectedItemCount > 0 && (
          <div className="mt-3 border-l-[3px] border-amber-500 bg-amber-50 px-3.5 py-3 text-[11px] font-semibold leading-5 text-amber-900 sm:text-[12px]">
            {notReadyMessage}
          </div>
        )}
        {unavailableCartMessage && (
          <div className="mt-3 border-l-[3px] border-red-500 bg-red-50 px-3.5 py-3 text-[11px] font-semibold leading-5 text-red-700 sm:text-[12px]">
            {unavailableCartMessage}
          </div>
        )}

        <button
          type="button"
          onClick={onAddToCart}
          disabled={!canAddToCart}
          className={`v10-primary-cta mt-4 flex h-[48px] w-full items-center justify-center gap-3 rounded-[11px] px-5 text-[11px] font-black uppercase sm:text-[12px] tracking-[0.07em] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-black/10 disabled:text-black/25 disabled:shadow-none ${
            orderMode === "bulk"
              ? "bg-[#171717] text-white shadow-[0_12px_28px_rgba(23,23,23,.16)] hover:bg-[#9B7616]"
              : "bg-[#F47822] text-white shadow-[0_12px_28px_rgba(244,120,34,.18)] hover:bg-[#171717]"
          }`}
        >
          {addingToCart
            ? orderMode === "bulk"
              ? "Submitting request…"
              : deliveryJourney === "shipping"
                ? "Sending for delivery…"
                : deliveryJourney === "packing"
                  ? "Packing hamper…"
                  : isEditingCartHamper
                    ? "Saving changes…"
                    : "Adding…"
            : user
              ? orderMode === "bulk"
                ? "Request quotation"
                : isEditingCartHamper
                  ? "Save hamper changes"
                  : "Add to cart"
              : orderMode === "bulk"
                ? "Login to request quote"
                : isEditingCartHamper
                  ? "Login to save changes"
                  : "Login to add"}
          {!addingToCart && <span>→</span>}
        </button>
 
      </div>
    </div>
  );
};

const V7TinyStat = ({ label, value }) => (
  <div className="min-w-[48px] text-right">
    <p className="text-[12px] font-black uppercase tracking-[0.09em] text-black/26">
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

        {sealed && (
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
  { x: 30, y: 34, rotate: -7, scale: 0.86, z: 20 },
  { x: 49, y: 33, rotate: 4, scale: 0.88, z: 21 },
  { x: 68, y: 35, rotate: -5, scale: 0.86, z: 20 },
  { x: 24, y: 49, rotate: 5, scale: 0.92, z: 24 },
  { x: 41, y: 48, rotate: -6, scale: 0.94, z: 25 },
  { x: 58, y: 47, rotate: 4, scale: 0.96, z: 26 },
  { x: 75, y: 49, rotate: -5, scale: 0.90, z: 24 },
  { x: 31, y: 63, rotate: -4, scale: 0.92, z: 30 },
  { x: 49, y: 62, rotate: 2, scale: 1.0, z: 32 },
  { x: 67, y: 63, rotate: 5, scale: 0.92, z: 31 },
  { x: 24, y: 76, rotate: 4, scale: 0.84, z: 34 },
  { x: 40, y: 76, rotate: -3, scale: 0.86, z: 35 },
  { x: 57, y: 77, rotate: 4, scale: 0.84, z: 35 },
  { x: 73, y: 76, rotate: -4, scale: 0.82, z: 34 },
  { x: 17, y: 62, rotate: -6, scale: 0.76, z: 28 },
  { x: 82, y: 61, rotate: 6, scale: 0.76, z: 28 },
  { x: 36, y: 90, rotate: -2, scale: 0.74, z: 38 },
  { x: 61, y: 90, rotate: 2, scale: 0.74, z: 38 },
];

const v20BoxStyleProfile = (container) => {
  const text = [
    container?.name,
    container?.slug,
    container?.type,
    container?.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let shape = "magnetic";

  if (/round|hat box|hatbox|cylinder|tube|jar|oval/.test(text)) {
    shape = "round";
  } else if (/tray|basket|platter|sleeve/.test(text)) {
    shape = "tray";
  } else if (/curved|capsule|arched/.test(text)) {
    shape = "curved";
  }

  let theme = "signature";

  if (/royal|diwali|festive|premium|signature|celebration|grand/.test(text)) {
    theme = "royal";
  } else if (/magnetic|rigid|luxury|classic|edit/.test(text)) {
    theme = "magnetic";
  } else if (/chest|trunk|wood|crate|treasure/.test(text)) {
    theme = "chest";
  } else if (/ivory|wedding|floral|rose|pearl/.test(text)) {
    theme = "ivory";
  } else if (/emerald|forest|botanical|green/.test(text)) {
    theme = "emerald";
  } else if (shape === "round") {
    theme = "couture";
  }

  return { shape, theme };
};

const v20ContainerPalette = (container, profile = { shape: "magnetic", theme: "signature" }) => {
  const themes = {
    magnetic: {
      main: "#B88443",
      light: "#F1D7AA",
      dark: "#7E4B1D",
      deep: "#3E210F",
      trim: "#F8E7B8",
      satin: "#F8EDDC",
      glow: "rgba(244,189,90,.34)",
      ribbonA: "#EBCB72",
      ribbonB: "#8A5A10",
      chip: "Luxury rigid magnetic hamper",
      collection: "Private Gift Atelier",
      badge: "HAMPORIUM",
    },
    royal: {
      main: "#8D2F2F",
      light: "#E3A767",
      dark: "#561515",
      deep: "#290A0D",
      trim: "#F6D47B",
      satin: "#F4D9BC",
      glow: "rgba(244,164,73,.36)",
      ribbonA: "#FFD27A",
      ribbonB: "#A86B11",
      chip: "Festive royal hamper",
      collection: "Celebration Edition",
      badge: "HAMPORIUM",
    },
    chest: {
      main: "#6B4324",
      light: "#CFA56B",
      dark: "#3C2315",
      deep: "#1C120C",
      trim: "#E9C784",
      satin: "#EEE0CE",
      glow: "rgba(215,160,87,.30)",
      ribbonA: "#F2D58C",
      ribbonB: "#8E5D18",
      chip: "3D premium gift chest",
      collection: "Treasure Keepsake Box",
      badge: "HAMPORIUM",
    },
    ivory: {
      main: "#C7B090",
      light: "#F5EBDC",
      dark: "#887156",
      deep: "#4C3F31",
      trim: "#F6E8C6",
      satin: "#FFF8EE",
      glow: "rgba(243,214,170,.32)",
      ribbonA: "#F3E1AE",
      ribbonB: "#B28C3B",
      chip: "Ivory couture hamper",
      collection: "Soft Luxe Edition",
      badge: "HAMPORIUM",
    },
    emerald: {
      main: "#335845",
      light: "#8CAD97",
      dark: "#1D3328",
      deep: "#0D1914",
      trim: "#E7D79A",
      satin: "#E9F1EB",
      glow: "rgba(138,189,151,.28)",
      ribbonA: "#F0DEA2",
      ribbonB: "#8D6A1B",
      chip: "Emerald house hamper",
      collection: "Botanical Signature",
      badge: "HAMPORIUM",
    },
    couture: {
      main: "#B07C9A",
      light: "#F1D6E5",
      dark: "#6F4560",
      deep: "#3B2335",
      trim: "#F8E7C5",
      satin: "#FFF3F6",
      glow: "rgba(235,187,216,.28)",
      ribbonA: "#F8E6B4",
      ribbonB: "#A97A28",
      chip: "Round couture hamper",
      collection: "Maison Capsule",
      badge: "HAMPORIUM",
    },
    signature: {
      main: "#C88A4A",
      light: "#F0D2AA",
      dark: "#8B5427",
      deep: "#4D2B14",
      trim: "#F7E2B2",
      satin: "#FBF1E4",
      glow: "rgba(244,189,90,.32)",
      ribbonA: "#EBCB72",
      ribbonB: "#8A5A10",
      chip: "Signature hamper",
      collection: "Hamporium Atelier",
      badge: "HAMPORIUM",
    },
  };

  const profileTheme = profile?.theme && themes[profile.theme] ? profile.theme : null;
  if (profileTheme) return themes[profileTheme];

  const fallbackKeys = Object.keys(themes);
  const seed = String(container?._id || container?.name || "hamper");
  return themes[fallbackKeys[v7Hash(seed) % fallbackKeys.length]];
};

const v20PackingSize = (component, count, compact = false) => {
  const kind = v7ItemKind(component);
  const base = {
    bottle: [46, 84],
    cylinder: [62, 68],
    snack: [76, 62],
    flat: [78, 52],
    gift: [70, 62],
  }[kind] || [68, 62];

  const crowdScale = count > 14 ? 0.78 : count > 10 ? 0.86 : count > 7 ? 0.94 : 1.12;

  const compactScale = compact ? 0.80 : 1;

  return {
    kind,
    width: Math.round(base[0] * crowdScale * compactScale),
    height: Math.round(base[1] * crowdScale * compactScale),
  };
};

const V20PackingItem = ({ entry, index, count, compact = false }) => {
  const component = entry.component;
  const slot = V20_PACKING_SLOTS[index % V20_PACKING_SLOTS.length];
  const size = v20PackingSize(component, count, compact);
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
  journeyState = "idle",
  compact = false,
}) => {
  const [liveItems, setLiveItems] = useState(() =>
    previewItems.map((item) => ({ ...item, phase: "stable" }))
  );
  const [packingNote, setPackingNote] = useState("");
  const previousIdsRef = useRef(new Set(previewItems.map((item) => item.id)));
  const noteTimerRef = useRef(null);
  const settleTimerRef = useRef(null);
  const introDropTimerRef = useRef(null);
  const introOpenTimerRef = useRef(null);
  const introReadyTimerRef = useRef(null);
  const [boxEntryPhase, setBoxEntryPhase] = useState("idle");

  const roundedFill = Math.min(100, Math.round(Number(fillPercent || 0)));
  const isAutoSealed = roundedFill >= 100;
  const isPacking = journeyState === "packing";
  const isShipping = journeyState === "shipping";
  const sealed = isAutoSealed || isPacking || isShipping;
  const isDroppingIn = boxEntryPhase === "drop";
  const isOpeningIn = boxEntryPhase === "opening";

  useEffect(() => {
    previousIdsRef.current = new Set(previewItems.map((item) => item.id));
    setLiveItems(previewItems.map((item) => ({ ...item, phase: "stable" })));

    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    if (introDropTimerRef.current) window.clearTimeout(introDropTimerRef.current);
    if (introOpenTimerRef.current) window.clearTimeout(introOpenTimerRef.current);
    if (introReadyTimerRef.current) window.clearTimeout(introReadyTimerRef.current);

    if (selectedContainer) {
      setBoxEntryPhase("drop");
      setPackingNote(`${selectedContainer.name} selected`);

      introDropTimerRef.current = window.setTimeout(() => {
        setBoxEntryPhase("opening");
        setPackingNote("Opening your hamper box");
      }, 920);

      introOpenTimerRef.current = window.setTimeout(() => {
        setPackingNote("Box ready - start adding gifts");
      }, 1540);

      introReadyTimerRef.current = window.setTimeout(() => {
        setBoxEntryPhase("idle");
      }, 2020);

      noteTimerRef.current = window.setTimeout(() => setPackingNote(""), 2500);
    } else {
      setBoxEntryPhase("idle");
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
      setPackingNote(`Adding ${latest.component?.name || "gift"} to your hamper`);
      noteTimerRef.current = window.setTimeout(() => setPackingNote(""), 1250);
    } else if (removedIds.size) {
      setPackingNote("Gift removed - space updated");
      noteTimerRef.current = window.setTimeout(() => setPackingNote(""), 1050);
    }

    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);

    settleTimerRef.current = window.setTimeout(() => {
      setLiveItems(previewItems.map((item) => ({ ...item, phase: "stable" })));
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
      if (introDropTimerRef.current) window.clearTimeout(introDropTimerRef.current);
      if (introOpenTimerRef.current) window.clearTimeout(introOpenTimerRef.current);
      if (introReadyTimerRef.current) window.clearTimeout(introReadyTimerRef.current);
    };
  }, []);

  const visibleLiveItems = liveItems.slice(0, 18);

  const lidTransform = sealed
    ? "translateX(-50%) translateY(92%) perspective(1250px) rotateX(0deg) scale(1)"
    : isDroppingIn
      ? "translateX(-50%) translateY(92%) perspective(1250px) rotateX(0deg) scale(1)"
      : "translateX(-50%) translateY(0) perspective(1250px) rotateX(48deg) scale(.99)";

  return (
    <div className="v60-live-stage relative isolate min-h-[320px] overflow-hidden rounded-[22px] border border-black/[0.055] bg-[radial-gradient(circle_at_50%_28%,#ffffff_0%,#fbfaf7_42%,#f4f0ea_72%,#ebe4da_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.98),0_14px_35px_rgba(39,27,14,.055)] sm:min-h-[380px] xl:min-h-[430px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[12%] bottom-[5%] h-[58px] rounded-full bg-black/[0.12] blur-[26px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[9%] h-[56%] w-[78%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(221,178,84,.09),transparent_68%)] blur-[16px]"
      />

      {(packingNote || isPacking || isShipping) && (
        <div
          key={packingNote || journeyState}
          className="v60-packing-note absolute left-1/2 top-3 z-[150] max-w-[82%] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-[#C7A254]/25 bg-white/95 px-3.5 py-1.5 text-[12px] font-black tracking-[.02em] text-black/55 shadow-[0_8px_22px_rgba(0,0,0,.07)] backdrop-blur-xl sm:top-4 sm:px-4 sm:py-2 sm:text-[12px]"
        >
          {isShipping
            ? "Hamper packed - preparing delivery"
            : isPacking
              ? "Finishing your hamper"
              : packingNote}
        </div>
      )}

      {!selectedContainer ? (
        <div className="absolute left-1/2 top-1/2 z-20 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-dashed border-black/15 bg-white/75 px-4 py-4 text-center text-[11px] font-extrabold leading-5 text-black/40 backdrop-blur-md sm:text-[12px]">
          Choose a box to start building your hamper.
        </div>
      ) : (
        <div
          key={selectedContainer._id}
          className={`v60-box-world absolute inset-x-0 bottom-[15px] z-10 mx-auto h-[282px] w-[98%] max-w-[740px] [perspective:1500px] [transform-style:preserve-3d] sm:bottom-[16px] sm:h-[332px] xl:bottom-[18px] xl:h-[382px] ${
            isDroppingIn
              ? "animate-[v50BoxDrop_.92s_cubic-bezier(.18,.88,.24,1.02)_both]"
              : ""
          } ${
            isShipping
              ? "animate-[v20ShipAway_1.45s_cubic-bezier(.3,.75,.18,1)_forwards]"
              : ""
          }`}
        >
          <div
            aria-hidden="true"
            className="absolute bottom-[3%] left-1/2 z-0 h-[30px] w-[76%] -translate-x-1/2 rounded-full bg-black/25 blur-[16px] sm:h-[38px]"
          />

          {/* HINGED LID - same footprint as box, opens from the back edge */}
          <div
            className={`absolute left-1/2 top-[1%] z-[12] h-[40%] w-[88%] origin-[50%_100%] [backface-visibility:hidden] [transform-style:preserve-3d] transition-transform duration-700 ease-[cubic-bezier(.2,.82,.2,1)] sm:w-[87%] ${
              isOpeningIn
                ? "animate-[v48LidOpen_.9s_cubic-bezier(.18,.84,.2,1)_forwards]"
                : ""
            } ${sealed ? "z-[90]" : ""}`}
            style={{ transform: lidTransform }}
          >
            <div className="absolute inset-x-[1.2%] -bottom-[8px] h-[12px] rounded-b-[8px] border-x border-b border-white/[0.055] bg-gradient-to-b from-[#121214] via-[#09090A] to-[#050506] shadow-[0_8px_14px_rgba(0,0,0,.22)]" />

            <div className="absolute inset-0 overflow-hidden rounded-[12px] border border-white/[0.075] bg-[radial-gradient(circle_at_28%_12%,rgba(255,255,255,.045),transparent_24%),linear-gradient(145deg,#171719_0%,#0e0e10_44%,#080809_75%,#121214_100%)] shadow-[0_20px_34px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.075),inset_0_-8px_18px_rgba(0,0,0,.34)]">
              <div className="pointer-events-none absolute inset-[7px] rounded-[8px] border border-[#CDA84F]/14" />

              <div className="pointer-events-none absolute -left-[22%] -top-[30%] z-[6] h-[160%] w-[15%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/12 to-transparent animate-[v48GoldSheen_5.6s_ease-in-out_infinite]" />

              <svg
                viewBox="0 0 1000 360"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="absolute inset-[5px] z-[4] h-[calc(100%-10px)] w-[calc(100%-10px)] text-[#CFA94F] opacity-[.92]"
              >
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M35 303 C120 255 145 175 234 76" />
                  <path d="M80 270 C66 236 67 211 81 185" />
                  <path d="M82 270 C112 247 129 221 136 192" />
                  <ellipse cx="79" cy="194" rx="12" ry="27" transform="rotate(-30 79 194)" />
                  <ellipse cx="132" cy="203" rx="12" ry="28" transform="rotate(32 132 203)" />
                  <path d="M132 201 C163 187 181 164 193 137" />
                  <ellipse cx="190" cy="140" rx="12" ry="29" transform="rotate(-39 190 140)" />

                  <g transform="translate(267 100)">
                    <ellipse cx="0" cy="-34" rx="14" ry="36" />
                    <ellipse cx="31" cy="-19" rx="14" ry="36" transform="rotate(50 31 -19)" />
                    <ellipse cx="34" cy="17" rx="14" ry="36" transform="rotate(98 34 17)" />
                    <ellipse cx="3" cy="35" rx="14" ry="36" transform="rotate(180 3 35)" />
                    <ellipse cx="-30" cy="18" rx="14" ry="36" transform="rotate(-98 -30 18)" />
                    <ellipse cx="-32" cy="-19" rx="14" ry="36" transform="rotate(-50 -32 -19)" />
                    <circle cx="1" cy="0" r="10" />
                    <path d="M-11 -2 C-3 -15 12 -13 15 -1" />
                    <path d="M-9 6 C1 16 14 10 16 1" />
                  </g>

                  <path d="M397 321 C456 267 478 203 501 108" />
                  <path d="M430 266 C406 251 393 230 388 208" />
                  <ellipse cx="394" cy="211" rx="12" ry="29" transform="rotate(-42 394 211)" />
                  <path d="M456 223 C486 210 504 190 514 165" />
                  <ellipse cx="509" cy="166" rx="12" ry="29" transform="rotate(43 509 166)" />

                  <g transform="translate(590 185)">
                    <ellipse cx="0" cy="-45" rx="17" ry="47" />
                    <ellipse cx="39" cy="-29" rx="17" ry="47" transform="rotate(50 39 -29)" />
                    <ellipse cx="49" cy="12" rx="17" ry="47" transform="rotate(93 49 12)" />
                    <ellipse cx="25" cy="44" rx="17" ry="47" transform="rotate(145 25 44)" />
                    <ellipse cx="-20" cy="45" rx="17" ry="47" transform="rotate(-150 -20 45)" />
                    <ellipse cx="-49" cy="14" rx="17" ry="47" transform="rotate(-94 -49 14)" />
                    <ellipse cx="-39" cy="-28" rx="17" ry="47" transform="rotate(-49 -39 -28)" />
                    <circle cx="0" cy="0" r="14" />
                    <path d="M-14 -3 C-6 -19 12 -20 17 -5" />
                    <path d="M-16 6 C-3 20 15 17 18 2" />
                  </g>

                  <path d="M692 308 C748 258 782 190 851 77" />
                  <path d="M724 274 C705 254 696 231 696 208" />
                  <ellipse cx="699" cy="211" rx="12" ry="29" transform="rotate(-38 699 211)" />
                  <path d="M761 234 C791 221 807 200 817 175" />
                  <ellipse cx="814" cy="176" rx="12" ry="29" transform="rotate(42 814 176)" />

                  <g transform="translate(896 110)">
                    <ellipse cx="0" cy="-29" rx="12" ry="31" />
                    <ellipse cx="26" cy="-15" rx="12" ry="31" transform="rotate(54 26 -15)" />
                    <ellipse cx="27" cy="17" rx="12" ry="31" transform="rotate(111 27 17)" />
                    <ellipse cx="0" cy="30" rx="12" ry="31" />
                    <ellipse cx="-26" cy="17" rx="12" ry="31" transform="rotate(-111 -26 17)" />
                    <ellipse cx="-27" cy="-16" rx="12" ry="31" transform="rotate(-54 -27 -16)" />
                    <circle cx="0" cy="0" r="9" />
                  </g>

                  <path d="M210 294 C258 271 303 262 350 268" />
                  <ellipse cx="257" cy="274" rx="10" ry="22" transform="rotate(68 257 274)" />
                  <ellipse cx="307" cy="267" rx="10" ry="22" transform="rotate(82 307 267)" />

                  <path d="M650 72 C700 53 744 50 794 61" />
                  <ellipse cx="697" cy="59" rx="10" ry="22" transform="rotate(73 697 59)" />
                  <ellipse cx="747" cy="57" rx="10" ry="22" transform="rotate(98 747 57)" />
                </g>
              </svg>
            </div>

            <div className="absolute bottom-[-1px] left-[6%] right-[6%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#B58B35]/55 to-transparent shadow-[0_1px_6px_rgba(202,158,65,.26)]" />
          </div>

          {/* OPEN BOX TOP */}
          <div className="absolute left-1/2 top-[39%] z-[24] h-[47%] w-[92%] rounded-[15px] border border-white/[0.065] bg-[linear-gradient(145deg,#1a1a1c_0%,#0d0d0f_46%,#080809_100%)] shadow-[0_25px_34px_rgba(0,0,0,.18),0_7px_13px_rgba(0,0,0,.11),inset_0_1px_0_rgba(255,255,255,.055)] [transform:translateX(-50%)_perspective(1200px)_rotateX(4deg)]">
            <div className="absolute inset-[7px] rounded-[11px] bg-[linear-gradient(145deg,#232326_0%,#111113_48%,#080809_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.065),inset_0_-3px_7px_rgba(0,0,0,.62)] sm:inset-[9px]" />

            <div
              className={`absolute inset-[16px_17px_18px] overflow-hidden rounded-[8px] border border-[#CDAA63]/10 bg-[radial-gradient(circle_at_50%_20%,rgba(218,179,102,.12),transparent_30%),linear-gradient(180deg,#262019_0%,#17130f_44%,#0d0b09_100%)] shadow-[inset_0_18px_30px_rgba(0,0,0,.42),inset_0_-10px_18px_rgba(202,158,80,.055)] transition-[opacity,transform] duration-500 sm:inset-[20px_22px_22px] ${
                isDroppingIn ? "scale-[.97] opacity-0" : "scale-100 opacity-100"
              } ${
                isOpeningIn
                  ? "animate-[v48InsideReveal_.48s_ease_.24s_both]"
                  : ""
              } ${sealed ? "opacity-[.05]" : ""}`}
            >
              <div className="pointer-events-none absolute inset-[7px] rounded-[6px] border border-[#D7B264]/10 bg-[repeating-linear-gradient(105deg,rgba(212,170,92,.045)_0_12px,rgba(255,255,255,.012)_12px_24px)]" />


              <div className="absolute inset-[3%_4%_5%] z-20 overflow-hidden rounded-[7px] [&_.v20-pack-item]:drop-shadow-[0_9px_10px_rgba(0,0,0,.22)] [&_.v20-pack-card]:rounded-[10px] [&_.v20-pack-card]:border-black/10 [&_.v20-pack-card]:bg-white [&_.v20-pack-card]:shadow-[0_8px_15px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.9)] [&_.v20-pack-image]:rounded-[8px] [&_.v20-pack-image]:bg-gradient-to-b [&_.v20-pack-image]:from-white [&_.v20-pack-image]:to-[#F4EFE8] [&_.v20-pack-label]:hidden">
                {visibleLiveItems.map((entry, index) => (
                  <V20PackingItem
                    key={entry.id}
                    entry={entry}
                    index={index}
                    count={visibleLiveItems.length}
                    compact={compact}
                  />
                ))}
              </div>

              {selectedDecorationCount > 0 && !sealed && (
                <V7DecorationOverlay decorations={previewDecorations} />
              )}
            </div>
          </div>

          {/* FRONT WALL - separate from top plane so the box has real depth */}
          <div className="absolute left-[7%] right-[7%] top-[79%] z-[48] h-[13%] rounded-b-[12px] border-x border-b border-white/[0.055] bg-[linear-gradient(180deg,#121214_0%,#0a0a0b_48%,#050506_100%)] shadow-[0_15px_18px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.05)] [clip-path:polygon(0_0,100%_0,97.5%_100%,2.5%_100%)]">
            <div className="absolute inset-x-[9%] top-[1px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* SMALL SATIN BOW - sits ON the front wall, not below the box */}
          <div
            aria-hidden="true"
            className={`absolute left-[67%] top-[80.2%] z-[70] h-[52px] w-[88px] -translate-x-1/2 origin-center ${
              sealed ? "animate-[v48BowSettle_.46s_ease-out_both]" : ""
            }`}
          >
            <span className="absolute left-[1px] top-[5px] h-[27px] w-[39px] -rotate-[15deg] rounded-[68%_34%_62%_38%] border-[6px] border-[#D3A43F] bg-[linear-gradient(135deg,rgba(255,226,145,.18),rgba(120,76,12,.05))] shadow-[inset_0_1px_0_rgba(255,244,194,.42),0_3px_7px_rgba(0,0,0,.16)]" />
            <span className="absolute right-[1px] top-[5px] h-[27px] w-[39px] rotate-[15deg] rounded-[34%_68%_38%_62%] border-[6px] border-[#D3A43F] bg-[linear-gradient(225deg,rgba(255,226,145,.18),rgba(120,76,12,.05))] shadow-[inset_0_1px_0_rgba(255,244,194,.42),0_3px_7px_rgba(0,0,0,.16)]" />
            <span className="absolute left-[31px] top-[26px] h-[25px] w-[12px] rotate-[10deg] [clip-path:polygon(0_0,100%_4%,82%_100%,50%_82%,15%_100%)] bg-[linear-gradient(90deg,#A97721,#E3B652_48%,#B47A20)] shadow-[0_3px_6px_rgba(0,0,0,.14)]" />
            <span className="absolute right-[29px] top-[26px] h-[27px] w-[12px] -rotate-[13deg] [clip-path:polygon(0_0,100%_4%,82%_100%,50%_82%,15%_100%)] bg-[linear-gradient(90deg,#A97721,#E3B652_48%,#B47A20)] shadow-[0_3px_6px_rgba(0,0,0,.14)]" />
            <span className="absolute left-1/2 top-[13px] z-[4] h-[17px] w-[19px] -translate-x-1/2 rounded-[6px] bg-[radial-gradient(circle_at_35%_25%,#F5D580,#D1A03A_48%,#986814_100%)] shadow-[0_4px_8px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,244,192,.58)]" />
          </div>

          {isShipping && (
            <div className="absolute left-1/2 top-[3px] z-[160] -translate-x-1/2 rounded-full border border-[#D8B052]/25 bg-[#0B0B0C] px-3 py-1.5 text-[12px] font-black uppercase tracking-[.07em] text-[#F2D17A] shadow-[0_12px_24px_rgba(0,0,0,.16)]">
              Packed - heading to you
            </div>
          )}
        </div>
      )}

      {selectedContainer && (
        <div className="v60-capacity-line absolute inset-x-[14px] bottom-[8px] z-[170] flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.075]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#9A6A18] via-[#D5AD57] to-[#F0D58F] transition-[width] duration-500 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, roundedFill))}%`,
              }}
            />
          </div>

          <span className="w-[42px] shrink-0 text-right text-[12px] font-black text-black/45">
            {isShipping ? "Ready" : `${roundedFill}%`}
          </span>
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
            <p className="text-[12px] font-black uppercase tracking-[0.07em] text-black/38">
              {label}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-black/48">
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
              className="flex h-10 min-w-[82px] items-center justify-center rounded-full bg-[#171717] px-4 text-[12px] font-black uppercase tracking-[0.06em] text-white transition active:scale-95 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/25"
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
      <p className="text-[11px] font-semibold text-black/46">
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
          className="h-9 rounded-xl border border-black/10 bg-white px-3 text-[12px] font-black uppercase tracking-[0.06em] text-black/55 transition hover:border-[#F47822] hover:text-[#F47822] disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← Prev
        </button>

        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => go(pageNumber)}
            className={`h-9 min-w-9 rounded-xl px-3 text-[12px] font-black transition ${
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
          className="h-9 rounded-xl border border-black/10 bg-white px-3 text-[12px] font-black uppercase tracking-[0.06em] text-black/55 transition hover:border-[#F47822] hover:text-[#F47822] disabled:cursor-not-allowed disabled:opacity-30"
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
  <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#F1ECE5] to-[#E8DFD4] text-[12px] font-bold uppercase tracking-[0.1em] text-black/25">
    No image
  </div>
);

const CustomHamperSkeleton = () => (
  <main className="min-h-screen bg-[#F6F1E9] px-3 pb-16 pt-[92px] sm:px-5 lg:px-7">
    <div className="mx-auto w-full max-w-[1760px]">
      <div className="h-[250px] animate-pulse rounded-[30px] bg-[#171614]/90" />
      <div className="mt-4 h-[64px] animate-pulse rounded-[18px] bg-white" />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="h-[620px] animate-pulse rounded-[28px] bg-white" />
        <div className="h-[610px] animate-pulse rounded-[28px] bg-white" />
      </div>
    </div>
  </main>
);

export default CustomHamper;
