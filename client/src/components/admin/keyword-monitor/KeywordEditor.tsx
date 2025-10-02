import React, { useState } from "react";
import { Pencil, Trash, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface Keyword {
  id: number;
  term: string;
  category: string;
  isActive: boolean;
  lastSearched?: string;
  matchCount?: number;
}

interface KeywordEditorProps {
  keyword: Keyword;
  onCancel: () => void;
}

export default function KeywordEditor({
  keyword,
  onCancel,
}: KeywordEditorProps) {
  const [formData, setFormData] = useState({
    term: keyword.term,
    category: keyword.category,
  });

  const updateKeywordMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/keywords/${keyword.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update keyword");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      onCancel();
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateKeywordMutation.mutate(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 p-3 bg-secondary/20 rounded-md"
    >
      <div className="space-y-1">
        <Label htmlFor="term">Keyword Term</Label>
        <Input
          id="term"
          value={formData.term}
          onChange={(e) => handleChange("term", e.target.value)}
          className="bg-white"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => handleChange("category", value)}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="delivery">Delivery Method</SelectItem>
            <SelectItem value="benefit">Health Benefit</SelectItem>
            <SelectItem value="mechanism">Mechanism</SelectItem>
            <SelectItem value="demographic">Demographic</SelectItem>
            <SelectItem value="disease">Disease/Condition</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={updateKeywordMutation.isPending}
        >
          <Check className="h-4 w-4 mr-1" />
          Save
        </Button>
      </div>
    </form>
  );
}
