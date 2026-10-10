import uploadFile from "../../helpers/uploadFile.js";
import { ProductMasterDriveAsset } from "./productMasterImageSync.model.js";
import Product from "./product.model.js";
import SKU from "./sku.model.js";
import Component from "./component.model.js";
import Container from "./container.model.js";

const API_ROOT = "https://www.googleapis.com/drive/v3/files";
const MAX_FILE_BYTES = 12 * 1024 * 1024;
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

async function listFolderImages(folder) {
  const all = [];
  let pageToken = "";
  let pages = 0;
  do {
    const response = await driveRequest("", {
      q: `'${folder.id}' in parents and trashed = false`,
      fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,size,md5Checksum,modifiedTime,resourceKey)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    }, folder);
    const payload = await response.json();
    if (payload.incompleteSearch) throw new Error("Google Drive returned an incomplete folder listing; no images were changed");
    all.push(...(payload.files || []));
    pageToken = payload.nextPageToken || "";
    pages += 1;
    if (pages > 10) throw new Error("Folder is unusually large; sync stopped safely");
  } while (pageToken);
  const images = all.filter((file) => IMAGE_MIME.has(String(file.mimeType || "").toLowerCase()));
  images.sort((a, b) => {
    const priority = (name) => /(?:^|[\s_\-.])(cover|hero|front|main|primary|01)(?:[\s_\-.]|$)/i.test(name || "") ? 0 : 1;
    return priority(a.name) - priority(b.name) || String(a.name).localeCompare(String(b.name), "en", { numeric: true });
  });
  if (images.length > MAX_FOLDER_IMAGES) {
    throw new Error(`Folder contains ${images.length} images (limit ${MAX_FOLDER_IMAGES}); existing images were preserved`);
  }
  return images;
}

async function fetchDriveImage(file) {
  if (!IMAGE_MIME.has(String(file.mimeType || "").toLowerCase())) {
    throw new Error(`Not an approved image: ${file.name}`);
  }
  if (Number(file.size || 0) > MAX_FILE_BYTES) throw new Error(`Image too large: ${file.name}`);
  const response = await driveRequest(`/${encodeURIComponent(file.id)}`, { alt: "media" }, file);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType === "text/html" || contentType === "application/json") {
    throw new Error(`Drive returned a web/error page instead of an image for ${file.name}`);
  }
  const size = Number(response.headers.get("content-length") || 0);
  if (size > MAX_FILE_BYTES) throw new Error(`Image exceeds 12MB: ${file.name}`);
  // Stream with a byte limit. Prevents unexpectedly huge remote responses from exhausting Render RAM.
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > MAX_FILE_BYTES) {
      await response.body.cancel().catch(() => {});
      throw new Error(`Image exceeds 12MB: ${file.name}`);
    }
    chunks.push(chunk);
  }
  if (!length) throw new Error(`Empty image: ${file.name}`);
  const buffer = Buffer.concat(chunks);
  // Validate the actual byte signature so an HTML/error payload cannot be stored as an image.
  const signatures = {
    "image/jpeg": buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    "image/png": buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/webp": buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP",
    "image/gif": ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6)),
    "image/avif": buffer.toString("ascii", 4, 12).includes("ftypavif") || buffer.toString("ascii", 4, 16).includes("ftypavis"),
  };
  if (!signatures[String(file.mimeType).toLowerCase()]) throw new Error(`Invalid image binary: ${file.name}`);
  return buffer;
}

async function getOrUploadAsset(file) {
  const fingerprint = `${file.md5Checksum || ""}:${file.modifiedTime || ""}:${file.size || ""}`;
  const existing = await ProductMasterDriveAsset.findOne({ fileId: file.id }).lean();
  if (existing?.fingerprint === fingerprint && existing.url?.startsWith("https://")) {
    return { url: existing.url, publicId: existing.publicId, alt: file.name || "" };
  }
  const binary = await fetchDriveImage(file);
  const uploaded = await uploadFile(binary, { folder: "hamporium/product-master" });
  await ProductMasterDriveAsset.findOneAndUpdate(
    { fileId: file.id },
    { $set: { fingerprint, url: uploaded.url, publicId: uploaded.publicId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // Replacing cached assets deliberately never deletes previous Cloudinary media;
  // an older catalogue row could still reference that URL.
  return { url: uploaded.url, publicId: uploaded.publicId, alt: file.name || "" };
}

function mergeImages(current, incoming) {
  const seen = new Set();
  return [...incoming, ...(current || [])]
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
    const files = source.type === "folder"
      ? await listFolderImages(source)
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
    for (let index = 0; index < files.length; index += 3) {
      const batch = await Promise.all(files.slice(index, index + 3).map(getOrUploadAsset));
      images.push(...batch);
    }
    const { matched, changed } = await saveGalleryToCatalog(entry.externalSku, images);
    if (!matched) {
      return { sku: entry.externalSku, name: entry.name, status: "not_found", count: images.length,
        message: "SKU not currently imported in HAMPORIUM; no catalogue data changed" };
    }
    return { sku: entry.externalSku, name: entry.name, status: changed ? "updated" : "unchanged",
      count: images.length, message: `${matched} catalogue record(s) matched` };
  } catch (error) {
    console.warn(`[ImageSync] ${entry.externalSku}: ${error.message}`);
    return { sku: entry.externalSku, name: entry.name, status: "failed", count: 0,
      message: String(error?.message || "Image import failed").slice(0, 300) };
  }
}
