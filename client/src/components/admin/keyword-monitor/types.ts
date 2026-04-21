export interface Keyword {
  id: number;
  term: string;
  category: string;
  isActive: boolean;
  lastSearched?: string;
  createdAt: string;
  matchCount?: number;
}

export interface KeywordGroup {
  id: number;
  name: string;
  description?: string;
  keywords: Keyword[];
  isActive: boolean;
}

export interface ExcludedKeyword {
  id: number;
  term: string;
  reason: string;
}

export interface MonitorResult {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  doi: string;
  matchedKeywords: string[];
  status: "pending" | "approved" | "rejected" | "archived";
  source: string;
  foundAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}
