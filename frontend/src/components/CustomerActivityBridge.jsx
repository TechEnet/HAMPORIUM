// EXACT PATH: frontend/src/components/CustomerActivityBridge.jsx
// ACTION: NEW - CUSTOMER 360 FRONTEND V1
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { configureCustomerActivityUser, readCustomerActivityConsent, trackCustomerActivity } from "../utils/customerActivity.js";

// Mounted within AuthProvider and Router, outside all page layouts.
export default function CustomerActivityBridge() {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  const id = user?.id || user?._id || "";
  useEffect(() => {
    if (authLoading) return;
    configureCustomerActivityUser(user);
    if (id) void readCustomerActivityConsent();
  }, [id, authLoading]);
  useEffect(() => {
    if (!id || authLoading) return;
    if (location.pathname === "/checkout") {
      void trackCustomerActivity("checkout_started", { path: location.pathname });
    }
  }, [location.pathname, id, authLoading]);
  return null;
}
