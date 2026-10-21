
// EXACT PATH: frontend/src/pages/admin/studio/CatalogAudit.jsx
import {useEffect,useState} from 'react';
import api from '../../../api/api.js';
import {Page,Section,Notice,Empty,Shortcuts,input,secondary,getError,date} from '../../../components/adminStudio/StudioUI.jsx';
export default function CatalogAudit(){const [events,setEvents]=useState([]),[kind,setKind]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);setError('');try{const r=await api.get('/catalog-studio/audit',{params:{limit:100,...(kind?{kind}:{})}});setEvents(r.data.events||[])}catch(e){setError(getError(e))}finally{setBusy(false)}};
 useEffect(()=>{void load()},[kind]);
 return <Page title="Catalog Activity & Audit" description="Review actions performed on product records, inventory, occasions and campaigns. Old products remain searchable from archived catalog."><Shortcuts/>
 {error&&<Notice tone="error">{error}</Notice>}
 <Section title="Action history" actions={<button className={secondary} onClick={load} disabled={busy}>↻ Refresh</button>}><select className={`${input} mb-4 max-w-[240px]`} value={kind} onChange={e=>setKind(e.target.value)}><option value="">All actions</option>{['product','sku','component','container','occasion','campaign','inventory'].map(x=><option key={x} value={x}>{x}</option>)}</select>
 {!events.length?<Empty>No recorded Studio actions yet. Legacy historical updates may not have a Studio audit record.</Empty>:<div className="space-y-2">{events.map((e,i)=><div key={e._id||i} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#EBE2D5] p-3 text-xs"><div><p className="font-extrabold">{String(e.action||'Update').replaceAll('_',' ')} · {e.subjectType||'catalog'}</p><p className="mt-1 break-all text-black/45">{String(e.subjectId||'—')} {e.reason?`· ${e.reason}`:''}</p></div><span className="text-black/40">{date(e.createdAt)}</span></div>)}</div>}
 </Section><Notice>This report covers Studio actions logged by the backend. It is not a complete reconstruction of every historical Excel modification.</Notice></Page>}
