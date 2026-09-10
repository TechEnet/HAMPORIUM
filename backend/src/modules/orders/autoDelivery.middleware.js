import {
  calculateBuyNowCheckoutDelivery,
  calculateCartCheckoutDelivery,
} from "./checkoutDelivery.service.js";

const applyEstimate = (req, estimate) => {
  req.body = req.body || {};

  // Server is authoritative. Any date supplied by the browser is ignored.
  req.body.deliveryDate = estimate.deliveryDateKey;
  req.checkoutDeliveryEstimate = estimate;
};

export const autoDeliveryForCart = async (req, res, next) => {
  try {
    const estimate = await calculateCartCheckoutDelivery({
      userId: req.user._id,
      addressId: req.body?.addressId,
    });

    applyEstimate(req, estimate);
    next();
  } catch (error) {
    next(error);
  }
};

export const autoDeliveryForBuyNow = async (req, res, next) => {
  try {
    const estimate = await calculateBuyNowCheckoutDelivery({
      userId: req.user._id,
      addressId: req.body?.addressId,
      skuId: req.body?.skuId,
      quantity: req.body?.quantity,
    });

    applyEstimate(req, estimate);
    next();
  } catch (error) {
    next(error);
  }
};
