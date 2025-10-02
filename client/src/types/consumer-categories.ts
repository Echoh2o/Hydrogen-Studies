export enum CategorizationModel {
  CONDITION = "condition",
  BODY_SYSTEM = "body_system",
  LIFE_STAGE = "life_stage",
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface ConsumerCategoriesResponse {
  success: boolean;
  data: {
    condition: CategoryCount[];
    body_system: CategoryCount[];
    life_stage: CategoryCount[];
  };
}

export interface StudyByCategory {
  id: number;
  title: string;
  abstract: string;
  publishDate: string;
  journal: string;
  doi: string | null;
  fullText: string | null;
  methods: string | null;
  results: string | null;
  conclusions: string | null;
  imageUrl: string | null;
}

export interface StudiesByCategoryResponse {
  success: boolean;
  data: StudyByCategory[];
}
