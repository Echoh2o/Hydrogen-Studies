import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  Loader2, Plus, X, Download, FileText, Users, Clock,
  Beaker, TrendingUp, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface StudyData {
  id: number;
  title: string;
  year: number;
  category: string;
  deliveryMethod: string;
  dosage: string;
  duration: number;
  sampleSize: number;
  outcome: string;
  methods: string;
  results: string;
  conclusion: string;
  citationCount: number;
  peerReviewed: boolean;
}

interface StudyComparisonProps {
  initialStudyIds?: number[];
  onStudySelect?: (studyId: number) => void;
  className?: string;
}

export default function StudyComparison({
  initialStudyIds = [],
  onStudySelect,
  className
}: StudyComparisonProps) {
  const [selectedStudyIds, setSelectedStudyIds] = useState<number[]>(initialStudyIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [comparisonView, setComparisonView] = useState<'table' | 'chart'>('table');

  // Fetch comparison data
  const { data: comparisonData, isLoading, refetch } = useQuery<StudyData[]>({
    queryKey: ['/api/explorer/comparison', selectedStudyIds],
    queryFn: async () => {
      if (selectedStudyIds.length === 0) return [];
      const response = await fetch(`/api/explorer/comparison/${selectedStudyIds.join(',')}`);
      if (!response.ok) throw new Error('Failed to fetch comparison data');
      return response.json();
    },
    enabled: selectedStudyIds.length > 0
  });

  // Search for studies to add
  const { data: searchResults } = useQuery({
    queryKey: ['/api/search', searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/search?q=${searchQuery}&limit=10`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.studies;
    },
    enabled: searchQuery.length > 2
  });

  const addStudyToComparison = (studyId: number) => {
    if (selectedStudyIds.length >= 3) {
      alert('You can compare up to 3 studies at a time');
      return;
    }
    if (!selectedStudyIds.includes(studyId)) {
      setSelectedStudyIds([...selectedStudyIds, studyId]);
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const removeStudyFromComparison = (studyId: number) => {
    setSelectedStudyIds(selectedStudyIds.filter(id => id !== studyId));
  };

  const exportComparison = () => {
    if (!comparisonData) return;

    // Create CSV content
    const headers = ['Field', ...comparisonData.map(s => s.title.substring(0, 30) + '...')];
    const rows = [
      ['Year', ...comparisonData.map(s => s.year)],
      ['Category', ...comparisonData.map(s => s.category)],
      ['Delivery Method', ...comparisonData.map(s => s.deliveryMethod)],
      ['Dosage', ...comparisonData.map(s => s.dosage)],
      ['Duration (days)', ...comparisonData.map(s => s.duration)],
      ['Sample Size', ...comparisonData.map(s => s.sampleSize)],
      ['Outcome', ...comparisonData.map(s => s.outcome)],
      ['Citations', ...comparisonData.map(s => s.citationCount)],
      ['Peer Reviewed', ...comparisonData.map(s => s.peerReviewed ? 'Yes' : 'No')],
    ];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-comparison-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Prepare radar chart data
  const radarData = comparisonData ? [
    {
      subject: 'Sample Size',
      ...comparisonData.reduce((acc, study, idx) => ({
        ...acc,
        [`Study ${idx + 1}`]: Math.min(100, (study.sampleSize / 500) * 100)
      }), {})
    },
    {
      subject: 'Duration',
      ...comparisonData.reduce((acc, study, idx) => ({
        ...acc,
        [`Study ${idx + 1}`]: Math.min(100, (study.duration / 365) * 100)
      }), {})
    },
    {
      subject: 'Citations',
      ...comparisonData.reduce((acc, study, idx) => ({
        ...acc,
        [`Study ${idx + 1}`]: Math.min(100, (study.citationCount / 100) * 100)
      }), {})
    },
    {
      subject: 'Quality',
      ...comparisonData.reduce((acc, study, idx) => ({
        ...acc,
        [`Study ${idx + 1}`]: study.peerReviewed ? 100 : 50
      }), {})
    },
  ] : [];

  // Prepare bar chart data
  const barData = comparisonData?.map((study, idx) => ({
    name: `Study ${idx + 1}`,
    sampleSize: study.sampleSize,
    duration: study.duration,
    citations: study.citationCount
  })) || [];

  const getOutcomeColor = (outcome: string) => {
    switch (outcome?.toLowerCase()) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      case 'neutral': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome?.toLowerCase()) {
      case 'positive': return <CheckCircle className="w-4 h-4" />;
      case 'negative': return <XCircle className="w-4 h-4" />;
      case 'neutral': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  if (selectedStudyIds.length === 0) {
    return (
      <Card className={cn("p-8", className)}>
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="text-lg font-semibold">No Studies Selected</h3>
          <p className="text-gray-600">Add studies to begin comparison</p>
          <Button onClick={() => setShowSearch(true)} data-testid="add-study-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Study to Compare
          </Button>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Study Comparison Tool</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSearch(true)}
                disabled={selectedStudyIds.length >= 3}
                data-testid="add-study-comparison"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportComparison}
                data-testid="export-comparison"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {comparisonData?.map((study, idx) => (
              <Badge
                key={study.id}
                variant="secondary"
                className="px-3 py-1"
                data-testid={`comparison-study-${study.id}`}
              >
                <span className="mr-2">Study {idx + 1}: {study.title.substring(0, 30)}...</span>
                <button
                  onClick={() => removeStudyFromComparison(study.id)}
                  className="ml-2 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Add Study to Comparison</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSearch(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Search for studies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-4"
                  data-testid="comparison-search-input"
                />
                <ScrollArea className="h-48">
                  {searchResults?.map((study: any) => (
                    <div
                      key={study.id}
                      className="p-2 hover:bg-gray-50 cursor-pointer rounded"
                      onClick={() => addStudyToComparison(study.id)}
                    >
                      <p className="font-semibold text-sm">{study.title}</p>
                      <p className="text-xs text-gray-500">{study.journal} • {study.publish_date}</p>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Views */}
      <Tabs value={comparisonView} onValueChange={(v: any) => setComparisonView(v)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="chart">Chart View</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Field</th>
                      {comparisonData?.map((_, idx) => (
                        <th key={idx} className="px-4 py-3 text-left text-sm font-semibold">
                          Study {idx + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">Title</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3 text-sm">
                          {study.title}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-4 py-3 font-medium">Year</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3">
                          {study.year}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">Category</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3">
                          <Badge variant="outline">{study.category}</Badge>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-4 py-3 font-medium">Delivery Method</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3">
                          <Badge>{study.deliveryMethod}</Badge>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">Sample Size</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            {study.sampleSize}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-4 py-3 font-medium">Duration</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {study.duration} days
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">Outcome</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className={cn("px-4 py-3", getOutcomeColor(study.outcome))}>
                          <div className="flex items-center gap-2">
                            {getOutcomeIcon(study.outcome)}
                            {study.outcome}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-4 py-3 font-medium">Citations</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-gray-400" />
                            {study.citationCount}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">Peer Reviewed</td>
                      {comparisonData?.map(study => (
                        <td key={study.id} className="px-4 py-3">
                          {study.peerReviewed ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart" className="mt-4 space-y-6">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Comparative Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  {comparisonData?.map((_, idx) => (
                    <Radar
                      key={idx}
                      name={`Study ${idx + 1}`}
                      dataKey={`Study ${idx + 1}`}
                      stroke={`hsl(${idx * 120}, 70%, 50%)`}
                      fill={`hsl(${idx * 120}, 70%, 50%)`}
                      fillOpacity={0.3}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Key Metrics Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sampleSize" fill="#3b82f6" name="Sample Size" />
                  <Bar dataKey="duration" fill="#10b981" name="Duration (days)" />
                  <Bar dataKey="citations" fill="#8b5cf6" name="Citations" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Key Differences */}
      <Card>
        <CardHeader>
          <CardTitle>Key Differences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {comparisonData && comparisonData.length > 1 && (
              <>
                <div className="p-3 bg-blue-50 rounded">
                  <p className="font-semibold text-sm mb-1">Largest Sample Size</p>
                  <p className="text-sm">
                    Study {comparisonData.reduce((maxIdx, study, idx, arr) => 
                      study.sampleSize > arr[maxIdx].sampleSize ? idx : maxIdx, 0) + 1} 
                    with {Math.max(...comparisonData.map(s => s.sampleSize))} participants
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="font-semibold text-sm mb-1">Most Cited</p>
                  <p className="text-sm">
                    Study {comparisonData.reduce((maxIdx, study, idx, arr) => 
                      study.citationCount > arr[maxIdx].citationCount ? idx : maxIdx, 0) + 1} 
                    with {Math.max(...comparisonData.map(s => s.citationCount))} citations
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded">
                  <p className="font-semibold text-sm mb-1">Longest Duration</p>
                  <p className="text-sm">
                    Study {comparisonData.reduce((maxIdx, study, idx, arr) => 
                      study.duration > arr[maxIdx].duration ? idx : maxIdx, 0) + 1} 
                    with {Math.max(...comparisonData.map(s => s.duration))} days
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}