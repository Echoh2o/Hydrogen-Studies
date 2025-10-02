import { useLocation } from "wouter";
import { Share2 } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { motion } from "framer-motion";
import { InteractiveButton } from "@/components/ui/interactive-button";

interface InsightCardButtonProps extends ButtonProps {
  studyId: number;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

export default function InsightCardButton({
  studyId,
  variant = "default",
  className,
  ...props
}: InsightCardButtonProps) {
  const [_location, setLocation] = useLocation();

  const handleClick = () => {
    setLocation(`/share-insight/${studyId}`);
  };

  return (
    <InteractiveButton
      variant={variant}
      onClick={handleClick}
      className={className}
      hoverScale={1.05}
      {...props}
    >
      <Share2 className="w-4 h-4 mr-2" />
      Share Insight
    </InteractiveButton>
  );
}
