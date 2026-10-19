
import mongoose from 'mongoose';
// Stock starts unverified. NEVER translate blank Excel ledger entries to zero.
const schema=new mongoose.Schema({
 entityType:{type:String,enum:['component','container','sku'],required:true},
 entityId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 verifiedQuantity:{type:Number,default:null,min:0},
 unit:{type:String,trim:true,default:'pc',maxlength:30},
 reorderLevel:{type:Number,default:null,min:0},
 safetyStock:{type:Number,default:null,min:0},
 source:{type:String,enum:['unverified','manual_verified','excel_approved'],default:'unverified'},
 sourceReference:{type:String,trim:true,default:'',maxlength:200},
 verifiedAt:{type:Date,default:null},
 verifiedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
 nextAvailableDate:{type:Date,default:null},
 note:{type:String,trim:true,default:'',maxlength:700},
},{timestamps:true});
schema.index({entityType:1,entityId:1},{unique:true});
schema.index({source:1,verifiedQuantity:1});
export default mongoose.models.InventoryStudioRecord||mongoose.model('InventoryStudioRecord',schema);
