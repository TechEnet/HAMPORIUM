
import {Router} from 'express';
import protect from '../../middlewares/auth.middleware.js';
import {allowRoles} from '../../middlewares/access.middleware.js';
import {ROLES} from '../../constants/roles.js';
import { catalogReadiness, getCatalogActionHistory, safeArchiveProduct, restoreArchivedProduct, getExcelFieldRegistry, getExtendedFields, saveExtendedFields } from './catalogStudio.controller.js';
const router=Router();
router.use(protect,allowRoles(ROLES.ADMIN,ROLES.OPERATIONS));
router.get('/readiness/:kind/:id',catalogReadiness);
router.get('/excel-fields/:kind',getExcelFieldRegistry);
router.get('/extended/:kind/:id/:sheet',getExtendedFields);
router.put('/extended/:kind/:id/:sheet',saveExtendedFields);
router.get('/audit',getCatalogActionHistory);
router.post('/products/:id/archive',safeArchiveProduct);
router.post('/products/:id/restore',restoreArchivedProduct);
export default router;
