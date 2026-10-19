
import mongoose from 'mongoose';
import Product from '../catalog/product.model.js';
import SKU from '../catalog/sku.model.js';
import Component from '../catalog/component.model.js';
import Container from '../catalog/container.model.js';
import InventoryRecord from './inventoryStudio.model.js';
import {resolveInventoryForProducts, inventoryDashboard,isStockEnforced} from './inventoryStudio.service.js';
import {recordCatalogAction} from '../catalogStudio/catalogStudio.model.js';
const models={sku:SKU,component:Component,container:Container};
const bad=(res,msg,code=400)=>res.status(code).json({success:false,message:msg});
export async function getInventoryOverview(req,res,next){try{res.json({success:true,inventory:await inventoryDashboard({limit:Math.min(100,Math.max(1,Number(req.query.limit)||30))})});}catch(e){next(e)}}
export async function listInventoryRecords(req,res,next){try{
 const type=req.query.entityType;if(type&&!models[type])return bad(res,'Invalid entity type');
 const page=Math.min(10000,Math.max(1,Number(req.query.page)||1)),limit=Math.min(100,Math.max(1,Number(req.query.limit)||30));
 const query=type?{entityType:type}:{};const [total,rows]=await Promise.all([InventoryRecord.countDocuments(query),InventoryRecord.find(query).sort({updatedAt:-1}).skip((page-1)*limit).limit(limit).lean()]);res.json({success:true,total,page,limit,records:rows});
 }catch(e){next(e)}}
export async function updateVerifiedInventory(req,res,next){try{
 const type=req.params.type,id=req.params.id;if(!models[type]||!mongoose.isValidObjectId(id))return bad(res,'Invalid catalog type or ID');
 const entity=await models[type].exists({_id:id});if(!entity)return bad(res,'Catalog record not found',404);
 const b=req.body||{};if(typeof b.confirmVerified!=='boolean'||!b.confirmVerified)return bad(res,'confirmVerified:true required to record verified stock');
 if(typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<0)return bad(res,'quantity must be a confirmed non-negative number');
 const unit=String(b.unit||'pc').trim().slice(0,30);if(!unit)return bad(res,'Unit required');
 const source=b.source==='excel_approved'?'excel_approved':'manual_verified';
 if(source==='excel_approved'&&!String(b.sourceReference||'').trim())return bad(res,'Approved Excel source reference is required');
 const previous=await InventoryRecord.findOne({entityType:type,entityId:id}).lean();
 const record=await InventoryRecord.findOneAndUpdate({entityType:type,entityId:id},{$set:{verifiedQuantity:b.quantity,unit,reorderLevel:typeof b.reorderLevel==='number'&&b.reorderLevel>=0?b.reorderLevel:null,safetyStock:typeof b.safetyStock==='number'&&b.safetyStock>=0?b.safetyStock:null,source,sourceReference:String(b.sourceReference||'').slice(0,200),verifiedAt:new Date(),verifiedBy:req.user._id,note:String(b.note||'').slice(0,700)}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
 await recordCatalogAction({req,subjectType:'inventory',subjectId:record._id,action:'verified_quantity_set',before:{quantity:previous?.verifiedQuantity,source:previous?.source},after:{quantity:record.verifiedQuantity,unit:record.unit,source:record.source}});
 res.json({success:true,record,note:'Only Inventory Studio record changed; legacy catalog stock and checkout untouched.'});
 }catch(e){next(e)}}
export async function clearInventoryVerification(req,res,next){try{
 const {type,id}=req.params;if(!models[type]||!mongoose.isValidObjectId(id))return bad(res,'Invalid type or ID');
 const record=await InventoryRecord.findOne({entityType:type,entityId:id});if(!record)return bad(res,'No stock record found',404);
 const old=record.verifiedQuantity;record.source='unverified';record.verifiedQuantity=null;record.verifiedAt=null;record.verifiedBy=null;await record.save();
 await recordCatalogAction({req,subjectType:'inventory',subjectId:record._id,action:'mark_unverified',before:{quantity:old},after:{quantity:null}});
 res.json({success:true,record});
 }catch(e){next(e)}}
export async function publicStockStatus(req,res,next){try{
 const id=req.params.productId;if(!mongoose.isValidObjectId(id))return bad(res,'Invalid product ID');
 const product=await Product.findOne({_id:id,status:'active'}).select('_id name slug status').lean();if(!product)return bad(res,'Product not found',404);
 if(!isStockEnforced())return res.json({success:true,productId:id,status:'unverified',enforcementEnabled:false,note:'Inventory source awaiting approval; storefront behavior unchanged.'});
 const [stock]=await resolveInventoryForProducts([product]);res.json({success:true,...stock});
 }catch(e){next(e)}}
