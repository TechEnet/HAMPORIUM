import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";

import {
  getMyProfile,
  updateMyProfile,
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "./user.controller.js";


const router = Router();


router.use(protect);


router.get(
  "/me",
  getMyProfile
);


router.patch(
  "/me",
  updateMyProfile
);


router.get(
  "/addresses",
  getMyAddresses
);


router.post(
  "/addresses",
  createAddress
);


router.patch(
  "/addresses/:addressId",
  updateAddress
);


router.delete(
  "/addresses/:addressId",
  deleteAddress
);


export default router;