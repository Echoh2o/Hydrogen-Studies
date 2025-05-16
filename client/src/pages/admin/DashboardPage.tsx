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
  Plus
} from 'lucide-react';

export default function DashboardPage() {
  // Fetch dashboard stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/stats/dashboard'],
    retry: false,
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
  
  // Placeholder data for stats when API isn't implemented yet
  const placeholderStats = {
    totalStudies: '1,523',
    totalBlogs: '47',
    pendingBlogs: '12',
    categoriesCount: '8',
    recentImports: '23',
  };
  
  const displayStats = stats || placeholderStats;
  
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
        </div>
        
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-auto flex-col p-4 justify-start items-center text-center" asChild>
                <Link href="/admin/studies/add">
                  <a>
                    <Plus className="mb-2 h-5 w-5" />
                    <span className="text-sm font-medium">Add Study</span>
                  </a>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col p-4 justify-start items-center text-center" asChild>
                <Link href="/admin/research-import">
                  <a>
                    <Search className="mb-2 h-5 w-5" />
                    <span className="text-sm font-medium">Import Research</span>
                  </a>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col p-4 justify-start items-center text-center" asChild>
                <Link href="/admin/blogs">
                  <a>
                    <FileText className="mb-2 h-5 w-5" />
                    <span className="text-sm font-medium">Manage Blogs</span>
                  </a>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col p-4 justify-start items-center text-center" asChild>
                <Link href="/admin/data-import">
                  <a>
                    <Upload className="mb-2 h-5 w-5" />
                    <span className="text-sm font-medium">Data Import</span>
                  </a>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Studies</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayStats.totalStudies}</div>
              <p className="text-xs text-muted-foreground">Hydrogen research studies in database</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blog Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayStats.totalBlogs}</div>
              <p className="text-xs text-muted-foreground">Published blog articles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Content</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayStats.pendingBlogs}</div>
              <p className="text-xs text-muted-foreground">Blogs awaiting review/publishing</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Recent Studies</CardTitle>
              <CardDescription>Recently added research studies</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStudies ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !recentStudies || recentStudies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium">No recent studies</h3>
                  <p className="text-xs text-muted-foreground mt-1">Import some research to see it here</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {recentStudies.slice(0, 5).map((study: any) => (
                    <li key={study.id} className="flex flex-col">
                      <Link href={`/admin/studies/edit/${study.id}`}>
                        <a className="font-medium text-sm hover:underline">{study.title}</a>
                      </Link>
                      <div className="flex mt-1 text-xs text-muted-foreground">
                        <span>{study.journal}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(study.publishDate)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/admin/studies">
                    <a>View All Studies</a>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Analytics Overview</CardTitle>
              <CardDescription>Key metrics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Studies by Category</p>
                    <p className="text-xs text-muted-foreground">Distribution across {displayStats.categoriesCount} categories</p>
                  </div>
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                </div>
                
                <div className="h-[160px] flex items-center justify-center border rounded-md bg-muted/5">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Analytics charts coming soon</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div>Recent Imports</div>
                    <div className="font-medium">{displayStats.recentImports} <span className="text-xs text-muted-foreground">(last 30 days)</span></div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div>Content Growth</div>
                    <div className="flex items-center font-medium">
                      <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                      <span>8.2%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" className="w-full" asChild>
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