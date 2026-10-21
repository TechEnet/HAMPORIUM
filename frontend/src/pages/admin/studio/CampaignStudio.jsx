
// EXACT PATH: frontend/src/pages/admin/studio/CampaignStudio.jsx
// Guided campaign management. Keeps the existing Marketing Studio API contract.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { uploadCatalogImage } from '../../../api/api.js';
import ProductChooser from '../../../components/adminStudio/ProductChooser.jsx';
import { Page, Section, Notice, Field, Empty, input, primary, secondary, danger, getError, date } from '../../../components/adminStudio/StudioUI.jsx';

const API = '/marketing-studio/admin/campaigns';
const OCCASIONS = '/marketing-studio/admin/occasions';
const fresh = () => ({ name: '', slug: '', headline: '', description: '', theme: '', bannerImage: '', mobileImage: '', buttonText: 'Explore Gifts', startsAt: '', endsAt: '', occasion: '', products: [], promotion: null, placement: ['home_hero', 'campaign_page'], targeting: { countries: [], states: [], cities: [] }, budgetINR: '', internalNotes: '' });
const asLocal = v => {
  if (!v || Number.isNaN(new Date(v).getTime())) return '';
  const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toISO = v => v ? new Date(v).toISOString() : null;
const unique = a => [...new Set((a || []).map(String).filter(Boolean))];
const labelOf = (x) => typeof x === 'string' ? x : x?.name || '';
const ID = x => x?._id ? String(x._id) : x ? String(x) : '';

// Admin-only diagnostics. Uses exactly the same public endpoint as the homepage.
// Does not publish, change catalog products, or bypass geo/date restrictions.
const readableDateTime = value => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';
};
const isLocationTargeted = campaign => ['countries', 'states', 'cities'].some(
  key => Array.isArray(campaign?.targeting?.[key]) && campaign.targeting[key].length > 0
);
const homeVisibilityReason = (campaign, publicList) => {
  if (campaign.status !== 'published') return 'This campaign is not Published. Publish it after completing the checklist.';
  const now = Date.now();
  const from = new Date(campaign.startsAt).getTime();
  const until = new Date(campaign.endsAt).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(until)) return 'Start/end time is missing or invalid. Review the Schedule step.';
  if (now < from) return `Published but scheduled: banner starts ${readableDateTime(campaign.startsAt)} (local time). It is not active yet.`;
  if (now > until) return `Published but ended: banner stopped ${readableDateTime(campaign.endsAt)}.`;
  if (!(campaign.placement || []).includes('home_hero')) return 'Homepage placement is off. Pause the campaign, enable “Homepage seasonal banner”, save, then republish.';
  if (!campaign.bannerImage) return 'Banner image is missing. Pause, upload a banner, save, then republish.';
  if (isLocationTargeted(campaign)) return 'This campaign targets specific locations. The current homepage does not send visitor location to this API, so it may be hidden. For a global test: Pause, choose All locations in Advanced options, save, and republish.';
  if (!Array.isArray(publicList)) return 'Unable to verify public visibility. Retry after checking the API connection.';
  if (!publicList.some(item => String(item._id) === String(campaign._id))) return 'Campaign is not in the public API response yet. Verify frontend/backend environment and refresh after saving; check API logs if it persists.';
  return 'Ready and present in the public API. Open the homepage and scroll below its existing promotional banners. If absent, confirm Home.jsx mounts WebsiteCampaigns and refresh the page.';
};

function BannerInput({ label, value, onChange, disabled, onError, busy, setBusy }) {
  const fileRef = useRef(null);
  const choose = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || disabled) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return onError('Please choose a JPG, PNG, WEBP or AVIF image.');
    if (file.size > 32 * 1024 * 1024) return onError('Image is larger than 32 MB. Please choose a smaller image.');
    setBusy(true); onError('');
    try {
      // Uses the ALREADY INSTALLED catalog image uploader (optimized WebP + HTTPS Cloudinary URL).
      const image = await uploadCatalogImage(file, 'collection');
      if (!image?.url) throw new Error('Image upload did not return a URL');
      onChange(image.url);
    } catch (err) { onError(getError(err)); }
    finally { setBusy(false); }
  };
  return <div className="min-w-0 rounded-2xl border border-[#E7DECF] bg-[#FFFEFC] p-3">
    <p className="mb-2 text-[12px] font-semibold">{label}</p>
    {value ? <img src={value} alt={`${label} preview`} className="h-36 w-full rounded-xl bg-[#F2ECE3] object-cover"/> : <div className="flex h-36 items-center justify-center rounded-xl bg-[#F5F0E8] text-xs text-[#87745B]">No banner selected</div>}
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={choose} disabled={disabled || busy}/>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={secondary} disabled={disabled || busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : value ? 'Change image' : 'Choose image'}</button>{value && <button type="button" className={secondary} disabled={disabled || busy} onClick={() => onChange('')}>Remove</button>}</div>
    <p className="mt-2 text-[10px] leading-5 text-black/50">JPG, PNG, WEBP or AVIF. Image will be optimized and saved online.</p>
  </div>;
}

function StepBar({ step, onJump }) {
  const stages = ['Occasion', 'Hampers', 'Banner', 'Schedule & Preview'];
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Campaign setup steps">{stages.map((name, i) => <button key={name} type="button" onClick={() => onJump(i)} className={`rounded-xl border px-3 py-3 text-left text-xs transition ${step === i ? 'border-[#A77E49] bg-[#F9F0E3] font-bold text-[#3B2C1C]' : 'border-[#E4D9CA] bg-white text-black/55 hover:bg-[#FAF7F3]'}`}><span className="mr-2 text-[10px]">{i + 1}.</span>{name}</button>)}</div>;
}

export default function CampaignStudio() {
  const [rows, setRows] = useState([]), [filter, setFilter] = useState(''), [listBusy, setListBusy] = useState(false);
  const [editing, setEditing] = useState(''), [step, setStep] = useState(0), [form, setForm] = useState(fresh), [saved, setSaved] = useState(null), [dirty, setDirty] = useState(false);
  const [occasions, setOccasions] = useState([]), [occasionQuery, setOccasionQuery] = useState(''), [occasionBusy, setOccasionBusy] = useState(false);
  const [linked, setLinked] = useState([]), [imageBusy, setImageBusy] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [visibilityReports, setVisibilityReports] = useState({});
  const [checkingVisibilityId, setCheckingVisibilityId] = useState('');
  const [advanced, setAdvanced] = useState(false), [geo, setGeo] = useState({ countries: [], states: [], cities: [] }), [geoSearch, setGeoSearch] = useState('');
  const sequence = useRef(0);
  const isArchived = saved?.status === 'archived';
  const isReadOnly = isArchived || saved?.status === 'published';

  const load = useCallback(async () => {
    setListBusy(true);
    try { const r = await api.get(API, { params: { limit: 100, ...(filter ? { status: filter } : {}) } }); setRows(r.data?.campaigns || []); }
    catch (e) { setError(getError(e)); }
    finally { setListBusy(false); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const seq = ++sequence.current;
    const timer = setTimeout(async () => {
      setOccasionBusy(true);
      try {
        const r = await api.get(OCCASIONS, { params: { search: occasionQuery.trim(), limit: 100 } });
        if (seq === sequence.current) setOccasions(old => {
          const incoming = r.data?.occasions || [];
          const selected = old.find(x => String(x._id) === form.occasion);
          return selected && !incoming.some(x => x._id === selected._id) ? [selected, ...incoming] : incoming;
        });
      } catch (e) { if (seq === sequence.current) setError(getError(e)); }
      finally { if (seq === sequence.current) setOccasionBusy(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [occasionQuery, form.occasion]);

  useEffect(() => {
    if (!form.occasion || occasions.some(x => String(x._id) === form.occasion)) return undefined;
    let alive = true;
    api.get(`${OCCASIONS}/${form.occasion}`).then(r => { if (alive && r.data?.occasion) setOccasions(old => [r.data.occasion, ...old.filter(x => String(x._id) !== form.occasion)]); }).catch(() => {});
    return () => { alive = false; };
  }, [form.occasion, occasions.length]);

  useEffect(() => {
    let alive = true; setLinked([]);
    if (!form.occasion) return undefined;
    api.get(`${OCCASIONS}/${form.occasion}`).then(r => {
      if (alive) setLinked((r.data?.linkedProducts || []).map(x => x.product).filter(x => x?._id));
    }).catch(() => {});
    return () => { alive = false; };
  }, [form.occasion]);

  useEffect(() => {
    if (!advanced) return undefined;
    let live = true;
    api.get('/marketing-studio/public/geo', { params: { type: 'countries', search: geoSearch, limit: 100 } }).then(r => { if (live) setGeo(g => ({ ...g, countries: r.data?.results || [] })); }).catch(() => {});
    return () => { live = false; };
  }, [advanced, geoSearch]);
  useEffect(() => {
    if (!advanced || !form.targeting.countries[0]) return undefined;
    let live = true;
    api.get('/marketing-studio/public/geo', { params: { type: 'states', country: form.targeting.countries[0], limit: 100 } }).then(r => { if (live) setGeo(g => ({ ...g, states: r.data?.results || [] })); }).catch(() => {});
    return () => { live = false; };
  }, [advanced, form.targeting.countries[0]]);
  useEffect(() => {
    if (!advanced || !form.targeting.states[0]) return undefined;
    let live = true;
    api.get('/marketing-studio/public/geo', { params: { type: 'cities', country: form.targeting.countries[0], state: form.targeting.states[0], limit: 100 } }).then(r => { if (live) setGeo(g => ({ ...g, cities: r.data?.results || [] })); }).catch(() => {});
    return () => { live = false; };
  }, [advanced, form.targeting.countries[0], form.targeting.states[0]]);

  const checkHomepageVisibility = async campaign => {
    const id = String(campaign._id);
    setCheckingVisibilityId(id);
    setVisibilityReports(old => ({ ...old, [id]: { message: 'Checking public campaign visibility…', okay: false } }));
    try {
      const response = await api.get('/marketing-studio/public/campaigns');
      const result = homeVisibilityReason(campaign, response.data?.campaigns);
      const okay = result.startsWith('Ready and present');
      setVisibilityReports(old => ({ ...old, [id]: { message: result, okay } }));
    } catch (err) {
      const status = err?.response?.status;
      setVisibilityReports(old => ({ ...old, [id]: {
        okay: false,
        message: `Public campaign API could not be checked${status ? ` (HTTP ${status})` : ''}. ${getError(err)}. Check backend deployment or API configuration.`,
      } }));
    } finally {
      setCheckingVisibilityId('');
    }
  };
  const update = (key, val) => { setDirty(true); setForm(f => ({ ...f, [key]: val })); };
  const start = async (id = '') => {
    setError(''); setMessage(''); setLinked([]); setAdvanced(false); setOccasionQuery(''); setStep(0); setDirty(false);
    if (!id) { setEditing('new'); setSaved(null); setForm(fresh()); return; }
    setBusy(true);
    try {
      const r = await api.get(`${API}/${id}`); const x = r.data?.campaign;
      if (!x) throw new Error('Campaign not found');
      setEditing(id); setSaved(x); setForm({ ...fresh(), ...x, occasion: ID(x.occasion), promotion: ID(x.promotion) || null, products: unique(x.products || []), startsAt: asLocal(x.startsAt), endsAt: asLocal(x.endsAt), targeting: { countries: x.targeting?.countries || [], states: x.targeting?.states || [], cities: x.targeting?.cities || [] }, budgetINR: x.budgetINR ?? '' });
    } catch (e) { setError(getError(e)); }
    finally { setBusy(false); }
  };
  const makePayload = () => ({
    name: form.name.trim(), slug: form.slug.trim(), headline: form.headline.trim(), description: form.description, theme: form.theme,
    bannerImage: form.bannerImage, mobileImage: form.mobileImage, buttonText: form.buttonText.trim() || 'Explore Gifts',
    occasion: form.occasion || null, products: unique(form.products), startsAt: toISO(form.startsAt), endsAt: toISO(form.endsAt),
    placement: form.placement, targeting: form.targeting, promotion: form.promotion || null,
    budgetINR: form.budgetINR === '' ? null : Number(form.budgetINR), internalNotes: form.internalNotes
  });
  const save = async () => {
    setError(''); setMessage('');
    if (!form.name.trim()) { setStep(0); setError('Please enter a campaign name first.'); return null; }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) { setStep(3); setError('End date must be after start date.'); return null; }
    setBusy(true);
    try {
      const body = makePayload();
      const r = editing === 'new' ? await api.post(API, body) : await api.patch(`${API}/${editing}`, body);
      const x = r.data?.campaign;
      if (!x?._id) throw new Error('Campaign was not returned after saving');
      setEditing(String(x._id)); setSaved(x); setDirty(false); setMessage('Campaign details saved. Nothing was published automatically.');
      await load(); return x;
    } catch (e) { setError(getError(e)); return null; }
    finally { setBusy(false); }
  };
  const changeStatus = async (row, status) => {
    const text = status === 'published' ? `Publish "${row.name}"? If the dates are current, its banner can become visible on the live website.` : status === 'paused' ? `Pause "${row.name}" and stop showing its campaign banner?` : `Archive "${row.name}"? Its history is preserved but the record becomes read-only.`;
    if (!window.confirm(text)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post(`${API}/${row._id}/status`, { status });
      await load(); if (editing === String(row._id)) await start(String(row._id));
      setMessage(status === 'published' ? 'Campaign published. It is visible only during its scheduled dates.' : `Campaign ${status}.`);
    } catch (e) { setError(getError(e)); if (e.response?.data?.reasons) { setStep(3); setMessage(`Cannot publish yet: ${e.response.data.reasons.join(' · ')}`); } }
    finally { setBusy(false); }
  };
  const duplicate = async row => {
    setBusy(true); setError('');
    try {
      const r = await api.get(`${API}/${row._id}`); const source = r.data.campaign;
      const suffix = Date.now().toString(36);
      const body = { name: `${source.name} (Copy)`, slug: `${source.slug}-copy-${suffix}`, headline: source.headline, description: source.description, theme: source.theme, bannerImage: source.bannerImage, mobileImage: source.mobileImage, buttonText: source.buttonText, occasion: source.occasion || null, products: source.products || [], startsAt: null, endsAt: null, placement: source.placement || ['home_hero','campaign_page'], targeting: source.targeting || { countries: [], states: [], cities: [] }, promotion: null, budgetINR: source.budgetINR ?? null, internalNotes: source.internalNotes || '' };
      const result = await api.post(API, body); await load(); await start(result.data.campaign._id);
      setMessage('Copied as a new Draft. Choose new dates, review everything, then publish separately.'); setStep(3);
    } catch (e) { setError(getError(e)); }
    finally { setBusy(false); }
  };
  const activeOccasion = occasions.find(x => String(x._id) === form.occasion);
  const visibleChecklist = [
    ['Campaign name', !!form.name.trim()], ['Customer headline', !!form.headline.trim()],
    ['Banner image uploaded', /^https:\/\//i.test(form.bannerImage)],
    ['At least one featured hamper/product', form.products.length > 0],
    ['Start and end dates', !!form.startsAt && !!form.endsAt && new Date(form.endsAt) > new Date(form.startsAt)]
  ];
  const ready = visibleChecklist.every(x => x[1]);
  return <Page eyebrow="HAMPORIUM / MARKETING" title="Campaigns" description="Create a beautiful seasonal banner in four simple steps. Save as draft first, then publish when you are ready." actions={<Link to="/admin/studio/marketing" className={secondary}>← Marketing</Link>}>
    {error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
    {!editing ? <Section title="Your campaigns" description="Choose an existing campaign or create a new one." actions={<button type="button" className={primary} onClick={() => start()}>+ Create campaign</button>}>
      <div className="mb-4 flex flex-wrap items-center gap-2"><select aria-label="Filter campaigns" className={`${input} max-w-[200px]`} value={filter} onChange={e => setFilter(e.target.value)}><option value="">All campaigns</option><option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option><option value="archived">Archived</option></select><button className={secondary} type="button" onClick={load}>Refresh</button></div>
      {!rows.length ? <Empty>{listBusy ? 'Loading…' : 'No campaigns found. Create your first campaign.'}</Empty> : <div className="grid gap-3 lg:grid-cols-2">{rows.map(row => <div key={row._id} className="rounded-2xl border border-[#E7DECF] bg-[#FFFEFC] p-4"><div className="flex items-start gap-3">{row.bannerImage ? <img alt="" src={row.bannerImage} className="h-20 w-24 shrink-0 rounded-xl object-cover" loading="lazy"/> : <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-[#F4EEE5] text-[10px] text-black/40">No banner</div>}<div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-[#967344]">{row.status}</p><h3 className="mt-1 truncate text-sm font-bold">{row.name}</h3><p className="mt-1 text-[11px] text-black/50">{readableDateTime(row.startsAt)} – {readableDateTime(row.endsAt)}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => start(row._id)}>{row.status === 'archived' ? 'View' : 'Edit'}</button><button type="button" className={secondary} disabled={checkingVisibilityId === String(row._id)} onClick={() => checkHomepageVisibility(row)}>{checkingVisibilityId === String(row._id) ? 'Checking…' : 'Check homepage visibility'}</button><button type="button" className={secondary} disabled={busy} onClick={() => duplicate(row)}>Duplicate</button>{row.status !== 'archived' && <>{row.status !== 'published' ? <button type="button" className={primary} disabled={busy} onClick={() => { void start(row._id).then(() => setStep(3)); }}>Review to publish</button> : <button type="button" className={secondary} disabled={busy} onClick={() => changeStatus(row, 'paused')}>Pause</button>}<button type="button" className={danger} disabled={busy} onClick={() => changeStatus(row, 'archived')}>Archive</button></>}</div>{visibilityReports[String(row._id)] && <div role="status" className={`mt-3 rounded-xl border px-3 py-3 text-[12px] leading-6 ${visibilityReports[String(row._id)].okay ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}><strong>Homepage check:</strong> {visibilityReports[String(row._id)].message}</div>}</div>)}</div>}
    </Section> : <>
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs text-black/60"><button type="button" className={secondary} onClick={() => { setEditing(''); setError(''); }}>← All campaigns</button><span className="rounded-full bg-[#F5EDE1] px-3 py-2 font-semibold">{saved?.status || 'New draft'}</span></div>{saved?.status === 'published' && <a target="_blank" rel="noreferrer" href={`/campaigns/${saved.slug}`} className={secondary}>View customer page ↗</a>}</div>
      <StepBar step={step} onJump={setStep}/>
      <Section title={['1. Choose your occasion', '2. Select the featured hampers', '3. Create your banner', '4. Schedule, check & save'][step]} description={['Start with an occasion and give your promotion a name.','Find products by their names. You never need a database ID.','Upload banner artwork and add the message customers will see.','Choose when it appears. Save first; publishing is a separate approval.'][step]}>
        {isArchived && <Notice tone="warning">Archived campaigns are read-only. Use Duplicate from the campaign list to reuse this one.</Notice>}{saved?.status === 'published' && <Notice tone="warning">This campaign is currently live. Pause it before editing so customers do not see incomplete changes.</Notice>}
        {step === 0 && <div className="grid gap-4 lg:grid-cols-2"><Field label="Campaign name" required help="For your team, e.g. Diwali Gifting 2026"><input className={input} disabled={isReadOnly} value={form.name} maxLength={180} onChange={e => update('name', e.target.value)} placeholder="Diwali Gifting 2026"/></Field><div><Field label="Occasion" help="Choose from the Excel Occasion Master. Optional if you select individual products."><input className={`${input} mb-2`} value={occasionQuery} disabled={isReadOnly} onChange={e => setOccasionQuery(e.target.value)} placeholder="Type Diwali, Wedding, Birthday…"/><select disabled={isReadOnly} className={input} value={form.occasion} onChange={e => { const id = e.target.value; update('occasion', id); const selected = occasions.find(x => String(x._id) === id); if (selected && !form.name) update('name', `${selected.name} Campaign ${new Date().getFullYear()}`); }}><option value="">Choose an occasion (optional)</option>{occasions.map(x => <option key={x._id} value={x._id}>{x.name} ({x.code})</option>)}</select></Field><p className="mt-1 text-[11px] text-black/50">{occasionBusy ? 'Searching occasions…' : 'Search all imported occasions by name or code.'}</p></div><div className="lg:col-span-2 rounded-xl bg-[#F8F4ED] p-4 text-xs text-black/65">{activeOccasion ? <><strong>Selected:</strong> {activeOccasion.name} · {activeOccasion.category || 'Occasion'}{!activeOccasion.isPublished && <p className="mt-1 text-amber-800">This occasion is not published yet. Campaigns and occasion collection pages have separate publish controls.</p>}</> : 'An occasion helps organize your campaign. It does not automatically create discounts or publish products.'}</div></div>}
        {step === 1 && <ProductChooser title="Featured hampers and products" value={form.products} onChange={x => update('products', x)} suggested={linked} disabled={isReadOnly}/>}
        {step === 2 && <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2"><Field label="Headline customers see" required><input className={input} maxLength={160} disabled={isReadOnly} value={form.headline} onChange={e => update('headline', e.target.value)} placeholder="Celebrate Diwali with thoughtful gifts"/></Field><Field label="Button text"><input className={input} maxLength={80} disabled={isReadOnly} value={form.buttonText} onChange={e => update('buttonText', e.target.value)} placeholder="Explore gifts"/></Field></div><Field label="Small description (optional)"><textarea className={input} rows={2} disabled={isReadOnly} value={form.description} maxLength={900} onChange={e => update('description', e.target.value)} placeholder="One or two lines about your gifting collection"/></Field><div className="grid gap-3 lg:grid-cols-2"><BannerInput label="Desktop / main banner *" value={form.bannerImage} onChange={v => update('bannerImage', v)} disabled={isReadOnly} onError={setError} busy={imageBusy} setBusy={setImageBusy}/><BannerInput label="Mobile banner (optional)" value={form.mobileImage} onChange={v => update('mobileImage', v)} disabled={isReadOnly} onError={setError} busy={imageBusy} setBusy={setImageBusy}/></div></div>}
        {step === 3 && <div className="space-y-5"><div className="grid gap-3 md:grid-cols-2"><Field label="Show from" required><input type="datetime-local" className={input} disabled={isReadOnly} value={form.startsAt} onChange={e => update('startsAt', e.target.value)}/></Field><Field label="Show until" required><input type="datetime-local" className={input} disabled={isReadOnly} value={form.endsAt} onChange={e => update('endsAt', e.target.value)}/></Field></div><div className="rounded-xl bg-[#F8F4ED] p-3"><p className="mb-2 text-xs font-bold">Where should it appear?</p><label className="flex items-center gap-3 text-xs"><input type="checkbox" disabled={isReadOnly} checked={form.placement.includes('home_hero')} onChange={e => update('placement', e.target.checked ? unique([...form.placement, 'home_hero', 'campaign_page']) : form.placement.filter(x => x !== 'home_hero'))}/>Homepage seasonal banner</label><p className="mt-2 text-[11px] text-black/50">Customer collection page is generated automatically for this campaign's URL.</p></div>
          <details open={advanced} onToggle={e => setAdvanced(e.currentTarget.open)} className="rounded-xl border border-[#E4D7C8] bg-white p-4"><summary className="cursor-pointer text-xs font-bold">Advanced options (optional)</summary><div className="mt-4 space-y-4"><p className="text-[11px] text-amber-800">For ordinary campaigns, leave targeting as All locations. Regional targeting requires the customer location integration; otherwise a targeted banner may not show to visitors.</p><div className="grid gap-3 md:grid-cols-2"><Field label="Target country" help="Leave blank to show to everyone. Search the country names if needed."><input className={`${input} mb-2`} disabled={isReadOnly} value={geoSearch} onChange={e => setGeoSearch(e.target.value)} placeholder="Find a country…"/><select className={input} disabled={isReadOnly} value={form.targeting.countries[0] || ''} onChange={e => update('targeting', { countries: e.target.value ? [e.target.value] : [], states: [], cities: [] })}><option value="">All countries</option>{form.targeting.countries[0] && !geo.countries.some(c => labelOf(c) === form.targeting.countries[0]) && <option value={form.targeting.countries[0]}>{form.targeting.countries[0]}</option>}{geo.countries.map(x => <option key={labelOf(x)} value={labelOf(x)}>{labelOf(x)}</option>)}</select></Field><Field label="Target state" help="Leave blank for the whole selected country."><select className={input} disabled={isReadOnly || !form.targeting.countries.length} value={form.targeting.states[0] || ''} onChange={e => update('targeting', { ...form.targeting, states: e.target.value ? [e.target.value] : [], cities: [] })}><option value="">All states</option>{form.targeting.states[0] && !geo.states.some(c => labelOf(c) === form.targeting.states[0]) && <option value={form.targeting.states[0]}>{form.targeting.states[0]}</option>}{geo.states.map(x => <option key={labelOf(x)} value={labelOf(x)}>{labelOf(x)}</option>)}</select></Field><Field label="Target city"><select disabled={isReadOnly || !form.targeting.states.length} className={input} value={form.targeting.cities[0] || ''} onChange={e => update('targeting', { ...form.targeting, cities: e.target.value ? [e.target.value] : [] })}><option value="">All cities</option>{form.targeting.cities[0] && !geo.cities.some(c => labelOf(c) === form.targeting.cities[0]) && <option value={form.targeting.cities[0]}>{form.targeting.cities[0]}</option>}{geo.cities.map(x => <option key={labelOf(x)} value={labelOf(x)}>{labelOf(x)}</option>)}</select></Field><Field label="Internal budget (₹)"><input className={input} type="number" min="0" disabled={isReadOnly} value={form.budgetINR} onChange={e => update('budgetINR', e.target.value)}/></Field></div><Field label="Internal notes"><textarea className={input} rows={2} disabled={isReadOnly} value={form.internalNotes} onChange={e => update('internalNotes', e.target.value)}/></Field><p className="text-[11px] text-black/55">Existing discount linkage is preserved on edit; discounts should be managed through the separate Promotions system.</p></div></details>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><div className="rounded-2xl border border-[#E5D9C8] p-4"><p className="mb-3 text-sm font-bold">Ready to publish?</p>{visibleChecklist.map(([text, ok]) => <div key={text} className="flex items-center gap-2 py-1.5 text-[12px]"><span className={ok ? 'text-emerald-700' : 'text-amber-700'}>{ok ? '✓' : '○'}</span>{text}</div>)}<p className="mt-2 text-[11px] text-black/50">Choose at least one featured product so the public campaign page has gifts. Save an incomplete draft anytime.</p></div><div className="overflow-hidden rounded-2xl border border-[#E5D9C8]"><div className="aspect-[16/7] bg-[#F4EEE5]">{form.bannerImage ? <img src={form.bannerImage} alt="Campaign banner preview" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-xs text-black/40">Banner preview</div>}</div><div className="p-4"><p className="text-lg font-semibold">{form.headline || 'Your campaign headline'}</p><p className="mt-1 text-xs text-black/55">{form.description || 'Your customer-facing campaign message will appear here.'}</p><p className="mt-2 text-[11px] font-bold text-[#9A753F]">{form.buttonText || 'Explore Gifts'} →</p></div></div></div>
        </div>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE6DA] pt-5"><div className="flex gap-2"><button type="button" className={secondary} disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>← Back</button>{step < 3 && <button type="button" className={primary} onClick={() => setStep(s => Math.min(3, s + 1))}>Continue →</button>}</div><div className="flex flex-wrap gap-2">{!isReadOnly && <button type="button" className={secondary} disabled={busy || imageBusy} onClick={save}>{busy ? 'Saving…' : saved ? 'Save changes' : 'Save draft'}</button>}{saved && !isArchived && (saved.status !== 'published' ? <button type="button" className={primary} disabled={busy || imageBusy || !ready || dirty} onClick={() => changeStatus(saved, 'published')}>{dirty ? 'Save changes before publishing' : ready ? 'Publish campaign' : 'Finish required fields to publish'}</button> : <button type="button" className={danger} disabled={busy} onClick={() => changeStatus(saved, 'paused')}>Pause campaign</button>)}</div></div>
      </Section>
    </>}
  </Page>;
}
