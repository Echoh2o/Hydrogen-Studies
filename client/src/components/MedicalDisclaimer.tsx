import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const DISCLAIMER_KEY = "hs_medical_disclaimer_acknowledged";

export default function MedicalDisclaimer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const acknowledged = localStorage.getItem(DISCLAIMER_KEY);
    if (!acknowledged) {
      setVisible(true);
    }
  }, []);

  const acknowledge = () => {
    localStorage.setItem(DISCLAIMER_KEY, new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold">Medical Disclaimer</h2>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The information on this website is for <strong>educational and informational purposes only</strong>.
            It is not intended as medical advice, diagnosis, or treatment.
          </p>
          <p>
            The research presented here represents published scientific studies. Individual results may vary.
            Always consult a qualified healthcare provider before making health decisions.
          </p>
          <p>
            Hydrogen Studies is not affiliated with any medical institution. We compile and summarize
            publicly available research to make it more accessible.
          </p>
        </div>

        <Button
          onClick={acknowledge}
          className="w-full bg-teal-600 hover:bg-teal-700"
        >
          I Understand
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Read our full{" "}
          <a href="/disclaimer" className="text-teal-600 underline">medical disclaimer</a>.
        </p>
      </div>
    </div>
  );
}
