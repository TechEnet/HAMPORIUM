
import mongoose from 'mongoose';
import Product from '../catalog/product.model.js';
import SKU from '../catalog/sku.model.js';
import Component from '../catalog/component.model.js';
import Container from '../catalog/container.model.js';
import InventoryRecord from './inventoryStudio.model.js';

// Deliberately hard-disabled until manager verifies source AND checkout reservation
// and cart/order guards are deployed. No environment flag can turn this on early.
export const isStockEnforced=()=>false;
const isVerified=r=>r && ['manual_verified','excel_approved'].includes(r.source) && Number.isFinite(r.verifiedQuantity) && r.verifiedQuantity>=0;
const key=(type,id)=>`${type}:${String(id)}`;
const qtyFrom=doc=>Number(doc?.quantity||1);
const normalizedUnit=u=>{const s=String(u||'pc').trim().toLowerCase();return ['pc','pcs','piece','pieces','nos','no','unit','units'].includes(s)?'pc':s;};
export async function resolveInventoryForProducts(products,{includeHidden=false}={}){
 const ids=[...new Set(products.map(p=>String(p._id)))];
 const skus=ids.length?await SKU.find({product:{$in:ids},...(includeHidden?{}:{isActive:true})}).select('product code name isActive container hamperContents decorations internalMaterials').lean():[];
 const containerIds=new Set(),componentIds=new Set(),skuIds=[];
 for(const s of skus){skuIds.push(s._id);if(s.container)containerIds.add(String(s.container));
 for(const field of ['hamperContents','decorations','internalMaterials'])for(const row of s[field]||[])if(row.component)componentIds.add(String(row.component));}
 const containers=containerIds.size?await Container.find({_id:{$in:[...containerIds]}}).select('_id packingMaterials name code').lean():[];
 const mapContainers=new Map(containers.map(b=>[String(b._id),b]));
 for(const b of containers)for(const m of b.packingMaterials||[])if(m.component)componentIds.add(String(m.component));
 const refs=[...skuIds,...componentIds,...containerIds];
 const entries=refs.length?await InventoryRecord.find({entityId:{$in:refs}}).lean():[];
 const rmap=new Map(entries.map(r=>[key(r.entityType,r.entityId),r]));
 const compose=(s)=>{
  const direct=rmap.get(key('sku',s._id));
  if(isVerified(direct))return {skuId:s._id,code:s.code,status:direct.verifiedQuantity===0?'out_of_stock':direct.reorderLevel!==null&&direct.verifiedQuantity<=direct.reorderLevel?'low_stock':'in_stock',buildable:Math.floor(direct.verifiedQuantity),source:direct.source,missing:[]};
  const wanted=new Map();let hasRecipe=false;
  const add=(type,id,quantity,unit='pc')=>{if(!id||!(quantity>0))return; const k=key(type,id);const prev=wanted.get(k);wanted.set(k,{type,id,quantity:(prev?.quantity||0)+quantity,unit:String(unit||'pc')});};
  if(s.container){hasRecipe=true;add('container',s.container,1,'pc');const b=mapContainers.get(String(s.container));for(const m of b?.packingMaterials||[])add('component',m.component,qtyFrom(m),m.unit);}
  for(const field of ['hamperContents','decorations','internalMaterials'])for(const part of s[field]||[]){if(part.isOptional)continue;hasRecipe=true;add('component',part.component,qtyFrom(part),part.unit);}
  if(!hasRecipe)return {skuId:s._id,code:s.code,status:'unverified',buildable:null,missing:[{reason:'No verified direct SKU stock or bill of materials'}]};
  let available=Infinity;const missing=[];const blockers=[];
  for(const item of wanted.values()){
   const r=rmap.get(key(item.type,item.id));
   if(!isVerified(r)){missing.push({type:item.type,id:item.id,reason:'Stock unverified'});continue;}
   // unit normalization must be approved by manager; don't silently convert kg into pcs.
   if(item.type==='component'&&r.unit&&item.unit&&normalizedUnit(r.unit)!==normalizedUnit(item.unit)){missing.push({type:item.type,id:item.id,reason:`Unit mismatch: ${item.unit} vs ${r.unit}`});continue;}
   const possible=Math.floor(r.verifiedQuantity/item.quantity);
   if(possible<=0)blockers.push({type:item.type,id:item.id,required:item.quantity,available:r.verifiedQuantity});
   available=Math.min(available,possible);
  }
  const status=missing.length?'unverified':blockers.length?'out_of_stock':available===Infinity?'unverified':available<=2?'low_stock':'in_stock';
  return {skuId:s._id,code:s.code,status,buildable:missing.length||available===Infinity?null:available,missing,blockers};
 };
 const grouped=new Map();for(const s of skus){const k=String(s.product);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(compose(s));}
 return products.map(p=>{const variants=grouped.get(String(p._id))||[];
  const status=variants.some(s=>s.status==='in_stock')?'in_stock':variants.some(s=>s.status==='low_stock')?'low_stock':variants.some(s=>s.status==='unverified')?'unverified':variants.length?'out_of_stock':'unverified';
  return {productId:p._id,name:p.name,slug:p.slug,publicationStatus:p.status,status,variants,canPurchase:isStockEnforced()?['in_stock','low_stock'].includes(status):null,enforcementEnabled:isStockEnforced()};
 });
}
export async function inventoryDashboard({limit=50}={}){
  // Walk the full active catalog; never silently report the first 2,000 as totals.
  const counts={in_stock:0,low_stock:0,out_of_stock:0,unverified:0};
  const attention=[];
  let cursor=null;
  let scanned=0;
  while(true){
    const filter={status:'active',...(cursor?{_id:{$gt:cursor}}:{})};
    const products=await Product.find(filter).select('_id name slug status').sort({_id:1}).limit(300).lean();
    if(!products.length)break;
    const resolved=await resolveInventoryForProducts(products);
    for(const p of resolved){counts[p.status]=(counts[p.status]||0)+1;
      if(p.status!=='in_stock'&&attention.length<limit)attention.push(p);}
    scanned+=resolved.length;
    cursor=products[products.length-1]._id;
    if(products.length<300)break;
  }
  const records=await InventoryRecord.countDocuments({});
  return {counts,scannedPublishedProducts:scanned,stockRecordCount:records,stockSourceConfirmed:false,autoExcelSyncEnabled:false,enforcementEnabled:false,attention,note:'Unverified is not zero. Existing Excel stock is not automatically imported or enforced.'};
}
