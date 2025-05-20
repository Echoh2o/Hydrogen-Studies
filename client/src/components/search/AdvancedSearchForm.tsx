import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Filter, Search, X, Loader2 } from "lucide-react";

// Define the search parameters schema
const searchFormSchema = z.object({
  query: z.string().optional(),
  benefit: z.array(z.string()).optional(),
  demographic: z.array(z.string()).optional(),
  mechanism: z.array(z.string()).optional(),
  deliveryMethod: z.array(z.string()).optional(),
  healthCondition: z.array(z.string()).optional(),
  bodySystem: z.array(z.string()).optional(),
  yearFrom: z.string().optional(),
  yearTo: z.string().optional(),
  peerReviewed: z.boolean().optional(),
  hasFullText: z.boolean().optional(),
  outcome: z.string().optional(),
  studyType: z.string().optional(),
  advancedOptions: z.object({
    searchInMethods: z.boolean().default(true),
    searchInResults: z.boolean().default(true),
    searchInConclusion: z.boolean().default(true),
    searchInSimplified: z.boolean().default(true),
    useFuzzyMatch: z.boolean().default(false),
    excludeTerms: z.string().optional(),
  }).optional(),
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 30 }, (_, i) => (currentYear - i).toString());

export function AdvancedSearchForm({ onSearch }) {
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [, setLocation] = useLocation();

  // Fetch filter options from API
  const { data: benefits, isLoading: isLoadingBenefits } = useQuery({
    queryKey: ['/api/benefits'],
  });

  const { data: demographics, isLoading: isLoadingDemographics } = useQuery({
    queryKey: ['/api/demographics'],
  });

  const { data: mechanisms, isLoading: isLoadingMechanisms } = useQuery({
    queryKey: ['/api/mechanisms'],
  });

  const { data: deliveryMethods, isLoading: isLoadingDeliveryMethods } = useQuery({
    queryKey: ['/api/delivery-methods'],
  });

  const { data: healthConditions, isLoading: isLoadingHealthConditions } = useQuery({
    queryKey: ['/api/health-conditions'],
  });

  const { data: bodySystems, isLoading: isLoadingBodySystems } = useQuery({
    queryKey: ['/api/body-systems'],
  });

  // Set up the form
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      query: "",
      benefit: [],
      demographic: [],
      mechanism: [],
      deliveryMethod: [],
      healthCondition: [],
      bodySystem: [],
      yearFrom: "",
      yearTo: "",
      peerReviewed: false,
      hasFullText: false,
      outcome: "",
      studyType: "",
      advancedOptions: {
        searchInMethods: true,
        searchInResults: true,
        searchInConclusion: true,
        searchInSimplified: true,
        useFuzzyMatch: false,
        excludeTerms: "",
      },
    },
  });

  // Handle form submission
  const onSubmit = (values: SearchFormValues) => {
    // Build query string
    const queryParams = new URLSearchParams();
    
    // Add main query if present
    if (values.query) queryParams.append("query", values.query);
    
    // Add array fields
    if (values.benefit && values.benefit.length > 0) 
      queryParams.append("benefit", values.benefit.join(","));
    
    if (values.demographic && values.demographic.length > 0) 
      queryParams.append("demographic", values.demographic.join(","));
    
    if (values.mechanism && values.mechanism.length > 0) 
      queryParams.append("mechanism", values.mechanism.join(","));
    
    if (values.deliveryMethod && values.deliveryMethod.length > 0) 
      queryParams.append("deliveryMethod", values.deliveryMethod.join(","));
    
    if (values.healthCondition && values.healthCondition.length > 0) 
      queryParams.append("healthCondition", values.healthCondition.join(","));
    
    if (values.bodySystem && values.bodySystem.length > 0) 
      queryParams.append("bodySystem", values.bodySystem.join(","));
    
    // Add scalar fields
    if (values.yearFrom) queryParams.append("yearFrom", values.yearFrom);
    if (values.yearTo) queryParams.append("yearTo", values.yearTo);
    if (values.peerReviewed) queryParams.append("peerReviewed", "true");
    if (values.hasFullText) queryParams.append("hasFullText", "true");
    if (values.outcome) queryParams.append("outcome", values.outcome);
    if (values.studyType) queryParams.append("studyType", values.studyType);
    
    // Add advanced options
    if (values.advancedOptions) {
      if (values.advancedOptions.searchInMethods) 
        queryParams.append("searchInMethods", "true");
      
      if (values.advancedOptions.searchInResults) 
        queryParams.append("searchInResults", "true");
      
      if (values.advancedOptions.searchInConclusion) 
        queryParams.append("searchInConclusion", "true");
      
      if (values.advancedOptions.searchInSimplified) 
        queryParams.append("searchInSimplified", "true");
      
      if (values.advancedOptions.useFuzzyMatch) 
        queryParams.append("useFuzzyMatch", "true");
      
      if (values.advancedOptions.excludeTerms) 
        queryParams.append("excludeTerms", values.advancedOptions.excludeTerms);
    }
    
    // Update URL without navigating
    window.history.pushState(
      null, 
      '', 
      queryParams.toString() ? `?${queryParams.toString()}` : window.location.pathname
    );
    
    // Call parent search function
    onSearch(values);
  };

  // Clear a specific filter
  const clearFilter = (field: string, value?: string) => {
    if (value) {
      // Clear specific value from array field
      const currentValues = form.getValues(field as any) as string[];
      const newValues = currentValues.filter(v => v !== value);
      form.setValue(field as any, newValues);
    } else {
      // Clear entire field
      if (field === 'advancedOptions') {
        form.setValue('advancedOptions', {
          searchInMethods: true,
          searchInResults: true,
          searchInConclusion: true,
          searchInSimplified: true,
          useFuzzyMatch: false,
          excludeTerms: "",
        });
      } else {
        form.setValue(field as any, field.includes('year') ? "" : (Array.isArray(form.getValues(field as any)) ? [] : ""));
      }
    }
    
    // Submit form to apply changes
    form.handleSubmit(onSubmit)();
  };

  // Clear all filters
  const clearAllFilters = () => {
    form.reset({
      query: "",
      benefit: [],
      demographic: [],
      mechanism: [],
      deliveryMethod: [],
      healthCondition: [],
      bodySystem: [],
      yearFrom: "",
      yearTo: "",
      peerReviewed: false,
      hasFullText: false,
      outcome: "",
      studyType: "",
      advancedOptions: {
        searchInMethods: true,
        searchInResults: true,
        searchInConclusion: true,
        searchInSimplified: true,
        useFuzzyMatch: false,
        excludeTerms: "",
      },
    });
    
    // Submit form to apply changes
    form.handleSubmit(onSubmit)();
  };

  // Active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    
    const values = form.getValues();
    if (values.query) count++;
    if (values.benefit && values.benefit.length > 0) count++;
    if (values.demographic && values.demographic.length > 0) count++;
    if (values.mechanism && values.mechanism.length > 0) count++;
    if (values.deliveryMethod && values.deliveryMethod.length > 0) count++;
    if (values.healthCondition && values.healthCondition.length > 0) count++;
    if (values.bodySystem && values.bodySystem.length > 0) count++;
    if (values.yearFrom) count++;
    if (values.yearTo) count++;
    if (values.peerReviewed) count++;
    if (values.hasFullText) count++;
    if (values.outcome) count++;
    if (values.studyType) count++;
    
    // Count advanced options
    if (values.advancedOptions) {
      if (!values.advancedOptions.searchInMethods) count++;
      if (!values.advancedOptions.searchInResults) count++;
      if (!values.advancedOptions.searchInConclusion) count++;
      if (!values.advancedOptions.searchInSimplified) count++;
      if (values.advancedOptions.useFuzzyMatch) count++;
      if (values.advancedOptions.excludeTerms) count++;
    }
    
    return count;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-sm border-neutral-200">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search input */}
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="Search for research studies on hydrogen..."
                          className="pl-10 py-6 text-lg"
                          {...field}
                        />
                      </FormControl>
                      <Search className="absolute left-3 top-3 h-5 w-5 text-neutral-400" />
                      <Button 
                        type="submit" 
                        className="absolute right-1 top-1 rounded-lg"
                      >
                        Search
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expand/collapse button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full justify-between"
              >
                <div className="flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  <span>Advanced Filters</span>
                  {getActiveFilterCount() > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {getActiveFilterCount()}
                    </Badge>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {/* Active filters */}
              {getActiveFilterCount() > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {form.getValues().query && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <span>Query: {form.getValues().query}</span>
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => clearFilter("query")}
                      />
                    </Badge>
                  )}
                  
                  {form.getValues().benefit?.map(benefit => (
                    <Badge key={benefit} variant="outline" className="flex items-center gap-1">
                      <span>Benefit: {benefit}</span>
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => clearFilter("benefit", benefit)}
                      />
                    </Badge>
                  ))}
                  
                  {/* Add more active filters for other fields */}
                  {/* Similar badges for demographic, mechanism, etc. */}
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              )}
              
              {/* Expanded filters */}
              {isExpanded && (
                <div className="mt-4 space-y-6">
                  <Tabs defaultValue="basic" onValueChange={setActiveTab} value={activeTab}>
                    <TabsList className="w-full">
                      <TabsTrigger value="basic" className="flex-1">Basic Filters</TabsTrigger>
                      <TabsTrigger value="hierarchical" className="flex-1">By Research Category</TabsTrigger>
                      <TabsTrigger value="advanced" className="flex-1">Advanced Options</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4 mt-4">
                      {/* Year range */}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="yearFrom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Year</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Any Year" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">Any Year</SelectItem>
                                  {yearOptions.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="yearTo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>To Year</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Current Year" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">Current Year</SelectItem>
                                  {yearOptions.map(year => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Study type */}
                      <FormField
                        control={form.control}
                        name="studyType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Study Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="All Study Types" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">All Study Types</SelectItem>
                                <SelectItem value="human">Human Studies</SelectItem>
                                <SelectItem value="animal">Animal Studies</SelectItem>
                                <SelectItem value="in_vitro">In Vitro Studies</SelectItem>
                                <SelectItem value="clinical_trial">Clinical Trials</SelectItem>
                                <SelectItem value="meta_analysis">Meta-Analysis</SelectItem>
                                <SelectItem value="review">Review Articles</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      
                      {/* Outcome */}
                      <FormField
                        control={form.control}
                        name="outcome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Study Outcome</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="All Outcomes" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">All Outcomes</SelectItem>
                                <SelectItem value="positive">Positive Results</SelectItem>
                                <SelectItem value="neutral">Neutral Results</SelectItem>
                                <SelectItem value="negative">Negative Results</SelectItem>
                                <SelectItem value="mixed">Mixed Results</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      
                      {/* Checkboxes */}
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="peerReviewed"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Peer-Reviewed Studies Only
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="hasFullText"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Full Text Available
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="hierarchical" className="space-y-6 mt-4">
                      {/* Benefits */}
                      <FormField
                        control={form.control}
                        name="benefit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Benefits</FormLabel>
                            <div className="relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between"
                                    >
                                      {field.value?.length > 0
                                        ? `${field.value.length} selected`
                                        : "Select benefits"}
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <div className="max-h-72 overflow-auto p-2 space-y-2">
                                    {isLoadingBenefits ? (
                                      <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                                      </div>
                                    ) : benefits?.map(benefit => (
                                      <div key={benefit.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`benefit-${benefit.id}`}
                                          checked={field.value?.includes(benefit.id.toString())}
                                          onCheckedChange={checked => {
                                            const newValue = checked
                                              ? [...(field.value || []), benefit.id.toString()]
                                              : (field.value || []).filter(
                                                  value => value !== benefit.id.toString()
                                                );
                                            field.onChange(newValue);
                                          }}
                                        />
                                        <label
                                          htmlFor={`benefit-${benefit.id}`}
                                          className="text-sm font-medium cursor-pointer"
                                        >
                                          {benefit.name} ({benefit.studyCount})
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Demographics */}
                      <FormField
                        control={form.control}
                        name="demographic"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Demographics</FormLabel>
                            <div className="relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between"
                                    >
                                      {field.value?.length > 0
                                        ? `${field.value.length} selected`
                                        : "Select demographics"}
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <div className="max-h-72 overflow-auto p-2 space-y-2">
                                    {isLoadingDemographics ? (
                                      <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                                      </div>
                                    ) : demographics?.map(demographic => (
                                      <div key={demographic.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`demographic-${demographic.id}`}
                                          checked={field.value?.includes(demographic.id.toString())}
                                          onCheckedChange={checked => {
                                            const newValue = checked
                                              ? [...(field.value || []), demographic.id.toString()]
                                              : (field.value || []).filter(
                                                  value => value !== demographic.id.toString()
                                                );
                                            field.onChange(newValue);
                                          }}
                                        />
                                        <label
                                          htmlFor={`demographic-${demographic.id}`}
                                          className="text-sm font-medium cursor-pointer"
                                        >
                                          {demographic.name} ({demographic.studyCount})
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Mechanisms */}
                      <FormField
                        control={form.control}
                        name="mechanism"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mechanisms of Action</FormLabel>
                            <div className="relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between"
                                    >
                                      {field.value?.length > 0
                                        ? `${field.value.length} selected`
                                        : "Select mechanisms"}
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <div className="max-h-72 overflow-auto p-2 space-y-2">
                                    {isLoadingMechanisms ? (
                                      <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                                      </div>
                                    ) : mechanisms?.map(mechanism => (
                                      <div key={mechanism.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`mechanism-${mechanism.id}`}
                                          checked={field.value?.includes(mechanism.id.toString())}
                                          onCheckedChange={checked => {
                                            const newValue = checked
                                              ? [...(field.value || []), mechanism.id.toString()]
                                              : (field.value || []).filter(
                                                  value => value !== mechanism.id.toString()
                                                );
                                            field.onChange(newValue);
                                          }}
                                        />
                                        <label
                                          htmlFor={`mechanism-${mechanism.id}`}
                                          className="text-sm font-medium cursor-pointer"
                                        >
                                          {mechanism.name} ({mechanism.studyCount})
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Delivery Methods */}
                      <FormField
                        control={form.control}
                        name="deliveryMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Methods</FormLabel>
                            <div className="relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between"
                                    >
                                      {field.value?.length > 0
                                        ? `${field.value.length} selected`
                                        : "Select delivery methods"}
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <div className="max-h-72 overflow-auto p-2 space-y-2">
                                    {isLoadingDeliveryMethods ? (
                                      <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                                      </div>
                                    ) : deliveryMethods?.map(method => (
                                      <div key={method.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`method-${method.id}`}
                                          checked={field.value?.includes(method.id.toString())}
                                          onCheckedChange={checked => {
                                            const newValue = checked
                                              ? [...(field.value || []), method.id.toString()]
                                              : (field.value || []).filter(
                                                  value => value !== method.id.toString()
                                                );
                                            field.onChange(newValue);
                                          }}
                                        />
                                        <label
                                          htmlFor={`method-${method.id}`}
                                          className="text-sm font-medium cursor-pointer"
                                        >
                                          {method.name} ({method.studyCount})
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                    
                    <TabsContent value="advanced" className="space-y-6 mt-4">
                      {/* Search locations */}
                      <div className="space-y-4">
                        <p className="text-sm font-medium">Search In:</p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="advancedOptions.searchInMethods"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    Methods Section
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="advancedOptions.searchInResults"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    Results Section
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="advancedOptions.searchInConclusion"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    Conclusion Section
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="advancedOptions.searchInSimplified"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    Simplified Explanations
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      {/* Fuzzy matching */}
                      <FormField
                        control={form.control}
                        name="advancedOptions.useFuzzyMatch"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Use Fuzzy Matching
                              </FormLabel>
                              <p className="text-sm text-neutral-500">
                                Finds closely related terms and handles typos
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      {/* Exclude terms */}
                      <FormField
                        control={form.control}
                        name="advancedOptions.excludeTerms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Exclude Terms</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter terms to exclude, separated by commas"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}