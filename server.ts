import * as dotenv from 'dotenv';
dotenv.config();
import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import { checkDbHealth, closeDb } from "./server/db";
import syncRouter from "./server/routes/sync";
import authRouter from "./server/routes/auth";
import invoiceRouter from "./server/routes/invoices";
import inventoryRouter from "./server/routes/inventory";
import productionRouter from "./server/routes/production";
import backupRouter from "./server/routes/backup";
import uploadRouter from "./server/routes/uploads";
import settingsRouter from "./server/routes/settings";
import farmersRouter from "./server/routes/farmers";
import formulasRouter from "./server/routes/formulas";
import driversRouter from "./server/routes/drivers";
import originsRouter from "./server/routes/origins";
import warehousesRouter from "./server/routes/warehouses";
import usersRouter from "./server/routes/users";
import { requireAuth } from "./server/middleware/auth";
import { securityHeaders } from "./server/middleware/security";
import { apiRateLimiter, authRateLimiter } from "./server/middleware/rateLimit";
import { corsMiddleware } from "./server/middleware/cors";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const uploadsPath = path.resolve(process.env.NIR_UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads'));
app.use('/uploads', express.static(uploadsPath));

app.get("/api/health", async (_req, res) => {
  const database = await checkDbHealth();
  const healthy = database.status === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "nir-production",
    database,
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRateLimiter, authRouter);
app.use("/api/settings", apiRateLimiter, requireAuth, settingsRouter);
app.use("/api/farmers", apiRateLimiter, requireAuth, farmersRouter);
app.use("/api/formulas", apiRateLimiter, requireAuth, formulasRouter);
app.use("/api/drivers", apiRateLimiter, requireAuth, driversRouter);
app.use("/api/origins", apiRateLimiter, requireAuth, originsRouter);
app.use("/api/warehouses", apiRateLimiter, requireAuth, warehousesRouter);
app.use("/api/users", apiRateLimiter, requireAuth, usersRouter);
app.use("/api/invoices", apiRateLimiter, requireAuth, invoiceRouter);
app.use("/api/inventory", apiRateLimiter, requireAuth, inventoryRouter);
app.use("/api/production", apiRateLimiter, requireAuth, productionRouter);
app.use("/api/sync", apiRateLimiter, requireAuth, syncRouter);
app.use("/api/backup", apiRateLimiter, requireAuth, backupRouter);
app.use("/api/uploads", apiRateLimiter, requireAuth, uploadRouter);

let ai: GoogleGenAI | null = null;
const getGeminiClient = (): GoogleGenAI | null => {
  if (!ai && process.env.GEMINI_API_KEY) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
};

app.post("/api/extract", apiRateLimiter, requireAuth, async (req, res) => {
  try {
    const { base64Data, mimeType, type, knownFarmers, knownProducts, knownDrivers } = req.body;
    const client = getGeminiClient();
    if (!client) return res.status(503).json({ error: "کلید سرویس هوش مصنوعی (GEMINI_API_KEY) در سرور تنظیم نشده است." });

    const responseSchema = type === 'entry' ? {
      type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
        sellerName: { type: Type.STRING, nullable: true }, productName: { type: Type.STRING, nullable: true },
        billWeight: { type: Type.NUMBER, nullable: true }, scaleWeight: { type: Type.NUMBER, nullable: true },
        driverName: { type: Type.STRING, nullable: true }, billNumber: { type: Type.STRING, nullable: true },
        origin: { type: Type.STRING, nullable: true }, transportCost: { type: Type.NUMBER, nullable: true },
        driverPhone: { type: Type.STRING, nullable: true }, driverIBAN: { type: Type.STRING, nullable: true }
      }}
    } : {
      type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
        farmerName: { type: Type.STRING, nullable: true }, productName: { type: Type.STRING, nullable: true },
        weight: { type: Type.NUMBER, nullable: true }, driverName: { type: Type.STRING, nullable: true },
        invoiceNumber: { type: Type.STRING, nullable: true }
      }}
    };

    const contextStr = [
      knownFarmers?.length ? `\nKnown Farmers/Sellers: ${knownFarmers.join(", ")}` : "",
      knownProducts?.length ? `\nKnown Products: ${knownProducts.join(", ")}` : "",
      knownDrivers?.length ? `\nKnown Drivers: ${knownDrivers.join(", ")}` : ""
    ].join('');
    const promptText = type === 'entry'
      ? `Extract Persian raw materials entry remittance data. Return JSON array. Separate seller and product. Product examples: ذرت, سویا, دان, گندم, جو, کنجاله, پودر, روغن, مکمل, سبوس, پلت, ویتامین, کلسیم, کنسانتره. Map sellerName, productName, billWeight, scaleWeight, driverName, billNumber, origin, transportCost, driverPhone, driverIBAN.${contextStr}`
      : `Extract Persian exit remittance data. Return JSON array. Separate farmer and product. Map farmerName, productName, weight, driverName, invoiceNumber.${contextStr}`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: promptText }] },
      config: { responseMimeType: "application/json", responseSchema }
    });
    if (!response.text) return res.status(500).json({ error: "پاسخی از مدل دریافت نشد." });
    res.json(JSON.parse(response.text.trim()));
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    res.status(500).json({ error: error.message || "خطا در استخراج هوشمند اطلاعات." });
  }
});

// Explicit API 404 Handler - Never return HTML for unmatched API endpoints
app.all(/^\/api\/.*/, (req, res) => {
  res.status(404).json({ success: false, error: "API endpoint not found", path: req.originalUrl });
});

// Global Centralized Error Handler
const errorHandler = (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[NIR Server Error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err?.message || 'خطای غیرمنتظره در سرور رخ داده است.',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err?.stack } : {})
  });
};

let httpServer: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const viteModule = 'vite';
    const { createServer: createViteServer } = await import(viteModule);
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const runtimeDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(process.argv[1] || process.cwd());
    const distPath = path.resolve(process.env.NIR_DIST_PATH || runtimeDir);
    const indexPath = path.join(distPath, 'index.html');
    const assetsPath = path.join(distPath, 'assets');

    if (!fs.existsSync(indexPath)) {
      throw new Error(`NIR frontend not found: ${indexPath}`);
    }
    if (!fs.existsSync(assetsPath)) {
      throw new Error(`NIR assets directory not found: ${assetsPath}`);
    }

    console.log(`[NIR] Frontend root: ${distPath}`);
    console.log(`[NIR] Assets root: ${assetsPath}`);

    // Serve built assets directly. No custom MIME hook and no SPA fallback here.
    app.use('/assets', express.static(assetsPath, {
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
    }));

    app.use(express.static(distPath, {
      index: 'index.html',
      fallthrough: true,
    }));

    // Only browser application routes reach the SPA fallback.
    app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)|\/assets(?:\/|$)).*$/, (_req, res) => {
      res.sendFile(indexPath);
    });
  }

  // 404 for assets
  app.use('/assets', (req, res) => res.status(404).send('Asset not found'));

  app.use(errorHandler);

  httpServer = app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://0.0.0.0:${PORT}`));
}

const shutdown = async (signal: string) => {
  console.log(`[NIR] ${signal} received; shutting down gracefully.`);
  if (httpServer) await new Promise<void>(resolve => httpServer!.close(() => resolve()));
  await closeDb();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void startServer().catch(async error => {
  console.error('[NIR] Failed to start server:', error);
  try { await closeDb(); } catch (_err) { /* ignore cleanup error */ }
  process.exit(1);
});
