
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import api from "../api/api.js";

const AuthContext = createContext(null);

const isPartnerRole = (user) => user?.roles?.includes("partner");

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // In React StrictMode a mount effect can run twice. Never let an older
  // unauthenticated bootstrap response clear a later successful login.
  const authEpoch = useRef(0);
  const didBootstrap = useRef(false);

  const loadPartner = useCallback(async (currentUser = user, epoch = authEpoch.current) => {
    if (!isPartnerRole(currentUser)) {
      if (epoch === authEpoch.current) setPartner(null);
      return null;
    }
    try {
      const response = await api.get("/partners/me");
      const nextPartner = response.data.partner || null;
      if (epoch === authEpoch.current) setPartner(nextPartner);
      return nextPartner;
    } catch (error) {
      if (![401, 403, 404].includes(error.response?.status)) {
        console.error("Unable to load partner account:", error);
      }
      if (epoch === authEpoch.current) setPartner(null);
      return null;
    }
  }, [user]);

  const loadUser = useCallback(async () => {
    const epoch = ++authEpoch.current;
    setAuthLoading(true);
    try {
      const response = await api.get("/users/me");
      const nextUser = response.data.user || null;
      if (epoch !== authEpoch.current) return null;
      setUser(nextUser);
      await loadPartner(nextUser, epoch);
      return nextUser;
    } catch (error) {
      // HTTP 401 here on a new/incognito visit is expected: no cookie yet.
      // It must not override a login that completed during the request.
      if (epoch === authEpoch.current) {
        setUser(null);
        setPartner(null);
      }
      return null;
    } finally {
      if (epoch === authEpoch.current) setAuthLoading(false);
    }
  }, [loadPartner]);

  useEffect(() => {
    if (didBootstrap.current) return;
    didBootstrap.current = true;
    void loadUser();
  }, [loadUser]);

  const applyLoginPayload = useCallback((data) => {
    authEpoch.current += 1;
    if (data?.user) setUser(data.user);
    if (data?.partner !== undefined) setPartner(data.partner || null);
    setAuthLoading(false);
    return data;
  }, []);

  // A 200 /auth/login by itself doesn't prove the browser saved the HttpOnly
  // cookie. Confirm it with /users/me before showing an authenticated session.
  const confirmLogin = useCallback(async (data) => {
    if (!data?.user) return data;
    const epoch = ++authEpoch.current;
    setAuthLoading(true);
    try {
      const response = await api.get("/users/me");
      if (!response.data?.user) throw new Error("Session verification returned no user");
      if (epoch === authEpoch.current) {
        applyLoginPayload({ ...data, user: response.data.user });
      }
      return data;
    } catch (error) {
      if (epoch === authEpoch.current) {
        setUser(null);
        setPartner(null);
      }
      const authError = new Error(
        "Login accepted, but the session cookie was not saved or sent. " +
        "Please check the same-origin API proxy and browser cookie settings."
      );
      authError.cause = error;
      throw authError;
    } finally {
      if (epoch === authEpoch.current) setAuthLoading(false);
    }
  }, [applyLoginPayload]);

  const register = useCallback(async (formData) => {
    const response = await api.post("/auth/register", formData);
    return response.data;
  }, []);

  const verifyEmail = useCallback(async ({ email, otp }) => {
    const response = await api.post("/auth/verify-email", { email, otp });
    return confirmLogin(response.data);
  }, [confirmLogin]);

  const resendVerificationOtp = useCallback(async (email) => {
    const response = await api.post("/auth/resend-verification-otp", { email });
    return response.data;
  }, []);

  const login = useCallback(async (formData) => {
    const response = await api.post("/auth/login", formData);
    return confirmLogin(response.data);
  }, [confirmLogin]);

  const googleLogin = useCallback(async (credential) => {
    const response = await api.post("/auth/google", { credential });
    return confirmLogin(response.data);
  }, [confirmLogin]);

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
    return confirmLogin(response.data);
  }, [confirmLogin]);

  const partnerGoogleRegister = useCallback(async ({ credential, payload }) => {
    const response = await api.post("/auth/partner/google/register", {
      ...payload,
      credential,
    });
    return confirmLogin(response.data);
  }, [confirmLogin]);

  const partnerGoogleLogin = useCallback(async (credential) => {
    const response = await api.post("/auth/partner/google/login", { credential });
    return confirmLogin(response.data);
  }, [confirmLogin]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      authEpoch.current += 1;
      setAuthLoading(false);
      setUser(null);
      setPartner(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post("/auth/logout-all");
    } finally {
      authEpoch.current += 1;
      setAuthLoading(false);
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
