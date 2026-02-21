/**
 * Admin Settings Routes
 * Manages platform settings with file-based persistence
 */
import { Router, Request, Response } from "express";
import { requireAdmin } from "../auth";
import fs from "fs";
import path from "path";

const router = Router();

const SETTINGS_FILE = path.join(process.cwd(), "data", "site-settings.json");

interface SiteSettings {
  siteTitle: string;
  siteDescription: string;
  defaultLanguage: string;
  timezone: string;
  autoPublish: boolean;
  maintenanceMode: boolean;
  emailNotifications: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteTitle: "Hydrogen Studies",
  siteDescription: "Advanced AI-powered hydrogen health research platform",
  defaultLanguage: "en",
  timezone: "UTC",
  autoPublish: false,
  maintenanceMode: false,
  emailNotifications: true,
};

function ensureDataDir() {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readSettings(): SiteSettings {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return DEFAULT_SETTINGS;
  }
  const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
  return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
}

function writeSettings(settings: SiteSettings) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET /api/admin/settings - Read current settings
router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const settings = readSettings();

    // Include integration status checks
    const integrations = {
      klaviyo: !!process.env.KLAVIYO_API_KEY,
      shopify: !!process.env.SHOPIFY_WEBHOOK_SECRET,
      openai: !!process.env.OPENAI_API_KEY,
      sendgrid: !!process.env.SENDGRID_API_KEY,
      googleAnalytics: !!process.env.VITE_GA_MEASUREMENT_ID,
      database: !!process.env.DATABASE_URL,
    };

    res.json({ settings, integrations });
  } catch (error) {
    console.error("Failed to read settings:", error);
    res.status(500).json({ error: "Failed to read settings" });
  }
});

// PUT /api/admin/settings - Update settings
router.put("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const current = readSettings();
    const updates = req.body;

    // Only allow known keys
    const allowed: (keyof SiteSettings)[] = [
      "siteTitle",
      "siteDescription",
      "defaultLanguage",
      "timezone",
      "autoPublish",
      "maintenanceMode",
      "emailNotifications",
    ];

    const updated = { ...current };
    for (const key of allowed) {
      if (key in updates) {
        (updated as any)[key] = updates[key];
      }
    }

    writeSettings(updated);
    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error("Failed to save settings:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
