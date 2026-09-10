import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api.js";
import { useAuth } from "./AuthContext.jsx";

const PartnerContext = createContext(null);

export const PartnerProvider = ({ children }) => {
  const { user, partner, setPartner } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerError, setPartnerError] = useState("");

  const refreshDashboard = useCallback(async () => {
    if (!user?.roles?.includes("partner")) {
      setDashboard(null);
      return null;
    }

    setPartnerLoading(true);
    setPartnerError("");

    try {
      const response = await api.get("/partners/dashboard");
      setDashboard(response.data);
      if (response.data.partner) setPartner(response.data.partner);
      return response.data;
    } catch (error) {
      setPartnerError(
        error.response?.data?.message || "Unable to load partner dashboard"
      );
      return null;
    } finally {
      setPartnerLoading(false);
    }
  }, [user?.id, setPartner]);

  useEffect(() => {
    if (user?.roles?.includes("partner")) {
      void refreshDashboard();
    } else {
      setDashboard(null);
    }
  }, [user?.id, user?.roles?.join("|")]);

  const value = useMemo(
    () => ({
      partner,
      dashboard,
      partnerLoading,
      partnerError,
      refreshDashboard,
    }),
    [partner, dashboard, partnerLoading, partnerError, refreshDashboard]
  );

  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
};

export const usePartner = () => {
  const context = useContext(PartnerContext);
  if (!context) throw new Error("usePartner must be used inside PartnerProvider");
  return context;
};
