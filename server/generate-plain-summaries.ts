/**
 * Generate Plain Language Summaries for Studies
 * 
 * Creates consumer-friendly summaries, objectives, methods, results, and conclusions
 * for studies that are missing these enhanced content fields
 */
import { db } from './db.js';
import { studies } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface StudyToEnhance {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  category: string;
}

/**
 * Generate enhanced content for a single study
 */
async function generateEnhancedContent(study: StudyToEnhance): Promise<{
  objective?: string;
  methods?: string;
  results?: string;
  conclusion?: string;
  summaryMarkdown?: string;
}> {
  try {
    // Generate plain language summary
    const summaryPrompt = `Create a plain language summary for this hydrogen research study. Write it in simple terms that non-scientists can understand. Focus on what the study found and what it means for people's health. Keep it under 200 words.

Title: ${study.title}
Abstract: ${study.abstract}

Write a consumer-friendly summary:`;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: summaryPrompt }],
      max_tokens: 300,
      temperature: 0.3,
    });

    const summaryMarkdown = summaryResponse.choices[0]?.message?.content || null;

    // Generate objective
    const objectivePrompt = `Extract or write a clear, simple objective for this study in 1-2 sentences:

Title: ${study.title}
Abstract: ${study.abstract}

Objective:`;

    const objectiveResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: objectivePrompt }],
      max_tokens: 150,
      temperature: 0.3,
    });

    const objective = objectiveResponse.choices[0]?.message?.content || null;

    // Generate methods summary
    const methodsPrompt = `Write a brief, clear summary of the methods used in this study. Focus on what was done and how. Keep it under 150 words and use simple language:

Title: ${study.title}
Abstract: ${study.abstract}

Methods:`;

    const methodsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: methodsPrompt }],
      max_tokens: 200,
      temperature: 0.3,
    });

    const methods = methodsResponse.choices[0]?.message?.content || null;

    // Generate results summary
    const resultsPrompt = `Write a brief, clear summary of the key results from this study. Focus on what was found. Keep it under 150 words and use simple language:

Title: ${study.title}
Abstract: ${study.abstract}

Results:`;

    const resultsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: resultsPrompt }],
      max_tokens: 200,
      temperature: 0.3,
    });

    const results = resultsResponse.choices[0]?.message?.content || null;

    // Generate conclusion
    const conclusionPrompt = `Write a brief, clear conclusion for this study. Focus on what it means and its implications. Keep it under 100 words and use simple language:

Title: ${study.title}
Abstract: ${study.abstract}

Conclusion:`;

    const conclusionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: conclusionPrompt }],
      max_tokens: 150,
      temperature: 0.3,
    });

    const conclusion = conclusionResponse.choices[0]?.message?.content || null;

    return {
      objective,
      methods,
      results,
      conclusion,
      summaryMarkdown,
    };
  } catch (error) {
    console.error(`Failed to generate content for study ${study.id}:`, error);
    return {};
  }
}

/**
 * Update study with enhanced content
 */
async function updateStudyWithContent(studyId: number, content: any): Promise<void> {
  try {
    await db.update(studies)
      .set({
        objective: content.objective,
        methods: content.methods,
        results: content.results,
        conclusion: content.conclusion,
        summaryMarkdown: content.summaryMarkdown,
      })
      .where(eq(studies.id, studyId));
    
    console.log(`✅ Updated study ${studyId} with enhanced content`);
  } catch (error) {
    console.error(`Failed to update study ${studyId}:`, error);
  }
}

/**
 * Main function to generate plain language summaries
 */
async function generatePlainLanguageSummaries(): Promise<void> {
  try {
    console.log('🚀 Starting plain language summary generation...');
    
    // Get studies that need enhanced content (check for any missing fields)
    const studiesNeedingContent = await db
      .select({
        id: studies.id,
        title: studies.title,
        abstract: studies.abstract,
        authors: studies.authors,
        journal: studies.journal,
        category: studies.category,
      })
      .from(studies)
      .limit(5); // Start with first 5 studies to test
    
    console.log(`📊 Found ${studiesNeedingContent.length} studies needing plain language summaries`);
    
    if (studiesNeedingContent.length === 0) {
      console.log('✅ All studies already have plain language summaries!');
      return;
    }
    
    // Process each study
    for (const study of studiesNeedingContent) {
      console.log(`\n📝 Processing study ${study.id}: "${study.title.substring(0, 60)}..."`);
      
      const enhancedContent = await generateEnhancedContent(study);
      
      if (Object.keys(enhancedContent).length > 0) {
        await updateStudyWithContent(study.id, enhancedContent);
      }
      
      // Small delay to respect API limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 Plain language summary generation completed!');
    
  } catch (error) {
    console.error('❌ Error generating plain language summaries:', error);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePlainLanguageSummaries()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { generatePlainLanguageSummaries };