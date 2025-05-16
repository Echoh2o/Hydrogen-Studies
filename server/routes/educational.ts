import { Router } from 'express';
import { eq, like, and, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import {
  educationalResources,
  glossaryTerms,
  faqItems,
} from '@shared/schema';
import { isAuthenticated } from '../auth';

const router = Router();

// Get all educational resources (public)
router.get('/educational-resources', async (req, res) => {
  try {
    const resources = await db.select().from(educationalResources)
      .where(req.query.published === 'true' 
        ? eq(educationalResources.isPublished, true)
        : undefined);
        
    return res.json(resources);
  } catch (error) {
    console.error('Error fetching educational resources:', error);
    return res.status(500).json({ message: 'Failed to fetch educational resources' });
  }
});

// Get a specific educational resource by slug (public)
router.get('/educational-resources/:slug', async (req, res) => {
  try {
    const [resource] = await db.select().from(educationalResources)
      .where(and(
        eq(educationalResources.slug, req.params.slug),
        req.query.preview !== 'true' ? eq(educationalResources.isPublished, true) : undefined
      ));
      
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    
    // Increment view count
    await db.update(educationalResources)
      .set({ viewCount: (resource.viewCount || 0) + 1 })
      .where(eq(educationalResources.id, resource.id));
      
    return res.json(resource);
  } catch (error) {
    console.error('Error fetching educational resource:', error);
    return res.status(500).json({ message: 'Failed to fetch educational resource' });
  }
});

// Get all glossary terms (public)
router.get('/glossary', async (req, res) => {
  try {
    let query = db.select().from(glossaryTerms);
    
    // Filter by term if provided
    if (req.query.term) {
      query = query.where(like(glossaryTerms.term, `%${req.query.term}%`));
    }
    
    // Sort alphabetically
    query = query.orderBy(asc(glossaryTerms.term));
    
    const terms = await query;
    return res.json(terms);
  } catch (error) {
    console.error('Error fetching glossary terms:', error);
    return res.status(500).json({ message: 'Failed to fetch glossary terms' });
  }
});

// Get a specific glossary term by ID (public)
router.get('/glossary/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const [term] = await db.select().from(glossaryTerms)
      .where(eq(glossaryTerms.id, id));
      
    if (!term) {
      return res.status(404).json({ message: 'Glossary term not found' });
    }
    
    return res.json(term);
  } catch (error) {
    console.error('Error fetching glossary term:', error);
    return res.status(500).json({ message: 'Failed to fetch glossary term' });
  }
});

// Get all FAQ items (public)
router.get('/faqs', async (req, res) => {
  try {
    let query = db.select().from(faqItems);
    
    // Filter by category if provided
    if (req.query.category) {
      query = query.where(eq(faqItems.category, req.query.category as string));
    }
    
    // Sort by display order
    query = query.orderBy(asc(faqItems.displayOrder));
    
    const items = await query;
    return res.json(items);
  } catch (error) {
    console.error('Error fetching FAQ items:', error);
    return res.status(500).json({ message: 'Failed to fetch FAQ items' });
  }
});

// ADMIN ROUTES

// Create a new educational resource (admin only)
router.post('/admin/educational-resources', isAuthenticated, async (req, res) => {
  try {
    const [resource] = await db.insert(educationalResources)
      .values({
        title: req.body.title,
        slug: req.body.slug,
        content: req.body.content,
        contentMarkdown: req.body.contentMarkdown,
        resourceType: req.body.resourceType,
        featuredOrder: req.body.featuredOrder || 0,
        isPublished: req.body.isPublished !== undefined ? req.body.isPublished : true,
      })
      .returning();
      
    return res.status(201).json(resource);
  } catch (error) {
    console.error('Error creating educational resource:', error);
    return res.status(500).json({ message: 'Failed to create educational resource' });
  }
});

// Update an educational resource (admin only)
router.put('/admin/educational-resources/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const [resource] = await db.update(educationalResources)
      .set({
        title: req.body.title,
        slug: req.body.slug,
        content: req.body.content,
        contentMarkdown: req.body.contentMarkdown,
        resourceType: req.body.resourceType,
        featuredOrder: req.body.featuredOrder,
        isPublished: req.body.isPublished,
        updatedAt: new Date()
      })
      .where(eq(educationalResources.id, id))
      .returning();
      
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    
    return res.json(resource);
  } catch (error) {
    console.error('Error updating educational resource:', error);
    return res.status(500).json({ message: 'Failed to update educational resource' });
  }
});

// Create a new glossary term (admin only)
router.post('/admin/glossary', isAuthenticated, async (req, res) => {
  try {
    const [term] = await db.insert(glossaryTerms)
      .values({
        term: req.body.term,
        definition: req.body.definition,
        longDefinition: req.body.longDefinition,
        references: req.body.references,
        relatedTerms: req.body.relatedTerms || [],
      })
      .returning();
      
    return res.status(201).json(term);
  } catch (error) {
    console.error('Error creating glossary term:', error);
    return res.status(500).json({ message: 'Failed to create glossary term' });
  }
});

// Update a glossary term (admin only)
router.put('/admin/glossary/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const [term] = await db.update(glossaryTerms)
      .set({
        term: req.body.term,
        definition: req.body.definition,
        longDefinition: req.body.longDefinition,
        references: req.body.references,
        relatedTerms: req.body.relatedTerms,
        updatedAt: new Date()
      })
      .where(eq(glossaryTerms.id, id))
      .returning();
      
    if (!term) {
      return res.status(404).json({ message: 'Glossary term not found' });
    }
    
    return res.json(term);
  } catch (error) {
    console.error('Error updating glossary term:', error);
    return res.status(500).json({ message: 'Failed to update glossary term' });
  }
});

// Create a new FAQ item (admin only)
router.post('/admin/faqs', isAuthenticated, async (req, res) => {
  try {
    const [faq] = await db.insert(faqItems)
      .values({
        question: req.body.question,
        answer: req.body.answer,
        answerMarkdown: req.body.answerMarkdown,
        category: req.body.category,
        displayOrder: req.body.displayOrder || 0,
      })
      .returning();
      
    return res.status(201).json(faq);
  } catch (error) {
    console.error('Error creating FAQ item:', error);
    return res.status(500).json({ message: 'Failed to create FAQ item' });
  }
});

// Update an FAQ item (admin only)
router.put('/admin/faqs/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const [faq] = await db.update(faqItems)
      .set({
        question: req.body.question,
        answer: req.body.answer,
        answerMarkdown: req.body.answerMarkdown,
        category: req.body.category,
        displayOrder: req.body.displayOrder,
        updatedAt: new Date()
      })
      .where(eq(faqItems.id, id))
      .returning();
      
    if (!faq) {
      return res.status(404).json({ message: 'FAQ item not found' });
    }
    
    return res.json(faq);
  } catch (error) {
    console.error('Error updating FAQ item:', error);
    return res.status(500).json({ message: 'Failed to update FAQ item' });
  }
});

// Delete an educational resource (admin only)
router.delete('/admin/educational-resources/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    await db.delete(educationalResources)
      .where(eq(educationalResources.id, id));
      
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting educational resource:', error);
    return res.status(500).json({ message: 'Failed to delete educational resource' });
  }
});

// Delete a glossary term (admin only)
router.delete('/admin/glossary/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    await db.delete(glossaryTerms)
      .where(eq(glossaryTerms.id, id));
      
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting glossary term:', error);
    return res.status(500).json({ message: 'Failed to delete glossary term' });
  }
});

// Delete an FAQ item (admin only)
router.delete('/admin/faqs/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    await db.delete(faqItems)
      .where(eq(faqItems.id, id));
      
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting FAQ item:', error);
    return res.status(500).json({ message: 'Failed to delete FAQ item' });
  }
});

export default router;