import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

import {
  archiveMasterItemAdmin,
  createPromotionAdmin,
  deleteMasterItemAdmin,
  deletePromotionAdmin,
  getMasterItemAdmin,
  getSkuSafetyAdmin,
  listMasterItemsAdmin,
  listPromotionsAdmin,
  listSkuControlsAdmin,
  listWebsitePromotionsForUser,
  listWebsitePromotionsPublic,
  previewPromotionCode,
  quotePromotionCode,
  removeMasterItemImageAdmin,
  removePromotionDisplayImageAdmin,
  restoreMasterItemAdmin,
  searchMasterOptionsAdmin,
  updateMasterItemAdmin,
  updatePromotionAdmin,
  updateSkuControlAdmin,
  uploadMasterItemImageAdmin,
  uploadPromotionDisplayImageAdmin,
} from "./promotion.controller.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

const codePreviewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    valid: false,
    message: "Too many code checks. Please wait a few minutes and try again.",
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ]);

    if (!allowed.has(String(file.mimetype || "").toLowerCase())) {
      const error = new Error("Only JPG, PNG, WEBP and AVIF images are allowed");
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

// Public offer feed. Private client/customer-care offers are never exposed here.
router.get("/public/website", listWebsitePromotionsPublic);

router.use(protect);

// Logged-in website feed. This can include a private offer only when the
// signed-in user is explicitly part of that offer's audience.
router.get("/website", listWebsitePromotionsForUser);

// Authenticated unified checkout-code resolver. The server classifies normal
// HAMPORIUM promotions and approved partner codes; the browser never guesses.
router.post("/code/preview", codePreviewLimiter, previewPromotionCode);
router.post("/code/quote", codePreviewLimiter, quotePromotionCode);

// =====================================================
// PROMOTIONS
// =====================================================
router.get("/admin", adminAccess, listPromotionsAdmin);
router.post("/admin", adminAccess, createPromotionAdmin);
router.patch("/admin/:id", adminAccess, updatePromotionAdmin);
router.delete("/admin/:id", adminAccess, deletePromotionAdmin);

router.post(
  "/admin/:id/display-image/:slot",
  adminAccess,
  imageUpload.single("image"),
  uploadPromotionDisplayImageAdmin
);
router.delete(
  "/admin/:id/display-image/:slot",
  adminAccess,
  removePromotionDisplayImageAdmin
);

// =====================================================
// MARGIN / SKU SAFETY
// =====================================================
router.get("/admin/skus", adminAccess, listSkuControlsAdmin);
router.get("/admin/skus/:skuId/safety", adminAccess, getSkuSafetyAdmin);
router.put("/admin/skus/:skuId/control", adminAccess, updateSkuControlAdmin);

// =====================================================
// MASTER CONTROL - CATALOGUE
// =====================================================
router.get("/admin/master/options", adminAccess, searchMasterOptionsAdmin);
router.get("/admin/master/items", adminAccess, listMasterItemsAdmin);
router.get("/admin/master/items/:type/:id", adminAccess, getMasterItemAdmin);
router.patch("/admin/master/items/:type/:id", adminAccess, updateMasterItemAdmin);
router.post(
  "/admin/master/items/:type/:id/archive",
  adminAccess,
  archiveMasterItemAdmin
);
router.post(
  "/admin/master/items/:type/:id/restore",
  adminAccess,
  restoreMasterItemAdmin
);
router.delete(
  "/admin/master/items/:type/:id",
  adminAccess,
  deleteMasterItemAdmin
);
router.post(
  "/admin/master/items/:type/:id/images",
  adminAccess,
  imageUpload.single("image"),
  uploadMasterItemImageAdmin
);
router.delete(
  "/admin/master/items/:type/:id/images",
  adminAccess,
  removeMasterItemImageAdmin
);

export default router;
