import crypto from "crypto";
import jwt from "jsonwebtoken";

import asyncHandler from "../../utils/asyncHandler.js";

import sendOTP from "../../helpers/sendOTP.js";

import Partner from "../partners/partner.model.js";
import PartnerProject from "../partners/partnerProject.model.js";

import Showcase from "./showcase.model.js";

import {
  PARTNER_STATUS,
  PARTNER_PROJECT_STATUS,
  SHOWCASE_STATUS,
  SHOWCASE_CLIENT_ACTION,
} from "../../constants/statuses.js";


// ======================================================
// CONFIG
// ======================================================

const OTP_TTL_MINUTES =
  Number(
    process.env
      .SHOWCASE_OTP_TTL_MINUTES ||
      5
  );

const OTP_RESEND_SECONDS =
  Number(
    process.env
      .SHOWCASE_OTP_RESEND_SECONDS ||
      60
  );

const OTP_MAX_ATTEMPTS =
  Number(
    process.env
      .SHOWCASE_OTP_MAX_ATTEMPTS ||
      5
  );

const OTP_MAX_SENDS_PER_HOUR =
  Number(
    process.env
      .SHOWCASE_OTP_MAX_SENDS_PER_HOUR ||
      5
  );

const SESSION_TTL_MINUTES =
  Number(
    process.env
      .SHOWCASE_SESSION_TTL_MINUTES ||
      30
  );


// ======================================================
// HELPERS
// ======================================================

const createError = (
  statusCode,
  message
) => {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
};


const getUserId = (req) =>
  req.user?._id ||
  req.user?.id;


const sameId = (a, b) =>
  String(a || "") ===
  String(b || "");


const INTERNAL_ROLES =
  new Set([
    "admin",
    "operations",
  ]);


const isInternalUser = (req) => {
  const roles =
    Array.isArray(req.user?.roles)
      ? req.user.roles
      : [];

  return roles.some((role) =>
    INTERNAL_ROLES.has(
      String(role).toLowerCase()
    )
  );
};


const hasPartnerAccess = (
  partner,
  req
) => {
  if (isInternalUser(req)) {
    return true;
  }

  const userId =
    getUserId(req);

  if (
    sameId(
      partner.owner,
      userId
    )
  ) {
    return true;
  }

  return partner.members?.some(
    (member) =>
      member.isActive &&
      sameId(
        member.user,
        userId
      )
  );
};


const hashValue = (value) =>
  crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");


const createAccessToken = () =>
  crypto
    .randomBytes(32)
    .toString("hex");


const createOtp = () =>
  String(
    crypto.randomInt(
      100000,
      1000000
    )
  );


const hashOtp = (
  showcaseId,
  otp
) =>
  crypto
    .createHmac(
      "sha256",
      process.env.JWT_SECRET
    )
    .update(
      `${showcaseId}:${otp}`
    )
    .digest("hex");


const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();


const pushProjectStatus = (
  project,
  status,
  userId,
  note
) => {
  if (
    project.status === status
  ) {
    return;
  }

  project.status =
    status;

  project.statusHistory.push({
    status,
    changedBy:
      userId || undefined,
    note:
      note || "",
  });
};


// ======================================================
// SEND OTP USING EXISTING HELPER
// Supports common existing signatures:
// sendOTP(email, otp)
// OR sendOTP({ email, otp })
// ======================================================

const sendShowcaseOtp = async (email, otp) =>
  sendOTP({
    to: email,
    otp,
    purpose: "Showcase Access",
    expiresInMinutes: OTP_TTL_MINUTES,
  });


// ======================================================
// CLIENT SAFE PAYLOAD
// NEVER RETURN PARTNER ECONOMICS HERE
// ======================================================

const buildClientPayload =
  (showcase) => {
    const partner =
      showcase.partner;

    const project =
      showcase.project;

    return {
      showcaseId:
        showcase.showcaseId,

      title:
        showcase.title,

      introduction:
        showcase.introduction,

      expiresAt:
        showcase.expiresAt,

      partner: {
        businessName:
          partner?.businessName ||
          "",
        referralCode:
          partner?.referralCode ||
          "",
      },

      project: {
        title:
          project?.title ||
          "",

        eventType:
          project?.eventType ||
          "",

        eventDate:
          project?.eventDate ||
          null,

        requiredDeliveryDate:
          project?.requiredDeliveryDate ||
          null,
      },

      items:
        showcase.items.map(
          (item) => ({
            _id:
              item._id,

            projectItemId:
              item.projectItemId,

            product:
              item.product
                ? {
                    _id:
                      item.product._id,

                    name:
                      item.product.name,

                    slug:
                      item.product.slug,

                    images:
                      item.product.images,

                    shortDescription:
                      item.product
                        .shortDescription,

                    brand:
                      item.product.brand,
                  }
                : null,

            title:
              item.title,

            quantity:
              item.quantity,

            personalization:
              item.personalization,

            clientPrice:
              item.clientPrice,
          })
        ),

      actions:
        showcase.clientActions.map(
          (action) => ({
            _id:
              action._id,

            action:
              action.action,

            itemId:
              action.itemId,

            comment:
              action.comment,

            createdAt:
              action.createdAt,
          })
        ),
    };
  };


// ======================================================
// PARTNER ACCESS
// ======================================================

const getPartnerForUser =
  async (req) => {
    const userId =
      getUserId(req);

    return Partner.findOne({
      $or: [
        {
          owner:
            userId,
        },
        {
          members: {
            $elemMatch: {
              user:
                userId,
              isActive:
                true,
            },
          },
        },
      ],
    });
  };


const getShowcaseForAccess =
  async (id, req) => {
    const showcase =
      await Showcase.findById(
        id
      );

    if (!showcase) {
      throw createError(
        404,
        "Showcase not found."
      );
    }

    if (isInternalUser(req)) {
      return showcase;
    }

    const partner =
      await Partner.findById(
        showcase.partner
      );

    if (
      !partner ||
      !hasPartnerAccess(
        partner,
        req
      )
    ) {
      throw createError(
        403,
        "You do not have access to this showcase."
      );
    }

    return showcase;
  };


// ======================================================
// SESSION TOKEN
// ======================================================

const createSessionToken =
  (showcase) =>
    jwt.sign(
      {
        type:
          "showcase_access",

        showcaseId:
          String(
            showcase._id
          ),

        version:
          showcase.access
            .sessionVersion,
      },

      process.env.JWT_SECRET,

      {
        algorithm: "HS256",
        expiresIn:
          `${SESSION_TTL_MINUTES}m`,
      }
    );


const getSessionToken = (req) => {
  const direct =
    req.headers[
      "x-showcase-session"
    ];

  if (direct) {
    return direct;
  }

  const authorization =
    req.headers.authorization;

  if (
    authorization?.startsWith(
      "Bearer "
    )
  ) {
    return authorization.split(
      " "
    )[1];
  }

  return null;
};


const resolveSecureShowcase =
  async (req) => {
    const token =
      getSessionToken(req);

    if (!token) {
      throw createError(
        401,
        "Showcase session required."
      );
    }

    let decoded;

    try {
      decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET,
          {
            algorithms: [
              "HS256",
            ],
          }
        );
    } catch {
      throw createError(
        401,
        "Invalid or expired showcase session."
      );
    }

    if (
      decoded.type !==
      "showcase_access"
    ) {
      throw createError(
        401,
        "Invalid showcase session."
      );
    }

    const showcase =
      await Showcase.findById(
        decoded.showcaseId
      )
        .populate(
          "partner",
          "businessName referralCode"
        )
        .populate(
          "project",
          "title eventType eventDate requiredDeliveryDate status"
        )
        .populate(
          "items.product",
          "name slug images shortDescription brand"
        );

    if (!showcase) {
      throw createError(
        404,
        "Showcase not found."
      );
    }

    if (
      showcase.status !==
      SHOWCASE_STATUS.ACTIVE
    ) {
      throw createError(
        403,
        "This showcase is not active."
      );
    }

    if (
      showcase.expiresAt &&
      showcase.expiresAt <
        new Date()
    ) {
      showcase.status =
        SHOWCASE_STATUS.EXPIRED;

      await showcase.save();

      throw createError(
        403,
        "This showcase has expired."
      );
    }

    if (
      Number(
        decoded.version
      ) !==
      Number(
        showcase.access
          .sessionVersion
      )
    ) {
      throw createError(
        401,
        "Showcase session has been revoked."
      );
    }

    return showcase;
  };


// ======================================================
// CREATE SHOWCASE
// ======================================================

export const createShowcase =
  asyncHandler(
    async (req, res) => {
      const partner =
        await getPartnerForUser(
          req
        );

      if (!partner) {
        throw createError(
          404,
          "Partner account not found."
        );
      }

      if (
        partner.status !==
        PARTNER_STATUS.APPROVED
      ) {
        throw createError(
          403,
          "Only approved partners can create showcases."
        );
      }

      const {
        projectId,
        title,
        introduction,
        expiresAt,
      } = req.body || {};

      const project =
        await PartnerProject
          .findOne({
            _id:
              projectId,

            partner:
              partner._id,
          })
          .populate(
            "items.product",
            "name slug images shortDescription brand"
          );

      if (!project) {
        throw createError(
          404,
          "Partner project not found."
        );
      }

      if (
        ![
          PARTNER_PROJECT_STATUS
            .CLIENT_PRICE_APPROVED,
          PARTNER_PROJECT_STATUS
            .SHOWCASE_LIVE,
          PARTNER_PROJECT_STATUS
            .CLIENT_REVIEW,
        ].includes(
          project.status
        )
      ) {
        throw createError(
          400,
          "HAMPORIUM must approve client pricing before creating a showcase."
        );
      }

      const existing =
        await Showcase.findOne({
          project:
            project._id,
        });

      if (existing) {
        throw createError(
          409,
          "A showcase already exists for this project."
        );
      }

      const approvedItems =
        project.items.filter(
          (item) =>
            item.validationStatus ===
              "approved" &&
            Number(
              item.clientPrice
            ) > 0
        );

      if (
        !approvedItems.length
      ) {
        throw createError(
          400,
          "Project has no approved client-facing items."
        );
      }

      const showcase =
        await Showcase.create({
          partner:
            partner._id,

          project:
            project._id,

          createdBy:
            getUserId(req),

          title:
            String(
              title ||
                project.title
            ).trim(),

          introduction:
            String(
              introduction ||
                ""
            ).trim(),

          client: {
            name:
              project.client.name,

            email:
              normalizeEmail(
                project.client.email
              ),
          },

          items:
            approvedItems.map(
              (item) => ({
                projectItemId:
                  item._id,

                product:
                  item.product?._id ||
                  item.product ||
                  undefined,

                title:
                  item.requestedTitle ||
                  item.product?.name ||
                  "",

                quantity:
                  item.quantity,

                personalization:
                  item.personalization,

                clientPrice:
                  item.clientPrice,
              })
            ),

          expiresAt:
            expiresAt
              ? new Date(
                  expiresAt
                )
              : new Date(
                  Date.now() +
                    7 *
                      24 *
                      60 *
                      60 *
                      1000
                ),

          status:
            SHOWCASE_STATUS.DRAFT,
        });

      res.status(201).json({
        success: true,
        message:
          "Private showcase created.",
        showcase,
      });
    }
  );


// ======================================================
// MY SHOWCASES
// ======================================================

export const getMyShowcases =
  asyncHandler(
    async (req, res) => {
      const partner =
        await getPartnerForUser(
          req
        );

      if (!partner) {
        return res.json({
          success: true,
          showcases: [],
        });
      }

      const showcases =
        await Showcase.find({
          partner:
            partner._id,
        })
          .populate(
            "project",
            "projectId title status client eventDate"
          )
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        showcases,
      });
    }
  );


// ======================================================
// SHOWCASE DETAIL PARTNER/ADMIN
// ======================================================

export const getShowcaseById =
  asyncHandler(
    async (req, res) => {
      const showcase =
        await getShowcaseForAccess(
          req.params.id,
          req
        );

      await showcase.populate([
        {
          path: "partner",
          select:
            "partnerId businessName status",
        },
        {
          path: "project",
          select:
            "projectId title client status eventType eventDate clientPriceTotal",
        },
        {
          path: "items.product",
          select:
            "name slug images shortDescription brand",
        },
      ]);

      res.json({
        success: true,
        showcase,
      });
    }
  );


// ======================================================
// PUBLISH / REGENERATE LINK
// ======================================================

export const publishShowcase =
  asyncHandler(
    async (req, res) => {
      const showcase =
        await getShowcaseForAccess(
          req.params.id,
          req
        );

      const project =
        await PartnerProject.findById(
          showcase.project
        );

      if (!project) {
        throw createError(
          404,
          "Partner project not found."
        );
      }

      if (
        ![
          PARTNER_PROJECT_STATUS
            .CLIENT_PRICE_APPROVED,
          PARTNER_PROJECT_STATUS
            .SHOWCASE_LIVE,
          PARTNER_PROJECT_STATUS
            .CLIENT_REVIEW,
        ].includes(
          project.status
        )
      ) {
        throw createError(
          400,
          "Project is not ready for showcase publishing."
        );
      }

      if (
        showcase.expiresAt &&
        showcase.expiresAt <=
          new Date()
      ) {
        showcase.expiresAt =
          new Date(
            Date.now() +
              7 *
                24 *
                60 *
                60 *
                1000
          );
      }

      const rawToken =
        createAccessToken();

      showcase.access.tokenHash =
        hashValue(
          rawToken
        );

      showcase.access.publishedAt =
        new Date();

      showcase.access.revokedAt =
        null;

      showcase.access.sessionVersion +=
        1;

      showcase.access.otpHash =
        null;

      showcase.access.otpExpiresAt =
        null;

      showcase.access.otpAttempts =
        0;

      showcase.status =
        SHOWCASE_STATUS.ACTIVE;

      await showcase.save();

      pushProjectStatus(
        project,
        PARTNER_PROJECT_STATUS.SHOWCASE_LIVE,
        getUserId(req),
        "Private showcase published."
      );

      project.nextAction =
        "Client OTP review";

      await project.save();

      const partnerRecord = await Partner.findById(showcase.partner).select("referralCode");

      res.json({
        success: true,
        message:
          "Showcase published.",

        showcaseId:
          showcase._id,

        accessToken:
          rawToken,

        referralCode:
          partnerRecord?.referralCode || "",

        sharePath:
          `/showcase/${rawToken}${partnerRecord?.referralCode ? `?ref=${encodeURIComponent(partnerRecord.referralCode)}` : ""}`,

        expiresAt:
          showcase.expiresAt,
      });
    }
  );


// ======================================================
// REVOKE
// ======================================================

export const revokeShowcase =
  asyncHandler(
    async (req, res) => {
      const showcase =
        await getShowcaseForAccess(
          req.params.id,
          req
        );

      showcase.status =
        SHOWCASE_STATUS.REVOKED;

      showcase.access.revokedAt =
        new Date();

      showcase.access.sessionVersion +=
        1;

      showcase.access.tokenHash =
        null;

      showcase.access.otpHash =
        null;

      showcase.access.otpExpiresAt =
        null;

      await showcase.save();

      res.json({
        success: true,
        message:
          "Showcase access revoked.",
      });
    }
  );


// ======================================================
// ADMIN SHOWCASE LIST
// ======================================================

export const getShowcasesAdmin =
  asyncHandler(
    async (req, res) => {
      const filter = {};

      if (req.query.status) {
        filter.status =
          req.query.status;
      }

      const showcases =
        await Showcase.find(
          filter
        )
          .populate(
            "partner",
            "partnerId businessName"
          )
          .populate(
            "project",
            "projectId title status client"
          )
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        showcases,
      });
    }
  );


// ======================================================
// PUBLIC REQUEST OTP
// ======================================================

export const requestShowcaseOtp =
  asyncHandler(
    async (req, res) => {
      const token =
        String(
          req.params.token ||
            ""
        ).trim();

      const email =
        normalizeEmail(
          req.body?.email
        );

      if (
        !token ||
        !email
      ) {
        throw createError(
          400,
          "Email is required."
        );
      }

      const showcase =
        await Showcase.findOne({
          "access.tokenHash":
            hashValue(token),
        }).select(
          "+access.tokenHash +access.otpHash +access.otpExpiresAt +access.otpAttempts +access.otpLastSentAt +access.otpWindowStartedAt +access.otpSendCount"
        );

      if (
        !showcase ||
        showcase.status !==
          SHOWCASE_STATUS.ACTIVE
      ) {
        throw createError(
          404,
          "Showcase is unavailable."
        );
      }

      if (
        showcase.expiresAt &&
        showcase.expiresAt <
          new Date()
      ) {
        showcase.status =
          SHOWCASE_STATUS.EXPIRED;

        await showcase.save();

        throw createError(
          410,
          "Showcase has expired."
        );
      }

      /*
        Avoid exposing invited email.
        Same response for wrong email.
      */

      if (
        normalizeEmail(
          showcase.client.email
        ) !== email
      ) {
        return res.json({
          success: true,
          message:
            "If this email is authorized, an OTP has been sent.",
        });
      }

      const now =
        new Date();

      const windowExpired =
        !showcase.access
          .otpWindowStartedAt ||
        now.getTime() -
          new Date(
            showcase.access
              .otpWindowStartedAt
          ).getTime() >
          60 * 60 * 1000;

      if (windowExpired) {
        showcase.access.otpWindowStartedAt =
          now;

        showcase.access.otpSendCount =
          0;
      }

      if (
        showcase.access
          .otpSendCount >=
        OTP_MAX_SENDS_PER_HOUR
      ) {
        throw createError(
          429,
          "Too many OTP requests. Please try again later."
        );
      }

      if (
        showcase.access
          .otpLastSentAt
      ) {
        const secondsSinceLast =
          (now.getTime() -
            new Date(
              showcase.access
                .otpLastSentAt
            ).getTime()) /
          1000;

        if (
          secondsSinceLast <
          OTP_RESEND_SECONDS
        ) {
          throw createError(
            429,
            `Please wait ${Math.ceil(
              OTP_RESEND_SECONDS -
                secondsSinceLast
            )} seconds before requesting another OTP.`
          );
        }
      }

      const otp =
        createOtp();

      showcase.access.otpHash =
        hashOtp(
          showcase._id,
          otp
        );

      showcase.access.otpExpiresAt =
        new Date(
          Date.now() +
            OTP_TTL_MINUTES *
              60 *
              1000
        );

      showcase.access.otpAttempts =
        0;

      showcase.access.otpLastSentAt =
        now;

      showcase.access.otpSendCount +=
        1;

      await showcase.save();

      await sendShowcaseOtp(
        email,
        otp
      );

      res.json({
        success: true,
        message:
          "If this email is authorized, an OTP has been sent.",
        expiresInMinutes:
          OTP_TTL_MINUTES,
      });
    }
  );


// ======================================================
// PUBLIC VERIFY OTP
// ======================================================

export const verifyShowcaseOtp =
  asyncHandler(
    async (req, res) => {
      const token =
        String(
          req.params.token ||
            ""
        ).trim();

      const email =
        normalizeEmail(
          req.body?.email
        );

      const otp =
        String(
          req.body?.otp ||
            ""
        ).trim();

      if (
        !token ||
        !email ||
        !otp
      ) {
        throw createError(
          400,
          "Email and OTP are required."
        );
      }

      const showcase =
        await Showcase.findOne({
          "access.tokenHash":
            hashValue(token),
        }).select(
          "+access.tokenHash +access.otpHash +access.otpExpiresAt +access.otpAttempts"
        );

      if (
        !showcase ||
        showcase.status !==
          SHOWCASE_STATUS.ACTIVE
      ) {
        throw createError(
          404,
          "Showcase is unavailable."
        );
      }

      if (
        normalizeEmail(
          showcase.client.email
        ) !== email
      ) {
        throw createError(
          400,
          "Invalid OTP or email."
        );
      }

      if (
        !showcase.access
          .otpHash ||
        !showcase.access
          .otpExpiresAt
      ) {
        throw createError(
          400,
          "Request a new OTP."
        );
      }

      if (
        new Date(
          showcase.access
            .otpExpiresAt
        ) < new Date()
      ) {
        showcase.access.otpHash =
          null;

        showcase.access.otpExpiresAt =
          null;

        await showcase.save();

        throw createError(
          400,
          "OTP has expired."
        );
      }

      if (
        showcase.access
          .otpAttempts >=
        OTP_MAX_ATTEMPTS
      ) {
        throw createError(
          429,
          "Too many incorrect attempts. Request a new OTP."
        );
      }

      const submittedHash =
        hashOtp(
          showcase._id,
          otp
        );

      const valid =
        crypto.timingSafeEqual(
          Buffer.from(
            submittedHash,
            "hex"
          ),
          Buffer.from(
            showcase.access
              .otpHash,
            "hex"
          )
        );

      if (!valid) {
        showcase.access.otpAttempts +=
          1;

        await showcase.save();

        throw createError(
          400,
          "Invalid OTP or email."
        );
      }

      showcase.access.otpHash =
        null;

      showcase.access.otpExpiresAt =
        null;

      showcase.access.otpAttempts =
        0;

      showcase.access.lastAccessAt =
        new Date();

      showcase.access.accessCount +=
        1;

      await showcase.save();

      const project =
        await PartnerProject.findById(
          showcase.project
        );

      if (
        project &&
        project.status ===
          PARTNER_PROJECT_STATUS
            .SHOWCASE_LIVE
      ) {
        pushProjectStatus(
          project,
          PARTNER_PROJECT_STATUS.CLIENT_REVIEW,
          undefined,
          "Client accessed the private showcase."
        );

        project.nextAction =
          "Client review";

        await project.save();
      }

      const sessionToken =
        createSessionToken(
          showcase
        );

      res.json({
        success: true,
        message:
          "Showcase access verified.",
        sessionToken,
        expiresInMinutes:
          SESSION_TTL_MINUTES,
      });
    }
  );


// ======================================================
// SECURE CLIENT VIEW
// ======================================================

export const getPublicShowcase =
  asyncHandler(
    async (req, res) => {
      const showcase =
        await resolveSecureShowcase(
          req
        );

      res.json({
        success: true,
        showcase:
          buildClientPayload(
            showcase
          ),
      });
    }
  );


// ======================================================
// CLIENT ACTION
// ======================================================

export const recordClientAction =
  asyncHandler(
    async (req, res) => {
      const showcase =
        await resolveSecureShowcase(
          req
        );

      const {
        action,
        itemId,
        comment,
      } = req.body || {};

      if (
        !Object.values(
          SHOWCASE_CLIENT_ACTION
        ).includes(action)
      ) {
        throw createError(
          400,
          "Invalid client action."
        );
      }

      if (
        [
          SHOWCASE_CLIENT_ACTION
            .SHORTLIST,
          SHOWCASE_CLIENT_ACTION
            .UNSHORTLIST,
        ].includes(action) &&
        !itemId
      ) {
        throw createError(
          400,
          "Item is required for this action."
        );
      }

      if (
        [
          SHOWCASE_CLIENT_ACTION
            .COMMENT,
          SHOWCASE_CLIENT_ACTION
            .REQUEST_CHANGE,
        ].includes(action) &&
        !String(
          comment || ""
        ).trim()
      ) {
        throw createError(
          400,
          "Comment is required."
        );
      }

      showcase.clientActions.push({
        action,

        itemId:
          itemId || undefined,

        comment:
          String(
            comment || ""
          ).trim(),
      });

      await showcase.save();

      const project =
        await PartnerProject.findById(
          showcase.project
        );

      if (project) {
        if (
          action ===
          SHOWCASE_CLIENT_ACTION.APPROVE
        ) {
          pushProjectStatus(
            project,
            PARTNER_PROJECT_STATUS.CLIENT_APPROVED,
            undefined,
            "Client approved the private showcase."
          );

          project.nextAction =
            "Create enquiry/order attribution";
        } else if (
          action ===
          SHOWCASE_CLIENT_ACTION.ENQUIRE
        ) {
          pushProjectStatus(
            project,
            PARTNER_PROJECT_STATUS.ENQUIRY,
            undefined,
            "Client enquiry captured from private showcase."
          );

          project.nextAction =
            "HAMPORIUM follow-up";
        } else if (
          action ===
          SHOWCASE_CLIENT_ACTION.REQUEST_CHANGE
        ) {
          pushProjectStatus(
            project,
            PARTNER_PROJECT_STATUS.CHANGES_REQUESTED,
            undefined,
            "Client requested showcase changes."
          );

          project.nextAction =
            "Partner/HAMPORIUM revision";
        } else if (
          project.status ===
          PARTNER_PROJECT_STATUS.SHOWCASE_LIVE
        ) {
          pushProjectStatus(
            project,
            PARTNER_PROJECT_STATUS.CLIENT_REVIEW,
            undefined,
            "Client activity captured."
          );
        }

        await project.save();
      }

      res.status(201).json({
        success: true,
        message:
          "Client action recorded.",
      });
    }
  );