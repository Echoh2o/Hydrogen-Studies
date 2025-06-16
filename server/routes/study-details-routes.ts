
import { Router } from 'express';
import { sql } from '../db';

const router = Router();

router.get('/studies/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    const studies = await sql`
      SELECT 
        id, title, abstract, authors, journal, 
        publish_date as "publishDate", category, doi, 
        image_url as "imageUrl", slug,
        plain_language_title as "plainLanguageTitle",
        plain_language_summary as "plainLanguageSummary",
        key_findings as "keyFindings",
        study_type as "studyType",
        participant_count as "participantCount",
        duration, dosage, delivery_method as "deliveryMethod",
        health_benefits as "healthBenefits",
        target_demographic as "targetDemographic",
        safety_notes as "safetyNotes"
      FROM studies 
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (studies.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const study = studies[0];
    
    // Convert participant_count to number if it exists
    if (study.participantCount) {
      study.participantCount = parseInt(study.participantCount);
    }

    res.json(study);
  } catch (error) {
    console.error('Error fetching study by slug:', error);
    res.status(500).json({ error: 'Failed to fetch study' });
  }
});

export default router;
