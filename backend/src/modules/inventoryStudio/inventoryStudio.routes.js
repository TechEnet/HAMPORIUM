
import {Router} from 'express';
import protect from '../../middlewares/auth.middleware.js';
import {allowRoles} from '../../middlewares/access.middleware.js';
import {ROLES} from '../../constants/roles.js';
import {getInventoryOverview,listInventoryRecords,updateVerifiedInventory,clearInventoryVerification,publicStockStatus} from './inventoryStudio.controller.js';
const r=Router();
r.get('/public/products/:productId',publicStockStatus);
r.use(protect,allowRoles(ROLES.ADMIN,ROLES.OPERATIONS));
r.get('/admin/overview',getInventoryOverview);
r.get('/admin/records',listInventoryRecords);
r.put('/admin/verified/:type/:id',updateVerifiedInventory);
r.post('/admin/unverify/:type/:id',clearInventoryVerification);
export default r;
