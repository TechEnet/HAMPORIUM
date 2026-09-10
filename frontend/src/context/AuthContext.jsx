import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api.js";

const AuthContext = createContext(null);

const isPartnerRole = (user) => user?.roles?.includes("partner");

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const loadPartner = useCallback(async (currentUser = user) => {
    if (!isPartnerRole(currentUser)) {
      setPartner(null);
      return null;
    }

    try {
      const response = await api.get("/partners/me");
      const nextPartner = response.data.partner || null;
      setPartner(nextPartner);
      return nextPartner;
    } catch (error) {
      if (![401, 403, 404].includes(error.response?.status)) {
        console.error("Unable to load partner account:", error);
      }
      setPartner(null);
      return null;
    }
  }, [user]);

  const loadUser = useCallback(async () => {
    setAuthLoading(true);

    try {
      const response = await api.get("/users/me");
      const nextUser = response.data.user || null;
      setUser(nextUser);
      await loadPartner(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      setPartner(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, [loadPartner]);

  useEffect(() => {
    void loadUser();
  }, []);

  const applyLoginPayload = useCallback((data) => {
    if (data?.user) setUser(data.user);
    if (data?.partner !== undefined) setPartner(data.partner || null);
    return data;
  }, []);

  const register = useCallback(async (formData) => {
    const response = await api.post("/auth/register", formData);
    return response.data;
  }, []);

  const verifyEmail = useCallback(async ({ email, otp }) => {
    const response = await api.post("/auth/verify-email", { email, otp });
    return applyLoginPayload(response.data);
  }, [applyLoginPayload]);

  const resendVerificationOtp = useCallback(async (email) => {
    const response = await api.post("/auth/resend-verification-otp", { email });
    return response.data;
  }, []);

  const login = useCallback(async (formData) => {
    const response = await api.post("/auth/login", formData);
    return applyLoginPayload(response.data);
  }, [applyLoginPayload]);

  const googleLogin = useCallback(async (credential) => {
    const response = await api.post("/auth/google", { credential });
    return applyLoginPayload(response.data);
  }, [applyLoginPayload]);

  const partnerRegister = useCallback(async (payload) => {
    const response = await api.post("/auth/partner/register", payload);
    return response.data;
  }, []);

  const partnerApply = useCallback(async (payload) => {
    const response = await api.post("/partners/apply", payload);
    await loadUser();
    return response.data;
  }, [loadUser]);

  const partnerLogin = useCallback(async (formData) => {
    const response = await api.post("/auth/partner/login", formData);
    return applyLoginPayload(response.data);
  }, [applyLoginPayload]);

  const partnerGoogleRegister = useCallback(async ({ credential, payload }) => {
    const response = await api.post("/auth/partner/google/register", {
      ...payload,
      credential,
    });
    return applyLoginPayload(response.data);
  }, [applyLoginPayload]);

  const partnerGoogleLogin = useCallback(async (credential) => {
    const response = await api.post("/auth/partner/google/login", { credential });
    return applyLoginPayload(response.data);
  }, [applyLoginPayload]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setPartner(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post("/auth/logout-all");
    } finally {
      setUser(null);
      setPartner(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get("/users/me");
    const nextUser = response.data.user;
    setUser(nextUser);
    await loadPartner(nextUser);
    return nextUser;
  }, [loadPartner]);

  const refreshPartner = useCallback(async () => loadPartner(user), [loadPartner, user]);

  const hasRole = useCallback(
    (...roles) => Boolean(user?.roles?.some((role) => roles.includes(role))),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      setUser,
      partner,
      setPartner,
      authLoading,
      register,
      verifyEmail,
      resendVerificationOtp,
      login,
      googleLogin,
      partnerRegister,
      partnerApply,
      partnerLogin,
      partnerGoogleRegister,
      partnerGoogleLogin,
      logout,
      logoutAll,
      refreshUser,
      refreshPartner,
      hasRole,
    }),
    [
      user,
      partner,
      authLoading,
      register,
      verifyEmail,
      resendVerificationOtp,
      login,
      googleLogin,
      partnerRegister,
      partnerApply,
      partnerLogin,
      partnerGoogleRegister,
      partnerGoogleLogin,
      logout,
      logoutAll,
      refreshUser,
      refreshPartner,
      hasRole,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
