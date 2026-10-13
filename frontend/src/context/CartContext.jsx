// EXACT PATH: frontend/src/context/CartContext.jsx
// ACTION: REPLACE - CUSTOMER 360 FRONTEND V1
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/api.js";
import { useAuth } from "./AuthContext.jsx";
import { buildAnalyticsPayload } from "../utils/analytics.js";
import { trackCustomerActivity } from "../utils/customerActivity.js";

const CartContext = createContext(null);
const emptyCart = { items: [], subtotal: 0, totalItems: 0, hasUnavailableItems: false };
const currentPagePath = () => typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`;
const record = (type, values = {}) => { void trackCustomerActivity(type, { ...values, path: values.path || currentPagePath() }); };

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState(emptyCart);
  const [cartLoading, setCartLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) { setCart(emptyCart); return emptyCart; }
    setCartLoading(true);
    try {
      const response = await api.get("/cart");
      const nextCart = response.data.cart || emptyCart;
      setCart(nextCart);
      return nextCart;
    } catch (error) {
      console.error("Unable to load cart:", error);
      setCart(emptyCart);
      return emptyCart;
    } finally { setCartLoading(false); }
  }, [user?.id, user?._id]);

  useEffect(() => { void refreshCart(); }, [refreshCart]);

  const addToCart = async (skuId, quantity = 1, options = {}) => {
    const response = await api.post("/cart/items", {
      skuId, quantity,
      analytics: buildAnalyticsPayload({
        source: options.source || "product_detail",
        pagePath: options.pagePath || currentPagePath(),
        searchEventId: options.searchEventId,
      }),
      location: options.location || null,
    });
    setCart(response.data.cart);
    record("cart_item_added", { skuId });
    return response.data.cart;
  };

  const addCustomHamper = async ({ containerId, items, decorations = [], channel = "", personalization = null, quantity = 1, source = "custom_hamper", pagePath, location = null }) => {
    const response = await api.post("/cart/custom-hampers", {
      containerId, items, decorations, channel, personalization, quantity,
      analytics: buildAnalyticsPayload({ source, pagePath: pagePath || currentPagePath() }),
      location,
    });
    setCart(response.data.cart);
    record("hamper_configured", { path: pagePath });
    return response.data.cart;
  };

  const updateCustomHamper = async (cartItemId, { containerId, items, decorations = [], channel = "", personalization = null, source = "custom_hamper_edit", pagePath, location = null }) => {
    const response = await api.put(`/cart/custom-hampers/${cartItemId}`, {
      containerId, items, decorations, channel, personalization,
      analytics: buildAnalyticsPayload({ source, pagePath: pagePath || currentPagePath() }),
      location,
    });
    setCart(response.data.cart);
    record("hamper_configured", { path: pagePath });
    return response.data.cart;
  };

  const removeFromCart = async (skuId) => {
    const response = await api.delete(`/cart/items/${skuId}`);
    setCart(response.data.cart);
    record("cart_item_removed", { skuId });
    return response.data.cart;
  };

  const removeCustomHamper = async (cartItemId) => {
    const response = await api.delete(`/cart/custom-hampers/${cartItemId}`);
    setCart(response.data.cart);
    record("cart_item_removed");
    return response.data.cart;
  };

  const updateQuantity = async (skuId, quantity) => {
    const nextQuantity = Number(quantity);
    if (nextQuantity <= 0) return removeFromCart(skuId);
    const response = await api.patch(`/cart/items/${skuId}`, { quantity: nextQuantity });
    setCart(response.data.cart);
    // Quantity is transactional state; optional activity records only add/remove events.
    return response.data.cart;
  };

  const updateCustomHamperQuantity = async (cartItemId, quantity) => {
    const nextQuantity = Number(quantity);
    if (nextQuantity <= 0) return removeCustomHamper(cartItemId);
    const response = await api.patch(`/cart/custom-hampers/${cartItemId}`, { quantity: nextQuantity });
    setCart(response.data.cart);
    return response.data.cart;
  };

  const clearCart = async () => {
    await api.delete("/cart");
    setCart(emptyCart);
    // Clear cart is not an allowed Customer360 V2 activity type.
  };

  return <CartContext.Provider value={{
    cart, cartLoading, addToCart, addCustomHamper, updateCustomHamper,
    updateQuantity, updateCustomHamperQuantity, removeFromCart,
    removeCustomHamper, clearCart, refreshCart,
  }}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
};
