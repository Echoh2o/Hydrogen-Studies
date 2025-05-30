import { optimizeDatabase, getDatabasePerformanceMetrics } from './database-optimizer';

async function runOptimization() {
  try {
    console.log('Starting database optimization...');
    const report = await optimizeDatabase();
    
    console.log('\n=== OPTIMIZATION REPORT ===');
    console.log('Performance Improvements:', report.performanceImprovements);
    console.log('Data Quality Fixes:', report.dataQualityFixes);
    console.log('Indexes Created:', report.indexesCreated);
    console.log('Storage Optimizations:', report.storageOptimizations);
    
    const metrics = await getDatabasePerformanceMetrics();
    console.log('\n=== PERFORMANCE METRICS ===');
    console.log(metrics);
    
  } catch (error) {
    console.error('Optimization failed:', error);
  }
}

runOptimization();