import Razorpay from "razorpay";

let razorpayInstance = null;

const getRazorpay = () => {
  const {
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
  } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay configuration is incomplete");
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayInstance;
};


export const createGatewayOrder = async ({
  amountPaise,
  currency = "INR",
  receipt,
  notes = {},
}) => {
  const razorpay = getRazorpay();

  return razorpay.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    notes,
  });
};


export const fetchGatewayPayment = async (paymentId) => {
  const razorpay = getRazorpay();

  return razorpay.payments.fetch(paymentId);
};


export const getRazorpayKeyId = () => {
  if (!process.env.RAZORPAY_KEY_ID) {
    throw new Error("RAZORPAY_KEY_ID is not configured");
  }

  return process.env.RAZORPAY_KEY_ID;
};