import asyncHandler from "../../utils/asyncHandler.js";
import { calculateCheckoutDelivery } from "./checkoutDelivery.service.js";

export const getCheckoutDeliveryEstimate = asyncHandler(async (req, res) => {
  const estimate = await calculateCheckoutDelivery({
    mode: req.body?.mode || "cart",
    userId: req.user._id,
    addressId: req.body?.addressId,
    skuId: req.body?.skuId,
    quantity: req.body?.quantity,
  });

  res.status(200).json({
    success: true,
    estimate,
  });
});
