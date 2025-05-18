import type { Express, Request, Response } from "express";
import { getSuggestionOptions, generateResearchSuggestions } from "../research-suggestions";

export default function registerResearchSuggestionsRoutes(app: Express) {
  // Get options for the research suggestion wizard
  app.get("/api/research-suggestions/options", async (req: Request, res: Response) => {
    try {
      const options = await getSuggestionOptions();
      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      console.error("Error fetching research suggestion options:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch suggestion options"
      });
    }
  });
  
  // Generate research suggestions based on user selections
  app.post("/api/research-suggestions/generate", async (req: Request, res: Response) => {
    try {
      const selections = req.body;
      
      // Validate the selections
      if (!selections) {
        return res.status(400).json({
          success: false,
          message: "Missing selection data"
        });
      }
      
      // Generate research suggestions
      const suggestions = await generateResearchSuggestions(selections);
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error("Error generating research suggestions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate research suggestions"
      });
    }
  });
}