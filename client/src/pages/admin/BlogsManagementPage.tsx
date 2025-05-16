import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import BlogsAdmin from '@/pages/admin/BlogsAdmin';

export default function BlogsManagementPage() {
  return (
    <AdminLayout
      title="Blog Management"
      description="Create, edit, and manage blog articles"
    >
      <BlogsAdmin />
    </AdminLayout>
  );
}