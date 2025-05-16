// Study interfaces
export interface Study {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  methods?: string;
  results?: string;
  conclusion?: string;
  doi?: string;
  pdfUrl?: string;
  citationUrl?: string;
  peerReviewed: boolean;
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
