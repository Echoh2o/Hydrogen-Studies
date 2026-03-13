import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  Share2,
  Download,
  Eye,
  GitBranch,
  Calendar,
  Activity,
  ArrowRight,
  Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import HeadMetaTags from "@/components/seo/HeadMetaTags";
import InteractiveBodyMap from "@/components/explorer/InteractiveBodyMap";
import ResearchTimeline from "@/components/explorer/ResearchTimeline";
import StudyComparison from "@/components/explorer/StudyComparison";
import ResearchEvolution from "@/components/explorer/ResearchEvolution";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";

export default function StudyExplorerPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("timeline");
  const [globalFilter, setGlobalFilter] = useState({
    dateRange: "all",
    condition: "all",
    deliveryMethod: "all",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudyIds, setSelectedStudyIds] = useState<number[]>([]);

  const handleStudyClick = (studyId: number) => {
    navigate(`/study/${studyId}`);
  };

  const handleSystemClick = (system: string, studyIds: number[]) => {
    toast({
      title: `${system} System Selected`,
      description: `Found ${studyIds.length} related studies. Click to explore.`,
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/search?bodysystem=${system}`)}
        >
          View Studies
        </Button>
      ),
    });
  };

  const handleYearClick = (year: number) => {
    toast({
      title: `Year ${year} Selected`,
      description: "View all studies from this year.",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/search?year=${year}`)}
        >
          View Studies
        </Button>
      ),
    });
  };

  const handleTopicClick = (topic: string) => {
    navigate(`/search?category=${topic}`);
  };

  const handleCountryClick = (country: string) => {
    navigate(`/search?country=${country}`);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied!",
      description: "Explorer link has been copied to clipboard.",
    });
  };

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Your visualization data is being prepared for download.",
    });
    // Export logic would go here
  };

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Study Explorer - Interactive Research Tool</title>
        <meta name="description" content="Explore hydrogen health research with our interactive study explorer. Filter, sort, and discover studies across categories." />
      </Helmet>
      <HeadMetaTags
        title="Interactive Study Explorer - Hydrogen Therapy Research"
        description="Explore hydrogen therapy research with interactive visualizations including timeline, body map, and evolution diagrams. Discover research trends and compare studies."
        keywords="hydrogen research explorer, interactive timeline, body system map, research evolution, study comparison"
        canonicalUrl="/explorer"
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-teal-600 to-purple-600 text-white">
          <div className="container mx-auto px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl font-bold mb-4">
                Interactive Study Explorer
              </h1>
              <p className="text-xl opacity-90 mb-6">
                Visualize the evolution and impact of hydrogen therapy research
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="bg-white/10 border-white/20 text-white">
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold">20+</p>
                    <p className="text-sm opacity-80">Years of Research</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/10 border-white/20 text-white">
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold">10</p>
                    <p className="text-sm opacity-80">Body Systems</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/10 border-white/20 text-white">
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold">500+</p>
                    <p className="text-sm opacity-80">Studies Mapped</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/10 border-white/20 text-white">
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold">30+</p>
                    <p className="text-sm opacity-80">Countries</p>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={handleShare}
                  data-testid="explorer-share-button"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Explorer
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExport}
                  data-testid="explorer-export-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          {/* Global Filters */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Global Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search studies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="explorer-search-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Date Range
                  </label>
                  <Select
                    value={globalFilter.dateRange}
                    onValueChange={(v) =>
                      setGlobalFilter((prev) => ({ ...prev, dateRange: v }))
                    }
                  >
                    <SelectTrigger data-testid="explorer-date-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="recent">Last 5 Years</SelectItem>
                      <SelectItem value="decade">Last 10 Years</SelectItem>
                      <SelectItem value="classic">Before 2010</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Condition
                  </label>
                  <Select
                    value={globalFilter.condition}
                    onValueChange={(v) =>
                      setGlobalFilter((prev) => ({ ...prev, condition: v }))
                    }
                  >
                    <SelectTrigger data-testid="explorer-condition-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conditions</SelectItem>
                      <SelectItem value="cardiovascular">
                        Cardiovascular
                      </SelectItem>
                      <SelectItem value="neurological">Neurological</SelectItem>
                      <SelectItem value="metabolic">Metabolic</SelectItem>
                      <SelectItem value="inflammatory">Inflammatory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Delivery Method
                  </label>
                  <Select
                    value={globalFilter.deliveryMethod}
                    onValueChange={(v) =>
                      setGlobalFilter((prev) => ({
                        ...prev,
                        deliveryMethod: v,
                      }))
                    }
                  >
                    <SelectTrigger data-testid="explorer-delivery-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="water">Hydrogen Water</SelectItem>
                      <SelectItem value="inhalation">Gas Inhalation</SelectItem>
                      <SelectItem value="bath">Hydrogen Bath</SelectItem>
                      <SelectItem value="injection">Injection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Explorer Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="bodymap" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Body Map</span>
              </TabsTrigger>
              <TabsTrigger
                value="comparison"
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Comparison</span>
              </TabsTrigger>
              <TabsTrigger
                value="evolution"
                className="flex items-center gap-2"
              >
                <GitBranch className="w-4 h-4" />
                <span className="hidden sm:inline">Evolution</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ResearchTimeline
                  onStudyClick={handleStudyClick}
                  onYearClick={handleYearClick}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="bodymap">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <InteractiveBodyMap onSystemClick={handleSystemClick} />
              </motion.div>
            </TabsContent>

            <TabsContent value="comparison">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <StudyComparison
                  initialStudyIds={selectedStudyIds}
                  onStudySelect={handleStudyClick}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="evolution">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ResearchEvolution
                  onTopicClick={handleTopicClick}
                  onCountryClick={handleCountryClick}
                />
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* Help Section */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                How to Use the Explorer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    Timeline View
                  </h4>
                  <p className="text-sm text-gray-600">
                    Explore research progress over time. Zoom in/out to focus on
                    specific periods.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-500" />
                    Body Map
                  </h4>
                  <p className="text-sm text-gray-600">
                    Click body systems to discover related studies and health
                    impacts.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-500" />
                    Comparison Tool
                  </h4>
                  <p className="text-sm text-gray-600">
                    Compare up to 3 studies side-by-side to understand
                    differences.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-orange-500" />
                    Evolution View
                  </h4>
                  <p className="text-sm text-gray-600">
                    See how research topics evolved and diversified over time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call to Action */}
          <Card className="mt-8 bg-gradient-to-r from-teal-50 to-purple-50">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">
                Discover More Research
              </h3>
              <p className="text-gray-600 mb-6">
                Explore our complete database of hydrogen therapy studies
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => navigate("/studies")}
                  data-testid="explorer-view-studies"
                >
                  View All Studies
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => navigate("/search")}>
                  Advanced Search
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}
