// EXACT PATH: frontend/src/pages/admin/studio/OccasionStudio.jsx
// Non-technical occasion editor; Excel/manual field ownership preserved.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../api/api.js';
import ProductChooser from '../../../components/adminStudio/ProductChooser.jsx';
import { Page, Section, Notice, Field, Empty, input, primary, secondary, getError } from '../../../components/adminStudio/StudioUI.jsx';
const API = '/marketing-studio/admin/occasions';
const standard = [['name', 'Occasion name'], ['category', 'Category'], ['priority', 'Launch priority'], ['theme', 'Suggested gifting theme']];
const extra = [['subcategory', 'Subcategory'], ['market', 'Market / region'], ['audience', 'Customer audience'], ['giftFormat', 'Gift format'], ['seoKeyword', 'Search keyword'], ['priceBand', 'Indicative price range'], ['calendarType', 'Calendar type'], ['unverifiedDate', 'Date (verify with calendar)'], ['culturalNote', 'Internal guidance']];
const all = [...standard, ...extra];
const makeForm = o => Object.fromEntries(all.map(([k]) => [k, String(o?.[k] ?? '')]));
const id = o => String(o?._id || o || '');
export default function OccasionStudio() {
    const [rows, setRows] = useState([]), [total, setTotal] = useState(0), [page, setPage] = useState(1);
    const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [priority, setPriority] = useState('');
    const [editing, setEditing] = useState(''), [original, setOriginal] = useState(null), [form, setForm] = useState(makeForm()), [expanded, setExpanded] = useState(false);
    const [linked, setLinked] = useState([]), [draftLinks, setDraftLinks] = useState([]), [busy, setBusy] = useState(false);
    const [error, setError] = useState(''), [message, setMessage] = useState('');
    const load = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            const r = await api.get(API, { params: { page, limit: 24, ...(search ? { search } : {}), ...(priority ? { priority } : {}) } });
            setRows(r.data?.occasions || []);
            setTotal(r.data?.total || 0);
        }
        catch (e) {
            setError(getError(e));
        }
        finally {
            setBusy(false);
        }
    }, [page, search, priority]);
    useEffect(() => { void load(); }, [load]);
    const open = async (row = null) => {
        setError('');
        setMessage('');
        setExpanded(false);
        setLinked([]);
        setDraftLinks([]);
        if (!row) {
            setOriginal(null);
            setForm(makeForm());
            setEditing('new');
            return;
        }
        setBusy(true);
        try {
            const r = await api.get(`${API}/${row._id}`);
            const x = r.data?.occasion || row;
            const associated = (r.data?.linkedProducts || []).map(l => l.product).filter(p => p?._id);
            setOriginal(x);
            setForm(makeForm(x));
            setLinked(associated);
            setDraftLinks(associated.map(id));
            setEditing(String(x._id));
        }
        catch (e) {
            setError(getError(e));
        }
        finally {
            setBusy(false);
        }
    };
    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        setMessage('');
        if (!form.name.trim()) {
            setError('Occasion name is required.');
            setBusy(false);
            return;
        }
        try {
            if (editing === 'new') {
                // The backend requires a unique stable code. Create one without asking staff to type an ID.
                const code = `MNL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
                const body = { code, ...Object.fromEntries(all.map(([k]) => [k, form[k].trim()])) };
                const r = await api.post(API, body);
                await open(r.data.occasion);
                setMessage('Occasion created as Unpublished. Review products and publish when ready.');
            }
            else {
                // VERY IMPORTANT: do not submit unchanged Excel-owned fields (backend protects every submitted field as manual override).
                const changed = Object.fromEntries(all.filter(([k]) => form[k].trim() !== String(original?.[k] ?? '').trim()).map(([k]) => [k, form[k].trim()]));
                if (Object.keys(changed).length) {
                    await api.patch(`${API}/${editing}`, changed);
                    const r = await api.get(`${API}/${editing}`);
                    setOriginal(r.data.occasion);
                    setForm(makeForm(r.data.occasion));
                    setMessage('Changes saved. Only edited fields are protected from future Excel updates.');
                }
                else
                    setMessage('No changes to save.');
            }
            await load();
        }
        catch (e) {
            setError(getError(e));
        }
        finally {
            setBusy(false);
        }
    };
    const visibility = async (row, publish) => {
        if (!window.confirm(`${publish ? 'Publish' : 'Unpublish'} "${row.name}"? This only affects the occasion collection, not live product status.`))
            return;
        setBusy(true);
        setError('');
        try {
            await api.patch(`${API}/${row._id}`, { isPublished: publish });
            setMessage(`Occasion ${publish ? 'published' : 'unpublished'}. Existing hampers unchanged.`);
            if (editing === String(row._id)) {
                const r = await api.get(`${API}/${row._id}`);
                setOriginal(r.data.occasion);
            }
            await load();
        }
        catch (e) {
            setError(getError(e));
        }
        finally {
            setBusy(false);
        }
    };
    const saveLinks = async () => {
        if (!original?._id)
            return;
        const previous = new Set(linked.map(id));
        const desired = new Set(draftLinks);
        const added = [...desired].filter(x => !previous.has(x));
        const removed = [...previous].filter(x => !desired.has(x));
        if (!added.length && !removed.length)
            return setMessage('No product links changed.');
        if (removed.length && !window.confirm(`Remove ${removed.length} occasion association(s)? The products will remain in the catalog.`))
            return;
        setBusy(true);
        setError('');
        try {
            // Sequential operations make partial failures easy to diagnose and retry.
            for (const p of added)
                await api.post(`${API}/${editing}/products/${p}`);
            for (const p of removed)
                await api.delete(`${API}/${editing}/products/${p}`);
            const r = await api.get(`${API}/${editing}`);
            const associated = (r.data.linkedProducts || []).map(l => l.product).filter(x => x?._id);
            setLinked(associated);
            setDraftLinks(associated.map(id));
            setMessage(`Links updated: ${added.length} added, ${removed.length} removed. Product visibility unchanged.`);
        }
        catch (e) {
            setError(`${getError(e)}. Some links may have saved; reopen this occasion to review.`);
        }
        finally {
            setBusy(false);
        }
    };
    const linkChanged = [...new Set([...linked.map(id), ...draftLinks])].some(x => linked.map(id).includes(x) !== draftLinks.includes(x));
    return <Page eyebrow="HAMPORIUM / MARKETING" title="Occasions" description="Manage gifting occasions imported from Excel. Find an occasion, update its details, or connect relevant hampers." actions={<Link to="/admin/studio/marketing" className={secondary}>← Marketing</Link>}>
    {error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
    {!editing ? <Section title="Find an occasion" description="You can search by name or occasion code. Import new Excel data from Marketing Excel Sync." actions={<button className={primary} onClick={() => open()}>+ New occasion</button>}>
      <form onSubmit={e => { e.preventDefault(); setPage(1); setSearch(query.trim()); }} className="mb-5 flex flex-wrap gap-2"><input className={`${input} max-w-[450px] flex-1`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Diwali, Wedding, Birthday…" aria-label="Occasion search"/><select className={`${input} max-w-[180px]`} value={priority} onChange={e => { setPage(1); setPriority(e.target.value); }} aria-label="Launch priority"><option value="">All priorities</option>{['P1', 'P2', 'P3', 'P4', 'P5'].map(p => <option key={p} value={p}>{p}</option>)}</select><button className={secondary}>Search</button></form>
      {!rows.length ? <Empty>{busy ? 'Loading occasions…' : 'No matching occasions. Try another name or import Excel.'}</Empty> : <div className="grid gap-3 lg:grid-cols-2">{rows.map(x => <div key={x._id} className="rounded-xl border border-[#E9E0D4] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-bold">{x.name}</h3><p className="mt-1 text-[11px] text-black/50">{x.category || 'Gifting occasion'} · {x.priority || 'No priority'} · {x.source === 'excel' ? 'Excel master' : 'Manually created'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${x.isPublished ? 'bg-emerald-50 text-emerald-800' : 'bg-[#F5F0E8] text-black/55'}`}>{x.isPublished ? 'Published' : 'Unpublished'}</span></div><div className="mt-4 flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={() => open(x)}>Edit / Hampers</button><button className={x.isPublished ? secondary : primary} disabled={busy} onClick={() => visibility(x, !x.isPublished)}>{x.isPublished ? 'Unpublish' : 'Publish'}</button></div></div>)}</div>}
      <div className="mt-5 flex items-center justify-between gap-2 text-xs"><span>{total.toLocaleString('en-IN')} occasions · Page {page}</span><div className="flex gap-2"><button className={secondary} disabled={busy || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><button className={secondary} disabled={busy || page * 24 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
    </Section> : <><div className="flex items-center justify-between"><button type="button" className={secondary} onClick={() => { setEditing(''); setError(''); }}>← All occasions</button>{original && <span className="rounded-full bg-[#F5F0E8] px-3 py-1.5 text-xs">{original.isPublished ? 'Published' : 'Unpublished'}</span>}</div>
      <Section title={editing === 'new' ? 'New occasion' : `Edit ${original?.name || 'occasion'}`} description="Only change what you need. Unchanged Excel data stays Excel-managed.">
        <form onSubmit={save} className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{standard.map(([key, label]) => <Field key={key} label={label} required={key === 'name'}><input className={input} value={form[key]} required={key === 'name'} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={label}/></Field>)}</div><details open={expanded} onToggle={e => setExpanded(e.currentTarget.open)} className="rounded-xl border border-[#E9DFD0] p-3"><summary className="cursor-pointer text-xs font-bold">More details (optional)</summary><div className="mt-4 grid gap-4 md:grid-cols-2">{extra.map(([key, label]) => <Field key={key} label={label}><input className={input} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={label}/></Field>)}</div><p className="mt-3 text-[11px] text-amber-800">Festival dates imported from Excel may be unverified. Confirm dates before customer-facing announcements.</p></details><button type="submit" disabled={busy} className={primary}>{busy ? 'Saving…' : editing === 'new' ? 'Create occasion' : 'Save details'}</button></form>
      </Section>
      {editing !== 'new' && <Section title="Hampers for this occasion" description="Search and select existing products by name. Nothing is deleted or unpublished when you change an occasion link."><ProductChooser title="Linked products" value={draftLinks} onChange={setDraftLinks} suggested={linked} disabled={busy} max={100}/><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-black/50">{draftLinks.length} chosen · Saved links: {linked.length}</p><button className={primary} type="button" disabled={busy || !linkChanged} onClick={saveLinks}>{busy ? 'Saving…' : 'Save hamper links'}</button></div></Section>}
      {original && <Section title="Customer visibility" description="Publishing an occasion creates a public gifting collection; it does not change product publication or prices."><button type="button" disabled={busy} className={original.isPublished ? secondary : primary} onClick={() => visibility(original, !original.isPublished)}>{original.isPublished ? 'Unpublish occasion' : 'Publish occasion'}</button>{original.isPublished && <Link to={`/occasions/${original.slug}`} target="_blank" className={`${secondary} ml-2`}>View collection ↗</Link>}</Section>}
    </>}
  </Page>;
}
