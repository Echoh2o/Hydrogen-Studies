/**
 * Admin Trends Analysis Page
 * Displays the comprehensive trends dashboard for administrators
 */

import TrendsDashboard from "@/components/trends/TrendsDashboard";
import AdminLayout from "@/components/admin/AdminLayout";

export default function TrendsAnalysisPage() {
  return (
    <AdminLayout title="Trends Analysis" description="Hydrogen research trends and insights">
      <TrendsDashboard />
    </AdminLayout>
  );
}
