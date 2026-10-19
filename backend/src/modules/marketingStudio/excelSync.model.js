
// EXACT PATH: backend/src/modules/marketingStudio/excelSync.model.js
// ACTION: NEW

import mongoose from 'mongoose';
const mixed=mongoose.Schema.Types.Mixed;
const sourceSchema=new mongoose.Schema({
  role:{type:String,required:true,unique:true},
  sheetName:{type:String,required:true},
  fields:[{column:Number,excelField:String,type:{type:String,default:'internal_reference'}}],
  checksum:{type:String,required:true},lastSync:{type:Date,default:Date.now},
},{timestamps:true});
const runSchema=new mongoose.Schema({
 digest:{type:String,required:true,unique:true,index:true},fileName:String,
 state:{type:String,enum:['running','completed','failed'],default:'running',index:true},
 actor:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
 counts:{type:mixed,default:{}},warnings:{type:[String],default:[]},
 startedAt:{type:Date,default:Date.now},finishedAt:Date,error:String,
},{timestamps:true});
const lockSchema=new mongoose.Schema({ _id:String, token:String,expiresAt:Date},{versionKey:false});
const headSchema=new mongoose.Schema({
 dataset:{type:String,required:true,unique:true},version:{type:String,required:true},
 rows:{type:Number,required:true},fileDigest:String,updatedAt:{type:Date,default:Date.now},
},{versionKey:false});
const chunkSchema=new mongoose.Schema({
 dataset:{type:String,required:true},version:{type:String,required:true},part:{type:Number,required:true},
 rows:{type:[mixed],default:[]},
},{versionKey:false});
chunkSchema.index({dataset:1,version:1,part:1},{unique:true});
const blockSchema=new mongoose.Schema({
 occasion:{type:mongoose.Schema.Types.ObjectId,ref:'MarketingOccasion',required:true},
 product:{type:mongoose.Schema.Types.ObjectId,ref:'Product',required:true},
 reason:{type:String,default:'Admin removed the automatic Excel association'},
 actor:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
},{timestamps:true});
blockSchema.index({occasion:1,product:1},{unique:true});
export const MarketingExcelSchema=mongoose.models.MarketingExcelSchema||mongoose.model('MarketingExcelSchema',sourceSchema);
export const MarketingExcelRun=mongoose.models.MarketingExcelRun||mongoose.model('MarketingExcelRun',runSchema);
export const MarketingExcelLock=mongoose.models.MarketingExcelLock||mongoose.model('MarketingExcelLock',lockSchema);
export const MarketingDataHead=mongoose.models.MarketingDataHead||mongoose.model('MarketingDataHead',headSchema);
export const MarketingDataChunk=mongoose.models.MarketingDataChunk||mongoose.model('MarketingDataChunk',chunkSchema);
export const MarketingLinkBlock=mongoose.models.MarketingLinkBlock||mongoose.model('MarketingLinkBlock',blockSchema);
export async function datasetRows(dataset){
 const head=await MarketingDataHead.findOne({dataset}).lean();if(!head)return null;
 const chunks=await MarketingDataChunk.find({dataset,version:head.version}).sort({part:1}).select('rows').lean();
 return chunks.flatMap(c=>c.rows||[]);
}
