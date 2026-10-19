
// EXACT PATH: backend/src/modules/marketingStudio/marketingStudio.model.js
// ACTION: REPLACE

import mongoose from 'mongoose';
const occasionSchema=new mongoose.Schema({
 code:{type:String,required:true,unique:true,trim:true,maxlength:30},
 name:{type:String,required:true,trim:true,maxlength:180},
 slug:{type:String,required:true,unique:true,lowercase:true,trim:true,maxlength:220},
 category:{type:String,default:'',maxlength:150},subcategory:{type:String,default:'',maxlength:160},
 market:{type:String,default:'',maxlength:150},audience:{type:String,default:'',maxlength:180},
 giftFormat:{type:String,default:'',maxlength:180},theme:{type:String,default:'',maxlength:220},
 priority:{type:String,trim:true,default:'',maxlength:10},
 priceBand:{type:String,default:'',maxlength:120},calendarType:{type:String,default:'',maxlength:150},
 unverifiedDate:{type:String,default:'',maxlength:150},culturalNote:{type:String,default:'',maxlength:600},
 seoKeyword:{type:String,default:'',maxlength:220},sourceStatus:{type:String,default:'Planned',maxlength:50},
 isPublished:{type:Boolean,default:false,index:true},archived:{type:Boolean,default:false,index:true},
 source:{type:String,enum:['excel','manual'],default:'manual'},
 manualOverrides:{type:[String],default:[]},
 syncMeta:{adopted:{type:Boolean,default:false},lastDigest:{type:String,default:''},lastSyncedAt:{type:Date,default:null}},
}, {timestamps:true});
occasionSchema.index({category:1,priority:1});
const occasionProductSchema=new mongoose.Schema({
 occasion:{type:mongoose.Schema.Types.ObjectId,ref:'MarketingOccasion',required:true},
 product:{type:mongoose.Schema.Types.ObjectId,ref:'Product',required:true},
 addedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
 source:{type:String,enum:['excel_reference','manual'],default:'manual'},
 externalHamperCode:{type:String,default:'',index:true},
},{timestamps:true});
occasionProductSchema.index({occasion:1,product:1},{unique:true});
const marketingCampaignSchema=new mongoose.Schema({
 name:{type:String,required:true,trim:true,maxlength:180},slug:{type:String,required:true,unique:true,trim:true,lowercase:true,maxlength:220},
 status:{type:String,enum:['draft','published','paused','archived'],default:'draft',index:true},
 occasion:{type:mongoose.Schema.Types.ObjectId,ref:'MarketingOccasion',default:null},
 theme:{type:String,trim:true,default:'',maxlength:180},headline:{type:String,trim:true,default:'',maxlength:160},
 description:{type:String,trim:true,default:'',maxlength:900},bannerImage:{type:String,trim:true,default:'',maxlength:2000},
 mobileImage:{type:String,trim:true,default:'',maxlength:2000},
 buttonText:{type:String,trim:true,default:'Explore Gifts',maxlength:80},
 startsAt:{type:Date,default:null,index:true},endsAt:{type:Date,default:null,index:true},
 products:[{type:mongoose.Schema.Types.ObjectId,ref:'Product'}],
 promotion:{type:mongoose.Schema.Types.ObjectId,ref:'Promotion',default:null},
 targeting:{countries:{type:[String],default:[]},states:{type:[String],default:[]},cities:{type:[String],default:[]}},
 placement:{type:[String],enum:['home_hero','collection','announcement','campaign_page'],default:['campaign_page']},
 budgetINR:{type:Number,default:null,min:0},internalNotes:{type:String,default:'',maxlength:2000},
 publishedAt:{type:Date,default:null},archivedAt:{type:Date,default:null},
}, {timestamps:true});
marketingCampaignSchema.index({status:1,startsAt:1,endsAt:1});
const marketingEventSchema=new mongoose.Schema({
 campaign:{type:mongoose.Schema.Types.ObjectId,ref:'MarketingCampaign',required:true,index:true},
 type:{type:String,enum:['impression','click'],required:true},
 placement:{type:String,default:'campaign_page',maxlength:50},
},{timestamps:true,versionKey:false});
marketingEventSchema.index({campaign:1,type:1,createdAt:-1});
export const Occasion=mongoose.models.MarketingOccasion||mongoose.model('MarketingOccasion',occasionSchema);
export const OccasionProduct=mongoose.models.MarketingOccasionProduct||mongoose.model('MarketingOccasionProduct',occasionProductSchema);
export const MarketingCampaign=mongoose.models.MarketingCampaign||mongoose.model('MarketingCampaign',marketingCampaignSchema);
export const MarketingEvent=mongoose.models.MarketingEvent||mongoose.model('MarketingEvent',marketingEventSchema);
