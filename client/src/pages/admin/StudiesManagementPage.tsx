import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import StudyTable from '@/components/admin/StudyTable';
import { Search, Plus } from 'lucide-react';
import { Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudyForm from '@/components/admin/StudyForm';

export default function StudiesManagementPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('browse');
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };
  
  return (
    <AdminLayout
      title="Studies Management"
      description="Browse, create, and manage research studies"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="browse" className="flex-1">Browse Studies</TabsTrigger>
          <TabsTrigger value="add" className="flex-1">Add New Study</TabsTrigger>
        </TabsList>
        
        {/* Browse Studies Tab */}
        <TabsContent value="browse" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Study Database</CardTitle>
              <CardDescription>Search, edit, or delete studies from your database</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex space-x-2 mb-6">
                <Input
                  placeholder="Search by title, author, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('add')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
              </form>
              
              <StudyTable searchQuery={searchQuery} />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Add Study Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add New Study</CardTitle>
              <CardDescription>Enter the details for a new research study</CardDescription>
            </CardHeader>
            <CardContent>
              <StudyForm
                onSuccess={() => {
                  toast({
                    title: "Study Added Successfully",
                    description: "The new study has been added to your database.",
                  });
                  setActiveTab('browse');
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}