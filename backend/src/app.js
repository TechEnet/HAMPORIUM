import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import routes from "./routes.js";
import errorHandler from "./middlewares/error.middleware.js";
import paymentWebhook from "./modules/payments/payment.webhook.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(helmet());

/* =========================================================
   RAZORPAY WEBHOOK

   IMPORTANT:
   This must stay BEFORE express.json(). Razorpay signs the
   exact raw request body, so parsing JSON first breaks the
   webhook signature verification.
========================================================= */
app.post(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  paymentWebhook
);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to HAMPORIUM API",
  });
});

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

app.use(errorHandler);

export default app;
