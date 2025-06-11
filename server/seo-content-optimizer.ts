
import { db } from './db';
import { studies } from '@shared/schema';
import { eq, sql, ilike } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

interface SEOOptimization {
  studyId: number;
  targetKeywords: string[];
  optimizedTitle: string;
  metaDescription: string;
  headings: string[];
  internalLinks: string[];
}

export async function optimizeStudyForSEO(studyId: number): Promise<SEOOptimization> {
  const study = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);
  
  if (!study.length || !openai) {
    throw new Error('Study not found or OpenAI not configured');
  }

  const studyData = study[0];
  
  const prompt = `
  Optimize this hydrogen therapy research study for SEO:
  
  Title: ${studyData.title}
  Abstract: ${studyData.abstract}
  Category: ${studyData.category}
  Keywords: ${studyData.keywords?.join(', ')}
  
  Please provide:
  1. 5-8 long-tail keywords this study should target
  2. SEO-optimized title (50-60 characters)
  3. Meta description (150-160 characters)
  4. 3-5 H2/H3 heading suggestions for the study page
  5. 3-5 internal linking opportunities to related studies/categories
  
  Focus on search intent around:
  - Health benefits and conditions
  - Scientific evidence and research
  - Safety and effectiveness
  - Treatment options and alternatives
  
  Format as JSON with keys: targetKeywords, optimizedTitle, metaDescription, headings, internalLinks
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const optimization = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      studyId,
      ...optimization
    };
  } catch (error) {
    console.error('SEO optimization failed:', error);
    throw error;
  }
}

export async function generateContentClusters(): Promise<any> {
  // Find studies that could be grouped into content clusters
  const categoryGroups = await db.execute(sql`
    SELECT 
      category,
      COUNT(*) as study_count,
      array_agg(DISTINCT unnest(keywords)) as all_keywords
    FROM studies 
    WHERE category IS NOT NULL 
    GROUP BY category 
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
  `);

  return categoryGroups.rows.map(group => ({
    topic: group.category,
    studyCount: group.study_count,
    keywords: group.all_keywords?.filter(Boolean).slice(0, 20),
    pillarPageOpportunity: group.study_count >= 10,
    clusterStrength: Math.min(group.study_count / 5, 10)
  }));
}
