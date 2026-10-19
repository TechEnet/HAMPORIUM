
import {Router} from 'express';
import protect from '../../middlewares/auth.middleware.js';
import {allowRoles} from '../../middlewares/access.middleware.js';
import {ROLES} from '../../constants/roles.js';
import {adminDemandOverview} from './demandStudio.controller.js';
const r=Router();
r.use(protect,allowRoles(ROLES.ADMIN,ROLES.OPERATIONS));
r.get('/overview',adminDemandOverview);
export default r;
