import { storage } from './storage';
import { db } from './db';
import { studies } from '@shared/schema';

// Sample study data
const sampleStudies = [
  {
    title: "Hydrogen gas improves survival rate and organ damage in a rat model of cardiac arrest",
    abstract: "This study evaluated the effects of hydrogen gas inhalation on survival and organ damage after cardiac arrest.",
    authors: "Johnson K, Smith AB, Chen ZJ, Williams R",
    journal: "Critical Care Medicine",
    publishDate: "2023-01-10",
    category: "Cardiovascular",
    doi: "10.1097/CCM.0000000123456",
    methods: "Rat model of cardiac arrest with hydrogen gas inhalation treatment",
    results: "Improved survival rates and reduced organ damage in hydrogen group",
    conclusion: "Hydrogen gas shows protective effects after cardiac arrest",
    url: "https://example.com/study2",
    peerReviewed: true,
    publishYear: 2023,
    healthCondition: "Cardiac arrest",
    intervention: "Hydrogen gas inhalation",
    population: "Rat model",
    viewCount: 87,
    sourceUrl: "https://example.com/source2",
    sourcePlatform: "ScienceDirect",
    imageUrl: "https://example.com/image2.jpg",
    simplifiedExplanation: "This study found that rats who inhaled hydrogen gas after cardiac arrest had better survival rates and less organ damage.",
    tags: [
      "cardiac arrest",
      "hydrogen inhalation",
      "organ protection",
      "survival rate"
    ]
  },
  {
    title: "Effects of hydrogen-rich water on exercise performance and recovery",
    abstract: "This randomized controlled trial investigated the effects of hydrogen-rich water consumption on exercise performance and recovery in athletes.",
    authors: "Miller P, Garcia T, Thompson E",
    journal: "Journal of Sports Science and Medicine",
    publishDate: "2022-09-22",
    category: "Sports Performance",
    doi: "10.10.5550/jssm.2022.456",
    methods: "Double-blind RCT with 30 athletes consuming either hydrogen-rich or placebo water for 2 weeks",
    results: "Improved recovery markers and reduced muscle soreness in hydrogen group",
    conclusion: "Hydrogen-rich water may enhance recovery after intensive exercise",
    url: "https://example.com/study3",
    peerReviewed: true,
    publishYear: 2022,
    healthCondition: "Exercise-induced muscle damage",
    intervention: "Hydrogen-rich water",
    population: "Athletes",
    viewCount: 235,
    sourceUrl: "https://example.com/source3",
    sourcePlatform: "SportsMed",
    imageUrl: "https://example.com/image3.jpg",
    videoUrl: "https://example.com/video3.mp4",
    simplifiedExplanation: "Athletes who drank hydrogen-rich water for two weeks showed better recovery and less muscle soreness after intense workouts compared to those drinking regular water.",
    tags: [
      "exercise",
      "recovery",
      "athletes",
      "hydrogen water",
      "muscle soreness"
    ]
  },
  {
    title: "Molecular hydrogen attenuates neuropathic pain in mice",
    abstract: "This study investigated the effects of molecular hydrogen on neuropathic pain in a mouse model.",
    authors: "Kawaguchi M, Satoh Y, Otsubo Y, Kazama T",
    journal: "Journal of Pain Research",
    publishDate: "2022-04-15",
    category: "Neurological",
    doi: "10.2147/JPR.S123528",
    methods: "Mouse model with sciatic nerve injury treated with hydrogen-rich water for 8 weeks",
    results: "Reduction in pain behavior and inflammatory markers in hydrogen group",
    conclusion: "Molecular hydrogen shows promise for treating neuropathic pain",
    url: "https://example.com/study1",
    peerReviewed: true,
    publishYear: 2022,
    healthCondition: "Neuropathic pain",
    intervention: "Hydrogen-rich water",
    population: "Mouse model",
    viewCount: 124,
    sourceUrl: "https://example.com/source1",
    sourcePlatform: "PubMed",
    simplifiedExplanation: "This research suggests that hydrogen water reduced pain in mice with nerve damage.",
    tags: [
      "neuropathic pain",
      "mouse model",
      "inflammation",
      "hydrogen water"
    ]
  }
];

// Initialize the database with sample data if it doesn't already have data
export async function initializeData() {
  try {
    // Check if database has studies
    const existingStudies = await db.select({ count: sql`count(*)` }).from(studies);
    const studyCount = Number(existingStudies[0]?.count || 0);
    
    console.log(`Found ${studyCount} existing studies in database`);
    
    // If there are no studies, insert the sample data
    if (studyCount === 0) {
      console.log('Adding sample studies to database...');
      
      // Insert each sample study
      for (const study of sampleStudies) {
        await storage.createStudy(study);
      }
      
      console.log('Sample data initialization complete');
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}