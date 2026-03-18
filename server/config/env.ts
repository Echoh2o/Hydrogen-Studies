import { randomBytes } from "crypto";

const isProduction = process.env.NODE_ENV === "production";

// Comprehensive environment validation
export function validateEnvironment() {
  const requiredEnvVars = ["DATABASE_URL"];
  const missingRequired: string[] = [];

  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }

  // In production, SESSION_SECRET is required (not auto-generated)
  if (isProduction && !process.env.SESSION_SECRET) {
    missingRequired.push("SESSION_SECRET");
  }

  // Exit if required vars are missing
  if (missingRequired.length > 0) {
    console.error(
      "Missing required environment variables:",
      missingRequired.join(", "),
    );
    if (isProduction) {
      console.error(
        "Generate SESSION_SECRET with: openssl rand -hex 32",
      );
    }
    process.exit(1);
  }

  // Generate SESSION_SECRET in development if not provided
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = randomBytes(32).toString("hex");
    console.warn(
      "SESSION_SECRET not set — generated a random secret for this dev instance.",
    );
  } else if (process.env.SESSION_SECRET.length < 32) {
    if (isProduction) {
      console.error("SESSION_SECRET must be at least 32 characters in production.");
      process.exit(1);
    }
    console.warn("SESSION_SECRET is short. Use at least 32 characters.");
  }

  // Warn about ALLOWED_ORIGINS in production
  if (isProduction && !process.env.ALLOWED_ORIGINS) {
    console.warn(
      "ALLOWED_ORIGINS not set in production — only same-origin requests will be allowed.",
    );
  }

  // Validate DATABASE_URL format
  try {
    new URL(process.env.DATABASE_URL!);
  } catch (error) {
    console.error(
      "Invalid DATABASE_URL format. Please provide a valid database connection string.",
    );
    process.exit(1);
  }

  // Warn about missing optional service keys
  const optionalServiceKeys = [
    { key: "ANTHROPIC_API_KEY", feature: "AI content enrichment" },
    { key: "XAI_API_KEY", feature: "Grok image generation (primary)" },
    { key: "OPENAI_API_KEY", feature: "DALL-E image generation (fallback)" },
    { key: "SENDGRID_API_KEY", feature: "email delivery (password resets)" },
    { key: "SENTRY_DSN", feature: "server error tracking" },
    { key: "VITE_SENTRY_DSN", feature: "client error tracking" },
    { key: "SHOPIFY_WEBHOOK_SECRET", feature: "Shopify webhook verification" },
  ];
  for (const { key, feature } of optionalServiceKeys) {
    if (!process.env[key]) {
      console.warn(`${key} not set — ${feature} will be disabled.`);
    }
  }

  console.log("Environment validation completed successfully");
}
