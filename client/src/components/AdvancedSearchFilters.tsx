import { useState, useEffect, useRef } from "react";
import { Search, Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchFilters {
  query: string;
  healthBenefits: string[];
  healthConditions: string[];
  bodySystems: string[];
  lifeStages: string[];
  studyTypes: string[];
  mechanisms: string[];
  yearFrom: string;
  yearTo: string;
  category: string;
  aiEnhanced: boolean | null;
  readingLevel: string;
  sortBy: string;
}

interface AdvancedSearchFiltersProps {
  onFiltersChange: (filters: SearchFilters) => void;
  totalResults?: number;
}

export function AdvancedSearchFilters({
  onFiltersChange,
  totalResults,
}: AdvancedSearchFiltersProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    healthBenefits: [],
    healthConditions: [],
    bodySystems: [],
    lifeStages: [],
    studyTypes: [],
    mechanisms: [],
    yearFrom: "",
    yearTo: "",
    category: "all",
    aiEnhanced: null,
    readingLevel: "all",
    sortBy: "relevance",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterCategories, setFilterCategories] = useState({
    healthBenefits: [],
    healthConditions: [],
    bodySystems: [],
    lifeStages: [],
    studyTypes: [],
    mechanisms: [],
  });

  // Pre-defined filter options based on hydrogen research
  const filterOptions = {
    healthBenefits: [
      "Antioxidant Effects",
      "Anti-inflammatory",
      "Neuroprotection",
      "Cardioprotection",
      "Improved Recovery",
      "Enhanced Performance",
      "Reduced Oxidative Stress",
      "Cell Protection",
      "Energy Metabolism",
      "Immune Support",
    ],
    healthConditions: [
      "Diabetes",
      "Cardiovascular Disease",
      "Neurodegenerative Disease",
      "Cancer",
      "Kidney Disease",
      "Liver Disease",
      "Metabolic Syndrome",
      "Hypertension",
      "Cognitive Decline",
      "Athletic Performance",
      "Chronic Fatigue",
      "Inflammation",
    ],
    bodySystems: [
      "Cardiovascular",
      "Nervous",
      "Respiratory",
      "Digestive",
      "Immune",
      "Musculoskeletal",
      "Endocrine",
      "Renal",
      "Hepatic",
      "Integumentary",
    ],
    lifeStages: [
      "Elderly",
      "Adults",
      "Athletes",
      "Children",
      "Pregnant Women",
      "Post-menopausal",
      "Active Adults",
      "Sedentary Population",
    ],
    studyTypes: [
      "Human Clinical Trial",
      "Animal Study",
      "In Vitro Study",
      "Randomized Controlled Trial",
      "Observational Study",
      "Case Study",
      "Systematic Review",
      "Meta-analysis",
    ],
    mechanisms: [
      "Selective Antioxidant",
      "Gene Expression",
      "Signal Modulation",
      "Enzymatic Activity",
      "Membrane Protection",
      "Mitochondrial Function",
      "Inflammatory Pathways",
      "Oxidative Balance",
      "Cellular Signaling",
    ],
  };

  const readingLevels = [
    { value: "beginner", label: "Beginner Friendly" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Scientific Level" },
    { value: "expert", label: "Expert/Research" },
  ];

  const sortOptions = [
    { value: "relevance", label: "Most Relevant" },
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "title", label: "Title A-Z" },
    { value: "popularity", label: "Most Popular" },
    { value: "rating", label: "Highest Rated" },
  ];

  const onFiltersChangeRef = useRef(onFiltersChange);
  onFiltersChangeRef.current = onFiltersChange;

  useEffect(() => {
    onFiltersChangeRef.current(filters);
  }, [filters]);

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const addArrayFilter = (
    category: keyof typeof filterOptions,
    value: string,
  ) => {
    setFilters((prev) => ({
      ...prev,
      [category]: [...prev[category], value],
    }));
  };

  const removeArrayFilter = (
    category: keyof typeof filterOptions,
    value: string,
  ) => {
    setFilters((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item !== value),
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      query: "",
      healthBenefits: [],
      healthConditions: [],
      bodySystems: [],
      lifeStages: [],
      studyTypes: [],
      mechanisms: [],
      yearFrom: "",
      yearTo: "",
      category: "all",
      aiEnhanced: null,
      readingLevel: "all",
      sortBy: "relevance",
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.query) count++;
    count += filters.healthBenefits.length;
    count += filters.healthConditions.length;
    count += filters.bodySystems.length;
    count += filters.lifeStages.length;
    count += filters.studyTypes.length;
    count += filters.mechanisms.length;
    if (filters.yearFrom || filters.yearTo) count++;
    if (filters.category && filters.category !== "all") count++;
    if (filters.aiEnhanced !== null) count++;
    if (filters.readingLevel && filters.readingLevel !== "all") count++;
    return count;
  };

  const FilterSection = ({
    title,
    category,
    options,
  }: {
    title: string;
    category: keyof typeof filterOptions;
    options: string[];
  }) => (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 rounded-lg">
        <span className="font-medium text-gray-700">{title}</span>
        <div className="flex items-center gap-2">
          {filters[category].length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {filters[category].length}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {options.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={`${category}-${option}`}
                checked={filters[category].includes(option)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    addArrayFilter(category, option);
                  } else {
                    removeArrayFilter(category, option);
                  }
                }}
              />
              <label
                htmlFor={`${category}-${option}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {option}
              </label>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Main Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search hydrogen research studies..."
              value={filters.query}
              onChange={(e) => updateFilter("query", e.target.value)}
              className="pl-10 pr-4 py-2 text-lg"
            />
          </div>

          {/* Quick Filters & Results */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant={showAdvanced ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Advanced Filters
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </Button>

              {getActiveFilterCount() > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear All
                </Button>
              )}
            </div>

            {totalResults !== undefined && (
              <div className="text-sm text-gray-600">
                {totalResults.toLocaleString()} studies found
              </div>
            )}
          </div>

          {/* Active Filter Tags */}
          {getActiveFilterCount() > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.query && (
                <Badge variant="default" className="flex items-center gap-1">
                  "{filters.query}"
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updateFilter("query", "")}
                  />
                </Badge>
              )}

              {Object.entries(filterOptions).map(([category, options]) =>
                filters[category as keyof typeof filterOptions].map(
                  (value: string) => (
                    <Badge
                      key={`${category}-${value}`}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {value}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() =>
                          removeArrayFilter(
                            category as keyof typeof filterOptions,
                            value,
                          )
                        }
                      />
                    </Badge>
                  ),
                ),
              )}
            </div>
          )}

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t">
              {/* Filter Categories */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">
                  Research Categories
                </h3>

                <FilterSection
                  title="Health Benefits"
                  category="healthBenefits"
                  options={filterOptions.healthBenefits}
                />

                <FilterSection
                  title="Health Conditions"
                  category="healthConditions"
                  options={filterOptions.healthConditions}
                />

                <FilterSection
                  title="Body Systems"
                  category="bodySystems"
                  options={filterOptions.bodySystems}
                />

                <FilterSection
                  title="Life Stages"
                  category="lifeStages"
                  options={filterOptions.lifeStages}
                />

                <FilterSection
                  title="Study Types"
                  category="studyTypes"
                  options={filterOptions.studyTypes}
                />

                <FilterSection
                  title="Mechanisms"
                  category="mechanisms"
                  options={filterOptions.mechanisms}
                />
              </div>

              {/* Additional Filters */}
              <div className="space-y-6">
                <h3 className="font-semibold text-gray-900">
                  Additional Filters
                </h3>

                {/* Publication Year Range */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Publication Year
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="From year"
                      value={filters.yearFrom}
                      onChange={(e) => updateFilter("yearFrom", e.target.value)}
                      type="number"
                      min="1990"
                      max="2024"
                    />
                    <Input
                      placeholder="To year"
                      value={filters.yearTo}
                      onChange={(e) => updateFilter("yearTo", e.target.value)}
                      type="number"
                      min="1990"
                      max="2024"
                    />
                  </div>
                </div>

                {/* Reading Level */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Reading Level
                  </label>
                  <Select
                    value={filters.readingLevel}
                    onValueChange={(value) =>
                      updateFilter("readingLevel", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reading level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {readingLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* AI Enhanced Content */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Content Type
                  </label>
                  <Select
                    value={
                      filters.aiEnhanced === null
                        ? "all"
                        : filters.aiEnhanced.toString()
                    }
                    onValueChange={(value) =>
                      updateFilter(
                        "aiEnhanced",
                        value === "all" ? null : value === "true",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All content" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Content</SelectItem>
                      <SelectItem value="true">AI Enhanced</SelectItem>
                      <SelectItem value="false">Original Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Options */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Sort By
                  </label>
                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) => updateFilter("sortBy", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
