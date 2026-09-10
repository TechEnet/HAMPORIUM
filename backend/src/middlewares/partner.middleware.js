import Partner from "../modules/partners/partner.model.js";
import { PARTNER_STATUS } from "../constants/statuses.js";

const getPartnerForUser = async (userId) =>
  Partner.findOne({
    $or: [
      { owner: userId },
      {
        members: {
          $elemMatch: {
            user: userId,
            isActive: true,
          },
        },
      },
    ],
  });

export const requirePartner = async (req, res, next) => {
  try {
    const partner = await getPartnerForUser(req.user?._id);

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Partner account required",
      });
    }

    req.partner = partner;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireApprovedPartner = async (req, res, next) => {
  try {
    const partner = req.partner || (await getPartnerForUser(req.user?._id));

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Partner account required",
      });
    }

    if (partner.status !== PARTNER_STATUS.APPROVED) {
      return res.status(403).json({
        success: false,
        message: "Partner approval is required for this action",
        partnerStatus: partner.status,
      });
    }

    req.partner = partner;
    next();
  } catch (error) {
    next(error);
  }
};

export const requirePartnerAdmin = async (req, res, next) => {
  try {
    const partner = req.partner || (await getPartnerForUser(req.user?._id));

    if (!partner) {
      return res.status(403).json({
        success: false,
        message: "Partner account required",
      });
    }

    const userId = String(req.user?._id || "");
    const owner = String(partner.owner || "") === userId;
    const adminMember = partner.members?.some(
      (member) =>
        member.isActive &&
        member.role === "partner_admin" &&
        String(member.user || "") === userId
    );

    if (!owner && !adminMember) {
      return res.status(403).json({
        success: false,
        message: "Partner administrator access required",
      });
    }

    req.partner = partner;
    next();
  } catch (error) {
    next(error);
  }
};
