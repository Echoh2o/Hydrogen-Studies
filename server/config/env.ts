
// Comprehensive environment validation
export function validateEnvironment() {
  const requiredEnvVars = ["DATABASE_URL"];
  const missingRequired = [];

  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }

  // Exit if DATABASE_URL is missing - can't run without a database
  if (missingRequired.length > 0) {
    console.error(
      "Missing required environment variables:",
      missingRequired.join(", "),
    );
    process.exit(1);
  }

  // Generate SESSION_SECRET if not provided (with warning)
  if (!process.env.SESSION_SECRET) {
    const crypto = require("crypto");
    process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
    console.warn(
      "⚠️  SESSION_SECRET not set — generated a random secret for this instance.",
    );
    console.warn(
      "⚠️  Sessions will not persist across restarts. Set SESSION_SECRET in Railway env vars.",
    );
    console.warn(
      "⚠️  Generate one with: openssl rand -hex 32",
    );
  } else if (process.env.SESSION_SECRET.length < 32) {
    console.warn("⚠️  SESSION_SECRET is short. Use at least 32 characters.");
  }

  // Default ALLOWED_ORIGINS if not provided
  if (!process.env.ALLOWED_ORIGINS) {
    console.warn(
      "⚠️  ALLOWED_ORIGINS not set — defaulting to allow all origins.",
    );
    console.warn(
      "⚠️  Set ALLOWED_ORIGINS in Railway env vars for production security.",
    );
    console.warn(
      "⚠️  Example: ALLOWED_ORIGINS=https://yourdomain.com",
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

  console.log("Environment validation completed successfully");
}
