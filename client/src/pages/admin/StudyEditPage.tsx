import { Link, useParams } from "wouter";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/admin/AdminLayout";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import StudyForm from "@/components/admin/StudyForm";
import {
  ArrowLeft,
  Loader,
  Sparkles,
  ImageIcon,
  Layers,
} from "lucide-react";

export default function StudyEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const studyId = Number(id);

  // Fetch study data
  const {
    data: study,
    isLoading,
    error,
  } = useQuery<any>({
    queryKey: [`/api/studies/${studyId}`],
    enabled: !!studyId && !isNaN(studyId),
  });

  const handleSuccess = () => {
    navigate("/admin/studies");
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Edit Study"
        description="Edit hydrogen research study"
      >
        <div className="flex items-center justify-center h-64">
          <Loader className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading study data...</span>
        </div>
      </AdminLayout>
    );
  }

  if (error || !study) {
    return (
      <AdminLayout
        title="Study Not Found"
        description="Could not find the requested study"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">
              Study Not Found
            </h1>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/studies")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Studies
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>
                The study you are looking for could not be found or there was an
                error loading it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Please check that the study ID is correct and try again.</p>
              <Button
                className="mt-4"
                onClick={() => navigate("/admin/studies")}
              >
                Return to Studies
              </Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Edit Study: ${study.title}`}
      description="Edit hydrogen research study"
    >
      <div className="space-y-6">
        <AdminBreadcrumbs
          items={[
            { label: "Studies", href: "/admin/studies" },
            { label: "Edit" },
          ]}
        />
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Edit Study</h1>
          <Button variant="outline" onClick={() => navigate("/admin/studies")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Studies
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Study Details</CardTitle>
            <CardDescription>
              Edit the details for this hydrogen research study
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudyForm
              initialData={study}
              studyId={studyId}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content actions</CardTitle>
            <CardDescription>
              Run AI-powered tools against this specific study. Most of these
              run automatically in the background — these shortcuts are for
              on-demand runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Button asChild variant="outline">
                <Link href={`/admin/content-enrichment?studyId=${studyId}`}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enrich content
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/admin/image-generation?studyId=${studyId}`}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate image
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/admin/multi-format?studyId=${studyId}`}>
                  <Layers className="mr-2 h-4 w-4" />
                  Multi-format content
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
