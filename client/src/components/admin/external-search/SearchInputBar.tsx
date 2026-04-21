import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";

interface SearchInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
  helpText?: string;
  label?: string;
}

/**
 * The query input + Submit button pattern shared by every external-search
 * component (PubMed, EuropePMC, CrossRef, SemanticScholar).
 */
export function SearchInputBar({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Search for articles",
  helpText,
  label = "Search Term",
}: SearchInputBarProps) {
  return (
    <div className="flex space-x-2">
      <div className="flex-1">
        <Label htmlFor="external-search-query">{label}</Label>
        <div className="flex mt-1.5">
          <Input
            id="external-search-query"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
          <Button
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
            className="ml-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>
        {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
      </div>
    </div>
  );
}
