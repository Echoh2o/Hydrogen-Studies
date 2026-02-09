import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Study {
  id: number;
  abstract: string;
  participantCount?: number;
  duration?: string;
  dosage?: string;
  deliveryMethod?: string;
  targetDemographic?: string;
  safetyNotes?: string;
  studyType?: string;
  methods?: string;
  results?: string;
  statisticalMethods?: string;
}

interface ScientificViewProps {
  study: Study;
}

export function ScientificView({ study }: ScientificViewProps) {
  return (
    <div className="space-y-6">
      {/* Abstract */}
      <Card>
        <CardHeader>
          <CardTitle>Abstract</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed">{study.abstract}</p>
        </CardContent>
      </Card>

      {/* Experimental Details */}
      <Card>
        <CardHeader>
          <CardTitle>Study Protocol & Design</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {study.studyType && (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Study Type</h4>
                  <p className="text-gray-700">{study.studyType}</p>
                </div>
              )}
              {study.participantCount && (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Sample Size</h4>
                  <p className="text-gray-700">{study.participantCount} participants</p>
                </div>
              )}
              {study.duration && (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Duration</h4>
                  <p className="text-gray-700">{study.duration}</p>
                </div>
              )}
              {study.dosage && (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Intervention/Dosage</h4>
                  <p className="text-gray-700">{study.dosage}</p>
                </div>
              )}
              {study.deliveryMethod && (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Delivery Method</h4>
                  <p className="text-gray-700">{study.deliveryMethod}</p>
                </div>
              )}
               {study.targetDemographic && (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Population</h4>
                  <p className="text-gray-700">{study.targetDemographic}</p>
                </div>
              )}
            </div>
        </CardContent>
      </Card>

      {/* Detailed Methods & Results (if available) */}
      {(study.methods || study.results) && (
          <Card>
              <CardHeader>
                  <CardTitle>Methodology & Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  {study.methods && (
                      <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Methods</h4>
                          <p className="text-gray-700 text-sm leading-relaxed">{study.methods}</p>
                      </div>
                  )}
                  {study.results && (
                      <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Results</h4>
                          <p className="text-gray-700 text-sm leading-relaxed">{study.results}</p>
                      </div>
                  )}
                  {study.statisticalMethods && (
                      <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Statistical Analysis</h4>
                          <p className="text-gray-700 text-sm leading-relaxed">{study.statisticalMethods}</p>
                      </div>
                  )}
              </CardContent>
          </Card>
      )}

      {/* Safety Information */}
      {study.safetyNotes && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">Safety Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700">{study.safetyNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
