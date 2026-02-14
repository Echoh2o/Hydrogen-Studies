
// Comprehensive environment validation
export function validateEnvironment() {
  const requiredEnvVars = ["DATABASE_URL"];
  const optionalEnvVars = [
    "OPENAI_API_KEY",
    "SENDGRID_API_KEY",
    "VITE_GA_MEASUREMENT_ID",
  ];
  const missingRequired = [];
  const missingOptional = [];

  // SECURITY: Required variables in production
  if (process.env.NODE_ENV === "production") {
    requiredEnvVars.push("SESSION_SECRET");
    requiredEnvVars.push("ALLOWED_ORIGINS");
  }

  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }

  // Check optional environment variables
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar);
    }
  }

  // Additional validation for ADMIN_USER_IDS
  if (process.env.ADMIN_USER_IDS) {
    const adminIds = process.env.ADMIN_USER_IDS.split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (adminIds.length === 0) {
      console.warn(
        "ADMIN_USER_IDS is empty - admin functionality will be disabled",
      );
      // Don't exit, just disable admin features
    } else {
      // Security check: warn about potentially insecure admin IDs
      const insecureIds = ["admin", "1", "root", "administrator"];
      const foundInsecure = adminIds.filter((id) =>
        insecureIds.includes(id.toLowerCase()),
      );
      if (foundInsecure.length > 0) {
        console.warn(
          `WARNING: Found potentially insecure admin IDs: ${foundInsecure.join(", ")}`,
        );
        console.warn(
          "Consider using more secure, unique identifiers for admin users.",
        );
      }
    }
  } else if (process.env.NODE_ENV === "production") {
    // Don't crash in production, just warn
    console.warn(
      "⚠️ ADMIN_USER_IDS not configured in production - admin features disabled",
    );
    console.warn(
      "⚠️ To enable admin features: Deployments → Configuration → Add ADMIN_USER_IDS secret",
    );
  }

  // Validate SESSION_SECRET strength
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      console.error("SESSION_SECRET is too short. Use at least 32 characters.");
      console.error("Generate a secure secret using: openssl rand -hex 32");
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
    if (
      process.env.SESSION_SECRET === "dev-secret-change-me-before-production"
    ) {
      console.error(
        "SESSION_SECRET is using the default value. This is insecure!",
      );
      console.error("Generate a secure secret using: openssl rand -hex 32");
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
  } else if (
    !process.env.SESSION_SECRET &&
    process.env.NODE_ENV !== "production"
  ) {
    console.warn(
      "⚠️  SESSION_SECRET not set. Using default for development only.",
    );
    console.warn(
      "⚠️  Generate a secure secret for production: openssl rand -hex 32",
    );
  }

  // Validate ALLOWED_ORIGINS
  if (process.env.NODE_ENV === "production" && process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    for (const origin of origins) {
      try {
        new URL(origin);
      } catch (error) {
        console.error(`Invalid origin in ALLOWED_ORIGINS: ${origin}`);
        console.error(
          "Each origin must be a valid URL (e.g., https://example.com)",
        );
        process.exit(1);
      }
    }
  }

  // Exit if required variables are missing
  if (missingRequired.length > 0) {
    console.error(
      "Missing required environment variables:",
      missingRequired.join(", "),
    );
    console.error(
      "Please ensure all required environment variables are set before starting the server.",
    );
    // ADMIN_USER_IDS is now optional - handled with warnings above
    if (missingRequired.includes("SESSION_SECRET")) {
      console.error(
        "SESSION_SECRET is required in production for secure session management.",
      );
      console.error("Generate a secure secret using: openssl rand -hex 32");
    }
    if (missingRequired.includes("ALLOWED_ORIGINS")) {
      console.error(
        "ALLOWED_ORIGINS is required in production for CORS security.",
      );
      console.error(
        "Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.",
      );
      console.error(
        "Example: ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com",
      );
    }
    process.exit(1);
  }

  // Warn about missing optional variables
  if (missingOptional.length > 0) {
    console.warn(
      "Missing optional environment variables:",
      missingOptional.join(", "),
    );
    console.warn(
      "Some features may not work properly without these variables.",
    );
  }

  // Validate DATABASE_URL format
  try {
    if (process.env.DATABASE_URL) {
       new URL(process.env.DATABASE_URL);
    }
  } catch (error) {
    console.error(
      "Invalid DATABASE_URL format. Please provide a valid database connection string.",
    );
    process.exit(1);
  }

  console.log("Environment validation completed successfully");
}
