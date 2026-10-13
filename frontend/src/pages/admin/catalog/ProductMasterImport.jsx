// EXACT PATH: frontend/src/pages/admin/catalog/ProductMasterImport.jsx
// HAMPORIUM V24 - FULL REPLACEMENT FILE

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../api/api.js";
// Image sync UI is included below to avoid a missing-component import.
// Self-contained Google Drive image sync panel (no extra JSX import needed).
// V25: Image sync is a resumable admin-only job. No normal Excel import here.
// IMPORTANT: the V24 button processed ONE folder as a test, then waited for
// a separate Continue click. V25 makes the complete run the primary action.
const IMAGE_SYNC_KEY = "hamporium:image-sync-job";
const IMAGE_SYNC_ROOT = "/catalog/admin/import/product-master/images";

const imageSyncCount = (rows, status) => rows.filter((item) => item.status === status).length;

function ProductMasterImageSyncPanel({ onComplete }) {
  const [file, setFile] = useState(null);
  const [scope, setScope] = useState("hampers");
  const [jobId, setJobId] = useState(() => {
    try { return window.localStorage.getItem(IMAGE_SYNC_KEY) || ""; }
    catch { return ""; }
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ nextOffset: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [preparedSkus, setPreparedSkus] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const stop = useRef(false);
  const running = useRef(false);

  const saveJobId = (value) => {
    setJobId(value);
    try {
      if (value) window.localStorage.setItem(IMAGE_SYNC_KEY, value);
      else window.localStorage.removeItem(IMAGE_SYNC_KEY);
    } catch { /* private mode: job still works while page is open */ }
  };

  // Restore the actual server-side cursor and per-SKU results after page refresh.
  useEffect(() => {
    if (!jobId) return undefined;
    let alive = true;
    api.get(`${IMAGE_SYNC_ROOT}/status/${jobId}`).then(({ data }) => {
      if (!alive || running.current) return;
      setProgress({ nextOffset: Number(data?.nextOffset || 0), total: Number(data?.total || 0) });
      setResults(Array.isArray(data?.results) ? data.results : []);
      if (data?.done) {
        saveJobId("");
        setNotice("Previous image-sync job finished. See the SKU-wise results below.");
      }
    }).catch((requestError) => {
      if (alive && requestError.response?.status === 404) {
        saveJobId("");
        setNotice("Previous job expired. Select the latest Excel and start again.");
      }
    });
    return () => { alive = false; };
  }, []);

  const run = async (id, { testOnly = false } = {}) => {
    if (!id || running.current) return;
    running.current = true;
    stop.current = false;
    setBusy(true);
    setError("");
    let countThisRun = 0;
    let hadFailures = false;
    try {
      while (!stop.current) {
        const response = await api.post(`${IMAGE_SYNC_ROOT}/next`, { jobId: id });
        const data = response.data || {};
        if (!data.success || data.busy) {
          throw new Error(data.message || "This image sync is already running. Try Resume shortly.");
        }

        setProgress({ nextOffset: Number(data.nextOffset || 0), total: Number(data.total || 0) });
        const batch = Array.isArray(data.batchResults) ? data.batchResults : [];
        if (batch.length) {
          setResults((old) => [...old, ...batch]);
          countThisRun += batch.length;
          if (batch.some((item) => item.status === "failed" || item.status === "not_found")) {
            hadFailures = true;
          }
        }

        if (data.done) {
          if (Array.isArray(data.results)) setResults(data.results);
          saveJobId("");
          const final = Array.isArray(data.results) ? data.results : batch;
          const errors = final.filter((row) => row.status === "failed" || row.status === "not_found");
          if (errors.length) {
            setNotice(`Image sync finished: ${final.length - errors.length} succeeded, ${errors.length} need attention. Open SKU-wise results below.`);
          } else {
            setNotice(`Image sync completed successfully for ${final.length} Drive folder(s).`);
          }
          onComplete?.();
          break;
        }
        if (testOnly && countThisRun >= 1) {
          setNotice(hadFailures
            ? "First folder did not sync. Expand the SKU-wise report to see why; you can still continue the other folders."
            : "First folder tested. Click 'Continue remaining folders' to sync the rest.");
          onComplete?.();
          break;
        }
        // Continue even if a single Drive folder has no access or the SKU is
        // not yet imported. The backend advances the cursor and reports it.
      }
      if (stop.current) {
        setNotice("Paused safely. Progress is saved. Click Continue remaining folders when ready.");
        onComplete?.();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Image sync interrupted; retry Continue remaining folders.");
      onComplete?.();
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const start = async (testOnly) => {
    if (!file || busy || running.current) {
      if (!file) setError("Choose the latest Excel (.xlsx) first.");
      return;
    }
    stop.current = false;
    setBusy(true);
    setError("");
    setNotice("");
    setResults([]);
    setPreparedSkus([]);
    setProgress({ nextOffset: 0, total: 0 });

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("scope", scope);
      const { data } = await api.post(`${IMAGE_SYNC_ROOT}/prepare`, form);
      const id = String(data?.jobId || "");
      if (!id) throw new Error("Backend did not return a job ID.");
      const total = Number(data?.total || 0);
      const linkedSkus = Array.isArray(data?.readyMadeSkus) ? data.readyMadeSkus : [];
      setPreparedSkus(linkedSkus);
      setProgress({ nextOffset: 0, total });
      saveJobId(id);
      setNotice(`Excel detected ${total} valid Drive folder link(s)` +
        (scope === "hampers" ? `: ${linkedSkus.join(", ") || "none"}.` : ".") +
        (testOnly ? " Testing first folder..." : " Syncing ALL folders one by one..."));
      setBusy(false);
      await run(id, { testOnly });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to prepare image sync.");
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!jobId || busy || running.current) return;
    setError("");
    try {
      const { data } = await api.get(`${IMAGE_SYNC_ROOT}/status/${jobId}`);
      setProgress({ nextOffset: Number(data?.nextOffset || 0), total: Number(data?.total || 0) });
      setResults(Array.isArray(data?.results) ? data.results : []);
      if (data?.done) {
        saveJobId("");
        setNotice("This image-sync job is already complete. See results below.");
        onComplete?.();
        return;
      }
      await run(jobId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to resume. Try again.");
    }
  };

  const counts = {
    updated: imageSyncCount(results, "updated"),
    unchanged: imageSyncCount(results, "unchanged"),
    failed: imageSyncCount(results, "failed"),
    notFound: imageSyncCount(results, "not_found"),
  };
  const last = results[results.length - 1];
  const issues = results.filter((item) => ["failed", "not_found"].includes(item.status));
  const currentPercent = progress.total > 0 ? Math.min(100, 100 * progress.nextOffset / progress.total) : 0;

  return (
    <section className="rounded-2xl border-2 border-orange-200 bg-[#FCFAF6] p-5 text-[#201C17] shadow-sm" aria-label="Google Drive image sync">
      <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Image-only sync · Does not change live/disabled status</p>
      <h2 className="mt-1 text-xl font-bold">Google Drive images → Cloudinary → Catalogue</h2>
      <p className="mt-2 text-sm leading-6 text-[#5E574E]">
        Select the latest supplier Excel. <strong>Sync all linked folders</strong> processes every linked hamper SKU;
        the older Test 1 Folder action synced only the first hamper, not all of them.
      </p>
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <strong>Excel (7) reference:</strong> SKU 510005–510011 have Drive folder URLs; 510001–510004 have no cover link.
        The actual detected SKU list below is read from whichever workbook you upload. If a SKU is not yet imported,
        it will be marked <strong>Not found</strong>; missing Drive permissions are reported separately.
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-[#5E574E]">
          Which images to sync?
          <select value={scope} onChange={(event) => setScope(event.target.value)} disabled={busy}
            className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-[#201C17]">
            <option value="hampers">Ready-made hampers only</option>
            <option value="all">All products (hampers first)</option>
            <option value="products">Boxes, gift items &amp; decorations only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-[#5E574E]">
          Latest supplier Excel
          <input type="file" accept=".xlsx,.xlsm,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={busy}
            aria-label="Select Excel for image-only sync" className="max-w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs" />
        </label>
        <button type="button" onClick={() => start(false)} disabled={busy || !file}
          className="rounded-xl bg-[#171717] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#D86B18] disabled:opacity-50">
          {busy ? "Processing..." : "Sync ALL linked folders"}
        </button>
        <button type="button" onClick={() => start(true)} disabled={busy || !file}
          className="rounded-xl border border-orange-300 bg-white px-4 py-3 text-sm font-bold text-[#8B420D] disabled:opacity-50">
          Test first folder only
        </button>
        {!busy && jobId && (
          <button type="button" onClick={resume}
            className="rounded-xl border border-[#B86B2F] bg-white px-4 py-3 text-sm font-bold text-[#8B420D]">
            Continue remaining folders
          </button>
        )}
        {busy && (
          <button type="button" onClick={() => { stop.current = true; }}
            className="rounded-xl border border-black/20 px-4 py-3 text-sm font-bold">Pause after this folder</button>
        )}
      </div>
      {preparedSkus.length > 0 && (
        <p className="mt-3 text-xs leading-5 text-[#827465]">
          <strong>Hamper SKUs detected:</strong> {preparedSkus.join(", ")}
        </p>
      )}
      {progress.total > 0 && (
        <div className="mt-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{progress.nextOffset} / {progress.total} Drive folder(s) processed</p>
            <p className="text-xs font-semibold text-black/50">{Math.round(currentPercent)}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E6DED3]">
            <div className="h-full rounded-full bg-[#D86B18] transition-all" style={{ width: `${currentPercent}%` }} />
          </div>
          <p className="mt-2 text-sm">
            Updated: <strong>{counts.updated}</strong> · Unchanged: <strong>{counts.unchanged}</strong> · Failed: <strong>{counts.failed}</strong> · SKU not found: <strong>{counts.notFound}</strong>
          </p>
        </div>
      )}
      {last && (
        <div className="mt-3 rounded-xl border border-black/10 bg-white p-3 text-sm">
          <strong>Last SKU: {last.sku} — {last.status} ({last.count || 0} photo(s))</strong>
          <p className="mt-1 break-words text-black/65">{last.message}</p>
        </div>
      )}
      {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {results.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white text-sm">
          <div className="border-b border-black/10 px-4 py-3 font-extrabold">SKU-wise image-sync report</div>
          <div className="max-h-72 overflow-y-auto">
            {results.map((result, index) => (
              <div key={`${result.sku}-${index}`} className="grid gap-1 border-b border-black/[0.07] px-4 py-3 sm:grid-cols-[110px_110px_1fr] sm:gap-3">
                <strong>SKU {result.sku}</strong>
                <span className={result.status === "failed" || result.status === "not_found"
                  ? "font-bold text-red-700" : "font-bold text-emerald-700"}>
                  {result.status === "not_found" ? "Not imported" : result.status} · {result.count || 0} photos
                </span>
                <span className="break-words text-black/60">{result.message || "No message"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {issues.length > 0 && (
        <p className="mt-3 text-xs leading-5 text-orange-800">
          <strong>{issues.length} SKU(s) need attention.</strong> Missing SKU: import that hamper first. HTTP 403/404:
          check the correct Drive folder sharing/API access. Other SKUs continue syncing even if one fails.
        </p>
      )}
      <p className="mt-3 text-xs leading-5 text-[#827465]">
        Image-only sync preserves existing Cloudinary galleries, prices, stock, and Admin publish/unpublish choices.
        After completion, the Admin Archive refreshes. Photo sync does not automatically publish incomplete hampers.
      </p>
    </section>
  );
}


// Catalogue record type filters use V22 backend recordType values.
// These filters only change what the admin sees; they NEVER limit an import.
const PRODUCT_TYPE_OPTIONS = [
  { value: "all", label: "All Products" },
  { value: "boxes", label: "Boxes" },
  { value: "items", label: "Gift Items" },
  { value: "hampers", label: "Ready-made Hampers" },
];

const productTypeOf = (record) => {
  const type = String(record?.recordType || "").trim().toLowerCase();
  if (["container", "box", "boxes", "packaging_box"].includes(type)) return "boxes";
  if (["ready_made_hamper", "ready-made-hamper", "ready_made", "hamper"].includes(type)) return "hampers";
  return "items"; // Other regular catalogue products/components.
};

const countProductTypes = (records) => {
  const counts = { all: records.length, boxes: 0, items: 0, hampers: 0 };
  for (const row of records) counts[productTypeOf(row)] += 1;
  return counts;
};

function ProductTypeFilter({ value, onChange, counts, label = "Product type" }) {
  return (
    <div aria-label={label} role="group" className="min-w-0">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-black/45">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PRODUCT_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
              value === option.value
                ? "border-[#F97316] bg-[#FFF2E7] text-[#A94D0A]"
                : "border-black/10 bg-white text-black/60 hover:border-[#F97316]/60 hover:text-[#A94D0A]"
            }`}
          >
            {option.label}
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
              value === option.value ? "bg-orange-100 text-orange-800" : "bg-black/[0.045] text-black/45"
            }`}>{counts[option.value] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Admin-only live readiness report. Rechecking after image sync immediately updates
// pending/ready counts; it does not call the destructive Excel import endpoint.
function ProductMasterArchivePanel({ reloadKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("all");
  const [mediaView, setMediaView] = useState("all");
  const [recordTypeView, setRecordTypeView] = useState("all");
  const [gallery, setGallery] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [publicationBusy, setPublicationBusy] = useState("");
  const [publicationMessage, setPublicationMessage] = useState("");

  // Admin-only manual publication. The existing Product/SKU editor endpoints
  // remain the authority, not the Excel Status column.
  const changeHamperPublication = async (row) => {
    if (!row.productId || !row.skuId || publicationBusy) return;
    const enabling = !row.published;
    if (enabling && row.publicationBlockers?.length) {
      setPublicationMessage(
        `${row.externalSku}: Cannot publish safely yet — ${row.publicationBlockers.join("; ")}`
      );
      return;
    }
    const agreed = window.confirm(
      enabling
        ? `Publish ${row.name} (${row.externalSku}) to customers? Confirm price, image and actual gift contents before making it orderable.`
        : `Unpublish ${row.name} (${row.externalSku}) from customer catalogue? Existing orders remain unchanged.`
    );
    if (!agreed) return;
    setPublicationBusy(row.externalSku);
    setPublicationMessage("");
    try {
      // Publishing: make SKU available before product; unpublishing: hide
      // Product first. This minimizes partial public visibility on failure.
      if (enabling) {
        await api.patch(`/catalog/admin/skus/${row.skuId}`, { isActive: true });
        await api.patch(`/catalog/admin/products/${row.productId}`, { status: "active" });
      } else {
        await api.patch(`/catalog/admin/products/${row.productId}`, { status: "draft" });
        await api.patch(`/catalog/admin/skus/${row.skuId}`, { isActive: false });
      }
      setPublicationMessage(`${row.externalSku}: ${enabling ? "Published" : "Unpublished"}.`);
      await refresh();
    } catch (requestError) {
      setPublicationMessage(requestError.response?.data?.message ||
        `${row.externalSku}: Could not update publication. Check Product & SKU status in Admin.`);
      await refresh();
    } finally {
      setPublicationBusy("");
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/catalog/admin/import/product-master/archive?limit=500");
      const payload = response.data || {};
      const incomingRows = Array.isArray(payload.records) ? payload.records : [];
      setRows(incomingRows);
      setSummary({ ...(payload.summary || {}), imageAuditVersion: payload.imageAuditVersion || "" });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load archive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [reloadKey]);

  // Readiness and Images act first, then the product type selection.
  // Counts reflect the current readiness + image filters, making combinations useful.
  const statusMediaRows = rows.filter((row) =>
    (view === "all" || row.state === view) &&
    (mediaView === "all" || row.imageState === mediaView)
  );
  const typeCounts = countProductTypes(statusMediaRows);
  const visible = statusMediaRows.filter((row) =>
    recordTypeView === "all" || productTypeOf(row) === recordTypeView
  );
  const imageAuditCurrent = ["V14-link-audit", "V22-live-state-hyperlink", "V24-hamper-priority-drive-link"].includes(summary?.imageAuditVersion);
  const imageTotals = {
    saved: rows.filter((row) => row.imageState === "saved").length,
    pending: rows.filter((row) => row.imageState === "drive_link_pending").length,
    missing: rows.filter((row) => row.imageState === "no_source_link").length,
  };
  const imageStateUnclassified = rows.length - imageTotals.saved - imageTotals.pending - imageTotals.missing;

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white" aria-label="Product Master archive">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#F97316]">Admin only</p>
          <h2 className="mt-1 text-xl font-bold">Catalogue readiness & image audit</h2>
          <p className="text-[11px] text-black/40">Backend audit version: {summary?.imageAuditVersion || "OLD / not updated"}</p>
          <p className="mt-2 text-sm text-black/55">
            Archived products remain visible here to admins, including saved photos.
            A Google Drive folder link is not a displayable image until image-only sync succeeds.
            Excel re-import does not change an existing Admin Live/Disabled decision.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}
          className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {loading ? "Checking..." : "Refresh readiness"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <span className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Ready: {summary?.ready ?? 0}</span>
        <span className="rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800">Archive: {summary?.archive ?? 0}</span>
        <span className="rounded-xl bg-black/[0.04] px-4 py-3 text-sm font-semibold">Total: {summary?.total ?? 0}</span>
        <span className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Photos saved: {imageTotals.saved}</span>
        <span className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Drive links pending: {imageTotals.pending}</span>
        <span className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No image link: {imageTotals.missing}</span>
      </div>
      {(!imageAuditCurrent || imageStateUnclassified !== 0) && <p role="alert" className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {!imageAuditCurrent ? "Backend image-audit controller is outdated; deploy V24 and refresh. " : ""}
        {imageStateUnclassified > 0 ? `${imageStateUnclassified} archived records have no image audit state. ` : ""}
        The image-only sync above must be run separately from normal Excel import.
      </p>}
      <div className="flex flex-wrap gap-3 px-5 pb-5">
        <label className="text-xs font-semibold text-black/60">Readiness
          <select aria-label="Filter readiness" value={view} onChange={(e) => setView(e.target.value)}
            className="ml-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
            <option value="archive">Needs attention</option><option value="ready">Ready</option><option value="all">All</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-black/60">Images
          <select aria-label="Filter image status" value={mediaView} onChange={(e) => setMediaView(e.target.value)}
            className="ml-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
            <option value="all">All image statuses</option>
            <option value="saved">Photos saved</option>
            <option value="drive_link_pending">Drive link, not synced</option>
            <option value="no_source_link">No Drive link</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-5">
        <ProductTypeFilter value={recordTypeView} onChange={setRecordTypeView} counts={typeCounts} label="Catalogue type" />
        <span className="text-xs font-semibold text-black/45" aria-live="polite">
          Showing {visible.length} of {rows.length} records
        </span>
      </div>
      {error && <p role="alert" className="px-5 pb-3 text-sm text-red-600">{error}</p>}
      {publicationMessage && <p role="status" className="mx-5 mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{publicationMessage}</p>}
      <div className="max-h-[480px] overflow-auto border-t border-black/10">
        <table className="min-w-[900px] w-full text-left text-xs sm:text-sm">
          <thead className="sticky top-0 z-10 bg-[#FAF7F3] text-black/60"><tr>
            <th className="p-3">Image</th><th className="p-3">SKU</th><th className="p-3">Product / Box</th>
            <th className="p-3">Readiness</th><th className="p-3">What is missing / Publish</th>
          </tr></thead>
          <tbody>
            {visible.map((row) => {
              const photos = row.images || [];
              return <tr key={row.rowKey} className="border-t border-black/5 align-top">
                <td className="p-3">
                  {photos.length > 0 ? (
                    <button type="button" onClick={() => { setGallery(row); setGalleryIndex(0); }}
                      aria-label={`View ${row.name} image gallery`} className="group flex flex-col items-start gap-1 text-left">
                      <img src={photos[0].url} alt={`${row.name} preview`} loading="lazy"
                        className="h-20 w-20 rounded-xl border border-black/10 bg-white object-contain p-1 transition group-hover:border-orange-400" />
                      <span className="text-[10px] font-semibold text-emerald-700">{photos.length} photo(s) · View</span>
                    </button>
                  ) : row.hasDriveLink ? (
                    <div className="flex flex-col gap-1">
                      <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-[10px] text-amber-800">Not synced</span>
                      <a href={row.sourceImageUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-semibold text-orange-700 underline">Open Drive folder</a>
                    </div>
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-black/10 bg-gray-50 p-2 text-center text-[10px] text-black/40">No image link</span>
                  )}
                </td>
                <td className="p-3 font-semibold">{row.externalSku || `Row ${row.rowNumber}`}</td>
                <td className="p-3">{row.name || "Unnamed"}<span className="ml-2 text-black/40">{row.recordType}</span></td>
                <td className="p-3 font-semibold">{row.state === "ready" ? "Ready" : "Archive"}</td>
                <td className="p-3 text-black/60">
                  <p>{row.reasons?.join(" · ") || "—"}</p>
                  {row.recordType === "ready_made_hamper" && (
                    <div className="mt-3 flex flex-col items-start gap-2">
                      <span className={`text-xs font-bold ${row.published ? "text-emerald-700" : "text-amber-700"}`}>
                        {row.published ? "LIVE (Admin-approved)" : "NOT LIVE (Admin draft)"}
                      </span>
                      {row.productId && row.skuId ? (
                        <button type="button" disabled={publicationBusy === row.externalSku ||
                            (!row.published && (row.publicationBlockers || []).length > 0)}
                          onClick={() => void changeHamperPublication(row)}
                          className="rounded-lg bg-[#191817] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                          {publicationBusy === row.externalSku ? "Saving..." : row.published ? "Unpublish" : "Publish Live"}
                        </button>
                      ) : <span className="text-xs text-red-600">Import SKU to enable publishing</span>}
                      {!row.published && row.publicationBlockers?.length > 0 && (
                        <p className="max-w-xs text-xs text-amber-700">Live blocked: {row.publicationBlockers.join("; ")}</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>;
            })}
            {!visible.length && <tr><td colSpan={5} className="p-6 text-center text-black/40">No records in this view</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="p-4 text-xs text-black/45">Images shown here come from MongoDB product/box/SKU galleries. Drive folder links are source references only; incomplete items remain hidden from customer catalogue.</p>
      {gallery && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/75 p-4"
          role="dialog" aria-modal="true" aria-label={`Images of ${gallery.name}`}>
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="font-bold">{gallery.name}</p>
                <p className="text-xs text-black/50">SKU {gallery.externalSku} · Image {galleryIndex + 1}/{gallery.images.length}</p></div>
              <button type="button" onClick={() => setGallery(null)} className="rounded-lg border px-4 py-2 text-sm">Close</button>
            </div>
            <img src={gallery.images[galleryIndex]?.url} alt={`${gallery.name} view ${galleryIndex + 1}`}
              className="h-[55vh] w-full rounded-xl bg-gray-50 object-contain" />
            {gallery.images.length > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setGalleryIndex((index) => (index - 1 + gallery.images.length) % gallery.images.length)}>Previous</button>
                <span className="text-sm">{galleryIndex + 1} / {gallery.images.length}</span>
                <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setGalleryIndex((index) => (index + 1) % gallery.images.length)}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const ACTION_STYLES = {
  CREATE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CREATED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  UPDATE: "border-blue-200 bg-blue-50 text-blue-700",
  UPDATED: "border-blue-200 bg-blue-50 text-blue-700",
  SKIP: "border-black/10 bg-black/[0.04] text-black/50",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  ERROR: "border-red-200 bg-red-50 text-red-700",
};
const toNumberOrNull = (value) =>
  value === "" || value === null || value === undefined
    ? null
    : Number(value);
const createContainerReviewForm = (item) => {
  const data = item?.reviewData || {};
  const outer = data.outerDimensions || {};
  const inner = data.innerDimensions || {};
  const maxWeight = data.maxContentWeight || {};
  const lead = data.productionLeadTime || {};
  const availability = data.availability || {};
  return {
    material: data.material || "",
    outerDimensions: {
      length: outer.length ?? "",
      width: outer.width ?? "",
      height: outer.height ?? "",
      unit: outer.unit || "cm",
    },
    innerDimensions: {
      length: inner.length ?? "",
      width: inner.width ?? "",
      height: inner.height ?? "",
      unit: inner.unit || outer.unit || "cm",
    },
    maxContentWeight: {
      value: maxWeight.value ?? "",
      unit: maxWeight.unit || "kg",
    },
    usableVolumePercent: data.usableVolumePercent ?? 85,
    maxItems: data.maxItems ?? 0,
    productionLeadTime: {
      personalizationDays: lead.personalizationDays ?? 0,
      assemblyDays: lead.assemblyDays ?? 0,
      packingDays: lead.packingDays ?? 0,
    },
    defaultCourierDays: data.defaultCourierDays ?? "",
    availability: {
      status: availability.status || "in_stock",
      availableQuantity:
        availability.availableQuantity ?? "",
      nextAvailableDate: availability.nextAvailableDate || "",
    },
    customerSelectable: data.customerSelectable !== false,
    sortOrder: data.sortOrder ?? 0,
  };
};
const ProductMasterImport = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewingContainer, setReviewingContainer] =
    useState(null);
  const [reviewForm, setReviewForm] = useState(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [archiveReload, setArchiveReload] = useState(0);
  const [previewTypeView, setPreviewTypeView] = useState("all");
  const currentData = importResult || preview;
  const previewRows = Array.isArray(currentData?.results) ? currentData.results : [];
  const previewTypeCounts = countProductTypes(previewRows);
  const visiblePreviewRows = previewRows.filter((row) =>
    previewTypeView === "all" || productTypeOf(row) === previewTypeView
  );
  const previewCreateCount = Number(preview?.summary?.create || 0);
  const previewUpdateCount = Number(preview?.summary?.update || 0);
  const previewImportableCount = Number(
    preview?.summary?.importable ?? previewCreateCount + previewUpdateCount
  );
  const previewIssueRows = Array.isArray(preview?.results)
    ? preview.results.filter((item) =>
        ["REVIEW", "ERROR"].includes(item?.action)
      )
    : [];
  const previewBlockingRowCount = previewIssueRows.filter(
    (item) => item?.blocking !== false
  ).length;
  const previewNonBlockingIssueCount = Math.max(
    0,
    previewIssueRows.length - previewBlockingRowCount
  );
  const previewRawSheetErrorCount = Array.isArray(preview?.compositionErrors)
    ? preview.compositionErrors.length
    : 0;
  const previewSheetErrorCount = preview?.allowPartialImport
    ? 0
    : previewRawSheetErrorCount;
  const previewBlockingCount =
    previewBlockingRowCount + previewSheetErrorCount;
  const archiveMode = preview?.importMode === "archive_upsert";
  const replaceMode = preview?.importMode === "replace_product_master";
  const partialImportMode =
    replaceMode && preview?.allowPartialImport === true;
  const legacyMergeHasChanges = previewCreateCount + previewUpdateCount > 0;
  const canConfirmImport =
    Boolean(preview) &&
    !analyzing &&
    !importing &&
    !reviewSaving &&
    (archiveMode || previewBlockingCount === 0) &&
    previewImportableCount > 0 &&
    (archiveMode || replaceMode || legacyMergeHasChanges);
  const summaryCards = useMemo(() => {
    if (!currentData?.summary) return [];
    if (importResult) {
      return [
        ["Total Rows", currentData.summary.totalRows ?? 0],
        ["Created", currentData.summary.created ?? 0],
        ["Updated", currentData.summary.updated ?? 0],
        ["Skipped", currentData.summary.skipped ?? 0],
        ["Review", currentData.summary.review ?? 0],
        ["Errors", currentData.summary.errors ?? 0],
      ];
    }
    return [
      ["Total Rows", currentData.summary.totalRows ?? 0],
      ["Create", currentData.summary.create ?? 0],
      ["Update", currentData.summary.update ?? 0],
      ["Unchanged", currentData.summary.skip ?? 0],
      ["Review", currentData.summary.review ?? 0],
      ["Errors", currentData.summary.error ?? 0],
    ];
  }, [currentData, importResult]);
  const selectFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setImportResult(null);
    setPreviewTypeView("all");
    setReviewingContainer(null);
    setReviewForm(null);
    setError("");
    setNotice("");
  };
  const uploadFile = async (endpoint, extraFields = {}) => {
    if (!file) throw new Error("Choose an Excel file first");
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(extraFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(
          key,
          typeof value === "string"
            ? value
            : JSON.stringify(value)
        );
      }
    });
    const response = await api.post(endpoint, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  };
  const analyzeFile = async ({ keepNotice = false } = {}) => {
    setAnalyzing(true);
    setError("");
    if (!keepNotice) setNotice("");
    setImportResult(null);
    try {
      const data = await uploadFile(
        "/catalog/admin/import/product-master/preview"
      );
      setPreview(data);
      return data;
    } catch (requestError) {
      setPreview(null);
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to analyze Product Master"
      );
      return null;
    } finally {
      setAnalyzing(false);
    }
  };
  const confirmImport = async () => {
    if (!preview) return;
    const createCount = Number(preview.summary?.create || 0);
    const updateCount = Number(preview.summary?.update || 0);
    const unchangedCount = Number(preview.summary?.skip || 0);
    const issueRows = Array.isArray(preview.results)
      ? preview.results.filter((item) =>
          ["REVIEW", "ERROR"].includes(item?.action)
        )
      : [];
    const blockingRows = issueRows.filter(
      (item) => item?.blocking !== false
    );
    const nonBlockingRows = issueRows.filter(
      (item) => item?.blocking === false
    );
    const rawSheetErrorCount = Array.isArray(preview.compositionErrors)
      ? preview.compositionErrors.length
      : 0;
    const sheetErrorCount = preview.allowPartialImport
      ? 0
      : rawSheetErrorCount;
    const totalRows = Number(preview.summary?.totalRows || 0);
    const importableCount = Number(
      preview.summary?.importable ?? createCount + updateCount
    );
    const isArchiveMode = preview.importMode === "archive_upsert";
    const isReplaceMode =
      preview.importMode === "replace_product_master";
    const isPartialReplace =
      isReplaceMode && preview.allowPartialImport === true;
    if (!isArchiveMode && (blockingRows.length > 0 || sheetErrorCount > 0)) {
      setError(
        "Resolve the blocking REVIEW/ERROR items before importing. The existing catalogue has not been changed."
      );
      return;
    }
    if (importableCount === 0) {
      setError(
        "No valid importable rows were found in this workbook. The existing catalogue has not been changed."
      );
      return;
    }
    if (!isArchiveMode && !isReplaceMode && createCount + updateCount === 0) {
      setError(
        "This import page needs the V12 archive backend. Deploy the matching files, then Analyze again."
      );
      return;
    }
    const skippedIssueCount =
      nonBlockingRows.length + (isPartialReplace ? rawSheetErrorCount : 0);
    const confirmed = window.confirm(
      isArchiveMode
        ? `Save ${importableCount} valid rows without deleting the catalogue? All ${totalRows} Excel rows will be preserved in the admin archive. Incomplete rows will stay hidden from customers until ready.`
        : isPartialReplace
        ? `Replace the current Product Master catalogue with ${importableCount} valid row(s) from this workbook? ${skippedIssueCount} incomplete REVIEW/ERROR item(s) or helper-sheet issue(s) will be skipped safely. Previous Product Master Products, SKUs, Components and Containers will be removed before the valid rows are imported. Users, orders, payments and partners are not deleted.`
        : isReplaceMode
          ? `Replace the current Product Master catalogue with this workbook (${totalRows} rows)? Previous Product Master Products, SKUs, Components and Containers will be removed, then this workbook will become the current catalogue. Users, orders, payments and partners are not deleted.`
          : `Import this Product Master? CREATE: ${createCount}, UPDATE: ${updateCount}, UNCHANGED: ${unchangedCount}.`
    );
    if (!confirmed) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const data = await uploadFile(
        "/catalog/admin/import/product-master/confirm"
      );
      setImportResult(data);
      setArchiveReload((value) => value + 1);
      setNotice(
        data.message || "Product Master import completed"
      );
    } catch (requestError) {
      const responseData = requestError.response?.data;
      if (responseData?.summary && responseData?.results) {
        setPreview(responseData);
      }
      setError(
        responseData?.message ||
          requestError.message ||
          "Unable to import Product Master"
      );
    } finally {
      setImporting(false);
    }
  };
  const openContainerReview = (item) => {
    if (!item?.reviewData) {
      setError(
        "This review row cannot be completed from this screen. Resolve the row conflict first."
      );
      return;
    }
    setError("");
    setNotice("");
    setReviewingContainer(item);
    setReviewForm(createContainerReviewForm(item));
  };
  const closeContainerReview = () => {
    if (reviewSaving) return;
    setReviewingContainer(null);
    setReviewForm(null);
  };
  const updateReviewSection = (section, field, value) => {
    setReviewForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };
  const completeContainerReview = async (event) => {
    event.preventDefault();
    if (!reviewingContainer || !reviewForm) return;
    setReviewSaving(true);
    setError("");
    setNotice("");
    try {
      const completion = {
        material: reviewForm.material,
        outerDimensions: {
          length: Number(reviewForm.outerDimensions.length),
          width: Number(reviewForm.outerDimensions.width),
          height: Number(reviewForm.outerDimensions.height),
          unit: reviewForm.outerDimensions.unit,
        },
        innerDimensions: {
          length: Number(reviewForm.innerDimensions.length),
          width: Number(reviewForm.innerDimensions.width),
          height: Number(reviewForm.innerDimensions.height),
          unit: reviewForm.innerDimensions.unit,
        },
        maxContentWeight: {
          value: Number(reviewForm.maxContentWeight.value),
          unit: reviewForm.maxContentWeight.unit,
        },
        usableVolumePercent: Number(
          reviewForm.usableVolumePercent
        ),
        maxItems: Number(reviewForm.maxItems || 0),
        productionLeadTime: {
          personalizationDays: Number(
            reviewForm.productionLeadTime
              .personalizationDays || 0
          ),
          assemblyDays: Number(
            reviewForm.productionLeadTime.assemblyDays || 0
          ),
          packingDays: Number(
            reviewForm.productionLeadTime.packingDays || 0
          ),
        },
        defaultCourierDays: toNumberOrNull(
          reviewForm.defaultCourierDays
        ),
        availability: {
          status: reviewForm.availability.status,
          availableQuantity: toNumberOrNull(
            reviewForm.availability.availableQuantity
          ),
          nextAvailableDate:
            reviewForm.availability.status === "incoming"
              ? reviewForm.availability.nextAvailableDate || null
              : null,
        },
        customerSelectable: Boolean(
          reviewForm.customerSelectable
        ),
        sortOrder: Number(reviewForm.sortOrder || 0),
      };
      const data = await uploadFile(
        "/catalog/admin/import/product-master/complete-container",
        {
          externalSku: reviewingContainer.externalSku,
          completion,
        }
      );
      setReviewingContainer(null);
      setReviewForm(null);
      setNotice(
        data.message || "Container review completed"
      );
      await analyzeFile({ keepNotice: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to complete container review"
      );
    } finally {
      setReviewSaving(false);
    }
  };
  const reset = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setPreviewTypeView("all");
    setReviewingContainer(null);
    setReviewForm(null);
    setError("");
    setNotice("");
  };
  return (
    <div className="pb-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#F97316]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F97316]">
              Catalogue Sync
            </p>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#171717] sm:text-4xl">
            Product Master Import
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/50">
            Import every valid Excel record without deleting existing catalogue IDs.
            Missing images, prices and incomplete rows remain in Admin Archive,
            hidden from customers until ready.
          </p>
        </div>
        {(file || preview || importResult) && (
          <button
            type="button"
            onClick={reset}
            disabled={
              analyzing ||
              importing ||
              reviewSaving
            }
            className="rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/55 transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50"
          >
            Start Over
          </button>
        )}
      </div>
      {error && (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {notice}
        </div>
      )}
      {/* Image sync changes media only; refresh archive after it completes. */}
      <div className="mt-8">
        <ProductMasterImageSyncPanel onComplete={() => setArchiveReload((count) => count + 1)} />
      </div>
      <ProductMasterArchivePanel reloadKey={archiveReload} />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <WorkflowStep
          number="01"
          title="Upload"
          description="Select Product Master Excel"
          active={Boolean(file)}
        />
        <WorkflowStep
          number="02"
          title="Analyze"
          description="Preview all changes safely"
          active={Boolean(preview || importResult)}
        />
        <WorkflowStep
          number="03"
          title="Import"
          description="Confirm approved records"
          active={Boolean(importResult)}
        />
      </div>
      <section className="mt-6 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <div className="border-b border-black/[0.06] bg-[#FFF9F2] px-5 py-5 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F97316]">
            Step 1
          </p>
          <h2 className="mt-1 text-lg font-bold text-[#171717]">
            Select Product Master
          </h2>
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
            <label className="block min-w-0 flex-1">
              <span className="mb-2 block text-xs font-bold text-black/60">
                Product Master Excel
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={selectFile}
                disabled={
                  analyzing ||
                  importing ||
                  reviewSaving
                }
                className="block w-full rounded-xl border border-black/10 bg-[#FAFAF9] px-3 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#171717] file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-white hover:file:bg-[#F97316] disabled:opacity-50"
              />
              {file && (
                <div className="mt-2 flex items-center gap-2 text-xs text-black/45">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Selected:
                  <span className="font-semibold text-black/65">
                    {file.name}
                  </span>
                </div>
              )}
              <p className="mt-2 text-[10px] font-medium text-black/35">
                Supported: .xlsx, .xls and .xlsm · up to 25 MB
              </p>
            </label>
            <button
              type="button"
              onClick={() => analyzeFile()}
              disabled={
                !file ||
                analyzing ||
                importing ||
                reviewSaving
              }
              className="rounded-xl bg-[#171717] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {analyzing
                ? "Analyzing..."
                : "Analyze File"}
            </button>
          </div>
          <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#FFF9F2] px-4 py-4 text-xs leading-6 text-black/60">
            <strong className="text-[#171717]">GST import rule:</strong>{" "}
            Product Master <strong>Target Sell Price</strong> is treated as the pre-GST base selling price.
            Tax % and HSN/SAC are imported separately; the backend applies any configured discount first,
            then GST, and derives the customer-facing final price. Preview remains read-only and never edits Excel.
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InfoCard
              title="Read-only Preview"
              text="Analyze never changes MongoDB. Safe Import upserts valid rows and archives incomplete rows."
            />
            <InfoCard
              title="Source Protected"
              text="The selected Excel file is never edited."
            />
            <InfoCard
              title="Safe Import Rules"
              text="Base price, GST and HSN/SAC stay separate. Strict catalogue workbooks block on REVIEW/ERROR; procurement-style real workbooks can skip only non-blocking incomplete rows after Analyze identifies the mode."
            />
          </div>
        </div>
      </section>
      {currentData?.summary && (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {summaryCards.map(([label, value]) => (
              <SummaryCard
                key={label}
                label={label}
                value={value}
              />
            ))}
          </section>
          <section className="mt-6 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-4 border-b border-black/[0.06] bg-[#FAFAF9] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F97316]">
                  {importResult ? "Final Result" : "Step 2"}
                </p>
                <h2 className="mt-1 font-bold text-[#171717]">
                  {importResult
                    ? "Import Result"
                    : "Preview Result"}
                </h2>
                <p className="mt-1 text-xs text-black/45">
                  {currentData.filename ||
                    file?.name ||
                    "Product Master"}
                  {currentData.sheetName
                    ? ` · ${currentData.sheetName}`
                    : ""}
                </p>
              </div>
              {!importResult && preview && (
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={!canConfirmImport}
                  className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing
                    ? "Importing..."
                    : archiveMode
                      ? "Save & Archive Incomplete"
                      : "Confirm Import"}
                </button>
              )}
            </div>
            {!importResult && preview && (
              <div
                className={`border-b px-5 py-3 text-xs font-semibold sm:px-6 ${
                  archiveMode
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : replaceMode
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : legacyMergeHasChanges
                      ? "border-amber-100 bg-amber-50 text-amber-700"
                      : "border-red-100 bg-red-50 text-red-700"
                }`}
              >
                {archiveMode
                  ? "Safe archive mode: all Excel rows are preserved; only complete records can appear publicly. Existing IDs and Cloudinary galleries are kept."
                  : replaceMode
                  ? partialImportMode
                    ? previewBlockingCount === 0
                      ? `Safe partial replace ready: ${previewImportableCount} valid row(s) will become the current catalogue. ${previewNonBlockingIssueCount + previewRawSheetErrorCount} non-blocking incomplete item(s) / helper-sheet issue(s) will be skipped.`
                      : "Procurement workbook detected, but one or more blocking issues still need attention before import."
                    : previewBlockingCount === 0
                      ? "Strict replace mode ready: Confirm Import will replace the previous Product Master catalogue with this workbook."
                      : "Strict replace mode is active, so blocking REVIEW/ERROR items must be resolved before import."
                  : legacyMergeHasChanges
                    ? "Legacy merge mode detected. Import is available for CREATE/UPDATE rows, but it will not fully replace the old Product Master catalogue."
                    : "Old backend importer detected. Deploy the latest catalog.controller.js and analyze this file again before replacing the catalogue."}
              </div>
            )}
            {!importResult && preview && (
              <div className="border-b border-black/[0.06] bg-white px-5 py-4 sm:px-6">
                <div className="flex flex-wrap gap-2 text-[10px] font-bold text-black/55">
                  <span className="rounded-lg bg-black/[0.04] px-3 py-2">
                    {preview.workbookProfile?.label || "HAMPORIUM workbook"}
                  </span>
                  <span className="rounded-lg bg-black/[0.04] px-3 py-2">
                    Product: {preview.sheetName || "Not detected"}
                    {preview.productHeaderRow
                      ? ` · header row ${preview.productHeaderRow}`
                      : ""}
                  </span>
                  {preview.hamperMasterSheetName ? (
                    <span className="rounded-lg bg-black/[0.04] px-3 py-2">
                      Hamper master: {preview.hamperMasterSheetName}
                    </span>
                  ) : null}
                  {preview.compositionSheetName ? (
                    <span className="rounded-lg bg-black/[0.04] px-3 py-2">
                      Recipe / composition: {preview.compositionSheetName}
                    </span>
                  ) : null}
                  {preview.containerSetupSheetName ? (
                    <span className="rounded-lg bg-black/[0.04] px-3 py-2">
                      Container setup: {preview.containerSetupSheetName}
                    </span>
                  ) : null}
                  {preview.decorationSheetName ? (
                    <span className="rounded-lg bg-black/[0.04] px-3 py-2">
                      Decorations: {preview.decorationSheetName}
                    </span>
                  ) : null}
                </div>
                {previewRawSheetErrorCount > 0 ? (
                  <p className="mt-3 text-[11px] font-semibold leading-5 text-amber-700">
                    {previewRawSheetErrorCount} helper-sheet issue(s) detected. {partialImportMode
                      ? "They are non-blocking for this procurement-style workbook and will be skipped safely."
                      : "They must be resolved before strict replacement."}
                  </p>
                ) : null}
              </div>
            )}
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
              <ProductTypeFilter value={previewTypeView} onChange={setPreviewTypeView} counts={previewTypeCounts} label="Preview by product type" />
              <div className="text-right">
                <p className="text-xs font-semibold text-black/55" aria-live="polite">
                  Showing {visiblePreviewRows.length} of {previewRows.length} rows
                </p>
                <p className="mt-1 text-[11px] text-black/40">View-only filter. Import still processes the full Excel.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-[#171717] text-[10px] uppercase tracking-[0.1em] text-white/60">
                  <tr>
                    <th className="px-4 py-3.5 font-bold">Row</th>
                    <th className="px-4 py-3.5 font-bold">Product SKU</th>
                    <th className="px-4 py-3.5 font-bold">Name</th>
                    <th className="px-4 py-3.5 font-bold">Type</th>
                    <th className="px-4 py-3.5 font-bold">Action</th>
                    <th className="px-4 py-3.5 font-bold">Details</th>
                    <th className="px-4 py-3.5 font-bold">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePreviewRows.map(
                    (item, index) => (
                      <tr
                        key={`${item.rowNumber}-${item.externalSku}-${index}`}
                        className="border-t border-black/[0.05] align-top transition hover:bg-[#FFF9F2]/50"
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-black/35">
                          {item.rowNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs font-bold text-black/60">
                          {item.externalSku || "—"}
                        </td>
                        <td className="min-w-[220px] px-4 py-4">
                          <p className="font-bold text-[#171717]">
                            {item.name || "Unnamed row"}
                          </p>
                          {item.sourceSheetName ? (
                            <p className="mt-1 text-[10px] font-semibold text-black/35">
                              {item.sourceSheetName}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className="rounded-lg bg-black/[0.04] px-2.5 py-1.5 text-[10px] font-bold capitalize text-black/50">
                            {String(
                              item.recordType || ""
                            ).replaceAll("_", " ") || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                              ACTION_STYLES[item.action] ||
                              "border-black/10 bg-black/[0.04] text-black/50"
                            }`}
                          >
                            {item.action}
                          </span>
                        </td>
                        <td className="min-w-[360px] px-4 py-4 text-xs leading-5 text-black/50">
                          <p>{item.reason || "—"}</p>
                          {item.compositionSummary && (
                            <div className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-[11px] font-medium text-[#F97316]">
                              {item.compositionSummary.contentLines ||
                                0}{" "}
                              content line(s)
                              {item.compositionSummary
                                .totalUnits !== undefined
                                ? ` · ${item.compositionSummary.totalUnits} total unit(s)`
                                : ""}
                              {item.compositionSummary
                                .containerSku
                                ? ` · Box ${item.compositionSummary.containerSku}`
                                : ""}
                            </div>
                          )}
                          {item.changedFields?.length > 0 && (
                            <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700/80">
                              <span className="font-bold">
                                Changed:
                              </span>{" "}
                              {item.changedFields.join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {item.action === "REVIEW" &&
                          item.recordType ===
                            "container" &&
                          item.reviewData ? (
                            <button
                              type="button"
                              onClick={() =>
                                openContainerReview(item)
                              }
                              disabled={reviewSaving}
                              className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[10px] font-bold text-amber-700 transition hover:border-[#F97316] hover:bg-[#FFF9F2] hover:text-[#F97316] disabled:opacity-50"
                            >
                              Complete Container
                            </button>
                          ) : (
                            <span className="text-xs text-black/20">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                  {visiblePreviewRows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-black/40">No records match this product type.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {reviewingContainer && reviewForm && (
        <ContainerReviewModal
          item={reviewingContainer}
          form={reviewForm}
          setForm={setReviewForm}
          updateSection={updateReviewSection}
          saving={reviewSaving}
          onClose={closeContainerReview}
          onSubmit={completeContainerReview}
        />
      )}
    </div>
  );
};
const ContainerReviewModal = ({
  item,
  form,
  setForm,
  updateSection,
  saving,
  onClose,
  onSubmit,
}) => {
  const sourceOuterLocked =
    item.reviewData?.hasSourceOuterDimensions === true;
  const sourceInnerLocked =
    item.reviewData?.hasSourceInnerDimensions === true;
  const sourceWeightLocked =
    item.reviewData?.hasSourceMaxContentWeight === true;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#171717]/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-[#F7F6F3] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/[0.07] bg-white px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F97316]">
              Container Review
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#171717] sm:text-2xl">
              {item.name}
            </h2>
            <p className="mt-1 text-xs text-black/40">
              Product Master SKU {item.externalSku}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-bold text-black/50 transition hover:bg-black/[0.03] disabled:opacity-50"
          >
            Close
          </button>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-5 p-5 sm:p-7"
        >
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold">
                !
              </div>
              <div>
                <p className="font-bold">
                  Why this row needs review
                </p>
                <p className="mt-1">{item.reason}</p>
                <p className="mt-2 text-xs text-amber-700/80">
                  Product Master values remain source-owned. Inner dimensions
                  and operational settings are stored only in HAMPORIUM.
                </p>
              </div>
            </div>
          </div>
          <ReviewSection
            eyebrow="Reference"
            title="Source / Commercial Snapshot"
            description="Read-only values from the selected Excel file."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyValue
                label="Source Product Type"
                value={
                  item.reviewData?.sourceProductType || "—"
                }
              />
              <ReadOnlyValue
                label="Category"
                value={item.reviewData?.category || "—"}
              />
              <ReadOnlyValue
                label="Subcategory"
                value={
                  item.reviewData?.subcategory || "—"
                }
              />
              <ReadOnlyValue
                label="Selling Price"
                value={
                  item.reviewData?.sellingPrice !== null &&
                  item.reviewData?.sellingPrice !== undefined
                    ? `₹${Number(
                        item.reviewData.sellingPrice
                      ).toLocaleString("en-IN")}`
                    : "Not set"
                }
              />
            </div>
          </ReviewSection>
          <ReviewSection
            eyebrow="Physical"
            title="Outer Dimensions"
            description={
              sourceOuterLocked
                ? "Provided by Product Master and locked here."
                : "Missing in Product Master. Complete locally."
            }
          >
            <DimensionFields
              value={form.outerDimensions}
              disabled={sourceOuterLocked}
              onChange={(field, value) =>
                updateSection(
                  "outerDimensions",
                  field,
                  value
                )
              }
            />
          </ReviewSection>
          <ReviewSection
            eyebrow="Fit Engine"
            title="Inner Dimensions"
            highlight
            description={
              sourceInnerLocked
                ? "True inner dimensions were supplied by the workbook and are locked here."
                : "Enter the true usable inside dimensions. These values drive the hamper fit engine."
            }
          >
            <DimensionFields
              value={form.innerDimensions}
              disabled={sourceInnerLocked}
              onChange={(field, value) =>
                updateSection(
                  "innerDimensions",
                  field,
                  value
                )
              }
            />
          </ReviewSection>
          <ReviewSection
            eyebrow="Capacity"
            title="Container Capacity"
            description={
              sourceWeightLocked
                ? "Maximum safe load came from Product Master."
                : "Maximum safe load must be completed locally."
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReviewField
                label="Max Content Weight"
                type="number"
                min="0.001"
                required
                disabled={sourceWeightLocked}
                value={form.maxContentWeight.value}
                onChange={(value) =>
                  updateSection(
                    "maxContentWeight",
                    "value",
                    value
                  )
                }
              />
              <ReviewSelect
                label="Weight Unit"
                disabled={sourceWeightLocked}
                value={form.maxContentWeight.unit}
                onChange={(value) =>
                  updateSection(
                    "maxContentWeight",
                    "unit",
                    value
                  )
                }
                options={[
                  ["kg", "kg"],
                  ["g", "g"],
                ]}
              />
              <ReviewField
                label="Usable Volume %"
                type="number"
                min="1"
                max="100"
                required
                value={form.usableVolumePercent}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    usableVolumePercent: value,
                  }))
                }
              />
              <ReviewField
                label="Max Items"
                type="number"
                min="0"
                value={form.maxItems}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    maxItems: value,
                  }))
                }
              />
            </div>
          </ReviewSection>
          <ReviewSection
            eyebrow="Operations"
            title="Container Setup"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReviewField
                label="Material"
                value={form.material}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    material: value,
                  }))
                }
                placeholder="e.g. rigid board"
              />
              <ReviewField
                label="Sort Order"
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    sortOrder: value,
                  }))
                }
              />
              <ReviewField
                label="Default Courier Days"
                type="number"
                min="0"
                max="60"
                value={form.defaultCourierDays}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    defaultCourierDays: value,
                  }))
                }
                placeholder="Optional"
              />
              <label className="flex items-end">
                <span className="flex min-h-[46px] w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-xs font-semibold text-black/60">
                  <input
                    type="checkbox"
                    checked={form.customerSelectable}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerSelectable:
                          event.target.checked,
                      }))
                    }
                    className="accent-[#F97316]"
                  />
                  Custom hamper builder
                </span>
              </label>
            </div>
          </ReviewSection>
          <ReviewSection
            eyebrow="Timeline"
            title="Production Defaults"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReviewField
                label="Personalization Days"
                type="number"
                min="0"
                value={
                  form.productionLeadTime
                    .personalizationDays
                }
                onChange={(value) =>
                  updateSection(
                    "productionLeadTime",
                    "personalizationDays",
                    value
                  )
                }
              />
              <ReviewField
                label="Assembly Days"
                type="number"
                min="0"
                value={
                  form.productionLeadTime.assemblyDays
                }
                onChange={(value) =>
                  updateSection(
                    "productionLeadTime",
                    "assemblyDays",
                    value
                  )
                }
              />
              <ReviewField
                label="Packing Days"
                type="number"
                min="0"
                value={
                  form.productionLeadTime.packingDays
                }
                onChange={(value) =>
                  updateSection(
                    "productionLeadTime",
                    "packingDays",
                    value
                  )
                }
              />
            </div>
          </ReviewSection>
          <ReviewSection
            eyebrow="Stock"
            title="Availability"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReviewSelect
                label="Status"
                value={form.availability.status}
                onChange={(value) =>
                  updateSection(
                    "availability",
                    "status",
                    value
                  )
                }
                options={[
                  ["in_stock", "In stock"],
                  ["incoming", "Incoming"],
                  ["out_of_stock", "Out of stock"],
                ]}
              />
              <ReviewField
                label="Available Quantity"
                type="number"
                min="0"
                value={
                  form.availability.availableQuantity
                }
                onChange={(value) =>
                  updateSection(
                    "availability",
                    "availableQuantity",
                    value
                  )
                }
                placeholder="Optional"
              />
              {form.availability.status === "incoming" && (
                <ReviewField
                  label="Next Available Date"
                  type="date"
                  required
                  value={
                    form.availability.nextAvailableDate
                  }
                  onChange={(value) =>
                    updateSection(
                      "availability",
                      "nextAvailableDate",
                      value
                    )
                  }
                />
              )}
            </div>
          </ReviewSection>
          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-end gap-3 border-t border-black/[0.07] bg-white px-5 py-4 sm:-mx-7 sm:-mb-7 sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-black/10 px-5 py-3 text-sm font-bold text-black/55 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171717] disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Complete & Import Container"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
const WorkflowStep = ({
  number,
  title,
  description,
  active,
}) => (
  <div
    className={`rounded-2xl border p-4 transition ${
      active
        ? "border-orange-200 bg-[#FFF9F2]"
        : "border-black/[0.06] bg-white"
    }`}
  >
    <div className="flex items-center gap-3">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-bold ${
          active
            ? "bg-[#F97316] text-white"
            : "bg-black/[0.04] text-black/35"
        }`}
      >
        {number}
      </span>
      <div>
        <p className="text-sm font-bold text-[#171717]">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-black/40">
          {description}
        </p>
      </div>
    </div>
  </div>
);
const SummaryCard = ({ label, value }) => (
  <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.025)]">
    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-black/35">
      {label}
    </p>
    <p className="mt-2 text-3xl font-bold tracking-tight text-[#171717]">
      {value}
    </p>
  </div>
);
const InfoCard = ({ title, text }) => (
  <div className="rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-4">
    <p className="text-xs font-bold text-[#171717]">{title}</p>
    <p className="mt-1 text-[11px] leading-5 text-black/40">
      {text}
    </p>
  </div>
);
const ReviewSection = ({
  eyebrow,
  title,
  description,
  children,
  highlight = false,
}) => (
  <section
    className={`rounded-2xl border p-5 ${
      highlight
        ? "border-[#D4AF37]/35 bg-[#FFF9F2]"
        : "border-black/[0.07] bg-white"
    }`}
  >
    {eyebrow && (
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#F97316]">
        {eyebrow}
      </p>
    )}
    <h3 className="mt-1 font-bold text-[#171717]">{title}</h3>
    {description && (
      <p className="mt-1 text-xs leading-5 text-black/40">
        {description}
      </p>
    )}
    <div className="mt-4">{children}</div>
  </section>
);
const DimensionFields = ({
  value,
  onChange,
  disabled = false,
}) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <ReviewField
      label="Length"
      type="number"
      min="0.001"
      required
      disabled={disabled}
      value={value.length}
      onChange={(next) =>
        onChange("length", next)
      }
    />
    <ReviewField
      label="Width"
      type="number"
      min="0.001"
      required
      disabled={disabled}
      value={value.width}
      onChange={(next) =>
        onChange("width", next)
      }
    />
    <ReviewField
      label="Height"
      type="number"
      min="0.001"
      required
      disabled={disabled}
      value={value.height}
      onChange={(next) =>
        onChange("height", next)
      }
    />
    <ReviewSelect
      label="Unit"
      disabled={disabled}
      value={value.unit}
      onChange={(next) =>
        onChange("unit", next)
      }
      options={[
        ["cm", "cm"],
        ["mm", "mm"],
      ]}
    />
  </div>
);
const ReviewField = ({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
  min,
  max,
  placeholder = "",
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
      {required && (
        <span className="ml-1 text-[#F97316]">*</span>
      )}
    </span>
    <input
      type={type}
      required={required}
      disabled={disabled}
      min={min}
      max={max}
      step={type === "number" ? "any" : undefined}
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      placeholder={placeholder}
      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100 disabled:bg-black/[0.035] disabled:text-black/40"
    />
  </label>
);
const ReviewSelect = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-black/60">
      {label}
    </span>
    <select
      value={value}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100 disabled:bg-black/[0.035] disabled:text-black/40"
    >
      {options.map(
        ([optionValue, optionLabel]) => (
          <option
            key={optionValue}
            value={optionValue}
          >
            {optionLabel}
          </option>
        )
      )}
    </select>
  </label>
);
const ReadOnlyValue = ({ label, value }) => (
  <div className="rounded-xl border border-black/[0.05] bg-[#FAFAF9] px-3.5 py-3">
    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-black/30">
      {label}
    </p>
    <p className="mt-1.5 text-sm font-bold text-[#171717]">
      {value}
    </p>
  </div>
);
export default ProductMasterImport;
