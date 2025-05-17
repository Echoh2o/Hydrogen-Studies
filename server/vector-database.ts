import { db, pool } from './db';
import { studies } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import OpenAI from 'openai';

// Initialize OpenAI client for embeddings
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Check if vector extension exists, if not create it
export async function setupVectorExtension() {
  try {
    // Check if pgvector extension exists
    const extensionExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      );
    `);

    if (!extensionExists.rows[0].exists) {
      console.log('Creating pgvector extension...');
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('pgvector extension created successfully');
    }

    // Check if studies_vectors table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'studies_vectors'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Creating studies_vectors table...');
      await pool.query(`
        CREATE TABLE studies_vectors (
          id SERIAL PRIMARY KEY,
          study_id INTEGER REFERENCES studies(id) ON DELETE CASCADE,
          chunk_text TEXT NOT NULL,
          embedding vector(1536) NOT NULL,
          metadata JSONB
        );
        CREATE INDEX ON studies_vectors USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
      `);
      console.log('studies_vectors table created successfully');
    }

    return true;
  } catch (error) {
    console.error('Error setting up vector extension:', error);
    return false;
  }
}

// Function to create an embedding for text
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

// Function to process and store study content as vector embeddings
export async function processStudyForVectorDB(studyId: number) {
  try {
    // Get the study
    const [study] = await db.select().from(studies).where(eq(studies.id, studyId));
    
    if (!study) {
      throw new Error(`Study with ID ${studyId} not found`);
    }

    // Create chunks from study content
    const chunks = createContentChunks(study);
    
    // Process each chunk
    for (const chunk of chunks) {
      // Create embedding
      const embedding = await createEmbedding(chunk.text);
      
      // Store in vector database
      await pool.query(
        `INSERT INTO studies_vectors (study_id, chunk_text, embedding, metadata)
         VALUES ($1, $2, $3, $4)`,
        [studyId, chunk.text, embedding, JSON.stringify(chunk.metadata)]
      );
    }

    return true;
  } catch (error) {
    console.error(`Error processing study ${studyId} for vector DB:`, error);
    return false;
  }
}

// Function to create meaningful chunks from study content
function createContentChunks(study: any) {
  const chunks = [];
  
  // Title chunk
  chunks.push({
    text: `Title: ${study.title}`,
    metadata: { 
      study_id: study.id,
      section: 'title',
      doi: study.doi
    }
  });
  
  // Abstract chunk - often the most informative part
  if (study.abstract) {
    chunks.push({
      text: `Abstract: ${study.abstract}`,
      metadata: { 
        study_id: study.id,
        section: 'abstract',
        doi: study.doi
      }
    });
  }
  
  // Methods chunk
  if (study.methods) {
    chunks.push({
      text: `Methods: ${study.methods}`,
      metadata: { 
        study_id: study.id,
        section: 'methods',
        doi: study.doi
      }
    });
  }
  
  // Results chunk
  if (study.results) {
    chunks.push({
      text: `Results: ${study.results}`,
      metadata: { 
        study_id: study.id,
        section: 'results',
        doi: study.doi
      }
    });
  }
  
  // Conclusion chunk
  if (study.conclusion) {
    chunks.push({
      text: `Conclusion: ${study.conclusion}`,
      metadata: { 
        study_id: study.id,
        section: 'conclusion',
        doi: study.doi
      }
    });
  }
  
  return chunks;
}

// Function to perform semantic search
export async function semanticSearch(query: string, limit: number = 5) {
  try {
    // Create embedding for the query
    const queryEmbedding = await createEmbedding(query);
    
    // Search for similar content
    const result = await pool.query(
      `SELECT sv.chunk_text, sv.metadata, s.title, s.authors, s.doi, s.publishDate,
        (sv.embedding <-> $1) AS distance
       FROM studies_vectors sv
       JOIN studies s ON sv.study_id = s.id
       ORDER BY distance ASC
       LIMIT $2`,
      [queryEmbedding, limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw error;
  }
}

// Function to process all studies in batches
export async function processAllStudiesForVectorDB(batchSize: number = 10) {
  try {
    // Get all study IDs
    const studyIds = await db
      .select({ id: studies.id })
      .from(studies)
      .orderBy(studies.id);
    
    let processed = 0;
    let batchResults = [];
    
    // Process in batches
    for (let i = 0; i < studyIds.length; i += batchSize) {
      const batch = studyIds.slice(i, i + batchSize);
      const batchPromises = batch.map(({ id }) => processStudyForVectorDB(id));
      
      // Wait for all promises in this batch to resolve
      const results = await Promise.allSettled(batchPromises);
      batchResults.push(...results);
      
      // Count successful operations
      processed += results.filter(result => result.status === 'fulfilled' && result.value).length;
      
      console.log(`Processed batch ${i / batchSize + 1}, total processed: ${processed}/${studyIds.length}`);
    }
    
    return {
      total: studyIds.length,
      processed,
      success: processed === studyIds.length
    };
  } catch (error) {
    console.error('Error processing all studies for vector DB:', error);
    throw error;
  }
}