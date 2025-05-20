import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  studies,
  bodySystems,
  healthConditions,
  studyHealthConditions
} from '@shared/schema';
import { 
  benefits, 
  studyBenefits,
  demographics, 
  studyDemographics,
  mechanisms, 
  studyMechanisms,
  deliveryMethods, 
  studyDeliveryMethods,
  durationCategories,
  studyDurations
} from '@shared/schema-hydrogen-fields';
import { eq, and, or, like, ilike, between, inArray, sql, isNull } from 'drizzle-orm';

const router = Router();

/**
 * Advanced search functionality
 * Supports searching by:
 * - Full text (query parameter)
 * - Benefits
 * - Demographics
 * - Mechanisms
 * - Delivery methods
 * - Health conditions
 * - Body systems
 * - Year range
 * - Peer review status
 * - Full text availability
 * - Study outcome
 * - Study type
 * - Advanced options for search within methods, results, etc.
 */
router.get('/api/advanced-search', async (req: Request, res: Response) => {
  try {
    const {
      query,
      benefit,
      demographic,
      mechanism,
      deliveryMethod,
      healthCondition,
      bodySystem,
      yearFrom,
      yearTo,
      peerReviewed,
      hasFullText,
      outcome,
      studyType,
      searchInMethods,
      searchInResults,
      searchInConclusion,
      searchInSimplified,
      useFuzzyMatch,
      excludeTerms,
      page = '1',
      pageSize = '20',
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    console.log('Advanced search query parameters:', req.query);

    // Parse numeric parameters
    const parsedPage = parseInt(page as string, 10) || 1;
    const parsedPageSize = parseInt(pageSize as string, 10) || 20;
    const offset = (parsedPage - 1) * parsedPageSize;

    // Parse array parameters
    const benefitIds = benefit ? (benefit as string).split(',') : [];
    const demographicIds = demographic ? (demographic as string).split(',') : [];
    const mechanismIds = mechanism ? (mechanism as string).split(',') : [];
    const deliveryMethodIds = deliveryMethod ? (deliveryMethod as string).split(',') : [];
    const healthConditionIds = healthCondition ? (healthCondition as string).split(',') : [];
    const bodySystemIds = bodySystem ? (bodySystem as string).split(',') : [];
    
    // Parse year range
    const parsedYearFrom = yearFrom ? parseInt(yearFrom as string, 10) : null;
    const parsedYearTo = yearTo ? parseInt(yearTo as string, 10) : null;
    
    // Parse boolean parameters
    const parsedPeerReviewed = peerReviewed === 'true';
    const parsedHasFullText = hasFullText === 'true';
    const parsedSearchInMethods = searchInMethods !== 'false'; // default to true
    const parsedSearchInResults = searchInResults !== 'false'; // default to true
    const parsedSearchInConclusion = searchInConclusion !== 'false'; // default to true
    const parsedSearchInSimplified = searchInSimplified !== 'false'; // default to true
    const parsedUseFuzzyMatch = useFuzzyMatch === 'true';
    
    // Parse exclude terms
    const excludeTermsList = excludeTerms ? (excludeTerms as string).split(',').map(term => term.trim()) : [];

    // Generate the where clause for the query
    let whereConditions = [];
    
    // Text search
    if (query) {
      const searchQuery = query as string;
      const textConditions = [];
      
      // Always search in title and abstract
      textConditions.push(ilike(studies.title, `%${searchQuery}%`));
      textConditions.push(ilike(studies.abstract, `%${searchQuery}%`));
      
      // Conditional searching in other sections
      if (parsedSearchInMethods) {
        textConditions.push(and(
          sql`${studies.methods} IS NOT NULL`,
          ilike(studies.methods, `%${searchQuery}%`)
        ));
      }
      
      if (parsedSearchInResults) {
        textConditions.push(and(
          sql`${studies.results} IS NOT NULL`,
          ilike(studies.results, `%${searchQuery}%`)
        ));
      }
      
      if (parsedSearchInConclusion) {
        textConditions.push(and(
          sql`${studies.conclusion} IS NOT NULL`,
          ilike(studies.conclusion, `%${searchQuery}%`)
        ));
      }
      
      if (parsedSearchInSimplified) {
        textConditions.push(and(
          sql`${studies.simplifiedExplanation} IS NOT NULL`,
          ilike(studies.simplifiedExplanation, `%${searchQuery}%`)
        ));
      }
      
      whereConditions.push(or(...textConditions));
      
      // Exclude terms
      for (const term of excludeTermsList) {
        if (term) {
          whereConditions.push(
            and(
              sql`${studies.title} NOT ILIKE ${'%' + term + '%'}`,
              sql`${studies.abstract} NOT ILIKE ${'%' + term + '%'}`,
              sql`${studies.methods} NOT ILIKE ${'%' + term + '%'} OR ${studies.methods} IS NULL`,
              sql`${studies.results} NOT ILIKE ${'%' + term + '%'} OR ${studies.results} IS NULL`,
              sql`${studies.conclusion} NOT ILIKE ${'%' + term + '%'} OR ${studies.conclusion} IS NULL`,
              sql`${studies.simplifiedExplanation} NOT ILIKE ${'%' + term + '%'} OR ${studies.simplifiedExplanation} IS NULL`
            )
          );
        }
      }
    }
    
    // Year range
    if (parsedYearFrom) {
      whereConditions.push(sql`${studies.publishYear} >= ${parsedYearFrom}`);
    }
    
    if (parsedYearTo) {
      whereConditions.push(sql`${studies.publishYear} <= ${parsedYearTo}`);
    }
    
    // Peer reviewed
    if (parsedPeerReviewed) {
      whereConditions.push(eq(studies.peerReviewed, true));
    }
    
    // Has full text
    if (parsedHasFullText) {
      whereConditions.push(eq(studies.hasFullText, true));
    }
    
    // Study type
    if (studyType) {
      whereConditions.push(eq(studies.studyType, studyType as string));
    }
    
    // Outcome
    if (outcome) {
      whereConditions.push(eq(studies.outcome, outcome as string));
    }

    // Build our query based on the search parameters
    let studyQuery = db.select().from(studies);
    
    // If we have any where conditions, apply them
    if (whereConditions.length > 0) {
      studyQuery = studyQuery.where(and(...whereConditions));
    }
    
    // Benefit filter (requires JOIN if specified)
    if (benefitIds.length > 0) {
      studyQuery = db
        .select({
          study: studies
        })
        .from(studies)
        .innerJoin(
          studyBenefits,
          eq(studies.id, studyBenefits.studyId)
        )
        .where(
          inArray(studyBenefits.benefitId, benefitIds.map(id => parseInt(id, 10)))
        )
        .groupBy(studies.id);
    }
    
    // Demographic filter (requires JOIN if specified)
    if (demographicIds.length > 0) {
      studyQuery = db
        .select({
          study: studies
        })
        .from(studies)
        .innerJoin(
          studyDemographics,
          eq(studies.id, studyDemographics.studyId)
        )
        .where(
          inArray(studyDemographics.demographicId, demographicIds.map(id => parseInt(id, 10)))
        )
        .groupBy(studies.id);
    }
    
    // Mechanism filter (requires JOIN if specified)
    if (mechanismIds.length > 0) {
      studyQuery = db
        .select({
          study: studies
        })
        .from(studies)
        .innerJoin(
          studyMechanisms,
          eq(studies.id, studyMechanisms.studyId)
        )
        .where(
          inArray(studyMechanisms.mechanismId, mechanismIds.map(id => parseInt(id, 10)))
        )
        .groupBy(studies.id);
    }
    
    // Delivery method filter (requires JOIN if specified)
    if (deliveryMethodIds.length > 0) {
      studyQuery = db
        .select({
          study: studies
        })
        .from(studies)
        .innerJoin(
          studyDeliveryMethods,
          eq(studies.id, studyDeliveryMethods.studyId)
        )
        .where(
          inArray(studyDeliveryMethods.deliveryMethodId, deliveryMethodIds.map(id => parseInt(id, 10)))
        )
        .groupBy(studies.id);
    }
    
    // Health condition filter (requires JOIN if specified)
    if (healthConditionIds.length > 0) {
      studyQuery = db
        .select({
          study: studies
        })
        .from(studies)
        .innerJoin(
          studyHealthConditions,
          eq(studies.id, studyHealthConditions.studyId)
        )
        .where(
          inArray(studyHealthConditions.healthConditionId, healthConditionIds.map(id => parseInt(id, 10)))
        )
        .groupBy(studies.id);
    }
    
    // Sorting logic
    let orderByClause;
    
    switch (sortBy as string) {
      case 'date':
        orderByClause = sortOrder === 'asc' 
          ? sql`${studies.publishDate} ASC` 
          : sql`${studies.publishDate} DESC`;
        break;
      case 'title':
        orderByClause = sortOrder === 'asc' 
          ? sql`${studies.title} ASC` 
          : sql`${studies.title} DESC`;
        break;
      case 'views':
        orderByClause = sortOrder === 'asc' 
          ? sql`${studies.viewCount} ASC` 
          : sql`${studies.viewCount} DESC`;
        break;
      case 'citations':
        orderByClause = sortOrder === 'asc' 
          ? sql`${studies.citationCount} ASC` 
          : sql`${studies.citationCount} DESC`;
        break;
      default:
        orderByClause = sql`${studies.publishDate} DESC`;
        break;
    }
    
    // Add ordering
    studyQuery = studyQuery.orderBy(orderByClause);
    
    // Get count for pagination
    const countQuery = db.select({ count: sql`count(*)` }).from(studies);
    
    // If we have any where conditions, apply them to the count query too
    if (whereConditions.length > 0) {
      countQuery.where(and(...whereConditions));
    }
    
    // Execute the count query
    const [countResult] = await countQuery;
    const total = Number(countResult?.count || 0);
    
    // Add pagination
    studyQuery = studyQuery.limit(parsedPageSize).offset(offset);
    
    // Execute the query
    const results = await studyQuery;
    
    // If we have nested results (from joins), extract them
    const studies = results.map(result => {
      // Check if we have a nested result structure (from JOINs)
      if (result && 'study' in result) {
        return result.study;
      }
      return result;
    });
    
    // Send the response
    res.json({
      data: studies,
      pagination: {
        total,
        page: parsedPage,
        pageSize: parsedPageSize,
        pageCount: Math.ceil(total / parsedPageSize)
      }
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ 
      error: 'Failed to execute search', 
      details: error.message
    });
  }
});

/**
 * Get available filter options for the search form
 * Returns counts of studies by different filter criteria
 */
router.get('/api/search/filters', async (req: Request, res: Response) => {
  try {
    // Get all benefits with study counts
    const benefitsWithCounts = await db.select().from(benefits).orderBy(benefits.displayOrder);
    
    // Get all demographics with study counts
    const demographicsWithCounts = await db.select().from(demographics).orderBy(demographics.displayOrder);
    
    // Get all mechanisms with study counts
    const mechanismsWithCounts = await db.select().from(mechanisms).orderBy(mechanisms.displayOrder);
    
    // Get all delivery methods with study counts
    const deliveryMethodsWithCounts = await db.select().from(deliveryMethods).orderBy(deliveryMethods.displayOrder);
    
    // Get health conditions
    const healthConditionsWithCounts = await db.select().from(healthConditions);
    
    // Get body systems
    const bodySystemsWithCounts = await db.select().from(bodySystems);
    
    // Get study types with counts
    const studyTypesQuery = await db
      .select({
        type: studies.studyType,
        count: sql`count(*)`
      })
      .from(studies)
      .where(sql`${studies.studyType} IS NOT NULL`)
      .groupBy(studies.studyType);
    
    // Get outcome types with counts
    const outcomeTypesQuery = await db
      .select({
        outcome: studies.outcome,
        count: sql`count(*)`
      })
      .from(studies)
      .where(sql`${studies.outcome} IS NOT NULL`)
      .groupBy(studies.outcome);
    
    // Get year range
    const yearRangeQuery = await db
      .select({
        min: sql`min(${studies.publishYear})`,
        max: sql`max(${studies.publishYear})`
      })
      .from(studies)
      .where(sql`${studies.publishYear} IS NOT NULL`);
    
    const [yearRange] = yearRangeQuery;
    
    // Get peer reviewed stats
    const peerReviewedQuery = await db
      .select({
        peerReviewed: studies.peerReviewed,
        count: sql`count(*)`
      })
      .from(studies)
      .groupBy(studies.peerReviewed);
    
    // Get full text stats
    const fullTextQuery = await db
      .select({
        hasFullText: studies.hasFullText,
        count: sql`count(*)`
      })
      .from(studies)
      .groupBy(studies.hasFullText);
    
    res.json({
      benefits: benefitsWithCounts,
      demographics: demographicsWithCounts,
      mechanisms: mechanismsWithCounts,
      deliveryMethods: deliveryMethodsWithCounts,
      healthConditions: healthConditionsWithCounts,
      bodySystems: bodySystemsWithCounts,
      studyTypes: studyTypesQuery,
      outcomeTypes: outcomeTypesQuery,
      yearRange,
      peerReviewedStats: peerReviewedQuery,
      fullTextStats: fullTextQuery
    });
  } catch (error) {
    console.error('Error fetching search filters:', error);
    res.status(500).json({ error: 'Failed to fetch search filters' });
  }
});

// Export the router
export default router;