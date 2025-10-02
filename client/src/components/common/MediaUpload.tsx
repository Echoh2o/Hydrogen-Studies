import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Upload,
  Image as ImageIcon,
  FileVideo,
  FileAudio,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MediaUploadProps {
  entityId: number;
  entityType: "study" | "blog";
  onSuccess?: (mediaUrl: string, fileType: string) => void;
  className?: string;
}

export function MediaUpload({
  entityId,
  entityType,
  onSuccess,
  className,
}: MediaUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);

    // Create preview for image files
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      if (imageAlt) {
        formData.append("imageAlt", imageAlt);
      }

      const endpoint =
        entityType === "study"
          ? `/api/studies/${entityId}/media`
          : `/api/blogs/${entityId}/media`;

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        // Don't set Content-Type here, the browser will set it with the proper boundary for multipart/form-data
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Upload successful",
          description: "The media file has been uploaded successfully.",
        });

        // Reset form
        setFile(null);
        setImageAlt("");
        setPreviewUrl(null);

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data.mediaUrl, data.fileType || "image");
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Upload failed",
          description:
            errorData.message || "There was an error uploading the file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error uploading media:", error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading the file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label htmlFor="media-file">Upload Media</Label>
        <Input
          id="media-file"
          type="file"
          onChange={handleFileChange}
          accept={entityType === "blog" ? "image/*" : "image/*,video/*,audio/*"}
          disabled={isUploading}
        />
        <p className="text-sm text-muted-foreground">
          {entityType === "blog"
            ? "Only image files are supported for blog articles."
            : "Supported formats: images, videos, and audio files."}
        </p>
      </div>

      {previewUrl && (
        <div className="mt-2">
          <p className="text-sm font-medium mb-1">Preview:</p>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-48 max-w-full rounded-md object-contain"
          />
        </div>
      )}

      {file && file.type.startsWith("image/") && (
        <div className="space-y-2">
          <Label htmlFor="image-alt">Image Alt Text</Label>
          <Input
            id="image-alt"
            placeholder="Describe the image for accessibility"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            disabled={isUploading}
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="flex items-center"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {getFileTypeIcon(file)}
            </>
          )}
        </Button>

        {file && (
          <p className="text-sm text-muted-foreground">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>
    </div>
  );
}

function getFileTypeIcon(file: File | null) {
  if (!file) return null;

  if (file.type.startsWith("image/")) {
    return <ImageIcon className="ml-2 h-4 w-4" />;
  } else if (file.type.startsWith("video/")) {
    return <FileVideo className="ml-2 h-4 w-4" />;
  } else if (file.type.startsWith("audio/")) {
    return <FileAudio className="ml-2 h-4 w-4" />;
  }

  return null;
}
