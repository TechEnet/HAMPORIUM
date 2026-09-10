export const isAdminUser = (user) =>
  Boolean(
    user?.roles?.some((role) => ["admin", "operations"].includes(role))
  );

export const isPartnerUser = (user) =>
  Boolean(user?.roles?.includes("partner"));

export const getPartnerLandingPath = (partner) =>
  partner?.status === "approved" ? "/partner" : "/partner/status";

export const getPostAuthPath = ({ user, partner, requestedPath = "" }) => {
  if (requestedPath) return requestedPath;
  if (isAdminUser(user)) return "/admin";
  if (isPartnerUser(user)) return getPartnerLandingPath(partner);
  return "/account";
};
