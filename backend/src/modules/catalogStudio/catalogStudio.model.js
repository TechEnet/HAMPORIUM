
import mongoose from 'mongoose';

// Append-only admin trail. It never changes historical Orders or supplier rows.
const catalogActionSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectType: { type: String, enum: ['product','sku','component','container','occasion','campaign','inventory'], required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  action: { type: String, required: true, maxlength: 70 },
  reason: { type: String, trim: true, default: '', maxlength: 1000 },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true, versionKey: false });
catalogActionSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });

// A protected restoration record for only the SKU flags touched by our archive endpoint.
const catalogArchiveSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  priorStatus: { type: String, required: true },
  priorFeatured: { type: Boolean, default: false },
  skus: [{ sku: { type: mongoose.Schema.Types.ObjectId, ref: 'SKU', required: true }, wasActive: Boolean }],
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: Date.now },
  reason: { type: String, default: '', maxlength: 500 },
  restoredAt: { type: Date, default: null },
  restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const CatalogAction = mongoose.models.CatalogStudioAction || mongoose.model('CatalogStudioAction', catalogActionSchema);
export const CatalogArchive = mongoose.models.CatalogStudioArchive || mongoose.model('CatalogStudioArchive', catalogArchiveSchema);
export async function recordCatalogAction({req, subjectType, subjectId, action, reason = '', before = null, after = null}) {
  await CatalogAction.create({ actor: req.user._id, subjectType, subjectId, action, reason, before, after });
}

// Every optional Excel column can be retained for manual data-entry without
// adding 100+ new columns to the customer-facing Product/SKU schema.
// Importer never writes into this collection, so manual metadata is preserved.
const extraFieldsSchema = new mongoose.Schema({
  entityType: {type:String,enum:['product','sku','component','container'],required:true},
  entityId: {type:mongoose.Schema.Types.ObjectId,required:true},
  masterSheet: {type:String,enum:['productMaster','hamperMaster','hamperRecipe'],required:true},
  fields: [{column:{type:Number,min:1,max:300,required:true},field:{type:String,required:true,maxlength:200},value:{type:String,default:'',maxlength:2500}}],
  changedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
},{timestamps:true});
extraFieldsSchema.index({entityType:1,entityId:1,masterSheet:1},{unique:true});
export const CatalogExtendedFields=mongoose.models.CatalogStudioExtendedFields||mongoose.model('CatalogStudioExtendedFields',extraFieldsSchema);
