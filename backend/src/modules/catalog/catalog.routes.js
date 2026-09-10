import { Router } from "express";
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

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    const validExtension = name.endsWith(".xlsx") || name.endsWith(".xls");

    if (!validExtension) {
      const error = new Error("Only Excel .xlsx or .xls files are allowed");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  },
});

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
  excelUpload.single("file"),
  previewProductMasterImport
);

router.post(
  "/admin/import/product-master/confirm",
  excelUpload.single("file"),
  confirmProductMasterImport
);

router.post(
  "/admin/import/product-master/complete-container",
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
