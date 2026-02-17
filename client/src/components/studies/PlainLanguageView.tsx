import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, ThumbsUp, Activity, CheckCircle2 } from "lucide-react";

interface Study {
  id: number;
  plainLanguageSummary?: string;
  keyFindings?: string;
  healthBenefits?: string;
  objective?: string;
  conclusionShort?: string;
}

interface PlainLanguageViewProps {
  study: Study;
}

export function PlainLanguageView({ study }: PlainLanguageViewProps) {
  // If we don't have enough "plain language" data, we might want to encourage the user to check the scientific view
  const hasData = study.plainLanguageSummary || study.keyFindings || study.healthBenefits;

  if (!hasData) {
      return (
          <Card className="bg-gray-50 border-dashed">
              <CardContent className="pt-6 text-center text-gray-500">
                  <p>A simplified summary is not yet available for this study.</p>
                  <p className="text-sm mt-1">Please switch to the <strong>Scientific View</strong> for full details.</p>
              </CardContent>
          </Card>
      );
  }

  return (
    <div className="space-y-6">
      {/* Main Summary */}
      {study.plainLanguageSummary && (
        <Card className="border-teal-100 shadow-sm overflow-hidden">
          <div className="bg-teal-50/50 p-4 border-b border-teal-100 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-teal-900">What is this study about?</h3>
          </div>
          <CardContent className="pt-6">
            <p className="text-gray-700 leading-relaxed text-lg">
              {study.plainLanguageSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key Findings */}
      {study.keyFindings && (
        <Card className="border-emerald-100 shadow-sm overflow-hidden">
           <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-emerald-900">Key Takeaways</h3>
          </div>
          <CardContent className="pt-6">
            <p className="text-gray-700 leading-relaxed">
              {study.keyFindings}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Health Benefits */}
      {study.healthBenefits && (
        <Card className="border-purple-100 shadow-sm overflow-hidden">
          <div className="bg-purple-50/50 p-4 border-b border-purple-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">Potential Health Benefits</h3>
          </div>
          <CardContent className="pt-6">
             <p className="text-gray-700">{study.healthBenefits}</p>
          </CardContent>
        </Card>
      )}
      
       {/* Conclusion/Bottom Line */}
       {study.conclusionShort && !study.keyFindings && (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-gray-600" />
                    The Bottom Line
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-gray-700">{study.conclusionShort}</p>
            </CardContent>
         </Card>
       )}
    </div>
  );
}
