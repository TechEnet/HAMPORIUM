import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../api/api.js";
import { useAuth } from "./AuthContext.jsx";
import {
  buildAnalyticsPayload,
} from "../utils/analytics.js";

const CartContext = createContext(null);

const emptyCart = {
  items: [],
  subtotal: 0,
  totalItems: 0,
  hasUnavailableItems: false,
};

const currentPagePath = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.pathname}${window.location.search}`;
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();

  const [cart, setCart] = useState(emptyCart);
  const [cartLoading, setCartLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart(emptyCart);
      return;
    }

    setCartLoading(true);

    try {
      const response = await api.get("/cart");
      setCart(response.data.cart || emptyCart);
    } catch (error) {
      console.error("Unable to load cart:", error);
      setCart(emptyCart);
    } finally {
      setCartLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (
    skuId,
    quantity = 1,
    options = {}
  ) => {
    const response = await api.post("/cart/items", {
      skuId,
      quantity,
      analytics: buildAnalyticsPayload({
        source:
          options.source || "product_detail",
        pagePath:
          options.pagePath || currentPagePath(),
        searchEventId:
          options.searchEventId,
      }),
      location: options.location || null,
    });

    setCart(response.data.cart);

    return response.data.cart;
  };

  const addCustomHamper = async ({
    containerId,
    items,
    decorations = [],
    channel = "",
    personalization = null,
    quantity = 1,
    source = "custom_hamper",
    pagePath,
    location = null,
  }) => {
    const response = await api.post(
      "/cart/custom-hampers",
      {
        containerId,
        items,
        decorations,
        channel,
        personalization,
        quantity,
        analytics: buildAnalyticsPayload({
          source,
          pagePath:
            pagePath || currentPagePath(),
        }),
        location,
      }
    );

    setCart(response.data.cart);

    return response.data.cart;
  };

  const removeFromCart = async (skuId) => {
    const response = await api.delete(
      `/cart/items/${skuId}`
    );

    setCart(response.data.cart);

    return response.data.cart;
  };

  const removeCustomHamper = async (
    cartItemId
  ) => {
    const response = await api.delete(
      `/cart/custom-hampers/${cartItemId}`
    );

    setCart(response.data.cart);

    return response.data.cart;
  };

  const updateQuantity = async (
    skuId,
    quantity
  ) => {
    const nextQuantity = Number(quantity);

    if (nextQuantity <= 0) {
      return removeFromCart(skuId);
    }

    const response = await api.patch(
      `/cart/items/${skuId}`,
      {
        quantity: nextQuantity,
      }
    );

    setCart(response.data.cart);

    return response.data.cart;
  };

  const updateCustomHamperQuantity = async (
    cartItemId,
    quantity
  ) => {
    const nextQuantity = Number(quantity);

    if (nextQuantity <= 0) {
      return removeCustomHamper(cartItemId);
    }

    const response = await api.patch(
      `/cart/custom-hampers/${cartItemId}`,
      {
        quantity: nextQuantity,
      }
    );

    setCart(response.data.cart);

    return response.data.cart;
  };

  const clearCart = async () => {
    await api.delete("/cart");
    setCart(emptyCart);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartLoading,
        addToCart,
        addCustomHamper,
        updateQuantity,
        updateCustomHamperQuantity,
        removeFromCart,
        removeCustomHamper,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
};
