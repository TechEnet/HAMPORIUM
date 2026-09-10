import express from "express";
import multer from "multer";

import protect from "../../middlewares/auth.middleware.js";

import {
  createDocument,
  getEntityDocuments,
  getDocumentById,
  replaceDocument,
  archiveDocument,
} from "./document.controller.js";


const router = express.Router();


const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",

  "application/pdf",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);


const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (
      !allowedMimeTypes.has(
        file.mimetype
      )
    ) {
      return cb(
        new Error(
          "Unsupported file type. Upload image, PDF, Word or Excel files."
        )
      );
    }

    cb(null, true);
  },
});


router.use(protect);


// ======================================
// CREATE / UPLOAD
// Customer + Internal staff
// ======================================

router.post(
  "/",
  upload.single("file"),
  createDocument
);


// ======================================
// ENTITY DOCUMENT LIST
// ======================================

router.get(
  "/entity/:entityType/:entityId",
  getEntityDocuments
);


// ======================================
// REPLACE DOCUMENT VERSION
// ======================================

router.post(
  "/:id/replace",
  upload.single("file"),
  replaceDocument
);


// ======================================
// ARCHIVE
// ======================================

router.patch(
  "/:id/archive",
  archiveDocument
);


// ======================================
// SINGLE DOCUMENT
// ======================================

router.get(
  "/:id",
  getDocumentById
);


export default router;