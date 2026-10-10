import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../api/api.js";
// Image sync UI is included below to avoid a missing-component import.
// Self-contained Google Drive image sync panel (no extra JSX import needed).
const KEY = "hamporium:image-sync-job";
const ROOT = "/catalog/admin/import/product-master/images";

// Add <ProductMasterImageSyncPanel /> to an ADMIN-only catalogue import page.
// It never calls the destructive Product Master "Confirm Import" endpoint.
function ProductMasterImageSyncPanel({ onComplete }) {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(() => localStorage.getItem(KEY) || "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ nextOffset: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const stop = useRef(false);

  useEffect(() => () => { stop.current = true; }, []);

  const run = async (id) => {
    setBusy(true);
    stop.current = false;
    setError("");
    try {
      while (!stop.current) {
        const response = await api.post(`${ROOT}/next`, { jobId: id, batchSize: 1 });
        const data = response.data || {};
        setProgress({ nextOffset: data.nextOffset || 0, total: data.total || 0 });
        setSummary(data.summary || null);
        if (Array.isArray(data.batchResults)) setResults((old) => [...old, ...data.batchResults]);
        if (data.done) {
          if (Array.isArray(data.results)) setResults(data.results);
          localStorage.removeItem(KEY);
          setJobId("");
          onComplete?.();
          break;
        }
        if (data.busy) { setError("Another image batch is running. Retry in a moment."); break; }
        if (!data.success) throw new Error(data.message || "Image sync failed");
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Image sync interrupted. Use Resume.");
    } finally {
      setBusy(false);
    }
  };

  const prepare = async () => {
    if (!file) { setError("Select the original Excel .xlsx file first."); return; }
    stop.current = false;
    setBusy(true);
    setError("");
    setResults([]);
    setSummary(null);
    setProgress({ nextOffset: 0, total: 0 });
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await api.post(`${ROOT}/prepare`, body);
      const id = response.data?.jobId;
      if (!id) throw new Error("Sync job ID missing");
      localStorage.setItem(KEY, id);
      setJobId(id);
      setProgress({ nextOffset: 0, total: response.data.total || 0 });
      setBusy(false);
      await run(id);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to prepare image sync");
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!jobId) return;
    try {
      const statusResponse = await api.get(`${ROOT}/status/${jobId}`);
      const data = statusResponse.data;
      setProgress({ nextOffset: data.nextOffset || 0, total: data.total || 0 });
      setResults(data.results || []);
      if (data.done) { setJobId(""); localStorage.removeItem(KEY); onComplete?.(); return; }
      await run(jobId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to resume image sync");
    }
  };

  const failed = results.filter((result) => result.status === "failed" || result.status === "not_found");

  return (
    <section className="rounded-2xl border border-[#DED4C5] bg-[#FCFAF6] p-5 text-[#201C17] shadow-sm" aria-label="Google Drive multiple image sync">
      <h2 className="text-xl font-bold">Sync Google Drive product images</h2>
      <p className="mt-2 text-sm text-[#5E574E]">Use your unchanged Product Master Excel. Reads each product's Google Drive folder, imports all supported pictures into Cloudinary, and adds them to the existing catalogue without changing prices, stock or box dimensions.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input type="file" accept=".xlsx,.xlsm,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={busy} aria-label="Select original Excel workbook" className="max-w-full text-sm" />
        <button type="button" onClick={prepare} disabled={busy || !file}
          className="rounded-full bg-[#D86B18] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Syncing..." : "Start image-only sync"}
        </button>
        {busy && <button type="button" onClick={() => { stop.current = true; }} className="rounded-full border px-4 py-2 text-sm">Pause after current batch</button>}
        {!busy && jobId && <button type="button" onClick={resume} className="rounded-full border border-[#B86B2F] px-4 py-2 text-sm font-semibold">Resume last sync</button>}
      </div>
      {progress.total > 0 && <div className="mt-4" aria-live="polite">
        <div className="flex justify-between text-sm"><span>{progress.nextOffset} / {progress.total} folders processed</span><span>{Math.floor((progress.nextOffset / progress.total) * 100)}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E6DED3]"><div className="h-full bg-[#D86B18] transition-all" style={{ width: `${progress.nextOffset / progress.total * 100}%` }} /></div>
        {summary && <p className="mt-2 text-sm">Updated: {summary.updated} · Unchanged: {summary.unchanged} · Failed: {summary.failed} · SKU not found: {summary.notFound}</p>}
      </div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {failed.length > 0 && <details className="mt-4 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">{failed.length} folder(s) need attention</summary>
        <div className="mt-2 max-h-44 overflow-y-auto">{failed.map((item, index) => <p key={`${item.sku}-${index}`} className="mb-2"><strong>{item.sku}</strong> {item.name}: {item.message}</p>)}</div>
      </details>}
      <p className="mt-3 text-xs text-[#827465]">This tool does not replace or delete product records. Rows with no image URL cannot be synced. Keep this tab open until complete; you can also resume later.</p>
    </section>
  );
}

// Admin-only live readiness report. Rechecking after image sync immediately updates
// pending/ready counts; it does not call the destructive Excel import endpoint.
function ProductMasterArchivePanel({ reloadKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("archive");
  const [mediaView, setMediaView] = useState("all");
  const [gallery, setGallery] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/catalog/admin/import/product-master/archive?limit=500");
      setRows(response.data?.records || []);
      setSummary(response.data?.summary || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load archive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [reloadKey]);

  const visible = rows.filter((row) =>
    (view === "all" || row.state === view) &&
    (mediaView === "all" || row.imageState === mediaView)
  );

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white" aria-label="Product Master archive">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#F97316]">Admin only</p>
          <h2 className="mt-1 text-xl font-bold">Catalogue readiness & image audit</h2>
          <p className="mt-2 text-sm text-black/55">
            Archived products remain visible here to admins, including saved photos.
            A Google Drive folder link is not a displayable image until image-only sync succeeds.
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
        <span className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Photos saved: {summary?.savedImageRows ?? 0}</span>
        <span className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Drive links pending: {summary?.pendingDriveRows ?? 0}</span>
        <span className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">No image link: {summary?.noSourceLinkRows ?? 0}</span>
      </div>
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
        <span className="self-center text-xs text-black/40">Showing {visible.length} of {rows.length}</span>
      </div>
      {error && <p role="alert" className="px-5 pb-3 text-sm text-red-600">{error}</p>}
      <div className="max-h-[480px] overflow-auto border-t border-black/10">
        <table className="min-w-[900px] w-full text-left text-xs sm:text-sm">
          <thead className="sticky top-0 z-10 bg-[#FAF7F3] text-black/60"><tr>
            <th className="p-3">Image</th><th className="p-3">SKU</th><th className="p-3">Product / Box</th>
            <th className="p-3">Readiness</th><th className="p-3">What is missing</th>
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
                <td className="p-3 text-black/60">{row.reasons?.join(" · ") || "—"}</td>
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
  const currentData = importResult || preview;
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
                  {(currentData.results || []).map(
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
