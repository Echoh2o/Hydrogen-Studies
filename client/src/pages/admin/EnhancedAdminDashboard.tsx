import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminLayout from "@/components/admin/AdminLayout";
import StudyEditor from "@/components/admin/StudyEditor";
import BlogEditor from "@/components/admin/BlogEditor";
import {
  Plus,
  Search,
  Filter,
  Edit3,
  Eye,
  Trash2,
  BookOpen,
  FileText,
  Users,
  TrendingUp,
  Calendar,
  Database,
  Globe,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  Archive,
  Star,
  Target,
} from "lucide-react";
import { Link } from "wouter";

interface Study {
  id: number;
  title: string;
  authors: string;
  journal: string;
  category: string;
  publishDate: string;
  isPublished: boolean;
  isFeatured: boolean;
  viewCount?: number;
  imageUrl?: string;
}

interface BlogArticle {
  id: number;
  title: string;
  summary: string;
  studyId: number;
  readingLevel: string;
  articleType: string;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const EnhancedAdminDashboard: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState("overview");
  const [studySearchQuery, setStudySearchQuery] = useState("");
  const [blogSearchQuery, setBlogSearchQuery] = useState("");
  const [studyFilter, setStudyFilter] = useState("all");
  const [blogFilter, setBlogFilter] = useState("all");
  const [editingStudy, setEditingStudy] = useState<number | null>(null);
  const [editingBlog, setEditingBlog] = useState<number | null>(null);
  const [creatingStudy, setCreatingStudy] = useState(false);
  const [creatingBlog, setCreatingBlog] = useState(false);

  // Fetch dashboard data
  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/stats/dashboard"],
    staleTime: 30000,
  });

  const { data: studies = [] } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
    select: (data: any[]) =>
      data.map((study) => ({
        id: study.id,
        title: study.title,
        authors: study.authors,
        journal: study.journal,
        category: study.category,
        publishDate: study.publishDate,
        isPublished: study.isPublished || false,
        isFeatured: study.isFeatured || false,
        viewCount: study.viewCount || 0,
        imageUrl: study.imageUrl,
      })),
  });

  const { data: blogArticles = [] } = useQuery<BlogArticle[]>({
    queryKey: ["/api/blog-articles"],
    select: (data: any[]) =>
      data.map((blog) => ({
        id: blog.id,
        title: blog.title,
        summary: blog.summary,
        studyId: blog.studyId,
        readingLevel: blog.readingLevel,
        articleType: blog.articleType,
        isPublished: blog.isPublished || false,
        viewCount: blog.viewCount || 0,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt,
      })),
  });

  // Filter studies
  const filteredStudies = studies.filter((study) => {
    const matchesSearch =
      study.title.toLowerCase().includes(studySearchQuery.toLowerCase()) ||
      study.authors.toLowerCase().includes(studySearchQuery.toLowerCase()) ||
      study.category.toLowerCase().includes(studySearchQuery.toLowerCase());

    const matchesFilter =
      studyFilter === "all" ||
      (studyFilter === "published" && study.isPublished) ||
      (studyFilter === "draft" && !study.isPublished) ||
      (studyFilter === "featured" && study.isFeatured);

    return matchesSearch && matchesFilter;
  });

  // Filter blogs
  const filteredBlogs = blogArticles.filter((blog) => {
    const matchesSearch =
      blog.title.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
      blog.summary.toLowerCase().includes(blogSearchQuery.toLowerCase());

    const matchesFilter =
      blogFilter === "all" ||
      (blogFilter === "published" && blog.isPublished) ||
      (blogFilter === "draft" && !blog.isPublished);

    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalStudies: (dashboardStats as any)?.totalStudies || studies.length,
    publishedStudies: studies.filter((s) => s.isPublished).length,
    totalBlogs: (dashboardStats as any)?.totalBlogs || blogArticles.length,
    publishedBlogs:
      (dashboardStats as any)?.publishedBlogs ||
      blogArticles.filter((b) => b.isPublished).length,
    totalViews:
      studies.reduce((sum, s) => sum + (s.viewCount || 0), 0) +
      blogArticles.reduce((sum, b) => sum + (b.viewCount || 0), 0),
    recentActivity: [],
  };

  // Show study editor
  if (creatingStudy || editingStudy) {
    const studyData = editingStudy
      ? studies.find((s) => s.id === editingStudy)
      : undefined;
    return (
      <AdminLayout title={creatingStudy ? "Create Study" : "Edit Study"}>
        <StudyEditor
          studyId={editingStudy || undefined}
          initialData={studyData}
          mode={creatingStudy ? "create" : "edit"}
          onSave={() => {
            setCreatingStudy(false);
            setEditingStudy(null);
          }}
          onCancel={() => {
            setCreatingStudy(false);
            setEditingStudy(null);
          }}
        />
      </AdminLayout>
    );
  }

  // Show blog editor
  if (creatingBlog || editingBlog) {
    const blogData = editingBlog
      ? blogArticles.find((b) => b.id === editingBlog)
      : undefined;
    return (
      <AdminLayout title={creatingBlog ? "Create Blog Post" : "Edit Blog Post"}>
        <BlogEditor
          blogId={editingBlog || undefined}
          initialData={blogData}
          mode={creatingBlog ? "create" : "edit"}
          onSave={() => {
            setCreatingBlog(false);
            setEditingBlog(null);
          }}
          onCancel={() => {
            setCreatingBlog(false);
            setEditingBlog(null);
          }}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Admin Dashboard"
      description="Comprehensive management for studies and blog posts"
    >
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Studies
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudies}</div>
              <p className="text-xs text-muted-foreground">
                {stats.publishedStudies} published
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Blog Articles
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBlogs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.publishedBlogs} published
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalViews.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all content
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Publication Rate
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalStudies > 0
                  ? Math.round(
                      (stats.publishedStudies / stats.totalStudies) * 100,
                    )
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">Studies published</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="studies">Studies Management</TabsTrigger>
            <TabsTrigger value="blogs">Blog Management</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Studies */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Recent Studies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {studies.slice(0, 5).map((study) => (
                      <div
                        key={study.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {study.title}
                          </div>
                          <div className="text-xs text-gray-600">
                            {study.authors}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              study.isPublished ? "default" : "secondary"
                            }
                          >
                            {study.isPublished ? "Published" : "Draft"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStudy(study.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Blogs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Recent Blog Posts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {blogArticles.slice(0, 5).map((blog) => (
                      <div
                        key={blog.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {blog.title}
                          </div>
                          <div className="text-xs text-gray-600">
                            {blog.articleType} • {blog.readingLevel}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={blog.isPublished ? "default" : "secondary"}
                          >
                            {blog.isPublished ? "Published" : "Draft"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingBlog(blog.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    onClick={() => setCreatingStudy(true)}
                    className="flex items-center justify-center h-20 flex-col space-y-2"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-sm">New Study</span>
                  </Button>

                  <Button
                    onClick={() => setCreatingBlog(true)}
                    className="flex items-center justify-center h-20 flex-col space-y-2"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-sm">New Blog</span>
                  </Button>

                  <Button
                    variant="outline"
                    asChild
                    className="flex items-center justify-center h-20 flex-col space-y-2"
                  >
                    <Link href="/admin/research-import">
                      <Search className="h-6 w-6" />
                      <span className="text-sm">Import Studies</span>
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    asChild
                    className="flex items-center justify-center h-20 flex-col space-y-2"
                  >
                    <Link href="/admin/content-enrichment">
                      <Target className="h-6 w-6" />
                      <span className="text-sm">Enrich Content</span>
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    asChild
                    className="flex items-center justify-center h-20 flex-col space-y-2"
                  >
                    <Link href="/admin/trends">
                      <TrendingUp className="h-6 w-6" />
                      <span className="text-sm">Trends Analysis</span>
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    asChild
                    className="flex items-center justify-center h-20 flex-col space-y-2"
                  >
                    <Link href="/admin/multi-format">
                      <FileText className="h-6 w-6" />
                      <span className="text-sm">Multi-Format Generator</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Studies Management Tab */}
          <TabsContent value="studies" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Studies Management</h2>
              <Button onClick={() => setCreatingStudy(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Study
              </Button>
            </div>

            {/* Studies Filters */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search studies by title, authors, or category..."
                      value={studySearchQuery}
                      onChange={(e) => setStudySearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={studyFilter} onValueChange={setStudyFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter studies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Studies</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Drafts</SelectItem>
                      <SelectItem value="featured">Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Studies List */}
            <div className="grid gap-4">
              {filteredStudies.map((study) => (
                <Card key={study.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg truncate">
                            {study.title}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={
                                study.isPublished ? "default" : "secondary"
                              }
                            >
                              {study.isPublished ? "Published" : "Draft"}
                            </Badge>
                            {study.isFeatured && (
                              <Badge
                                variant="outline"
                                className="border-yellow-200 text-yellow-800"
                              >
                                <Star className="h-3 w-3 mr-1" />
                                Featured
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <strong>Authors:</strong> {study.authors}
                          </div>
                          <div>
                            <strong>Journal:</strong> {study.journal}
                          </div>
                          <div>
                            <strong>Category:</strong> {study.category}
                          </div>
                          <div>
                            <strong>Published:</strong>{" "}
                            {new Date(study.publishDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingStudy(study.id)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/studies/${study.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Blog Management Tab */}
          <TabsContent value="blogs" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Blog Management</h2>
              <Button onClick={() => setCreatingBlog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Blog Post
              </Button>
            </div>

            {/* Blog Filters */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search blog posts by title or summary..."
                      value={blogSearchQuery}
                      onChange={(e) => setBlogSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={blogFilter} onValueChange={setBlogFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter blogs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Posts</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Drafts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Blog List */}
            <div className="grid gap-4">
              {filteredBlogs.map((blog) => (
                <Card key={blog.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg truncate">
                            {blog.title}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={
                                blog.isPublished ? "default" : "secondary"
                              }
                            >
                              {blog.isPublished ? "Published" : "Draft"}
                            </Badge>
                            <Badge variant="outline">{blog.articleType}</Badge>
                            <Badge variant="outline">{blog.readingLevel}</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {blog.summary}
                        </div>
                        <div className="text-xs text-gray-500">
                          Created:{" "}
                          {new Date(blog.createdAt).toLocaleDateString()} •
                          Updated:{" "}
                          {new Date(blog.updatedAt).toLocaleDateString()} •
                          Views: {blog.viewCount}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingBlog(blog.id)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/blog/${blog.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default EnhancedAdminDashboard;
