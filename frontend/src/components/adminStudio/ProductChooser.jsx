
// EXACT PATH: frontend/src/components/adminStudio/ProductChooser.jsx
// Reusable staff-friendly product selector. No database IDs exposed to staff.
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/api.js';
import { input, secondary, getError } from './StudioUI.jsx';

const unique = (arr) => [...new Set(arr.map(String).filter(Boolean))];
const imageOf = (row) => row?.images?.[0]?.url || row?.images?.[0]?.secure_url || '';
const money = (v) => typeof v === 'number' ? `₹${v.toLocaleString('en-IN')}` : 'Price pending';

export default function ProductChooser({ value = [], onChange, disabled = false, title = 'Choose hampers or products', suggested = [], max = 100 }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [known, setKnown] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const selected = unique(value).slice(0, max);

  const addKnown = useCallback((incoming) => {
    setKnown(old => {
      const next = { ...old };
      for (const x of incoming) if (x?._id) next[String(x._id)] = x;
      return next;
    });
  }, []);

  useEffect(() => { addKnown(suggested); }, [suggested, addKnown]);

  useEffect(() => {
    const seq = ++latest.current;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const r = await api.get('/catalog/admin/products', { params: { search: query.trim(), page: 1, limit: 24 } });
        if (seq !== latest.current) return;
        const products = r.data?.products || [];
        setRows(products);
        addKnown(products);
      } catch (e) { if (seq === latest.current) setError(getError(e)); }
      finally { if (seq === latest.current) setLoading(false); }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, addKnown]);

  // Resolve already-saved selections, e.g. when editing an older campaign.
  useEffect(() => {
    let alive = true;
    const missing = selected.filter(id => !known[id]).slice(0, 15);
    if (!missing.length) return undefined;
    Promise.allSettled(missing.map(id => api.get(`/catalog/admin/products/${id}`))).then(results => {
      if (!alive) return;
      addKnown(results.filter(x => x.status === 'fulfilled').map(x => x.value.data?.product).filter(Boolean));
    });
    return () => { alive = false; };
  // Dependencies intentionally use a stable key for selected IDs and known entries.
  }, [selected.join('|'), selected.filter(id => !known[id]).join('|'), addKnown]);

  const toggle = (id) => {
    if (disabled) return;
    const next = selected.includes(id) ? selected.filter(x => x !== id) : unique([...selected, id]);
    if (next.length <= max) onChange(next);
  };
  const suggestedNotSelected = suggested.filter(x => x?._id && !selected.includes(String(x._id)));

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] font-bold">{title}</p><span className="rounded-full bg-[#F3EEE6] px-3 py-1 text-[11px] text-[#695840]">{selected.length} selected</span></div>
    {selected.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Selected products">{selected.map(id => <span key={id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#D6C5AB] bg-[#FAF6EF] px-3 py-1.5 text-[11px]"><span className="max-w-[220px] truncate">{known[id]?.name || 'Saved product (details loading)'}</span><button type="button" disabled={disabled} aria-label={`Remove ${known[id]?.name || 'product'}`} onClick={() => toggle(id)} className="font-bold text-[#8D6540] hover:text-red-700">×</button></span>)}</div>}
    {suggestedNotSelected.length > 0 && <div className="rounded-xl border border-[#E6D9C4] bg-[#FFFBF4] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">Hampers linked to this occasion</p><button type="button" className={secondary} disabled={disabled || selected.length >= max} onClick={() => onChange(unique([...selected, ...suggestedNotSelected.map(x => String(x._id))]).slice(0, max))}>+ Add linked hampers</button></div><p className="mt-1 text-[11px] text-black/55">Suggested from existing catalog. You can remove any you don't want to feature.</p></div>}
    <input value={query} onChange={e => setQuery(e.target.value)} disabled={disabled} className={input} placeholder="Search by hamper or product name" aria-label="Search products" />
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <div className="max-h-[330px] space-y-1 overflow-y-auto rounded-xl border border-[#EEE6DA] p-2">
      {loading && <p className="p-3 text-xs text-black/45">Searching catalog…</p>}
      {!loading && rows.length === 0 && <p className="p-3 text-xs text-black/55">No products found. Try a different name.</p>}
      {!loading && rows.map(row => { const id = String(row._id), checked = selected.includes(id); return <button key={id} type="button" onClick={() => toggle(id)} disabled={disabled || (!checked && selected.length >= max)} aria-pressed={checked} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-[#F8F4ED] disabled:opacity-50 ${checked ? 'bg-[#F4EBDC]' : ''}`}><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F3EEE5]">{imageOf(row) ? <img src={imageOf(row)} alt="" className="h-full w-full object-cover" loading="lazy"/> : <span className="text-[10px] text-black/30">No image</span>}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{row.name}</span><span className="mt-0.5 block text-[10px] text-black/50">{money(row.minPrice)} · {row.status === 'active' ? 'Live' : row.status === 'archived' ? 'Archived' : 'Draft'}</span></span><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${checked ? 'border-[#B58D57] bg-[#B58D57] text-white' : 'border-[#CFC4B5]'}`}>{checked ? '✓' : ''}</span></button>; })}
    </div>
    <p className="text-[11px] text-black/50">Only currently published, purchasable products appear to customers. Selecting a product never publishes it.</p>
  </div>;
}
