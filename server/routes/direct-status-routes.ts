import { Router } from "express";
import { checkScheduledSearches } from "../keyword-monitor-service";

const router = Router();

/**
 * Direct API endpoint for keyword monitor status
 * This endpoint bypasses Vite development server by using a dedicated router
 * and proper content type headers to ensure JSON is returned
 */
router.get("/monitor-status", async (req, res) => {
  try {
    // Set appropriate headers to ensure JSON response
    res.setHeader("Content-Type", "application/json");

    // Get the current status
    const status = await checkScheduledSearches();

    // Create a standardized response format
    const response = {
      success: true,
      data: status || { ran: false, message: "No status available" },
    };

    // Return JSON response
    return res.json(response);
  } catch (error) {
    console.error("Error checking scheduled search status:", error);

    // Ensure error response is also JSON
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({
      success: false,
      message: "Failed to check schedule status",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
