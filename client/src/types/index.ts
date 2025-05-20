// Study interfaces
export interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  journalPublishDate?: string | null;
  category: string;
  methods?: string | null;
  results?: string | null;
  conclusion?: string | null;
  doi?: string | null;
  pdfUrl?: string | null;
  citationUrl?: string | null;
  peerReviewed: boolean;
  imageUrl?: string | null;
  imageAlt?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  publishYear?: number | null;
  simplifiedExplanation?: string | null;
  tags?: string[];
  createdAt?: string | Date;
  viewCount?: number;
  citationCount?: number;
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
}

// Category interfaces
export interface Category {
  id: string;
  name: string;
  description: string;
  studyCount: number;
  icon?: string; // SVG path data
}

// Newsletter subscription
export interface NewsletterSubscription {
  email: string;
  createdAt: string;
}
