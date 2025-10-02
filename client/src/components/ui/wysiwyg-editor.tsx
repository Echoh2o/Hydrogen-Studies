import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface WysiwygEditorProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
  required?: boolean;
  readOnly?: boolean;
  error?: string;
  description?: string;
}

const toolbarOptions = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  [{ align: [] }],
  ["link", "image", "blockquote", "code-block"],
  [{ color: [] }, { background: [] }],
  ["clean"],
];

export function WysiwygEditor({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = "Enter content...",
  className,
  height = "200px",
  required = false,
  readOnly = false,
  error,
  description,
}: WysiwygEditorProps) {
  // Init with empty string if value is undefined
  const [editorValue, setEditorValue] = useState(value || "");

  // Update local state when prop value changes
  useEffect(() => {
    setEditorValue(value || "");
  }, [value]);

  // Handle editor changes
  const handleChange = (content: string) => {
    setEditorValue(content);
    onChange(content);
  };

  // Quill modules configuration
  const modules = {
    toolbar: toolbarOptions,
    clipboard: {
      matchVisual: false,
    },
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-baseline justify-between">
          <Label htmlFor={id || name} className="font-medium">
            {label} {required && <span className="text-red-500">*</span>}
          </Label>
        </div>
      )}

      <div
        className={cn(
          "border rounded-md overflow-hidden",
          error ? "border-red-500" : "border-input",
          className,
        )}
        style={{ minHeight: height }}
      >
        <ReactQuill
          id={id || name}
          value={editorValue}
          onChange={handleChange}
          placeholder={placeholder}
          modules={modules}
          readOnly={readOnly}
          theme="snow"
          className="h-full"
          style={{ height: `calc(${height} - 42px)` }} // Adjust for toolbar height
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
