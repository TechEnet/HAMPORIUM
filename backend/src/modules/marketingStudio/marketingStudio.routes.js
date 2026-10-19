
// EXACT PATH: backend/src/modules/marketingStudio/marketingStudio.routes.js
// ACTION: REPLACE

import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import protect from '../../middlewares/auth.middleware.js';
import {allowRoles} from '../../middlewares/access.middleware.js';
import {ROLES} from '../../constants/roles.js';
import multer from 'multer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {previewMarketingExcel,commitMarketingExcel,marketingExcelHistory} from './excelSync.controller.js';
import {adminListOccasions,createOccasion,editOccasion,setOccasionFieldOwnership,linkOccasionProduct,unlinkOccasionProduct,occasionProductList,listPublicOccasions,getPlanning,getGeo,adminListCampaigns,createCampaign,editCampaign,campaignReadiness,campaignChangeStatus,publicCampaigns,trackCampaignEvent,campaignPerformance,adminOccasionDetail,adminCampaignDetail} from './marketingStudio.controller.js';
const r=Router();
r.get('/public/occasions',listPublicOccasions);
r.get('/public/occasions/:slug/products',occasionProductList);
r.get('/public/campaigns',publicCampaigns);
r.get('/public/geo',getGeo);
r.post('/public/campaigns/:id/events',rateLimit({windowMs:15*60*1000,limit:90,standardHeaders:true,legacyHeaders:false}),trackCampaignEvent);
r.use(protect,allowRoles(ROLES.ADMIN,ROLES.OPERATIONS));
// New Excel sync endpoints are admin-only. Read endpoints above remain available.
const tmp=path.join(os.tmpdir(),'hamporium-marketing-excel');fs.mkdirSync(tmp,{recursive:true});
const excelUpload=multer({dest:tmp,limits:{files:1,fileSize:35*1024*1024},
 fileFilter(_req,file,cb){return /\.(xlsx|xlsm)$/i.test(file.originalname||'')?cb(null,true):cb(new Error('Upload .xlsx/.xlsm only'))}});
const cleanUpload=(req,res,next)=>{const cleanup=()=>{if(req.file?.path)fs.promises.unlink(req.file.path).catch(()=>{})};
 res.once('finish',cleanup);res.once('close',cleanup);next()};
const adminOnly=allowRoles(ROLES.ADMIN);
r.post('/admin/excel/preview',adminOnly,excelUpload.single('file'),cleanUpload,previewMarketingExcel);
r.post('/admin/excel/confirm',adminOnly,excelUpload.single('file'),cleanUpload,commitMarketingExcel);
r.get('/admin/excel/history',adminOnly,marketingExcelHistory);
r.get('/admin/planning',getPlanning);
r.get('/admin/occasions',adminListOccasions);
r.post('/admin/occasions',createOccasion);
r.get('/admin/occasions/:id',adminOccasionDetail);
r.patch('/admin/occasions/:id',editOccasion);
r.patch('/admin/occasions/:id/field-ownership',adminOnly,setOccasionFieldOwnership);
r.post('/admin/occasions/:id/products/:productId',linkOccasionProduct);
r.delete('/admin/occasions/:id/products/:productId',unlinkOccasionProduct);
r.get('/admin/campaigns',adminListCampaigns);
r.post('/admin/campaigns',createCampaign);
r.get('/admin/campaigns/:id',adminCampaignDetail);
r.get('/admin/campaigns/:id/readiness',campaignReadiness);
r.get('/admin/campaigns/:id/performance',campaignPerformance);
r.patch('/admin/campaigns/:id',editCampaign);
r.post('/admin/campaigns/:id/status',campaignChangeStatus);
export default r;
