
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
   CORS CONFIGURATION
   HAMPORIUM - PRODUCTION + DEVELOPMENT
========================================================= */

const allowedOrigins = new Set([
  // Official production domain
  "https://hamporium.in",
  "https://www.hamporium.in",

  // Existing Vercel deployment
  "https://hamporium.vercel.app",

  // Local development
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

/*
 * Additional frontend URLs can be configured
 * from Render environment variables.
 *
 * Example:
 * CLIENT_URL=https://hamporium.in,https://www.hamporium.in
 */

if (process.env.CLIENT_URL) {
  const envOrigins = process.env.CLIENT_URL
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  envOrigins.forEach((origin) => {
    allowedOrigins.add(origin);
  });
}

const corsOptions = {
  origin(origin, callback) {
    /*
     * Allow requests without an Origin header.
     * Examples:
     * - Server-to-server requests
     * - Health checks
     * - Postman
     */

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);

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
};

// Apply CORS globally
app.use(cors(corsOptions));

/* =========================================================
   SECURITY
========================================================= */

app.use(helmet());

/* =========================================================
   RAZORPAY WEBHOOK

   IMPORTANT:
   This must remain BEFORE express.json().

   Razorpay uses the exact raw request body
   for webhook signature verification.
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
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(errorHandler);

export default app;
