import { Router } from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import multer from "multer";

import {
  getCategories,
  getCollections,
  getComponents,
  getContainers,
  getProducts,
  getProductBySlug,
  validateConfiguration,

  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,

  getAdminCollections,
  createCollection,
  updateCollection,
  deleteCollection,

  getAdminComponents,
  getAdminComponentById,
  createComponent,
  updateComponent,
  deleteComponent,

  getAdminContainers,
  getAdminContainerById,
  createContainer,
  updateContainer,
  deleteContainer,

  getAdminProducts,
  getAdminProductById,
  createProduct,
  updateProduct,
  deleteProduct,

  createSKU,
  updateSKU,
  deleteSKU,

  uploadCatalogImage,
  deleteCatalogImage,
  previewProductMasterImport,
  confirmProductMasterImport,
  completeProductMasterContainerReview,
} from "./catalog.controller.js";

import protect from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/access.middleware.js";
import { ROLES } from "../../constants/roles.js";

const router = Router();
const adminAccess = allowRoles(ROLES.ADMIN, ROLES.OPERATIONS);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error("Only JPG, PNG, WEBP and AVIF images are allowed");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  },
});

/* =========================================================
   PRODUCT MASTER EXCEL UPLOAD - DISK + STREAM-DIRECT PARSE
========================================================= */

/*
 * Do NOT keep procurement workbooks in process memory. The real HAMPORIUM
 * workbook is ~9 MB compressed but expands to well over 100 MB of worksheet
 * XML. multer.memoryStorage() keeps the compressed upload alive in V8 while
 * SheetJS is also building worksheet objects, which can push a small Render
 * instance over its memory limit.
 *
 * Store the upload on Render's ephemeral /tmp filesystem instead. The
 * controller streams only Product Master-related data into a tiny compact workbook, and this middleware
 * removes the temp file as soon as the response finishes/closes.
 */
const productMasterTempDir = path.join(
  os.tmpdir(),
  "hamporium-product-master"
);
fs.mkdirSync(productMasterTempDir, { recursive: true });

const excelUpload = multer({
  dest: productMasterTempDir,
  limits: {
    // Current real workbook is ~9 MB. Keep a defensive ceiling so a very large
    // workbook cannot unexpectedly consume hundreds of MB while parsing.
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    const validExtension =
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".xlsm");

    if (!validExtension) {
      const error = new Error("Only Excel .xlsx, .xls or .xlsm files are allowed");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  },
});

let activeProductMasterRequest = null;

const productMasterRequestGuard = (req, res, next) => {
  if (activeProductMasterRequest) {
    res.setHeader("Retry-After", "5");
    return res.status(429).json({
      success: false,
      message:
        "Another Product Master analyze/import is already running. Wait a few seconds and try again.",
    });
  }

  const token = Symbol("product-master-request");
  activeProductMasterRequest = token;
  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;

    if (activeProductMasterRequest === token) {
      activeProductMasterRequest = null;
    }

    const tempPath = req.file?.path;
    if (tempPath) {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  };

  res.once("finish", cleanup);
  res.once("close", cleanup);

  next();
};

/* =========================================================
   PUBLIC
========================================================= */

router.get("/categories", getCategories);
router.get("/collections", getCollections);
router.get("/components", getComponents);
router.get("/containers", getContainers);
router.post("/configurations/validate", validateConfiguration);
router.get("/products", getProducts);
router.get("/products/:slug", getProductBySlug);

/* =========================================================
   ADMIN PROTECTION
========================================================= */

router.use("/admin", protect, adminAccess);

/* =========================================================
   IMAGE UPLOAD
========================================================= */

router.post("/admin/upload-image", upload.single("image"), uploadCatalogImage);
router.delete("/admin/upload-image", deleteCatalogImage);

/* =========================================================
   ADMIN PRODUCT MASTER IMPORT
========================================================= */

router.post(
  "/admin/import/product-master/preview",
  productMasterRequestGuard,
  excelUpload.single("file"),
  previewProductMasterImport
);

router.post(
  "/admin/import/product-master/confirm",
  productMasterRequestGuard,
  excelUpload.single("file"),
  confirmProductMasterImport
);

router.post(
  "/admin/import/product-master/complete-container",
  productMasterRequestGuard,
  excelUpload.single("file"),
  completeProductMasterContainerReview
);

/* =========================================================
   ADMIN CATEGORIES
========================================================= */

router.get("/admin/categories", getAdminCategories);
router.post("/admin/categories", createCategory);
router.patch("/admin/categories/:categoryId", updateCategory);
router.delete("/admin/categories/:categoryId", deleteCategory);

/* =========================================================
   ADMIN COLLECTIONS
========================================================= */

router.get("/admin/collections", getAdminCollections);
router.post("/admin/collections", createCollection);
router.patch("/admin/collections/:collectionId", updateCollection);
router.delete("/admin/collections/:collectionId", deleteCollection);

/* =========================================================
   ADMIN COMPONENTS
========================================================= */

router.get("/admin/components", getAdminComponents);
router.get("/admin/components/:componentId", getAdminComponentById);
router.post("/admin/components", createComponent);
router.patch("/admin/components/:componentId", updateComponent);
router.delete("/admin/components/:componentId", deleteComponent);

/* =========================================================
   ADMIN CONTAINERS
========================================================= */

router.get("/admin/containers", getAdminContainers);
router.get("/admin/containers/:containerId", getAdminContainerById);
router.post("/admin/containers", createContainer);
router.patch("/admin/containers/:containerId", updateContainer);
router.delete("/admin/containers/:containerId", deleteContainer);

/* =========================================================
   ADMIN PRODUCTS
========================================================= */

router.get("/admin/products", getAdminProducts);
router.get("/admin/products/:productId", getAdminProductById);
router.post("/admin/products", createProduct);
router.patch("/admin/products/:productId", updateProduct);
router.delete("/admin/products/:productId", deleteProduct);

/* =========================================================
   ADMIN SKUS
========================================================= */

router.post("/admin/products/:productId/skus", createSKU);
router.patch("/admin/skus/:skuId", updateSKU);
router.delete("/admin/skus/:skuId", deleteSKU);

export default router;
