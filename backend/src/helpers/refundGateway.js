import Razorpay from "razorpay";

let client = null;
let cachedKeyId = "";
let cachedKeySecret = "";

const getClient = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured");
  }

  if (
    !client ||
    cachedKeyId !== keyId ||
    cachedKeySecret !== keySecret
  ) {
    client = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    cachedKeyId = keyId;
    cachedKeySecret = keySecret;
  }

  return client;
};

export const createGatewayRefund = async ({
  paymentId,
  amountPaise,
  receipt = "",
  notes = {},
}) => {
  if (!paymentId) {
    throw new Error("Razorpay payment ID is required for refund");
  }

  const amount = Math.round(Number(amountPaise || 0));

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }

  const payload = {
    amount,
    notes,
  };

  if (receipt) {
    payload.receipt = String(receipt).slice(0, 40);
  }

  return getClient().payments.refund(paymentId, payload);
};

export default createGatewayRefund;
