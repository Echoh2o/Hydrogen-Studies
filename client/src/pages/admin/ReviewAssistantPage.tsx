import SmartReviewQueue from '@/components/review/SmartReviewQueue';
import { Helmet } from 'react-helmet';

const ReviewAssistantPage = () => {
  return (
    <>
      <Helmet>
        <title>Review Assistant - Admin Panel</title>
        <meta name="description" content="Smart review assistant for managing research studies" />
      </Helmet>
      <SmartReviewQueue />
    </>
  );
};

export default ReviewAssistantPage;