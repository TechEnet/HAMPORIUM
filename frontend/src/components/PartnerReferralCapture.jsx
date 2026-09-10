import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import api from "../api/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  clearStoredPartnerReferral,
  getStoredPartnerReferral,
  storePartnerReferral,
} from "../utils/partnerReferral.js";

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);

const PartnerReferralCapture = () => {
  const location = useLocation();
  const { user } = useAuth();
  const claimedRef = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const referralCode = normalizeCode(params.get("ref"));

    if (!referralCode) return undefined;

    let active = true;

    const capture = async () => {
      try {
        const response = await api.get(
          `/partners/referrals/resolve/${encodeURIComponent(referralCode)}`
        );

        if (!active || !response.data?.valid || !response.data?.referral) {
          return;
        }

        const referral = response.data.referral;
        const saved = storePartnerReferral({
          ...referral,
          projectId: params.get("project") || null,
          showcaseId: params.get("showcase") || null,
          source: "partner_link",
        });

        if (!saved || !user || user.roles?.includes("partner")) {
          return;
        }

        const userId = user.id || user._id || "user";
        const claimKey = `${userId}:${saved.referralCode}:${saved.projectId || ""}:${saved.showcaseId || ""}`;

        if (claimedRef.current === claimKey) return;
        claimedRef.current = claimKey;

        try {
          await api.post("/partners/referrals/claim", {
            referralCode: saved.referralCode,
            projectId: saved.projectId || null,
            showcaseId: saved.showcaseId || null,
            source: "partner_link",
          });
        } catch (error) {
          if (error.response?.status !== 400) throw error;

          await api.post("/partners/referrals/claim", {
            referralCode: saved.referralCode,
            source: "partner_link",
          });
        }
      } catch (error) {
        if (error.response?.status === 404) {
          const stored = getStoredPartnerReferral();
          if (normalizeCode(stored?.referralCode) === referralCode) {
            clearStoredPartnerReferral();
          }
          return;
        }

        console.error("Unable to capture partner referral:", error);
      }
    };

    void capture();

    return () => {
      active = false;
    };
  }, [location.search, user?.id, user?._id, user?.roles?.join("|")]);

  /*
   * IMPORTANT:
   * We intentionally do not pull an old persistent referral from the API and
   * silently restore it into localStorage. A normal retail order is attributed
   * only when the customer currently has an explicit promo/referral code.
   */
  return null;
};

export default PartnerReferralCapture;
