import { Helmet } from "react-helmet";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AdminLayout from "@/components/admin/AdminLayout";
import StudyForm from "@/components/admin/StudyForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AddStudyPage() {
  const [, navigate] = useLocation();

  const handleSuccess = () => {
    navigate("/admin/studies");
  };

  return (
    <AdminLayout
      title="Add New Study"
      description="Create a new hydrogen research study"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Add New Study</h1>
          <Button variant="outline" onClick={() => navigate("/admin/studies")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Studies
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Study Details</CardTitle>
            <CardDescription>
              Enter all the details for the new hydrogen research study
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudyForm onSuccess={handleSuccess} />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
