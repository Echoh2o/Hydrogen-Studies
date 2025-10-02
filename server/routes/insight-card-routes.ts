import express from "express";
import { z } from "zod";
import { db } from "../db";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define the schema for insight card generation request
const generateInsightSchema = z.object({
  studyId: z.number(),
  insight: z.string().optional(),
  customText: z.string().optional(),
  theme: z.string().optional(),
  style: z.string().optional(),
});

/**
 * Generate insights for a study
 */
router.post("/insight-cards/generate-insights", async (req, res) => {
  try {
    const { studyId } = req.body;

    // Validate studyId
    if (!studyId) {
      return res.status(400).json({ error: "Study ID is required" });
    }

    // Fetch the study
    const [study] = await db
      .select()
      .from(studies)
      .where(eq(studies.id, studyId));

    if (!study) {
      return res.status(404).json({ error: "Study not found" });
    }

    // Generate insights using OpenAI
    const prompt = `
      As a scientific research expert specializing in hydrogen health studies, analyze the following study and 
      provide 5 key insights that would be valuable for health practitioners and researchers. 
      Format each insight as a single concise sentence (15-25 words) that captures a significant finding, implication, 
      or methodology advantage. Focus on practical applications and clinical relevance.
      
      Study Title: ${study.title}
      Abstract: ${study.abstract}
      ${study.methods ? `Methods: ${study.methods}` : ""}
      ${study.results ? `Results: ${study.results}` : ""}
      ${study.conclusion ? `Conclusion: ${study.conclusion}` : ""}
      
      Return a JSON array with exactly 5 insight strings. Each insight should be self-contained and 
      understandable without additional context.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content:
            "You are a scientific research analyst specializing in hydrogen health studies.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    // Extract the insights from the response
    const responseContent = completion.choices[0].message.content;
    let insights = [];

    try {
      const parsedResponse = JSON.parse(responseContent);
      insights = Array.isArray(parsedResponse.insights)
        ? parsedResponse.insights
        : [];

      // Ensure we have exactly 5 insights
      if (insights.length > 5) {
        insights = insights.slice(0, 5);
      } else if (insights.length < 5) {
        // If we don't have 5 insights, add generic ones to fill in
        while (insights.length < 5) {
          insights.push(
            `The study on ${study.title.substring(0, 40)}... provides valuable evidence for hydrogen therapy.`,
          );
        }
      }
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
      // Fallback to extracting insights from text
      const lines = responseContent
        .split("\n")
        .filter(
          (line) =>
            line.trim().length > 0 &&
            !line.includes("{") &&
            !line.includes("}"),
        )
        .map((line) => line.replace(/^[0-9]+[\.\)]-?\s*|["']/g, "").trim())
        .filter((line) => line.length > 10 && line.length < 100);

      insights = lines.slice(0, 5);

      // If we still don't have 5 insights, add generic ones
      while (insights.length < 5) {
        insights.push(
          `The study on ${study.title.substring(0, 40)}... provides valuable evidence for hydrogen therapy.`,
        );
      }
    }

    return res.json({ insights });
  } catch (error) {
    console.error("Error generating insights:", error);
    return res.status(500).json({ error: "Failed to generate insights" });
  }
});

/**
 * Generate insight card image
 */
router.post("/insight-cards/generate-image", async (req, res) => {
  try {
    const { studyId, insight, customText, theme, style } =
      generateInsightSchema.parse(req.body);

    // Fetch the study
    const [study] = await db
      .select()
      .from(studies)
      .where(eq(studies.id, studyId));

    if (!study) {
      return res.status(404).json({ error: "Study not found" });
    }

    // Prepare the prompt for image generation
    const imagePrompt = `
      Create a professional scientific insight card image visualizing the following insight from a hydrogen health research study:
      
      "${insight || customText || `Key finding from study: ${study.title}`}"
      
      Style: ${style || "Modern, minimalist scientific illustration"}
      Theme: ${theme || "Medical research with subtle hydrogen molecule imagery"}
      
      The image should be suitable for sharing on professional platforms, convey scientific authority,
      and include subtle visual elements related to hydrogen health research such as water molecules,
      hydrogen atoms, or medical imagery. Do not include any text in the image.
      
      Create this as a digital illustration with clean lines and a professional color palette.
    `;

    // Generate the image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    return res.json({
      imageUrl: response.data[0].url,
      studyId,
      insight:
        insight || customText || `Key finding from study: ${study.title}`,
    });
  } catch (error) {
    console.error("Error generating insight card image:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate insight card image" });
  }
});

/**
 * Share an insight card
 */
router.post("/insight-cards/share", async (req, res) => {
  try {
    const { studyId, insight, imageUrl } = req.body;

    // Validate required fields
    if (!studyId || !insight || !imageUrl) {
      return res
        .status(400)
        .json({ error: "Study ID, insight, and image URL are required" });
    }

    // Generate a unique short ID for the shared card
    const shareId = Math.random().toString(36).substring(2, 10);

    // In a real application, we would save this to the database
    // For now, we'll just return the sharing information

    return res.json({
      success: true,
      shareId,
      shareUrl: `/shared-insight/${shareId}`,
      studyId,
      insight,
      imageUrl,
    });
  } catch (error) {
    console.error("Error sharing insight card:", error);
    return res.status(500).json({ error: "Failed to share insight card" });
  }
});

export default router;
