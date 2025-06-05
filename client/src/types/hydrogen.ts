// Type definitions for hydrogen-specific data structures

export interface Benefit {
  id: number;
  name: string;
  slug: string;
  description: string;
  studyCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Demographic {
  id: number;
  name: string;
  slug: string;
  description: string;
  studyCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Mechanism {
  id: number;
  name: string;
  slug: string;
  description: string;
  studyCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryMethod {
  id: number;
  name: string;
  slug: string;
  description: string;
  studyCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Duration {
  id: number;
  name: string;
  slug: string;
  description: string;
  minDays?: number;
  maxDays?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudyOutcome {
  id: number;
  studyId: number;
  outcomeType: string;
  description: string;
  significance: 'positive' | 'negative' | 'neutral' | 'mixed';
  metrics?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Study {
  id: number;
  title: string;
  abstract: string;
  slug?: string;
  doi?: string;
  pmid?: string;
  authors?: string;
  journal?: string;
  publishDate: string;
  fullTextUrl?: string;
  pdfUrl?: string;
  imageUrl?: string;
  peerReviewed: boolean;
  studyType: 'human' | 'animal' | 'in vitro' | 'review' | 'meta-analysis' | 'other';
  sampleSize?: number;
  studyDesign?: string;
  fundingSource?: string;
  keywords?: string;
  conclusions?: string;
  limitations?: string;
  createdAt?: string;
  updatedAt?: string;
  benefits?: Benefit[];
  demographics?: Demographic[];
  mechanisms?: Mechanism[];
  deliveryMethods?: DeliveryMethod[];
  durations?: Duration[];
  outcomes?: StudyOutcome[];
}

export interface BenefitWithStudies {
  id: number;
  name: string;
  slug: string;
  description: string;
  studies: Study[];
}

export interface DemographicWithStudies {
  id: number;
  name: string;
  slug: string;
  description: string;
  studies: Study[];
}

export interface MechanismWithStudies {
  id: number;
  name: string;
  slug: string;
  description: string;
  studies: Study[];
}

export interface DeliveryMethodWithStudies {
  id: number;
  name: string;
  slug: string;
  description: string;
  studies: Study[];
}