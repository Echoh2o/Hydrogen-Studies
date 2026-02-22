import SmartReviewQueue from "@/components/review/SmartReviewQueue";
import AdminLayout from "@/components/admin/AdminLayout";

const ReviewAssistantPage = () => {
  return (
    <AdminLayout title="Review Assistant" description="Smart review assistant for managing research studies">
      <SmartReviewQueue />
    </AdminLayout>
  );
};

export default ReviewAssistantPage;
