import AdminLayout from "@/components/admin/AdminLayout";
import { BlogRecommendationSystem } from "@/components/admin/BlogRecommendationSystem";

export default function BlogRecommendationPage() {
  return (
    <AdminLayout title="Blog Ideas">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog Ideas</h1>
          <p className="text-muted-foreground">
            Get AI-powered recommendations for high-impact blog posts based on
            your research studies.
          </p>
        </div>

        <BlogRecommendationSystem />
      </div>
    </AdminLayout>
  );
}
