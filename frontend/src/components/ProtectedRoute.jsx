import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import Loader from "./Loader.jsx";

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <Loader />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (
    allowedRoles.length > 0 &&
    !user.roles?.some((role) => allowedRoles.includes(role))
  ) {
    if (user.roles?.includes("partner")) {
      return <Navigate to="/partner" replace />;
    }

    return <Navigate to="/account" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
