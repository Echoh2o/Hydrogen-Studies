/**
 * Content Enhancement Coordinator
 * 
 * Orchestrates all phases of content enhancement and provides unified progress monitoring
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

interface EnhancementProgress {
  phase: string;
  description: string;
  totalItems: number;
  completedItems: number;
  percentage: number;
  status: 'pending' | 'running' | 'completed';
  lastUpdate: Date;
}

interface OverallProgress {
  phases: EnhancementProgress[];
  overallCompletion: number;
  estimatedTimeRemaining?: string;
  nextPhase?: string;
}

/**
 * Get comprehensive progress across all enhancement phases
 */
export async function getOverallEnhancementProgress(): Promise<OverallProgress> {
  // Get current statistics from database
  const statsResult = await db.execute(sql`
    SELECT 
      COUNT(*) as total_studies,
      COUNT(CASE WHEN plain_language_title IS NOT NULL AND plain_language_title != '' THEN 1 END) as plain_titles_complete,
      COUNT(CASE WHEN methods_short IS NOT NULL AND methods_short != '' THEN 1 END) as methods_complete,
      COUNT(CASE WHEN results_short IS NOT NULL AND results_short != '' THEN 1 END) as results_complete,
      COUNT(CASE WHEN conclusion_short IS NOT NULL AND conclusion_short != '' THEN 1 END) as conclusions_complete,
      COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as images_complete,
      COUNT(CASE WHEN doi IS NOT NULL AND doi != '' THEN 1 END) as dois_complete,
      COUNT(CASE WHEN research_citations IS NOT NULL THEN 1 END) as citations_complete
    FROM studies
  `);

  const stats = statsResult.rows[0];
  const totalStudies = Number(stats.total_studies);

  const phases: EnhancementProgress[] = [
    {
      phase: 'Phase 1',
      description: 'SEO-Optimized Plain Language Titles',
      totalItems: totalStudies,
      completedItems: Number(stats.plain_titles_complete),
      percentage: Math.round((Number(stats.plain_titles_complete) / totalStudies) * 100),
      status: Number(stats.plain_titles_complete) === totalStudies ? 'completed' : 'running',
      lastUpdate: new Date()
    },
    {
      phase: 'Phase 2a',
      description: 'Consumer-Friendly Methods',
      totalItems: totalStudies,
      completedItems: Number(stats.methods_complete),
      percentage: Math.round((Number(stats.methods_complete) / totalStudies) * 100),
      status: Number(stats.methods_complete) === totalStudies ? 'completed' : 'running',
      lastUpdate: new Date()
    },
    {
      phase: 'Phase 2b',
      description: 'Consumer-Friendly Results',
      totalItems: totalStudies,
      completedItems: Number(stats.results_complete),
      percentage: Math.round((Number(stats.results_complete) / totalStudies) * 100),
      status: Number(stats.results_complete) === totalStudies ? 'completed' : 'running',
      lastUpdate: new Date()
    },
    {
      phase: 'Phase 2c',
      description: 'Consumer-Friendly Conclusions',
      totalItems: totalStudies,
      completedItems: Number(stats.conclusions_complete),
      percentage: Math.round((Number(stats.conclusions_complete) / totalStudies) * 100),
      status: Number(stats.conclusions_complete) === totalStudies ? 'completed' : 'running',
      lastUpdate: new Date()
    },
    {
      phase: 'Phase 3',
      description: 'AI-Generated Study Images',
      totalItems: totalStudies,
      completedItems: Number(stats.images_complete),
      percentage: Math.round((Number(stats.images_complete) / totalStudies) * 100),
      status: Number(stats.images_complete) === totalStudies ? 'completed' : 'pending',
      lastUpdate: new Date()
    },
    {
      phase: 'Research Enrichment',
      description: 'Academic Citations and Links',
      totalItems: totalStudies,
      completedItems: Number(stats.citations_complete),
      percentage: Math.round((Number(stats.citations_complete) / totalStudies) * 100),
      status: Number(stats.citations_complete) === totalStudies ? 'completed' : 'running',
      lastUpdate: new Date()
    }
  ];

  // Calculate overall completion
  const totalPossibleItems = phases.reduce((sum, phase) => sum + phase.totalItems, 0);
  const totalCompletedItems = phases.reduce((sum, phase) => sum + phase.completedItems, 0);
  const overallCompletion = Math.round((totalCompletedItems / totalPossibleItems) * 100);

  // Determine next phase
  const nextPhase = phases.find(phase => phase.status === 'pending')?.phase;

  return {
    phases,
    overallCompletion,
    nextPhase
  };
}

/**
 * Get detailed statistics for content quality assessment
 */
export async function getContentQualityMetrics() {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_studies,
      -- Content completeness
      COUNT(CASE WHEN abstract IS NOT NULL AND abstract != '' THEN 1 END) as with_abstract,
      COUNT(CASE WHEN methods IS NOT NULL AND methods != '' THEN 1 END) as with_methods,
      COUNT(CASE WHEN results IS NOT NULL AND results != '' THEN 1 END) as with_results,
      COUNT(CASE WHEN conclusion IS NOT NULL AND conclusion != '' THEN 1 END) as with_conclusion,
      
      -- Consumer accessibility
      COUNT(CASE WHEN plain_language_title IS NOT NULL AND plain_language_title != '' THEN 1 END) as with_plain_titles,
      COUNT(CASE WHEN methods_short IS NOT NULL AND methods_short != '' THEN 1 END) as with_digestible_methods,
      COUNT(CASE WHEN results_short IS NOT NULL AND results_short != '' THEN 1 END) as with_digestible_results,
      COUNT(CASE WHEN conclusion_short IS NOT NULL AND conclusion_short != '' THEN 1 END) as with_digestible_conclusions,
      
      -- Visual content
      COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_images,
      
      -- Research data
      COUNT(CASE WHEN doi IS NOT NULL AND doi != '' THEN 1 END) as with_doi,
      COUNT(CASE WHEN research_citations IS NOT NULL THEN 1 END) as with_citations,
      COUNT(CASE WHEN research_sources IS NOT NULL THEN 1 END) as with_sources,
      COUNT(CASE WHEN pdf_link IS NOT NULL AND pdf_link != '' THEN 1 END) as with_pdf_links
    FROM studies
  `);

  return result.rows[0];
}

/**
 * Identify priority areas needing the most improvement
 */
export async function getPriorityAreas() {
  const metrics = await getContentQualityMetrics();
  const totalStudies = Number(metrics.total_studies);

  const areas = [
    {
      area: 'Consumer-Friendly Conclusions',
      current: Number(metrics.with_digestible_conclusions),
      percentage: Math.round((Number(metrics.with_digestible_conclusions) / totalStudies) * 100),
      gap: totalStudies - Number(metrics.with_digestible_conclusions),
      priority: 'critical'
    },
    {
      area: 'Consumer-Friendly Methods',
      current: Number(metrics.with_digestible_methods),
      percentage: Math.round((Number(metrics.with_digestible_methods) / totalStudies) * 100),
      gap: totalStudies - Number(metrics.with_digestible_methods),
      priority: 'high'
    },
    {
      area: 'Consumer-Friendly Results',
      current: Number(metrics.with_digestible_results),
      percentage: Math.round((Number(metrics.with_digestible_results) / totalStudies) * 100),
      gap: totalStudies - Number(metrics.with_digestible_results),
      priority: 'high'
    },
    {
      area: 'AI-Generated Images',
      current: Number(metrics.with_images),
      percentage: Math.round((Number(metrics.with_images) / totalStudies) * 100),
      gap: totalStudies - Number(metrics.with_images),
      priority: 'medium'
    },
    {
      area: 'SEO Plain Language Titles',
      current: Number(metrics.with_plain_titles),
      percentage: Math.round((Number(metrics.with_plain_titles) / totalStudies) * 100),
      gap: totalStudies - Number(metrics.with_plain_titles),
      priority: 'medium'
    }
  ];

  // Sort by gap size (highest priority first)
  return areas.sort((a, b) => b.gap - a.gap);
}

/**
 * Check if a phase is ready to start
 */
export async function checkPhaseReadiness(phase: string): Promise<boolean> {
  const progress = await getOverallEnhancementProgress();
  
  switch (phase) {
    case 'Phase 3': // Visual Enhancement
      // Start when Phase 1 is mostly complete (>80%) and Phase 2 is progressing
      const phase1 = progress.phases.find(p => p.phase === 'Phase 1');
      return phase1 ? phase1.percentage > 80 : false;
      
    case 'Phase 4': // Meta Enhancement
      // Start when Phase 2 and 3 are mostly complete
      const phase2a = progress.phases.find(p => p.phase === 'Phase 2a');
      const phase2b = progress.phases.find(p => p.phase === 'Phase 2b');
      const phase3 = progress.phases.find(p => p.phase === 'Phase 3');
      return (phase2a?.percentage || 0) > 80 && 
             (phase2b?.percentage || 0) > 80 && 
             (phase3?.percentage || 0) > 80;
             
    default:
      return false;
  }
}

/**
 * Generate a comprehensive enhancement report
 */
export async function generateEnhancementReport() {
  const progress = await getOverallEnhancementProgress();
  const priorities = await getPriorityAreas();
  const metrics = await getContentQualityMetrics();
  
  return {
    summary: {
      totalStudies: Number(metrics.total_studies),
      overallCompletion: progress.overallCompletion,
      phasesComplete: progress.phases.filter(p => p.status === 'completed').length,
      phasesRunning: progress.phases.filter(p => p.status === 'running').length,
      nextPhase: progress.nextPhase
    },
    phases: progress.phases,
    priorityAreas: priorities,
    recommendations: generateRecommendations(priorities, progress)
  };
}

function generateRecommendations(priorities: any[], progress: any) {
  const recommendations = [];
  
  // Focus on biggest gaps first
  const criticalAreas = priorities.filter(p => p.priority === 'critical');
  if (criticalAreas.length > 0) {
    recommendations.push(`Priority: Address ${criticalAreas[0].area} (only ${criticalAreas[0].percentage}% complete)`);
  }
  
  // Suggest next phase if ready
  const readyForPhase3 = progress.phases.find((p: any) => p.phase === 'Phase 1')?.percentage > 80;
  if (readyForPhase3) {
    recommendations.push('Ready to start Phase 3: Visual Enhancement');
  }
  
  return recommendations;
}