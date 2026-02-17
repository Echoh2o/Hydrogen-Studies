import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  BookOpen,
  Tag,
  AlertCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BlogCategory {
  name: string;
  count: number;
}

export default function BlogCategoriesPage() {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch existing blog categories (distinct article types)
  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/blogs/categories"],
    select: (data: any) => data?.categories || [],
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      apiRequest(
        "PUT",
        `/api/blogs/categories/${encodeURIComponent(oldName)}`,
        { name: newName },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blogs/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      setEditingCategory(null);
      setEditingName("");
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryName: string) =>
      apiRequest(
        "DELETE",
        `/api/blogs/categories/${encodeURIComponent(categoryName)}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blogs/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleUpdateCategory = () => {
    if (!editingCategory || !editingName.trim()) return;
    updateCategoryMutation.mutate({
      oldName: editingCategory,
      newName: editingName.trim(),
    });
  };

  const handleDeleteCategory = (categoryName: string) => {
    deleteCategoryMutation.mutate(categoryName);
  };

  const startEditing = (category: BlogCategory) => {
    setEditingCategory(category.name);
    setEditingName(category.name);
  };

  const cancelEditing = () => {
    setEditingCategory(null);
    setEditingName("");
  };

  if (isLoading) {
    return (
      <AdminLayout title="Blog Categories">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">
              Loading blog categories...
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Blog Categories">
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-500">
            Error loading blog categories: {error.message}
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Blog Categories">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog Categories</h1>
          <p className="text-muted-foreground">
            Manage existing categories used by your blog articles. New
            categories are automatically created when you assign them to blog
            articles.
          </p>
        </div>

        {/* Categories List */}
        <div className="space-y-4">
          {categories.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-semibold">
                    No categories found
                  </h3>
                  <p className="text-muted-foreground">
                    Categories will appear here automatically when you create
                    blog articles with article types assigned.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            categories.map((category: BlogCategory) => (
              <Card
                key={category.name}
                className="hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {editingCategory === category.name ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleUpdateCategory()
                          }
                          className="font-medium"
                          data-testid={`input-edit-${category.name}`}
                        />
                      ) : (
                        <>
                          <Tag className="h-5 w-5 text-teal-600" />
                          <h3 className="text-xl font-semibold capitalize">
                            {category.name}
                          </h3>
                          <Badge variant="secondary" className="ml-2">
                            {category.count} articles
                          </Badge>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editingCategory === category.name ? (
                        <>
                          <Button
                            size="sm"
                            onClick={handleUpdateCategory}
                            disabled={
                              !editingName.trim() ||
                              updateCategoryMutation.isPending
                            }
                            data-testid={`button-save-edit-${category.name}`}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditing}
                            data-testid={`button-cancel-edit-${category.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(category)}
                            data-testid={`button-edit-${category.name}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-${category.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Category
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the "
                                  {category.name}" category? This will remove
                                  the category from {category.count} blog
                                  articles. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteCategory(category.name)
                                  }
                                  className="bg-red-600 hover:bg-red-700"
                                  data-testid={`button-confirm-delete-${category.name}`}
                                >
                                  Delete Category
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Summary */}
        {categories.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>
                  {categories.length} categories managing{" "}
                  {categories.reduce(
                    (sum: number, cat: BlogCategory) => sum + cat.count,
                    0,
                  )}{" "}
                  total articles
                </span>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Blog Article Management</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
