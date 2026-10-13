// PATH: backend/src/modules/catalog/productMasterImages.service.js
// HAMPORIUM V26 FULL REPLACEMENT
// EXACT PATH: backend/src/modules/catalog/productMasterImages.service.js
// HAMPORIUM V26 - LARGE DRIVE PHOTOS TO OPTIMIZED HIGH-QUALITY WEBP

import sharp from "sharp";
import uploadFile from "../../helpers/uploadFile.js";
import { ProductMasterDriveAsset } from "./productMasterImageSync.model.js";
import Product from "./product.model.js";
import SKU from "./sku.model.js";
import Component from "./component.model.js";
import Container from "./container.model.js";

const API_ROOT = "https://www.googleapis.com/drive/v3/files";
// Upper bound on ORIGINAL downloaded Drive media. Not a Cloudinary upload limit.
// Work with one original at a time to avoid Render memory spikes.
const MB = 1024 * 1024;
const MAX_FILE_BYTES = Math.min(64, Math.max(12, Number(process.env.DRIVE_IMAGE_MAX_MB || 50))) * MB;
const TARGET_IMAGE_BYTES = 3 * MB;
const MAX_INPUT_PIXELS = 42_000_000;
const OPTIMIZER_VERSION = "hamporium-webp-2200-q86-v26";
const MAX_FOLDER_IMAGES = 60;
const DRIVE_TIMEOUT_MS = 18000;
const IMAGE_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif",
]);

export function parseDriveAssetLink(input) {
  const value = String(input || "").trim();
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (!["drive.google.com", "docs.google.com"].includes(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const folderIndex = segments.indexOf("folders");
  const fileIndex = segments.indexOf("file");
  let type = "";
  let id = "";
  if (folderIndex >= 0) { type = "folder"; id = segments[folderIndex + 1] || ""; }
  else if (fileIndex >= 0 && segments[fileIndex + 1] === "d") {
    type = "file"; id = segments[fileIndex + 2] || "";
  } else if (url.pathname === "/open" || url.pathname === "/uc") {
    type = "file"; id = url.searchParams.get("id") || "";
  }
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(id)) return null;
  const resourceKey = url.searchParams.get("resourcekey") || "";
  if (resourceKey && !/^[a-zA-Z0-9_-]{1,250}$/.test(resourceKey)) return null;
  return { type, id, resourceKey };
}

function authHeaders(fileId, resourceKey) {
  return resourceKey
    ? { "X-Goog-Drive-Resource-Keys": `${fileId}/${resourceKey}` }
    : {};
}

async function driveRequest(path, params, { id, resourceKey } = {}) {
  const apiKey = String(process.env.GOOGLE_DRIVE_API_KEY || "").trim();
  if (!apiKey) throw new Error("GOOGLE_DRIVE_API_KEY missing on backend");
  const url = new URL(`${API_ROOT}${path}`);
  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: authHeaders(id, resourceKey),
    signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS),
    // Media downloads can legitimately redirect to googleusercontent.com.
    redirect: "follow",
  });
  if (!response.ok) {
    let reason = `Google Drive API HTTP ${response.status}`;
    try {
      const json = await response.json();
      reason += `: ${String(json?.error?.message || "").slice(0, 220)}`;
    } catch { /* use status code */ }
    throw new Error(reason);
  }
  return response;
}

// V24: Unlike Product Master, 09 Hamper Master sometimes points to a folder
// containing another SKU subfolder. Bounded traversal; no random recursive
// scanning of the owner's entire Drive and no arbitrary external hosts.
async function listFolderChildren(folder) {
  const all = [];
  let pageToken = "";
  let pages = 0;
  do {
    const response = await driveRequest("", {
      q: `'${folder.id}' in parents and trashed = false`,
      fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,size,md5Checksum,modifiedTime,resourceKey,shortcutDetails)",
      pageSize: 500,
      pageToken,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    }, folder);
    const payload = await response.json();
    if (payload.incompleteSearch) throw new Error("Drive returned an incomplete folder listing; no images were changed");
    all.push(...(payload.files || []));
    pageToken = payload.nextPageToken || "";
    pages += 1;
    if (pages >= 6 && pageToken) throw new Error("Drive folder too large for a safe image sync");
  } while (pageToken);
  return all;
}

const folderNameKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const imagePriority = (name) => /(?:^|[\s_\-.])(cover|hero|front|main|primary|01)(?:[\s_\-.]|$)/i.test(name || "") ? 0 : 1;

async function listFolderImages(folder, match = {}) {
  const seen = new Set();
  const skuKey = folderNameKey(match.sku);
  const MAX_FOLDER_DEPTH = 2; // original folder + at most two levels of children
  const MAX_CHILD_FOLDERS = 12;

  const visit = async (current, depth) => {
    if (!current?.id || seen.has(current.id)) return [];
    seen.add(current.id);
    const children = await listFolderChildren(current);
    const direct = children.filter((file) => IMAGE_MIME.has(String(file.mimeType || "").toLowerCase()));
    if (direct.length) return direct;
    if (depth >= MAX_FOLDER_DEPTH) return [];

    let folders = children.filter((file) => file.mimeType === "application/vnd.google-apps.folder");
    if (!folders.length) return [];
    folders.sort((a, b) => {
      const score = (item) => skuKey && folderNameKey(item.name).includes(skuKey) ? 1 : 0;
      return score(b) - score(a) || String(a.name).localeCompare(String(b.name), "en", { numeric: true });
    });
    // Multiple unrelated nested folders could be different products. Never
    // accidentally attach an arbitrary hamper's photo to the current SKU.
    if (folders.length > 1 && skuKey) {
      const exact = folders.filter((item) => folderNameKey(item.name).includes(skuKey));
      if (exact.length === 1) folders = exact;
      else if (!exact.length) {
        throw new Error(`Folder contains ${folders.length} subfolders and none match SKU ${match.sku}. Link the correct SKU folder directly.`);
      } else folders = exact;
    }
    if (folders.length > MAX_CHILD_FOLDERS) {
      throw new Error(`Folder contains ${folders.length} subfolders; please link the exact SKU folder (limit ${MAX_CHILD_FOLDERS})`);
    }
    for (const child of folders) {
      const nested = await visit({ id: child.id, resourceKey: child.resourceKey || "" }, depth + 1);
      if (nested.length) return nested;
    }
    return [];
  };

  const images = await visit(folder, 0);
  images.sort((a, b) => imagePriority(a.name) - imagePriority(b.name) ||
    String(a.name).localeCompare(String(b.name), "en", { numeric: true }));
  if (images.length > MAX_FOLDER_IMAGES) {
    throw new Error(`Folder contains ${images.length} images (limit ${MAX_FOLDER_IMAGES}); existing images were preserved`);
  }
  if (!images.length) {
    throw new Error(`No JPG/PNG/WEBP/AVIF/GIF photo found in Drive folder ${folder.id} or its first two nested levels. Verify sharing and actual image files.`);
  }
  return images;
}

// IMPORTANT: file.size is original image bytes. The converter needs to read
// the original before compressing it; only applying an 8MB/12MB upload limit
// before conversion makes optimization impossible.
async function fetchDriveImage(file) {
  if (!IMAGE_MIME.has(String(file.mimeType || "").toLowerCase())) {
    throw new Error(`Not an approved image: ${file.name}`);
  }
  if (Number(file.size || 0) > MAX_FILE_BYTES) {
    throw new Error(`Original Drive image ${file.name} exceeds ${Math.round(MAX_FILE_BYTES / MB)}MB safety limit. Reduce the source file size before retrying.`);
  }
  const response = await driveRequest(`/${encodeURIComponent(file.id)}`, { alt: "media" }, file);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType === "text/html" || contentType === "application/json") {
    throw new Error(`Drive returned a web/error page instead of an image for ${file.name}`);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_FILE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`Original Drive image ${file.name} exceeds ${Math.round(MAX_FILE_BYTES / MB)}MB safety limit.`);
  }
  if (!response.body) throw new Error(`Drive delivered an empty response for ${file.name}`);
  const reader = response.body.getReader();
  let byteCount = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > MAX_FILE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error(`Original Drive image ${file.name} exceeds ${Math.round(MAX_FILE_BYTES / MB)}MB safety limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!byteCount) throw new Error(`Empty image: ${file.name}`);
  const buffer = Buffer.concat(chunks, byteCount);
  const signatures = {
    "image/jpeg": buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    "image/png": buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/webp": buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP",
    "image/gif": ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6)),
    "image/avif": buffer.toString("ascii", 4, 16).includes("ftypavif") || buffer.toString("ascii", 4, 16).includes("ftypavis"),
  };
  if (!signatures[String(file.mimeType).toLowerCase()]) throw new Error(`Invalid image binary: ${file.name}`);
  return buffer;
}

/**
 * Resize once and upload a real WebP binary, not a renamed JPEG/PNG.
 * Longest side <=2200, quality starts at 86; progressively shrink only for
 * highly detailed originals exceeding the 3MB web-friendly target.
 * EXIF orientation applied, embedded metadata stripped; alpha retained.
 * Animated GIF/WebP are deliberately converted to the first frame.
 * Maximum decoded pixel count protects Render from decompression bombs.
 * Throws instead of silently committing a partial or corrupted gallery.
 */
export async function optimizeProductMasterImage(originalBuffer) {
  if (!Buffer.isBuffer(originalBuffer) || originalBuffer.length < 12) {
    throw new Error("Missing or invalid original image buffer");
  }
  if (originalBuffer.length > MAX_FILE_BYTES) {
    throw new Error(`Original exceeds ${Math.round(MAX_FILE_BYTES / MB)}MB limit`);
  }
  const opts = { limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true, failOn: "error", animated: false };
  let metadata;
  try {
    metadata = await sharp(originalBuffer, opts).metadata();
  } catch (error) {
    throw new Error(`Cannot decode image; check file integrity and dimensions: ${String(error.message).slice(0, 130)}`);
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw new Error(`Image dimensions exceed safe limit (${Math.round(MAX_INPUT_PIXELS / 1e6)} megapixels). Reduce camera resolution first.`);
  }
  // No output exceeds 2200px and WebP converts oversized raw uploads to
  // much lighter photos; no needless 12MB rejection before this step.
  const attempts = [
    { dimension: 2200, quality: 86 },
    { dimension: 2000, quality: 84 },
    { dimension: 1800, quality: 82 },
    { dimension: 1600, quality: 80 },
    { dimension: 1400, quality: 77 },
  ];
  for (const config of attempts) {
    let optimized;
    try {
      optimized = await sharp(originalBuffer, opts)
        .rotate()
        .resize({ width: config.dimension, height: config.dimension, fit: "inside", withoutEnlargement: true })
        .webp({ quality: config.quality, effort: 4, alphaQuality: 92, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
    } catch (error) {
      throw new Error(`Photo optimization failed: ${String(error.message).slice(0, 140)}`);
    }
    if (optimized.data.length <= TARGET_IMAGE_BYTES) {
      return {
        buffer: optimized.data,
        originalBytes: originalBuffer.length,
        optimizedBytes: optimized.data.length,
        width: optimized.info.width,
        height: optimized.info.height,
        format: "webp",
      };
    }
  }
  throw new Error("Optimized image still exceeds 3MB after resizing to 1400px. Please export this unusually detailed photo at lower resolution.");
}

async function getOrUploadAsset(file) {
  // Version suffix forces legacy (possibly massive) Cloudinary originals to be
  // converted exactly once upon resync, even when Drive file hasn't changed.
  const fingerprint = `${file.md5Checksum || ""}:${file.modifiedTime || ""}:${file.size || ""}:${OPTIMIZER_VERSION}`;
  const existing = await ProductMasterDriveAsset.findOne({ fileId: file.id }).lean();
  if (existing?.fingerprint === fingerprint && existing.url?.startsWith("https://")) {
    return { url: existing.url, publicId: existing.publicId, alt: file.name || "", previousUrl: "", originalBytes: 0, optimizedBytes: 0 };
  }
  const binary = await fetchDriveImage(file);
  const converted = await optimizeProductMasterImage(binary);
  // Existing uploadFile already accepts a Buffer. Pass WebP bytes, not the
  // original >12MB Drive photo; no Cloudinary helper or global limit changes.
  const uploaded = await uploadFile(converted.buffer, { folder: "hamporium/product-master" });
  const url = String(uploaded?.url || uploaded?.secure_url || "");
  const publicId = String(uploaded?.publicId || uploaded?.public_id || "");
  if (!url.startsWith("https://")) throw new Error(`Cloudinary returned no usable HTTPS URL for ${file.name}`);
  await ProductMasterDriveAsset.findOneAndUpdate(
    { fileId: file.id },
    { $set: { fingerprint, url, publicId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // No delete of old Cloudinary files; historical/manual galleries may refer
  // to them. Old URL is removed only from THIS SKU's synced gallery on resync.
  return { url, publicId, alt: file.name || "", previousUrl: existing?.url && existing.url !== url ? existing.url : "", originalBytes: converted.originalBytes, optimizedBytes: converted.optimizedBytes };
}

function mergeImages(current, incoming) {
  const superseded = new Set(incoming.map((item) => item.previousUrl).filter(Boolean));
  const seen = new Set();
  return [...incoming, ...(current || []).filter((item) => !superseded.has(String(item?.url || "")))]
    .filter((item) => {
      const url = String(item?.url || "").trim();
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((item) => ({ url: String(item.url), publicId: String(item.publicId || ""), alt: String(item.alt || "") }));
}

async function saveGalleryToCatalog(sku, images) {
  // Do NOT mutate manual products, pricing, inventory, capacity, or order references.
  const base = { "source.type": "product_master", "source.externalSku": sku };
  const models = [Component, Container, Product, SKU];
  let matched = 0;
  let changed = 0;
  for (const Model of models) {
    const documents = await Model.find(base).select("_id images").lean();
    matched += documents.length;
    for (const document of documents) {
      const merged = mergeImages(document.images, images);
      if (JSON.stringify(merged) === JSON.stringify(document.images || [])) continue;
      await Model.updateOne({ _id: document._id, "source.type": "product_master" }, { $set: { images: merged } });
      changed += 1;
    }
  }
  return { matched, changed };
}

export async function syncProductMasterImageEntry(entry) {
  const source = parseDriveAssetLink(entry.imageUrl);
  if (!source) {
    return { sku: entry.externalSku, name: entry.name, status: "failed", count: 0,
      message: "Not a supported Google Drive folder or file link" };
  }
  try {
    // Do not download/upload 10+ images if the source SKU is not imported.
    const base = { "source.type": "product_master", "source.externalSku": String(entry.externalSku) };
    const existingCounts = await Promise.all(
      [Component, Container, Product, SKU].map((Model) => Model.countDocuments(base))
    );
    if (!existingCounts.some((count) => count > 0)) {
      return { sku: entry.externalSku, name: entry.name, status: "not_found", count: 0,
        message: "SKU is not imported in Product/Container/Component/SKU. Import the workbook before image sync." };
    }
    const files = source.type === "folder"
      ? await listFolderImages(source, { sku: entry.externalSku, name: entry.name })
      : [await (async () => {
          const info = await driveRequest(`/${encodeURIComponent(source.id)}`, {
            fields: "id,name,mimeType,size,md5Checksum,modifiedTime,resourceKey",
            supportsAllDrives: "true",
          }, source);
          return { ...(await info.json()), resourceKey: source.resourceKey || "" };
        })()];
    if (files.length === 0) {
      return { sku: entry.externalSku, name: entry.name, status: "failed", count: 0,
        message: "No JPG/PNG/WEBP/AVIF/GIF images found inside the linked folder" };
    }
    // Fetch every image successfully before changing the database. Partial gallery is not committed.
    const images = [];
    // Sequential conversion prevents multiple 20-50MB originals + decoded
    // bitmaps in RAM simultaneously on small Render instances.
    for (const file of files) {
      images.push(await getOrUploadAsset(file));
    }
    const { matched, changed } = await saveGalleryToCatalog(entry.externalSku, images);
    if (!matched) {
      return { sku: entry.externalSku, name: entry.name, status: "not_found", count: images.length,
        message: "SKU not currently imported in HAMPORIUM; no catalogue data changed" };
    }
    const processed = images.filter((item) => item.originalBytes > 0);
    const inputMB = processed.reduce((sum, item) => sum + item.originalBytes, 0) / MB;
    const outputMB = processed.reduce((sum, item) => sum + item.optimizedBytes, 0) / MB;
    const reduced = inputMB > 0 ? Math.max(0, Math.round((1 - outputMB / inputMB) * 100)) : null;
    const saving = processed.length
      ? `; ${processed.length} photo(s) optimized ${inputMB.toFixed(1)}MB -> ${outputMB.toFixed(1)}MB (${reduced}% reduction)`
      : "; all photo(s) already cached in optimized WebP";
    return { sku: entry.externalSku, name: entry.name, status: changed ? "updated" : "unchanged",
      count: images.length, message: `${matched} catalogue record(s) matched${saving}` };
  } catch (error) {
    console.warn(`[ImageSync] ${entry.externalSku}: ${error.message}`);
    return { sku: entry.externalSku, name: entry.name, status: "failed", count: 0,
      message: String(error?.message || "Image import failed").slice(0, 300) };
  }
}
