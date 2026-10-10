import { useEffect, useRef, useState } from "react";
import api from "../../api/api.js";

const KEY = "hamporium:image-sync-job";
const ROOT = "/catalog/admin/import/product-master/images";

// Add <ProductMasterImageSyncPanel /> to an ADMIN-only catalogue import page.
// It never calls the destructive Product Master "Confirm Import" endpoint.
export default function ProductMasterImageSyncPanel() {
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
      if (data.done) { setJobId(""); localStorage.removeItem(KEY); return; }
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
