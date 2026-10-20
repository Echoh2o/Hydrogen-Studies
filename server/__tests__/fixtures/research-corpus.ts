/** Raw `studies` rows (as getCorpus selects them) shared by the research-query and MCP tests. */
export const CORPUS_ROWS = [
  {
    id: 1, slug: "h2-water-bp-rct", title: "Hydrogen water lowers blood pressure", publish_year: 2021, journal: "J Hypertension",
    country: "Japan", study_design: "rct", study_type: "Human", is_human_trial: true, h2_delivery_method: "drinking_water",
    outcome: "positive", sample_size: 40, duration: 56, health_conditions: ["Blood Pressure"], key_finding: "Systolic BP fell 5 mmHg.",
    doi: "10.1000/bp.1", quality_score: 82,
  },
  {
    id: 2, slug: "h2-inhalation-bp", title: "Inhaled hydrogen and blood pressure", publish_year: 2019, journal: "Clin Exp",
    country: "China", study_design: null, study_type: "Human", is_human_trial: true, h2_delivery_method: "Gas",
    outcome: "Neutral", sample_size: 20, duration: 14, health_conditions: ["Blood Pressure"], key_finding: "No change in BP.",
    doi: null, quality_score: 60,
  },
  {
    id: 3, slug: "h2-rat-hypertension", title: "Hydrogen gas in hypertensive rats", publish_year: 2015, journal: "Lab Anim",
    country: "China", study_design: null, study_type: "Rat", is_human_trial: false, h2_delivery_method: "Gas (Sustained Release)",
    outcome: "Positive", sample_size: 30, duration: 28, health_conditions: ["Blood Pressure"], key_finding: "Lower BP in rats.",
    doi: "10.1000/rat.3", quality_score: 55,
  },
  {
    id: 4, slug: "h2-cells", title: "Hydrogen-rich medium protects endothelial cells", publish_year: 2012, journal: "Cell Biol",
    country: "Japan", study_design: null, study_type: "Cell Culture", is_human_trial: false, h2_delivery_method: "Medium (Dissolved)",
    outcome: "Positive", sample_size: null, duration: 1, health_conditions: ["Cardiovascular"], key_finding: "Less ROS.",
    doi: "10.1000/cell.4", quality_score: 40,
  },
  {
    id: 5, slug: "h2-review", title: "Molecular hydrogen: a review", publish_year: 2023, journal: "Rev Med",
    country: null, study_design: "review", study_type: "clinical", is_human_trial: false, h2_delivery_method: "mixed",
    outcome: null, sample_size: null, duration: null, health_conditions: ["Blood Pressure", "Fatigue"], key_finding: "Promising but early.",
    doi: "10.1000/rev.5", quality_score: 30,
  },
  {
    id: 6, slug: "h2-fatigue-rct", title: "Hydrogen inhalation reduces fatigue", publish_year: 2024, journal: "Sports Med",
    country: "USA", study_design: "rct", study_type: "Human", is_human_trial: true, h2_delivery_method: "inhalation",
    outcome: "positive", sample_size: 60, duration: 7, health_conditions: ["Fatigue"], key_finding: "Less perceived fatigue.",
    doi: "10.1000/fat.6", quality_score: 75,
  },
];

export const CONDITION_ROWS = [
  { slug: "blood-pressure", name: "Blood Pressure", description: null, study_count: 3 },
  { slug: "chronic-fatigue", name: "Fatigue", description: null, study_count: 2 },
];

/** Which corpus ids each condition hub matches (stands in for conditionHubWhere). */
export const CONDITION_IDS: Record<string, number[]> = {
  "blood-pressure": [1, 2, 3, 5],
  "chronic-fatigue": [5, 6],
};

export const LONG_ABSTRACT = "Background: ".concat("Hydrogen-rich water was given to adults with high blood pressure. ".repeat(20));
