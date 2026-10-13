import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import routes from "./routes.js";
import errorHandler from "./middlewares/error.middleware.js";
import paymentWebhook from "./modules/payments/payment.webhook.js";
import customerIntelligenceRoutes from "./modules/customerIntelligence/customerIntelligence.routes.js";
import { captureAuthActivity } from "./modules/customerIntelligence/customerIntelligence.controller.js";

const app = express();

// Existing production and development origins; additional URLs via CLIENT_URL.
const allowedOrigins = new Set([
  "https://hamporium.in",
  "https://www.hamporium.in",
  "https://hamporium.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(",").map((x) => x.trim().replace(/\/+$/, ""))
    .filter(Boolean).forEach((x) => allowedOrigins.add(x));
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
}));
app.use(helmet());

// Must remain BEFORE express.json() for Razorpay signature verification.
app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }), paymentWebhook);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

app.get("/", (req, res) => res.json({ success: true, message: "Welcome to HAMPORIUM API" }));

// Inspect only successful responses from existing auth routes, without changing auth logic.
app.use("/api/auth", captureAuthActivity);

// New Customer 360 endpoints. The admin branch requires a verified admin JWT.
app.use("/api/customer-intelligence", customerIntelligenceRoutes);

// Preserve every existing HAMPORIUM API.
app.use("/api", routes);

app.use((req, res) => res.status(404).json({ success: false, message: "API route not found" }));
app.use(errorHandler);
export default app;
