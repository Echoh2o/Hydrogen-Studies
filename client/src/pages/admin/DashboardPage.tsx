import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Database,
  FileText,
  Upload,
  Search,
  TrendingUp,
  BarChart2,
  Clock,
  Loader2,
  AlertCircle,
  Plus,
  RefreshCw,
  ImageIcon
} from 'lucide-react';

export default function DashboardPage() {
  // Fetch dashboard stats
  const { data: stats, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['/api/stats/dashboard'],
    retry: false,
    refetchOnMount: true,
    staleTime: 0,
  });
  
  // Fetch recent studies
  const { data: recentStudies, isLoading: isLoadingStudies } = useQuery({
    queryKey: ['/api/studies/recent'],
    retry: false,
  });
  
  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  // Use real stats from API with proper TypeScript handling
  const dashboardStats = {
    totalStudies: (stats as any)?.totalStudies || 0,
    totalBlogs: (stats as any)?.totalBlogs || 0,
    pendingBlogs: (stats as any)?.draftBlogs || 0,
    categoriesCount: (stats as any)?.categoriesCount || 8,
    recentImports: (stats as any)?.recentImports || 0,
  };

  // Debug: Log the stats data to see what's being received
  console.log('Dashboard stats received:', stats);
  console.log('Processed dashboard stats:', dashboardStats);

  // Show loading state while fetching data
  if (isLoadingStats) {
    return (
      <AdminLayout title="Dashboard" description="Admin dashboard overview">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading dashboard statistics...</span>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout title="Dashboard" description="Admin dashboard overview">
      <Helmet>
        <title>Dashboard | HydrogenStudies Admin</title>
      </Helmet>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome to the HydrogenStudies admin dashboard
          </p>
          {stats && (
            <div className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          )}
        </div>
        
        {/* Quick Action Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Content Management */}
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background border-blue-100 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2 text-blue-500" />
                Content Management
              </CardTitle>
              <CardDescription>Manage studies and blog articles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="default" size="sm" className="w-full justify-start bg-blue-600 hover:bg-blue-700" asChild>
                  <Link href="/admin/studies/add">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Study
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href="/admin/studies">
                    <Database className="mr-2 h-4 w-4" />
                    Manage Studies
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href="/admin/blogs">
                    <FileText className="mr-2 h-4 w-4" />
                    Manage Blogs
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Operations */}
          <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-background border-amber-100 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2 text-amber-500" />
                Data Operations
              </CardTitle>
              <CardDescription>Import and manage research data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="default" size="sm" className="w-full justify-start bg-amber-600 hover:bg-amber-700" asChild>
                  <Link href="/admin/research-import">
                    <Search className="mr-2 h-4 w-4" />
                    Import Research
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href="/admin/data-import">
                    <Upload className="mr-2 h-4 w-4" />
                    Data Import (CSV/Excel)
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Enhancement Tools */}
          <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-background border-green-100 dark:border-green-900">
            <CardHeader>
              <CardTitle className="flex items-center">
                <RefreshCw className="h-5 w-5 mr-2 text-green-500" />
                Enhancement Tools
              </CardTitle>
              <CardDescription>Enrich and improve content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="default" size="sm" className="w-full justify-start bg-green-600 hover:bg-green-700" asChild>
                  <Link href="/admin/batch-enrichment">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Batch Enrichment
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href="/admin/content-enrichment">
                    <Clock className="mr-2 h-4 w-4" />
                    Content Enrichment
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href="/admin/image-generation">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Image Generation
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-100 dark:border-blue-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Studies</CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalStudies || 'Loading...'}</div>
              <p className="text-xs text-muted-foreground">Hydrogen research studies in database</p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-red-500">Debug: {JSON.stringify(stats)}</p>
              )}
            </CardContent>
          </Card>
          
          <Card className="border-amber-100 dark:border-amber-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blog Articles</CardTitle>
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalBlogs}</div>
              <p className="text-xs text-muted-foreground">Published blog articles</p>
            </CardContent>
          </Card>
          
          <Card className="border-purple-100 dark:border-purple-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Content</CardTitle>
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.pendingBlogs}</div>
              <p className="text-xs text-muted-foreground">Blogs awaiting review/publishing</p>
            </CardContent>
          </Card>
          
          <Card className="border-green-100 dark:border-green-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Imports</CardTitle>
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Upload className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.recentImports}</div>
              <p className="text-xs text-muted-foreground">Studies imported in last 30 days</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Recent Activity and Analytics */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent Studies */}
          <Card className="col-span-1 border-blue-100 dark:border-blue-900/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Studies</CardTitle>
                  <CardDescription>Recently added research entries</CardDescription>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingStudies ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !recentStudies || (recentStudies as any)?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium">No recent studies</h3>
                  <p className="text-xs text-muted-foreground mt-1">Import some research to see it here</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {((recentStudies as any) || []).slice(0, 5).map((study: any) => (
                    <li key={study.id} className="flex flex-col p-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                      <Link href={`/admin/studies/edit/${study.id}`}>
                        <a className="font-medium text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1">{study.title}</a>
                      </Link>
                      <div className="flex mt-1 text-xs text-muted-foreground">
                        <span className="line-clamp-1">{study.journal || "Journal not specified"}</span>
                        <span className="mx-2 flex-shrink-0">•</span>
                        <span className="flex-shrink-0">{formatDate(study.publishDate) || "Date unknown"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-4 border-t">
                <Button variant="default" size="sm" className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                  <Link href="/admin/studies">
                    <a>View All Studies</a>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Analytics Overview */}
          <Card className="col-span-1 border-purple-100 dark:border-purple-900/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Analytics Overview</CardTitle>
                  <CardDescription>Key metrics and trends</CardDescription>
                </div>
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BarChart2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-purple-50 dark:bg-purple-900/10">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Studies by Category</p>
                    <p className="text-xs text-muted-foreground">Distribution across {dashboardStats.categoriesCount} categories</p>
                  </div>
                  <BarChart2 className="h-5 w-5 text-purple-500" />
                </div>
                
                <div className="h-[130px] flex items-center justify-center rounded-md bg-purple-50 dark:bg-purple-900/10">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Content analytics charts coming soon</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm p-2 rounded-md bg-green-50 dark:bg-green-900/10">
                    <div>Recent Imports</div>
                    <div className="font-medium flex items-center">
                      <Upload className="mr-2 h-4 w-4 text-green-500" />
                      <span>{dashboardStats.recentImports}</span>
                      <span className="ml-1 text-xs text-muted-foreground">(30 days)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm p-2 rounded-md bg-green-50 dark:bg-green-900/10">
                    <div>Content Growth</div>
                    <div className="flex items-center font-medium">
                      <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
                      <span>8.2%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <Button variant="default" size="sm" className="w-full bg-purple-600 hover:bg-purple-700" asChild>
                  <Link href="/admin/analytics">
                    <a>View Full Analytics</a>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}