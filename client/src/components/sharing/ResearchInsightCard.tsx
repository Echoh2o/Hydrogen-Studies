import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Study } from "@/types/hydrogen";
import { useToast } from "@/hooks/use-toast";
import { Download, Share2, Copy, Check, FileImage } from "lucide-react";
// html2canvas is ~90KB and only used on click — lazy-load on demand.
const loadHtml2Canvas = () =>
  import("html2canvas").then((m) => m.default);

interface ResearchInsightCardProps {
  study: Study;
}

const CARD_TEMPLATES = [
  {
    id: "modern",
    name: "Modern",
    background: "bg-gradient-to-br from-teal-500 to-purple-600",
  },
  {
    id: "minimal",
    name: "Minimal",
    background: "bg-white border-2 border-neutral-200",
  },
  {
    id: "scientific",
    name: "Scientific",
    background: "bg-gradient-to-r from-teal-500 to-emerald-600",
  },
  {
    id: "academic",
    name: "Academic",
    background: "bg-gradient-to-br from-amber-500 to-orange-600",
  },
  {
    id: "hydrogen",
    name: "Hydrogen",
    background: "bg-gradient-to-r from-teal-400 to-cyan-500",
  },
];

const ResearchInsightCard: React.FC<ResearchInsightCardProps> = ({ study }) => {
  const [template, setTemplate] = useState(CARD_TEMPLATES[0]);
  const [title, setTitle] = useState(
    study.title?.length > 80
      ? `${study.title.substring(0, 77)}...`
      : study.title,
  );
  const [insight, setInsight] = useState("");
  const [showLogo, setShowLogo] = useState(true);
  const [fontSize, setFontSize] = useState(100);
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { toast } = useToast();

  // Generate a brief insight from the study
  React.useEffect(() => {
    // Extract a key insight from the abstract
    if (study.abstract) {
      const sentences = study.abstract
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 40);
      if (sentences.length > 0) {
        // Get a meaningful sentence from the middle of the abstract
        const midIndex = Math.min(1, sentences.length - 1);
        const selectedSentence = sentences[midIndex].trim();
        setInsight(
          selectedSentence.length > 150
            ? `${selectedSentence.substring(0, 147)}...`
            : selectedSentence,
        );
      }
    }
  }, [study]);

  const downloadCard = async () => {
    if (!cardRef.current) return;

    try {
      setDownloading(true);
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `hydrogen-research-${study.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({
        title: "Success!",
        description: "Research insight card downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Error",
        description: "Failed to download the research card. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!cardRef.current) return;

    try {
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      canvas.toBlob(async (blob: Blob | null) => {
        if (blob) {
          try {
            const item = new ClipboardItem({ "image/png": blob });
            await navigator.clipboard.write([item]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);

            toast({
              title: "Copied!",
              description: "Research insight card copied to clipboard.",
            });
          } catch (clipboardError) {
            console.error("Clipboard API not supported", clipboardError);
            // Fallback - open in new window to copy manually
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            toast({
              title: "Manual copy needed",
              description: "Right-click on the image and select 'Copy Image'",
            });
          }
        }
      });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Error",
        description: "Failed to copy the research card. Please try again.",
        variant: "destructive",
      });
    }
  };

  const shareCard = async () => {
    if (!cardRef.current) return;

    try {
      setSharing(true);
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );

      if (blob) {
        const file = new File([blob], `hydrogen-research-${study.id}.png`, {
          type: "image/png",
        });
        const data = {
          files: [file],
          title: "Hydrogen Research Insight",
          text: `${title}\n\nSource: hydrogenstudies.com/study/${study.slug || `id/${study.id}`}`,
        };

        if (navigator.canShare && navigator.canShare(data)) {
          await navigator.share(data);
          toast({
            title: "Shared!",
            description: "Research insight card was shared successfully.",
          });
        } else {
          throw new Error("Web Share API not supported");
        }
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast({
        title: "Sharing not supported",
        description:
          "Your browser doesn't support sharing. Try copying or downloading instead.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const handleFontSizeChange = (value: number[]) => {
    setFontSize(value[0]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-neutral-100 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Research Insight Card</h2>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="customize">Customize</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="py-4">
            <div className="flex justify-center">
              <div
                ref={cardRef}
                className={`w-[600px] h-[314px] ${template.background} rounded-xl overflow-hidden shadow-lg`}
                style={{
                  fontSize: `${fontSize}%`,
                  color: template.id === "minimal" ? "#333" : "#fff",
                }}
              >
                <div className="p-6 h-full flex flex-col">
                  {showLogo && (
                    <div className="mb-2 opacity-90">
                      <div className="text-lg font-bold tracking-tight">
                        HydrogenStudies
                        <span className="text-xs font-normal">.com</span>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-2xl font-bold mb-3 leading-tight">
                      {title}
                    </h3>

                    <p className="text-base opacity-90 mb-4">
                      {insight ||
                        "This study provides valuable insights into hydrogen health research."}
                    </p>

                    <div className="text-sm opacity-80 mt-auto">
                      {study.authors && (
                        <div className="font-medium">
                          {study.authors.split(",")[0]} et al.
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span>
                          {study.journal ? study.journal : "Scientific Journal"}{" "}
                          • {new Date(study.publishDate).getFullYear()}
                        </span>
                        {study.doi && <span>DOI: {study.doi}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3 mt-4">
              <Button
                variant="outline"
                onClick={copyToClipboard}
                disabled={copied}
              >
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>

              <Button onClick={downloadCard} disabled={downloading}>
                <Download className="mr-2 h-4 w-4" />
                {downloading ? "Downloading..." : "Download"}
              </Button>

              <Button
                variant="secondary"
                onClick={shareCard}
                disabled={sharing}
              >
                <Share2 className="mr-2 h-4 w-4" />
                {sharing ? "Sharing..." : "Share"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="customize" className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="template">Card Style</Label>
                <Select
                  value={template.id}
                  onValueChange={(value) => {
                    const selected = CARD_TEMPLATES.find((t) => t.id === value);
                    if (selected) setTemplate(selected);
                  }}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_TEMPLATES.map((temp) => (
                      <SelectItem key={temp.id} value={temp.id}>
                        {temp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Card Title</Label>
                <Textarea
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter your insight title"
                  className="resize-none"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insight">Insight Text</Label>
                <Textarea
                  id="insight"
                  value={insight}
                  onChange={(e) => setInsight(e.target.value)}
                  placeholder="Enter your research insight"
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size">Font Size</Label>
                <div className="pt-2">
                  <Slider
                    defaultValue={[fontSize]}
                    min={80}
                    max={120}
                    step={5}
                    onValueChange={handleFontSizeChange}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Smaller</span>
                  <span>{fontSize}%</span>
                  <span>Larger</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="show-logo"
                  checked={showLogo}
                  onCheckedChange={setShowLogo}
                />
                <Label htmlFor="show-logo">Show HydrogenStudies Logo</Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ResearchInsightCard;
