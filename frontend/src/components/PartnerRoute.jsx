import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import Loader from "./Loader.jsx";

const PartnerRoute = ({ requireApproved = true }) => {
  const { user, partner, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <Loader />;

  if (!user) {
    return <Navigate to="/partner/login" replace state={{ from: location }} />;
  }

  if (!user.roles?.includes("partner")) {
    return <Navigate to="/partner/register" replace />;
  }

  if (!partner) {
    return <Navigate to="/partner/status" replace />;
  }

  if (requireApproved && partner.status !== "approved") {
    return <Navigate to="/partner/status" replace />;
  }

  return <Outlet />;
};

export default PartnerRoute;
