/**
 * Admin Trends Analysis Page
 * Displays the comprehensive trends dashboard for administrators
 */

import TrendsDashboard from '@/components/trends/TrendsDashboard';
import { Card } from '@/components/ui/card';

export default function TrendsAnalysisPage() {
  return (
    <div className="container mx-auto py-6" data-testid="admin-trends-page">
      <TrendsDashboard />
    </div>
  );
}