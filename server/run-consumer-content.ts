/**
 * Direct Consumer Content Generation Script
 * 
 * Generates consumer-friendly explanations for studies that need them
 */

import { generateAllConsumerContent, getConsumerContentCoverage } from './consumer-content-generator';

async function main() {
  try {
    console.log("Starting consumer content generation process...");
    
    // Check current status
    const initialStats = await getConsumerContentCoverage();
    console.log("\nCurrent Coverage:");
    console.log(`- Methods: ${initialStats.withMethods}/${initialStats.totalStudies} (${initialStats.methodsPercentage}%)`);
    console.log(`- Results: ${initialStats.withResults}/${initialStats.totalStudies} (${initialStats.resultsPercentage}%)`);
    console.log(`- Conclusions: ${initialStats.withConclusions}/${initialStats.totalStudies} (${initialStats.conclusionsPercentage}%)`);
    
    // Generate consumer content
    const results = await generateAllConsumerContent();
    
    // Check final status
    const finalStats = await getConsumerContentCoverage();
    console.log("\nFinal Coverage:");
    console.log(`- Methods: ${finalStats.withMethods}/${finalStats.totalStudies} (${finalStats.methodsPercentage}%)`);
    console.log(`- Results: ${finalStats.withResults}/${finalStats.totalStudies} (${finalStats.resultsPercentage}%)`);
    console.log(`- Conclusions: ${finalStats.withConclusions}/${finalStats.totalStudies} (${finalStats.conclusionsPercentage}%)`);
    
    console.log("\nConsumer content generation completed successfully!");
    
  } catch (error) {
    console.error("Error in consumer content generation:", error);
  }
}

main();