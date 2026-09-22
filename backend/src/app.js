import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import routes from "./routes.js";
import errorHandler from "./middlewares/error.middleware.js";
import paymentWebhook from "./modules/payments/payment.webhook.js";

const app = express();

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
  "https://hamporium.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/*
 * Optional environment URL.
 * Example:
 * CLIENT_URL=https://hamporium.vercel.app
 */
if (process.env.CLIENT_URL) {
  const envOrigins = process.env.CLIENT_URL
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  allowedOrigins.push(...envOrigins);
}

app.use(
  cors({
    origin(origin, callback) {
      /*
       * Requests without Origin are allowed.
       * Examples:
       * - server-to-server
       * - health checks
       * - Postman
       */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);

      return callback(
        new Error("Origin is not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  })
);

/* =========================================================
   SECURITY
========================================================= */

app.use(helmet());

/* =========================================================
   RAZORPAY WEBHOOK

   IMPORTANT:
   This must stay BEFORE express.json().
   Razorpay signs the exact raw request body, so parsing JSON
   first breaks webhook signature verification.
========================================================= */

app.post(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  paymentWebhook
);

/* =========================================================
   BODY PARSERS
========================================================= */

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

/* =========================================================
   HEALTH / ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to HAMPORIUM API",
  });
});

/* =========================================================
   API ROUTES
========================================================= */

app.use("/api", routes);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(errorHandler);

export default app;