
// EXACT PATH: backend/src/modules/marketingStudio/marketingStudio.controller.js
// ACTION: REPLACE

import mongoose from 'mongoose';
import Product from '../catalog/product.model.js';
import { websiteImageMongoFilter } from '../catalog/catalogReadiness.service.js';
import SKU from '../catalog/sku.model.js';
import Promotion from '../promotions/promotion.model.js';
import { Occasion, OccasionProduct, MarketingCampaign, MarketingEvent } from './marketingStudio.model.js';
import {recordCatalogAction} from '../catalogStudio/catalogStudio.model.js';
import {datasetRows, MarketingLinkBlock} from './excelSync.model.js';
const bad=(res,msg,status=400)=>res.status(status).json({success:false,message:msg});
const valid=(v)=>mongoose.isValidObjectId(v);
const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
const safeSlug=(v)=>clean(v,220).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,200);
const list=(value,max=50)=>Array.isArray(value)?[...new Set(value.slice(0,max).map(x=>clean(x,100)).filter(Boolean))]:[];
const pageParams=(q)=>({page:Math.min(10000,Math.max(1,Number(q.page)||1)),limit:Math.min(100,Math.max(1,Number(q.limit)||30))});
const campaignAllowed=['draft','published','paused','archived'];
const imageOkay=(s)=>!s||/^https:\/\/[^\s]+$/i.test(s);
const campaignPayload=(b)=>{const x={};for(const key of ['name','headline','description','theme','bannerImage','mobileImage','buttonText','internalNotes'])if(b[key]!==undefined)x[key]=clean(b[key],key.includes('Image')?2000:key==='internalNotes'?2000:900);
 if(b.slug!==undefined)x.slug=safeSlug(b.slug);
 if(b.occasion!==undefined)x.occasion=b.occasion===null?null:b.occasion;
 if(b.promotion!==undefined)x.promotion=b.promotion===null?null:b.promotion;
 if(b.products!==undefined)x.products=[...new Set(Array.isArray(b.products)?b.products.map(String):[])].slice(0,100);
 if(b.targeting!==undefined)x.targeting={countries:list(b.targeting?.countries),states:list(b.targeting?.states),cities:list(b.targeting?.cities)};
 if(b.placement!==undefined)x.placement=list(b.placement,4);
 if(b.startsAt!==undefined)x.startsAt=b.startsAt||null;
 if(b.endsAt!==undefined)x.endsAt=b.endsAt||null;
 if(b.budgetINR!==undefined)x.budgetINR=b.budgetINR===null?null:Number(b.budgetINR);
 return x};
const checkCampaign=async(c)=>{const reasons=[];
 if(!c.name?.trim())reasons.push('Campaign name required');
 if(!c.headline?.trim())reasons.push('Banner headline required');
 if(!c.bannerImage?.trim()||!imageOkay(c.bannerImage))reasons.push('Valid HTTPS banner image required');
 if(c.mobileImage&&!imageOkay(c.mobileImage))reasons.push('Mobile image must use HTTPS');
 if(!c.startsAt||!c.endsAt||!(new Date(c.endsAt)>new Date(c.startsAt)))reasons.push('Valid start and end dates required');
 if(!c.products?.length&&!c.occasion)reasons.push('Choose products or an occasion');
 if(c.promotion){const p=await Promotion.findById(c.promotion).select('_id status').lean();if(!p)reasons.push('Linked promotion no longer exists');}
 return reasons;
};
export async function adminListOccasions(req,res,next){try{
 const {page,limit}=pageParams(req.query);const f={};if(req.query.category)f.category=clean(req.query.category,150);if(req.query.priority)f.priority=clean(req.query.priority,4);if(req.query.search)f.$or=[{name:new RegExp(clean(req.query.search,80).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')},{code:clean(req.query.search,30)}];
 const [total,occasions]=await Promise.all([Occasion.countDocuments(f),Occasion.find(f).sort({priority:1,name:1}).skip((page-1)*limit).limit(limit).lean()]);res.json({success:true,total,page,limit,occasions});}catch(e){next(e)}}
export async function createOccasion(req,res,next){try{
 const b=req.body||{};if(!clean(b.name)||!clean(b.code))return bad(res,'Name and occasion code required');const slug=safeSlug(b.slug||b.name);if(!slug)return bad(res,'Valid slug required');
 const fields=['category','subcategory','market','audience','giftFormat','theme','priority','priceBand','calendarType','unverifiedDate','culturalNote','seoKeyword'];const data={code:clean(b.code,30),name:clean(b.name,180),slug,source:'manual',isPublished:false};for(const f of fields)if(b[f]!==undefined)data[f]=clean(b[f],600);
 const occasion=await Occasion.create(data);await recordCatalogAction({req,subjectType:'occasion',subjectId:occasion._id,action:'create'});res.status(201).json({success:true,occasion});
 }catch(e){if(e.code===11000)return bad(res,'Occasion code or slug already exists',409);next(e)}}
export async function editOccasion(req,res,next){try{
 const {id}=req.params;if(!valid(id))return bad(res,'Invalid occasion ID');const row=await Occasion.findById(id);if(!row)return bad(res,'Occasion not found',404);
 const b=req.body||{};const allowed=['name','category','subcategory','market','audience','giftFormat','theme','priority','priceBand','calendarType','unverifiedDate','culturalNote','seoKeyword'];for(const f of allowed)if(b[f]!==undefined)row[f]=clean(b[f],600);
 if(b.slug!==undefined)row.slug=safeSlug(b.slug);
 // Admin edits are field-owned: subsequent Excel sync never silently reverts them.
 row.manualOverrides=[...new Set([...(row.manualOverrides||[]),...allowed.filter(key=>b[key]!==undefined)])];
 if(b.isPublished!==undefined){if(typeof b.isPublished!=='boolean')return bad(res,'isPublished must be boolean');row.isPublished=b.isPublished;}
 if(b.archived!==undefined){if(typeof b.archived!=='boolean')return bad(res,'archived must be boolean');row.archived=b.archived;if(row.archived)row.isPublished=false;}
 await row.save();await recordCatalogAction({req,subjectType:'occasion',subjectId:row._id,action:'edit'});res.json({success:true,occasion:row});
 }catch(e){next(e)}}
// Explicit field ownership control for protected legacy/manual overrides.
export async function setOccasionFieldOwnership(req,res,next){try{
 const id=req.params.id;if(!valid(id))return bad(res,'Invalid occasion ID');
 const fields=Array.isArray(req.body?.fields)?req.body.fields:[];
 const mode=clean(req.body?.mode,10);
 if(!['excel','manual'].includes(mode)||!fields.length||fields.length>20||
   fields.some(f=>!['name','category','subcategory','market','audience','giftFormat','theme','priority','priceBand','calendarType','unverifiedDate','culturalNote','seoKeyword','sourceStatus'].includes(f)))return bad(res,'Choose valid fields and mode excel/manual');
 const o=await Occasion.findById(id);if(!o)return bad(res,'Occasion not found',404);
 if(o.source!=='excel')return bad(res,'Only Excel-owned occasions support this control',409);
 const old=[...(o.manualOverrides||[])],next=new Set(old);
 for(const f of fields){if(mode==='excel')next.delete(f);else next.add(f)}
 o.manualOverrides=[...next];await o.save();
 await recordCatalogAction({req,subjectType:'occasion',subjectId:id,action:'field_ownership',
  before:{manualOverrides:old},after:{manualOverrides:o.manualOverrides}});
 res.json({success:true,manualOverrides:o.manualOverrides,
  note:'No field value is changed. Excel-owned fields update on NEXT confirmed Excel import.'});
}catch(e){next(e)}}
export async function linkOccasionProduct(req,res,next){try{
 const {id,productId}=req.params;if(!valid(id)||!valid(productId))return bad(res,'Invalid ID');const [occasion,product]=await Promise.all([Occasion.exists({_id:id}),Product.exists({_id:productId})]);if(!occasion||!product)return bad(res,'Occasion or product not found',404);
 await MarketingLinkBlock.deleteOne({occasion:id,product:productId});
 await OccasionProduct.updateOne({occasion:id,product:productId},{$setOnInsert:{occasion:id,product:productId,addedBy:req.user._id,source:'manual'}},{upsert:true});res.json({success:true,message:'Association added; product publication state unchanged'});
 }catch(e){next(e)}}
export async function unlinkOccasionProduct(req,res,next){try{
 const {id,productId}=req.params;if(!valid(id)||!valid(productId))return bad(res,'Invalid ID');await MarketingLinkBlock.updateOne({occasion:id,product:productId},{$set:{actor:req.user._id}},{upsert:true});
 await OccasionProduct.deleteOne({occasion:id,product:productId});res.json({success:true,message:'Occasion link removed; catalog product preserved'});
 }catch(e){next(e)}}
export async function occasionProductList(req,res,next){try{
 const occ=await Occasion.findOne({slug:req.params.slug,isPublished:true,archived:false}).select('_id name slug seoKeyword').lean();if(!occ)return bad(res,'Occasion not found',404);
 const links=await OccasionProduct.find({occasion:occ._id}).select('product').limit(500).lean();
 const products=await Product.find({_id:{$in:links.map(x=>x.product)},status:'active',minPrice:{$gt:0},...websiteImageMongoFilter()}).select('name slug images minPrice maxPrice shortDescription').limit(100).lean();
 res.json({success:true,occasion:occ,products});
 }catch(e){next(e)}}
export async function listPublicOccasions(req,res,next){try{const rows=await Occasion.find({isPublished:true,archived:false}).select('name code slug category priority seoKeyword').sort({priority:1,name:1}).limit(200).lean();res.json({success:true,occasions:rows});}catch(e){next(e)}}
export async function getPlanning(req,res,next){try{
 const names=['21A Occasion Priority','21B Occasion Navigation','21C Campaign Calendar'];
 const data={};for(const name of names)data[name]=(await datasetRows(name))||[];
 res.json({success:true,planning:data,source:'Last admin-confirmed Excel marketing sync',
  warning:'Planning data only, NOT verified festival dates or live discounts.'});
}catch(e){next(e)}}
export async function getGeo(req,res,next){try{
 const type=clean(req.query.type||'countries',20);
 if(!['countries','states','cities'].includes(type))return bad(res,'type must be countries, states or cities');
 const countries={countries:'geo_countries',states:'geo_states',cities:'geo_cities'};
 const data=(await datasetRows(countries[type]))||[];
 const country=clean(req.query.country,100).toLowerCase(),state=clean(req.query.state,100).toLowerCase(),search=clean(req.query.search,100).toLowerCase();
 const size=Math.min(100,Math.max(1,Number(req.query.limit)||50));
 const filtered=data.filter(x=>(!country||String(x.country||'').toLowerCase()===country)&&
  (!state||String(x.state||'').toLowerCase()===state)&&
  (!search||String(typeof x==='string'?x:x.name||'').toLowerCase().includes(search)));
 res.json({success:true,type,total:filtered.length,results:filtered.slice(0,size),
  note:'Reference geography from last confirmed Excel import. Not proof of delivery serviceability.'});
}catch(e){next(e)}}
export async function adminListCampaigns(req,res,next){try{
 const {page,limit}=pageParams(req.query);const q=req.query.status?{status:clean(req.query.status,30)}:{};
 const [total,campaigns]=await Promise.all([MarketingCampaign.countDocuments(q),MarketingCampaign.find(q).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean()]);res.json({success:true,total,page,limit,campaigns});
 }catch(e){next(e)}}
export async function createCampaign(req,res,next){try{
 const payload=campaignPayload(req.body||{});if(!payload.name)return bad(res,'Campaign name required');
 payload.slug=payload.slug||safeSlug(payload.name);if(!payload.slug)return bad(res,'Invalid campaign slug');payload.status='draft';
 const c=await MarketingCampaign.create(payload);await recordCatalogAction({req,subjectType:'campaign',subjectId:c._id,action:'create'});res.status(201).json({success:true,campaign:c});
 }catch(e){if(e.code===11000)return bad(res,'Campaign slug already exists',409);next(e)}}
export async function editCampaign(req,res,next){try{
 const {id}=req.params;if(!valid(id))return bad(res,'Invalid ID');const c=await MarketingCampaign.findById(id);if(!c)return bad(res,'Campaign not found',404);
 if(c.status==='archived')return bad(res,'Archived campaign is read-only; clone to create a new one',409);
 const fields=campaignPayload(req.body||{});for(const [k,v]of Object.entries(fields))c[k]=v;
 await c.save();await recordCatalogAction({req,subjectType:'campaign',subjectId:c._id,action:'edit'});res.json({success:true,campaign:c});
 }catch(e){next(e)}}
export async function campaignReadiness(req,res,next){try{if(!valid(req.params.id))return bad(res,'Invalid ID');const c=await MarketingCampaign.findById(req.params.id).lean();if(!c)return bad(res,'Campaign not found',404);const reasons=await checkCampaign(c);res.json({success:true,ready:!reasons.length,reasons});}catch(e){next(e)}}
export async function campaignChangeStatus(req,res,next){try{
 const {id}=req.params;if(!valid(id))return bad(res,'Invalid ID');const target=clean(req.body?.status,20);if(!campaignAllowed.includes(target)||target==='draft')return bad(res,'Allowed status: published, paused, archived');
 const c=await MarketingCampaign.findById(id);if(!c)return bad(res,'Campaign not found',404);
 if(c.status==='archived')return bad(res,'Archived campaigns are immutable',409);
 if(target==='published'){const reasons=await checkCampaign(c);if(reasons.length)return res.status(409).json({success:false,message:'Campaign not ready',reasons});c.publishedAt=new Date()}
 if(target==='archived')c.archivedAt=new Date();const old=c.status;c.status=target;await c.save();
 await recordCatalogAction({req,subjectType:'campaign',subjectId:c._id,action:`status_${target}`,before:{status:old},after:{status:target}});
 res.json({success:true,campaign:c,message:'Campaign status changed only; no product price, SKU publication or checkout discounts modified.'});
 }catch(e){next(e)}}
const geoAllowed=(t,query)=>{for(const [k,q] of [['countries','country'],['states','state'],['cities','city']]){if(t?.[k]?.length&&!t[k].some(x=>x.toLowerCase()===clean(query[q],100).toLowerCase()))return false}return true};
export async function publicCampaigns(req,res,next){try{
 const now=new Date();const rows=await MarketingCampaign.find({status:'published',startsAt:{$lte:now},endsAt:{$gte:now}}).select('name slug headline description bannerImage mobileImage buttonText startsAt endsAt occasion products promotion targeting placement').limit(40).lean();
 const active=rows.filter(row=>geoAllowed(row.targeting,req.query));
 // Featured products also require current catalog publication; campaigns cannot revive archives.
 const productIds=[...new Set(active.flatMap(x=>(x.products||[]).map(String)))];const permitted=productIds.length?await Product.find({_id:{$in:productIds},status:'active',minPrice:{$gt:0},...websiteImageMongoFilter()}).select('_id name slug images minPrice').lean():[];const map=new Map(permitted.map(p=>[String(p._id),p]));
 res.json({success:true,campaigns:active.map(c=>({...c,products:c.products.map(id=>map.get(String(id))).filter(Boolean),promotion:null})),note:'Promotion eligibility and actual discount are resolved separately by the existing Promotion Engine.'});
 }catch(e){next(e)}}
export async function trackCampaignEvent(req,res,next){try{
 const id=req.params.id;if(!valid(id))return bad(res,'Invalid campaign ID');
 const type=clean(req.body?.type,20);if(!['impression','click'].includes(type))return bad(res,'Invalid event type');
 const now=new Date(),validCampaign=await MarketingCampaign.exists({_id:id,status:'published',startsAt:{$lte:now},endsAt:{$gte:now}});if(!validCampaign)return bad(res,'Campaign not currently active',404);
 await MarketingEvent.create({campaign:id,type,placement:clean(req.body?.placement||'campaign_page',50)});
 res.status(202).json({success:true});
 }catch(e){next(e)}}
export async function campaignPerformance(req,res,next){try{
 if(!valid(req.params.id))return bad(res,'Invalid ID');const id=new mongoose.Types.ObjectId(req.params.id);
 const rows=await MarketingEvent.aggregate([{$match:{campaign:id}},{$group:{_id:'$type',count:{$sum:1}}}]);const counts={impression:0,click:0};for(const x of rows)counts[x._id]=x.count;
 res.json({success:true,metrics:counts,clickThroughPercent:counts.impression?Number((100*counts.click/counts.impression).toFixed(2)):0,note:'Only anonymous impression/click counts. Orders/revenue attribution requires separate validated integration.'});
 }catch(e){next(e)}}

export async function adminOccasionDetail(req,res,next){try{
 const id=req.params.id;if(!valid(id))return bad(res,'Invalid occasion ID');
 const occasion=await Occasion.findById(id).lean();if(!occasion)return bad(res,'Occasion not found',404);
 const links=await OccasionProduct.find({occasion:id}).populate('product','name slug status images minPrice').limit(250).lean();
 res.json({success:true,occasion,linkedProducts:links});
}catch(e){next(e)}}
export async function adminCampaignDetail(req,res,next){try{
 const id=req.params.id;if(!valid(id))return bad(res,'Invalid campaign ID');
 const campaign=await MarketingCampaign.findById(id).lean();if(!campaign)return bad(res,'Campaign not found',404);
 const reasons=await checkCampaign(campaign);
 res.json({success:true,campaign,readyToPublish:!reasons.length,reasons});
}catch(e){next(e)}}
