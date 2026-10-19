
// EXACT PATH: backend/src/modules/marketingStudio/excelSync.controller.js
// ACTION: NEW

// Safe non-destructive Excel marketing synchronization.
// Run AFTER the existing Product Master importer, using the same workbook.
// Never edits Product, SKU, Order, price, stock, published/archived flags, or checkout.
import mongoose from 'mongoose';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Product from '../catalog/product.model.js';
import SKU from '../catalog/sku.model.js';
import { Occasion, OccasionProduct } from './marketingStudio.model.js';
import { MarketingExcelSchema, MarketingExcelRun, MarketingExcelLock, MarketingDataHead,
  MarketingDataChunk, MarketingLinkBlock } from './excelSync.model.js';
import { readMarketingWorkbook, workbookDigest, record, field, text, excelCode,
  columnsOf, normalize } from './excelSync.reader.js';

const error=(message,status=400)=>Object.assign(new Error(message),{statusCode:status});
const BAD_CODES=new Set(['','0']);
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const filterString=(v,max=500)=>text(v,max);
const occasionFields={
 name:['Occasion / Event'],category:['Category'],subcategory:['Sub Category'],
 market:['Market / Region'],audience:['Audience'],giftFormat:['Gift Format'],
 theme:['Suggested Hamper Theme'],priority:['Priority'],priceBand:['Indicative Price Band (INR)'],
 calendarType:['Calendar Type'],unverifiedDate:['Month / Date (verify)'],
 culturalNote:['Cultural / Compliance Note'],seoKeyword:['SEO Collection Keyword'],
 sourceStatus:['Campaign Status'],
};
const campaignOwnedFields=Object.keys(occasionFields);
const priorityValid=x=>x===''||/^P\d{1,2}$/.test(x);
const parseOccasions=sheet=>{
 const result=[],duplicates=new Set(),seen=new Set(),problems=[];
 for(const line of sheet?.rows||[]){
  const r=record(sheet,line),code=excelCode(field(r,'Occasion ID'));
  const name=filterString(field(r,'Occasion / Event'),180);
  if(!code&&!name)continue;
  if(!code||BAD_CODES.has(code)||!name){problems.push(`Occasion row ${line.number}: missing code/name`);continue}
  if(seen.has(code)){duplicates.add(code);continue}seen.add(code);
  const fields={};
  for(const [key,aliases]of Object.entries(occasionFields)){
    fields[key]=filterString(field(r,...aliases),key==='culturalNote'?600:220);
  }
  if(!priorityValid(fields.priority)){
   problems.push(`Occasion row ${line.number}: unknown priority ${fields.priority}`);continue;
  }
  result.push({code,fields});
 }
 if(duplicates.size)problems.push(`Duplicate Occasion IDs: ${[...duplicates].slice(0,12).join(', ')}`);
 return {rows:result,problems};
};
const parseHamperLinks=sheet=>{
 const rows=[],warnings=[],seen=new Set();
 for(const item of sheet?.rows||[]){
  const r=record(sheet,item),hamperCode=excelCode(field(r,'Hamper Code','Hamper SKU'));
  const occasionCode=excelCode(field(r,'Occasion Code (Auto)','Occasion ID / Name (Input)'));
  if(!hamperCode)continue;
  if(!occasionCode){warnings.push(`Hamper ${hamperCode}: no valid occasion selected`);continue}
  const key=`${hamperCode}:${occasionCode}`;
  if(seen.has(key))continue;seen.add(key);
  rows.push({hamperCode,occasionCode});
 }
 return {rows,warnings};
};
const datasetFromSheet=(role,sheet)=>{
 if(!sheet)return null;
 const pairs={
  priority:[['collection','Collection'],['priority','Launch Priority'],['channel','Target Channel'],['priceFrom','Price From INR'],['priceTo','Price To INR'],['theme','Hero Assortment / Theme'],['leadTime','Planning Lead Time'],['rationale','Commercial Rationale']],
  navigation:[['group','Menu Group'],['label','Navigation Label'],['slug','Proposed URL Slug'],['order','Display Order'],['filters','Recommended Filters'],['notes','Landing Page Notes']],
  calendar:[['month','Month'],['events','Occasions / Events'],['theme','Campaign Theme'],['audience','Target Audience'],['creativeStart','Planning / Creative Start'],['validationNotes','Date Validation / Notes'],['owner','Campaign Owner'],['budget','Budget INR'],['status','Launch Status']],
 };
 const rows=[];
 for(const line of sheet.rows){
  const r=record(sheet,line);let row;
  if(role==='countries'){const name=filterString(line.values[0],150);if(name)rows.push(name);continue}
  if(role==='states'){
   const name=filterString(field(r,'name'),150),country=filterString(field(r,'country_name'),150);
   if(name&&country)rows.push({name,country,code:filterString(field(r,'iso2'),20)});
   continue;
  }
  if(role==='cities'){
   const name=filterString(field(r,'name'),150),country=filterString(field(r,'country'),150),state=filterString(field(r,'subcountry'),150);
   if(name&&country)rows.push({name,country,state});continue;
  }
  row={};for(const [key,source] of (pairs[role]||[]))row[key]=filterString(field(r,source),500);
  if(Object.values(row).some(Boolean))rows.push(row);
 }
 return rows;
};
const datasetRoles=['priority','navigation','calendar','countries','states','cities'];
const datasetKeys={priority:'21A Occasion Priority',navigation:'21B Occasion Navigation',calendar:'21C Campaign Calendar',countries:'geo_countries',states:'geo_states',cities:'geo_cities'};
const slugOf=(name,code)=>`${filterString(name,180).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,150)||'occasion'}-${code}`;
const currentExcelFields=sheet=>Object.entries(sheet?.header||[]).filter(([index,v])=>String(v||'').trim()).map(([index,v])=>({column:Number(index)+1,excelField:text(v,180)}));
const schemaRoles={productMaster:'productMaster',hampers:'hamperMaster',hamperRecipe:'hamperRecipe'};
function prepare(source){
 const issues=[...(source.warnings||[])], parsed={};
 parsed.occasions=parseOccasions(source.sheets.occasions);
 parsed.links=parseHamperLinks(source.sheets.hampers);
 issues.push(...parsed.links.warnings);
 const fatal=[...parsed.occasions.problems,...(source.warnings||[]).filter(x=>/^(Unrecognized columns|Missing sheet)/.test(x))];
 if(source.sheets.occasions&&!parsed.occasions.rows.length)fatal.push('Occasion Master contains no valid occasions');
 if(source.sheets.hampers&&source.sheets.hampers.rows.length&&!currentExcelFields(source.sheets.hampers).some(f=>normalize(f.excelField)==='hampercode'))fatal.push('Hamper Code column missing');
 parsed.datasets={};for(const role of datasetRoles){
  if(source.sheets[role]){const data=datasetFromSheet(role,source.sheets[role]);
   if(!data.length)fatal.push(`Empty ${role} dataset`);else parsed.datasets[role]=data;
  }
 }
 parsed.schemas={};for(const [role,key] of Object.entries(schemaRoles))if(source.sheets[role])parsed.schemas[key]=currentExcelFields(source.sheets[role]);
 return {parsed,issues:issues.slice(0,120),fatal};
}
const digestOf=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function analysis(wb,digest){
 const {parsed,issues,fatal}=prepare(wb), count={};
 for(const [name,sheet]of Object.entries(wb.sheets))count[name]=sheet.rows.length;
 const ids=parsed.occasions.rows.map(r=>r.code);
 const existing=ids.length?await Occasion.find({code:{$in:ids}}).select('code source syncMeta').lean():[];
 const existingByCode=new Map(existing.map(x=>[x.code,x]));
 const occasions={new:0,managed:0,legacyBaseline:0,manualProtected:0};
 for(const o of parsed.occasions.rows){const x=existingByCode.get(o.code);
  if(!x)occasions.new++;else if(x.source==='manual')occasions.manualProtected++;
  else if(!x.syncMeta?.adopted)occasions.legacyBaseline++;else occasions.managed++;
 }
 const changedFields={};
 for(const [role,fields]of Object.entries(parsed.schemas)){
  const old=await MarketingExcelSchema.findOne({role}).lean();const prev=new Set((old?.fields||[]).map(x=>normalize(x.excelField)));
  const curr=new Set(fields.map(x=>normalize(x.excelField)));
  changedFields[role]={newColumns:fields.filter(x=>!prev.has(normalize(x.excelField))).map(x=>x.excelField),
    removedColumns:(old?.fields||[]).filter(x=>!curr.has(normalize(x.excelField))).map(x=>x.excelField),
    changedPositions:fields.filter(x=>old?.fields?.some(y=>normalize(y.excelField)===normalize(x.excelField)&&x.column!==y.column)).map(x=>x.excelField)};
 }
 const previous=await MarketingExcelRun.findOne({state:'completed'}).sort({finishedAt:-1}).select('counts').lean();
 const priorOccasionCount=Number(previous?.counts?.inputRows?.occasions||0);
 const decreased=priorOccasionCount>=50&&parsed.occasions.rows.length>0&&parsed.occasions.rows.length<priorOccasionCount*.7;
 return {digest,counts:count,occasions,linkCandidates:parsed.links.rows.length,
  changes:changedFields,issues,fatal,requiresRowDecreaseAcknowledgement:decreased,
  note:'Preview only. Existing Product/SKU/Order publication and pricing are NEVER mutated by this module.'};
}
async function loadRequest(req){
 if(!req.file?.path)throw error('Upload a .xlsx or .xlsm workbook with form field file');
 if(!/\.(xlsx|xlsm)$/i.test(req.file.originalname||''))throw error('Use Excel .xlsx/.xlsm for marketing sync');
 const digest=await workbookDigest(req.file.path);
 const workbook=await readMarketingWorkbook(req.file.path);
 return {digest,workbook,preview:await analysis(workbook,digest)};
}
export async function previewMarketingExcel(req,res,next){try{
 const {preview}=await loadRequest(req);res.json({success:true,preview,ready:!preview.fatal.length});
}catch(e){next(e)}}
const same=(a,b)=>String(a??'')===String(b??'');
async function reconcileOccasions(rows,digest){
 const stats={inserted:0,updated:0,adoptedProtected:0,manualPreserved:0,unchanged:0};
 const existing=await Occasion.find({code:{$in:rows.map(x=>x.code)}}).lean();
 const byCode=new Map(existing.map(x=>[x.code,x]));
 const ops=[];
 for(const item of rows){
  const {code,fields}=item,o=byCode.get(code);
  if(!o){
   ops.push({updateOne:{filter:{code},update:{$setOnInsert:{code,...fields,
    slug:slugOf(fields.name,code),source:'excel',isPublished:false,archived:false,
    syncMeta:{adopted:true,lastDigest:digest,lastSyncedAt:new Date()}}},upsert:true}});
   stats.inserted++;continue;
  }
  if(o.source==='manual'){stats.manualPreserved++;continue}
  // Existing seed data might have been modified by staff BEFORE field ownership existed.
  if(!o.syncMeta?.adopted){
   const overrides=new Set(o.manualOverrides||[]);
   for(const key of campaignOwnedFields)if(!same(o[key],fields[key]))overrides.add(key);
   ops.push({updateOne:{filter:{_id:o._id,updatedAt:o.updatedAt},
    update:{$set:{manualOverrides:[...overrides],syncMeta:{adopted:true,lastDigest:digest,lastSyncedAt:new Date()}}}}});
   stats.adoptedProtected++;continue;
  }
  if(o.syncMeta?.lastDigest===digest){stats.unchanged++;continue}
  const ignored=new Set(o.manualOverrides||[]),setFields={
   syncMeta:{adopted:true,lastDigest:digest,lastSyncedAt:new Date()}};
  let changed=false;
  for(const key of campaignOwnedFields){if(ignored.has(key))continue;
   if(!same(o[key],fields[key])){setFields[key]=fields[key];changed=true}
  }
  ops.push({updateOne:{filter:{_id:o._id,updatedAt:o.updatedAt},update:{$set:setFields}}});
  stats[changed?'updated':'unchanged']++;
 }
 for(let i=0;i<ops.length;i+=150){
  // Do not discard an in-progress run when duplicate upserts race with another writer.
  // A global sync lock serializes imports; optimistic updatedAt protects staff edits.
  await Occasion.bulkWrite(ops.slice(i,i+150),{ordered:false});
 }
 return stats;
}
async function reconcileLinks(rows,actor){
 const stats={created:0,alreadyLinked:0,manualBlocked:0,unmatched:[],conflict:[]};
 const codes=[...new Set(rows.map(x=>x.hamperCode))];
 const occCodes=[...new Set(rows.map(x=>x.occasionCode))];
 const occasions=await Occasion.find({code:{$in:occCodes}}).select('_id code').lean();
 const byCode=new Map(occasions.map(x=>[x.code,x]));
 const skuMatches=await SKU.find({'source.externalSku':{$in:codes}}).select('product source.externalSku').lean();
 const productMatches=await Product.find({'source.externalSku':{$in:codes}}).select('_id source.externalSku').lean();
 const productMap=new Map();
 for(const sku of skuMatches){const code=sku.source?.externalSku;if(!productMap.has(code))productMap.set(code,new Set());productMap.get(code).add(String(sku.product))}
 for(const product of productMatches){const code=product.source?.externalSku;if(!productMap.has(code))productMap.set(code,new Set());productMap.get(code).add(String(product._id))}
 const allowedIds=[...new Set([...productMap.values()].flatMap(x=>[...x]))];
 const existingProducts=allowedIds.length?await Product.find({_id:{$in:allowedIds}}).select('_id').lean():[];
 const allowed=new Set(existingProducts.map(x=>String(x._id)));
 for(const item of rows){
  const occasion=byCode.get(item.occasionCode);const ids=[...(productMap.get(item.hamperCode)||[])].filter(id=>allowed.has(id));
  if(!occasion||!ids.length){stats.unmatched.push(item);continue}
  if(ids.length!==1){stats.conflict.push(item);continue}
  const productId=ids[0];
  const isBlocked=await MarketingLinkBlock.exists({occasion:occasion._id,product:productId});
  if(isBlocked){stats.manualBlocked++;continue}
  const updated=await OccasionProduct.updateOne({occasion:occasion._id,product:productId},
    {$setOnInsert:{occasion:occasion._id,product:productId,source:'excel_reference',externalHamperCode:item.hamperCode,addedBy:actor}},
    {upsert:true});
  stats[updated.upsertedCount?'created':'alreadyLinked']++;
 }
 stats.unmatched=stats.unmatched.slice(0,100);stats.conflict=stats.conflict.slice(0,100);
 return stats;
}
async function commitDatasets(datasets,digest){
 const stats={};
 for(const [role,rows]of Object.entries(datasets)){
  const dataset=datasetKeys[role],version=digestOf(rows);
  const previous=await MarketingDataHead.findOne({dataset}).lean();
  if(previous?.version===version){stats[role]={unchanged:rows.length};continue}
  const size=300;
  for(let i=0;i<rows.length;i+=size){
   await MarketingDataChunk.updateOne({dataset,version,part:i/size},
    {$setOnInsert:{dataset,version,part:i/size,rows:rows.slice(i,i+size)}},{upsert:true});
  }
  // The active pointer changes LAST, after all chunks for this version exist.
  await MarketingDataHead.updateOne({dataset},{$set:{version,rows:rows.length,fileDigest:digest,updatedAt:new Date()}},{upsert:true});
  stats[role]={updated:rows.length};
 }
 return stats;
}
async function commitSchemas(schemas,digest){
 const stats={};
 for(const [role,fields]of Object.entries(schemas)){
  const previous=await MarketingExcelSchema.findOne({role}).lean();
  let defaults=[];
  if(!previous){try{const bundled=JSON.parse(await readFile(new URL('../catalogStudio/data/excelFieldRegistry.json',import.meta.url),'utf8'));defaults=bundled[role]||[]}catch{}}
  const columns=columnsOf({header:fields.reduce((a,f)=>{a[f.column-1]=f.excelField;return a},[])},previous?.fields||defaults);
  await MarketingExcelSchema.updateOne({role},{$set:{role,sheetName:role,fields:columns,checksum:digestOf(columns),lastSync:new Date()}},{upsert:true});
  stats[role]=columns.length;
 }
 return stats;
}
async function acquire(){
 const now=new Date(),token=randomUUID();
 try {const lock=await MarketingExcelLock.findOneAndUpdate({_id:'marketing-import',
  $or:[{expiresAt:{$lt:now}},{token:{$exists:false}}]},
  {$set:{token,expiresAt:new Date(Date.now()+15*60*1000)}},{upsert:true,new:true});
  return lock?.token===token?token:null;
 }catch(e){if(e.code===11000)return null;throw e}
}
export async function commitMarketingExcel(req,res,next){let token=null,digest='';
 try {
  const source=await loadRequest(req);digest=source.digest;
  if(req.body?.previewDigest!==digest)throw error('Preview mismatch. Preview THIS exact file first, then confirm.',409);
  if(source.preview.fatal.length)throw error(source.preview.fatal.join('; '),409);
  if(source.preview.requiresRowDecreaseAcknowledgement&&req.body?.acknowledgeRowDecrease!=='true')
    throw error('Occasion rows decreased by over 30%. Confirm explicitly with acknowledgeRowDecrease=true.',409);
  if((await MarketingExcelRun.exists({digest,state:'completed'})))return res.json({success:true,alreadyApplied:true,digest});
  token=await acquire();if(!token)throw error('Another Excel sync is already in progress. Try again later.',409);
  await MarketingExcelRun.updateOne({digest},{$set:{state:'running',actor:req.user._id,fileName:text(req.file.originalname,200),startedAt:new Date(),error:''}},{upsert:true});
  const counters={inputRows:source.preview.counts};
  const normalized=prepare(source.workbook).parsed;
  if(source.workbook.sheets.occasions)counters.occasions=await reconcileOccasions(normalized.occasions.rows,digest);
  if(source.workbook.sheets.hampers)counters.links=await reconcileLinks(normalized.links.rows,req.user._id);
  counters.datasets=await commitDatasets(normalized.datasets,digest);
  counters.schemas=await commitSchemas(normalized.schemas,digest);
  await MarketingExcelRun.updateOne({digest},{$set:{state:'completed',counts:counters,warnings:source.preview.issues,finishedAt:new Date()}});
  res.json({success:true,digest,counts:counters,warnings:source.preview.issues,
   note:'Only marketing data and approved sheet schemas updated. No Product/SKU/Order/Inventory modifications.'});
 }catch(e){
  if(digest&&token)await MarketingExcelRun.updateOne({digest},{$set:{state:'failed',error:text(e.message,500),finishedAt:new Date()}}).catch(()=>{});
  next(e);
 }finally{if(token)await MarketingExcelLock.deleteOne({_id:'marketing-import',token}).catch(()=>{})}
}
export async function marketingExcelHistory(req,res,next){try{
 const runs=await MarketingExcelRun.find().sort({startedAt:-1}).limit(35).select('-__v').lean();
 res.json({success:true,runs});
}catch(e){next(e)}}
