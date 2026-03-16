/**
 * Vitest global test setup
 */
import { vi } from "vitest";

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
