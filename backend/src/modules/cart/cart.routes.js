import { Router } from "express";
import multer from "multer";

import protect from "../../middlewares/auth.middleware.js";

import {
  getCart,
  addCartItem,
  addCustomHamper,
  updateCartItem,
  updateCustomHamperQuantity,
  removeCartItem,
  removeCustomHamper,
  clearCart,
  uploadCustomHamperPersonalizationAsset,
  deleteCustomHamperPersonalizationAsset,
} from "./cart.controller.js";

const router = Router();

const allowedPersonalizationMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const personalizationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    callback(null, allowedPersonalizationMimeTypes.has(file.mimetype));
  },
}).single("image");

const handlePersonalizationUpload = (req, res, next) => {
  personalizationUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Personalization image must be 5 MB or smaller"
            : "Unable to read personalization image upload",
      });
    }

    next();
  });
};

router.use(protect);

router.get("/", getCart);

router.post("/items", addCartItem);
router.patch("/items/:skuId", updateCartItem);
router.delete("/items/:skuId", removeCartItem);

router.post(
  "/custom-hampers/personalization-assets",
  handlePersonalizationUpload,
  uploadCustomHamperPersonalizationAsset
);
router.delete(
  "/custom-hampers/personalization-assets",
  deleteCustomHamperPersonalizationAsset
);

router.post("/custom-hampers", addCustomHamper);
router.patch("/custom-hampers/:cartItemId", updateCustomHamperQuantity);
router.delete("/custom-hampers/:cartItemId", removeCustomHamper);

router.delete("/", clearCart);

export default router;
