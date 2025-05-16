/**
 * Scraper manager for handling multiple platform scrapers
 * Provides a centralized way to run and manage all research scrapers
 */
import { HydrogenStudiesScraper } from './hydrogen-studies-scraper';
import { PubMedScraper } from './pubmed-scraper';
import { GoogleScholarScraper } from './google-scholar-scraper';

/**
 * Get all registered scrapers
 */
export function getAllScrapers() {
  return [
    new HydrogenStudiesScraper(),
    new PubMedScraper(),
    new GoogleScholarScraper()
  ];
}

/**
 * Run a specific scraper by name
 * @param scraperName Name of the scraper to run
 */
export async function runScraperByName(scraperName: string): Promise<{ 
  success: boolean; 
  message: string; 
  results?: { total: number; success: number } 
}> {
  try {
    const scrapers = getAllScrapers();
    const scraper = scrapers.find(s => s.source.name.toLowerCase() === scraperName.toLowerCase());
    
    if (!scraper) {
      return { 
        success: false, 
        message: `Scraper "${scraperName}" not found. Available scrapers: ${scrapers.map(s => s.source.name).join(', ')}` 
      };
    }
    
    if (!scraper.source.enabled) {
      return { 
        success: false, 
        message: `Scraper "${scraperName}" is currently disabled` 
      };
    }
    
    console.log(`Running scraper: ${scraperName}`);
    const results = await scraper.execute();
    
    return {
      success: true,
      message: `Successfully ran scraper "${scraperName}"`,
      results
    };
  } catch (err) {
    const error = err as Error;
    console.error(`Error running scraper "${scraperName}":`, error);
    return {
      success: false,
      message: `Error running scraper "${scraperName}": ${error.message}`
    };
  }
}

/**
 * Run all enabled scrapers
 */
export async function runAllScrapers(): Promise<{
  success: boolean;
  message: string;
  results: { name: string; success: boolean; message: string; results?: { total: number; success: number } }[]
}> {
  const scrapers = getAllScrapers().filter(s => s.source.enabled);
  const results = [];
  
  console.log(`Running all ${scrapers.length} enabled scrapers...`);
  
  for (const scraper of scrapers) {
    try {
      console.log(`Running scraper: ${scraper.source.name}`);
      const scraperResults = await scraper.execute();
      results.push({
        name: scraper.source.name,
        success: true,
        message: `Successfully ran scraper "${scraper.source.name}"`,
        results: scraperResults
      });
    } catch (err) {
      const error = err as Error;
      console.error(`Error running scraper "${scraper.source.name}":`, error);
      results.push({
        name: scraper.source.name,
        success: false,
        message: `Error: ${error.message}`
      });
    }
  }
  
  const allSuccessful = results.every(r => r.success);
  
  return {
    success: allSuccessful,
    message: allSuccessful ? 'All scrapers ran successfully' : 'Some scrapers failed to run',
    results
  };
}

/**
 * Get information about all available scrapers
 */
export function getScraperInfo(): {
  name: string;
  description: string;
  baseUrl: string;
  enabled: boolean;
}[] {
  return getAllScrapers().map(scraper => ({
    name: scraper.source.name,
    description: scraper.source.description,
    baseUrl: scraper.source.baseUrl,
    enabled: scraper.source.enabled
  }));
}