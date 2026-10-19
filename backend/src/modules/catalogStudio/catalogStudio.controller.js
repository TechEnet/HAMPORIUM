
// EXACT PATH: backend/src/modules/catalogStudio/catalogStudio.controller.js
// ACTION: REPLACE

import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Product from '../catalog/product.model.js';
import SKU from '../catalog/sku.model.js';
import Component from '../catalog/component.model.js';
import Container from '../catalog/container.model.js';
import { hasWebsiteImage, componentArchiveReasons, containerArchiveReasons, hamperArchiveReasons } from '../catalog/catalogReadiness.service.js';
import { CatalogArchive, CatalogAction, CatalogExtendedFields, recordCatalogAction } from './catalogStudio.model.js';
import { MarketingExcelSchema } from '../marketingStudio/excelSync.model.js';

const valid = (value) => mongoose.isValidObjectId(value);
const bad = (res, msg, status = 400) => res.status(status).json({ success: false, message: msg });
const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const good = (v) => filled(v) && Number(v) > 0;
const checklist = (kind, record, skus = []) => {
  // This checklist is guidance only. The existing storefront predicate remains authoritative.
  const basic = kind === 'product' ? [
    ['name', 'Hamper name', Boolean(record?.name?.trim())],
    ['category', 'Category', Boolean(record?.category)],
    ['image', 'Website cover image', hasWebsiteImage(record?.images)],
    ['activeSku', 'At least one active, priced SKU', skus.some(s=>s.isActive !== false && good(s.price))],
    ['publication', 'Admin-approved publication', record?.status === 'active'],
  ] : kind === 'sku' ? [
    ['code', 'SKU code', Boolean(record?.code?.trim())],
    ['name', 'SKU name', Boolean(record?.name?.trim())],
    ['price', 'Selling price', good(record?.price)],
    ['leadTimeDays', 'Excel-only preparation lead-time (days)', Number.isFinite(Number(record?.leadTimeDays)) && record?.leadTimeDays !== null],
    ['active', 'SKU active', record?.isActive === true],
  ] : kind === 'component' ? [
    ['name', 'Gift name', Boolean(record?.name?.trim())],
    ['price', 'Selling price', good(record?.sellingPrice)],
    ['image', 'Website image', hasWebsiteImage(record?.images)],
    ['dimensions', 'Dimensions', good(record?.dimensions?.length) && good(record?.dimensions?.width) && good(record?.dimensions?.height)],
    ['weight', 'Item weight', good(record?.weight?.value)],
    ['selectable', 'Customer selectable', record?.customerSelectable === true],
  ] : [
    ['name', 'Box name', Boolean(record?.name?.trim())],
    ['price', 'Selling price', good(record?.sellingPrice)],
    ['image', 'Box image', hasWebsiteImage(record?.images)],
    ['outerDimensions', 'Outer dimensions', good(record?.outerDimensions?.length) && good(record?.outerDimensions?.width) && good(record?.outerDimensions?.height)],
    ['innerDimensions', 'Inner dimensions', good(record?.innerDimensions?.length) && good(record?.innerDimensions?.width) && good(record?.innerDimensions?.height)],
    ['maxWeight', 'Maximum content weight', good(record?.maxContentWeight?.value)],
    ['selectable', 'Customer selectable', record?.customerSelectable === true],
  ];
  const rows = basic.map(([key, label, complete])=>({key,label,complete,requiredForStorefront: !(kind === 'sku' && key === 'leadTimeDays'),recommendedForDelivery: kind === 'sku' && key === 'leadTimeDays'}));
  let reasons = kind === 'product' ? hamperArchiveReasons(record,skus) : kind === 'component' ? componentArchiveReasons(record) : kind === 'container' ? containerArchiveReasons(record) : rows.filter(x=>x.requiredForStorefront&&!x.complete).map(x=>`${x.label} missing`);
  return { kind, checklist:rows, completed:rows.filter(x=>x.complete).length, total:rows.length, readyToPublish: reasons.length===0, reasons, optionalSections:['Procurement','Costing and margin','Tax/HSN','Supplier','Excel source metadata','Internal notes'], note:'Informational only; existing public catalog filters and checkout validation remain authoritative.' };
};
const models = { product:Product, sku:SKU, component:Component, container:Container };
export async function catalogReadiness(req,res,next) {
 try {
  const Model = models[req.params.kind]; if (!Model || !valid(req.params.id)) return bad(res,'Unknown catalog type or invalid ID');
  const doc = await Model.findById(req.params.id).lean();if(!doc) return bad(res,'Catalog record not found',404);
  const skus = req.params.kind==='product'?await SKU.find({product:doc._id}).lean():[];
  res.json({success:true, recordId:doc._id, ...checklist(req.params.kind,doc,skus), source:doc.source?.type||'manual'});
 }catch(e){next(e)}
}
export async function getCatalogActionHistory(req,res,next){
 try {const q={};if(req.query.kind){if(!['product','sku','component','container','occasion','campaign','inventory'].includes(req.query.kind))return bad(res,'Invalid kind');q.subjectType=req.query.kind}
 if(req.query.id){if(!valid(req.query.id))return bad(res,'Invalid ID');q.subjectId=req.query.id}
 const limit=Math.min(100,Math.max(1,Number(req.query.limit)||30));const events=await CatalogAction.find(q).sort({createdAt:-1}).limit(limit).lean();res.json({success:true,events});}catch(e){next(e)}
}
export async function safeArchiveProduct(req,res,next){
 try {const id=req.params.id;if(!valid(id))return bad(res,'Invalid product ID');
 const reason=String(req.body?.reason||'').trim().slice(0,500);if(reason.length<8)return bad(res,'Please provide an archive reason (at least 8 characters)');
 const p=await Product.findById(id);if(!p)return bad(res,'Product not found',404);
 if(p.status==='archived')return bad(res,'Product already archived',409);
 const skus=await SKU.find({product:id}).select('_id isActive').lean();
 const snapshot=await CatalogArchive.findOneAndUpdate({product:id},{$set:{priorStatus:p.status,priorFeatured:p.isFeatured,skus:skus.map(s=>({sku:s._id,wasActive:s.isActive})),archivedBy:req.user._id,archivedAt:new Date(),restoredAt:null,restoredBy:null,reason}}, {upsert:true,new:true});
 const result=await Product.updateOne({_id:id,status:p.status},{$set:{status:'archived',isFeatured:false}});
 if(!result.modifiedCount)return bad(res,'Record changed; refresh and retry',409);
 await SKU.updateMany({product:id},{$set:{isActive:false}});
 await recordCatalogAction({req,subjectType:'product',subjectId:p._id,action:'archive',reason,before:{status:p.status,featured:p.isFeatured,skus:skus.length},after:{status:'archived',archiveId:snapshot._id}});
 res.json({success:true,message:'Product archived; recipe and history preserved',archiveId:snapshot._id});
 }catch(e){next(e)}
}
export async function restoreArchivedProduct(req,res,next){
 try {const id=req.params.id;if(!valid(id))return bad(res,'Invalid product ID');const p=await Product.findById(id);if(!p)return bad(res,'Product not found',404);
 if(p.status!=='archived')return bad(res,'Product is not archived',409);
 const snapshot=await CatalogArchive.findOne({product:id,restoredAt:null}).lean();
 // Conservative restore: never silently republish old, unverified inventory / incomplete data.
 const restoreLive=req.body?.publish===true;
 if(restoreLive&&!snapshot)return bad(res,'Archive snapshot unavailable; restore to Draft first',409);
 const skuIds=snapshot?.skus?.filter(x=>x.wasActive).map(x=>x.sku)||[];
 const skus=restoreLive ? await SKU.find({_id:{$in:skuIds},product:id}).lean():[];
 if(restoreLive){const reasons=hamperArchiveReasons({...p.toObject(),status:'active'},skus);
  if(reasons.length)return res.status(409).json({success:false,message:'Not ready to republish',reasons});}
 const status=restoreLive?'active':'draft';
 const result=await Product.updateOne({_id:id,status:'archived'},{$set:{status,isFeatured:restoreLive?Boolean(snapshot.priorFeatured):false}});
 if(!result.modifiedCount)return bad(res,'Product changed; refresh and retry',409);
 if(restoreLive&&skuIds.length)await SKU.updateMany({_id:{$in:skuIds},product:id},{$set:{isActive:true}});
 await CatalogArchive.updateOne({product:id},{$set:{restoredAt:new Date(),restoredBy:req.user._id}});
 await recordCatalogAction({req,subjectType:'product',subjectId:p._id,action:'restore',reason:restoreLive?'Admin requested live restoration':'Safe draft restoration',before:{status:'archived'},after:{status}});
 res.json({success:true,status,previousStatus:snapshot?.priorStatus||null,message:restoreLive?'Product restored live after readiness validation':'Product restored as Draft; previous data preserved'});
 }catch(e){next(e)}
}

// Exact field labels from the user's Excel workbook. Never pretend that every
// original procurement field belongs to a customer-facing Mongoose model.
let cachedRegistry;
export async function getExcelFieldRegistry(req,res,next){try{
  if(!cachedRegistry){const filepath=path.join(path.dirname(fileURLToPath(import.meta.url)),'data','excelFieldRegistry.json');cachedRegistry=JSON.parse(await readFile(filepath,'utf8'));}
  const kind=req.params.kind;if(!['productMaster','hamperMaster','hamperRecipe'].includes(kind))return bad(res,'Invalid master sheet');
  const live=await MarketingExcelSchema.findOne({role:kind}).lean();
  res.json({success:true,sheet:kind,fields:live?.fields||cachedRegistry[kind],schemaChecksum:live?.checksum||null,source:live?'latest_confirmed_excel':'bundled_default',note:'New Excel columns are discovered at each confirmed marketing sync. Unknown columns default to internal; actual publication readiness is separate.'});
}catch(e){next(e)}}

export async function getExtendedFields(req,res,next){try{
 const {kind,id,sheet}=req.params;if(!models[kind]||!valid(id)||!['productMaster','hamperMaster','hamperRecipe'].includes(sheet))return bad(res,'Invalid kind, id or sheet');
 const fields=await CatalogExtendedFields.findOne({entityType:kind,entityId:id,masterSheet:sheet}).lean();
 res.json({success:true,record:fields||null});
}catch(e){next(e)}}
export async function saveExtendedFields(req,res,next){try{
 const {kind,id,sheet}=req.params;if(!models[kind]||!valid(id)||!['productMaster','hamperMaster','hamperRecipe'].includes(sheet))return bad(res,'Invalid kind, id or sheet');
 if(!(await models[kind].exists({_id:id})))return bad(res,'Catalog record not found',404);
 if(!Array.isArray(req.body?.fields)||req.body.fields.length>150)return bad(res,'fields must be an array of at most 150 entries');
 if(!cachedRegistry){const filepath=path.join(path.dirname(fileURLToPath(import.meta.url)),'data','excelFieldRegistry.json');cachedRegistry=JSON.parse(await readFile(filepath,'utf8'));}
 const latest=await MarketingExcelSchema.findOne({role:sheet}).lean();
 const registry=latest?.fields||cachedRegistry[sheet];
 const allowed=new Map(registry.map(f=>[f.column,f.excelField]));const seen=new Set();const fields=[];
 for(const item of req.body.fields){const n=Number(item?.column);if(!Number.isInteger(n)||!allowed.has(n)||seen.has(n))return bad(res,'Unknown or repeated Excel field column');
  const currentName=allowed.get(n);
  if(item.field&&String(item.field).trim()!==currentName)return bad(res,'Excel schema changed. Refresh form before editing these fields.',409);
  seen.add(n);const value=String(item?.value??'').slice(0,2500);fields.push({column:n,field:currentName,value});
 }
 const updated=await CatalogExtendedFields.findOneAndUpdate({entityType:kind,entityId:id,masterSheet:sheet},{$set:{fields,changedBy:req.user._id}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
 await recordCatalogAction({req,subjectType:kind,subjectId:id,action:'extended_excel_fields_updated',after:{sheet,fields:fields.length}});
 res.json({success:true,record:updated,note:'Internal/manual Excel field data saved separately. No live product/public field was overwritten.'});
}catch(e){next(e)}}
