import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Info, Activity, Brain, Heart, Lungs, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BodySystemData {
  system: string;
  count: number;
  studies: number[];
  benefits: string[];
  impactScore: number;
  conditions: string[];
}

interface InteractiveBodyMapProps {
  onSystemClick?: (system: string, studyIds: number[]) => void;
  className?: string;
}

export default function InteractiveBodyMap({ onSystemClick, className }: InteractiveBodyMapProps) {
  const [hoveredSystem, setHoveredSystem] = useState<string | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: systemsData, isLoading } = useQuery<BodySystemData[]>({
    queryKey: ['/api/explorer/body-systems']
  });

  // Create a map for quick lookup
  const systemDataMap = systemsData?.reduce((acc, system) => {
    acc[system.system] = system;
    return acc;
  }, {} as Record<string, BodySystemData>) || {};

  const getSystemColor = (system: string) => {
    const data = systemDataMap[system];
    if (!data) return '#e0e0e0';
    
    const score = data.impactScore;
    if (score >= 80) return '#10b981'; // emerald-500
    if (score >= 60) return '#3b82f6'; // blue-500
    if (score >= 40) return '#8b5cf6'; // violet-500
    if (score >= 20) return '#f59e0b'; // amber-500
    return '#6b7280'; // gray-500
  };

  const getSystemOpacity = (system: string) => {
    if (selectedSystem && selectedSystem !== system) return 0.3;
    if (hoveredSystem === system) return 1;
    return 0.7;
  };

  const handleSystemClick = (system: string) => {
    const data = systemDataMap[system];
    if (data) {
      setSelectedSystem(selectedSystem === system ? null : system);
      if (onSystemClick) {
        onSystemClick(system, data.studies);
      }
    }
  };

  const renderSystemInfo = (system: string) => {
    const data = systemDataMap[system];
    if (!data) return null;

    return (
      <Card className="p-4 bg-white shadow-lg">
        <h3 className="font-bold text-lg mb-2 capitalize">{system} System</h3>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{data.count}</span> studies found
          </p>
          {data.benefits.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1">Key Benefits:</p>
              <div className="flex flex-wrap gap-1">
                {data.benefits.map(benefit => (
                  <Badge key={benefit} variant="secondary" className="text-xs">
                    {benefit}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {data.conditions.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1">Conditions Studied:</p>
              <p className="text-xs text-gray-600">{data.conditions.join(', ')}</p>
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("relative w-full", className)}>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* SVG Body Map */}
          <div className="flex-1">
            <svg
              viewBox="0 0 400 600"
              className="w-full h-auto max-h-[600px]"
              aria-label="Interactive human body map showing hydrogen research impact areas"
            >
              {/* Human body outline */}
              <g id="body-outline">
                <path
                  d="M200 50 Q180 30 160 35 Q150 40 150 55 Q150 70 160 85 L170 120 L150 180 L140 250 L130 350 L125 450 L120 550 L140 560 L160 550 L170 450 L180 350 L200 320 L220 350 L230 450 L240 550 L260 560 L280 550 L275 450 L270 350 L260 250 L250 180 L230 120 L240 85 Q250 70 250 55 Q250 40 240 35 Q220 30 200 50 Z"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="2"
                />
                
                {/* Head */}
                <circle cx="200" cy="50" r="25" fill="none" stroke="#374151" strokeWidth="2" />
              </g>

              {/* Interactive body systems */}
              
              {/* Brain/Neurological System */}
              <motion.g
                id="neurological"
                className="cursor-pointer"
                onClick={() => handleSystemClick('neurological')}
                onMouseEnter={() => setHoveredSystem('neurological')}
                onMouseLeave={() => setHoveredSystem(null)}
                animate={{ opacity: getSystemOpacity('neurological') }}
                data-testid="body-system-neurological"
              >
                <circle
                  cx="200"
                  cy="45"
                  r="18"
                  fill={getSystemColor('neurological')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <Brain className="w-4 h-4" x="192" y="37" stroke="#fff" />
              </motion.g>

              {/* Heart/Cardiovascular System */}
              <motion.g
                id="cardiovascular"
                className="cursor-pointer"
                onClick={() => handleSystemClick('cardiovascular')}
                onMouseEnter={() => setHoveredSystem('cardiovascular')}
                onMouseLeave={() => setHoveredSystem(null)}
                animate={{ opacity: getSystemOpacity('cardiovascular') }}
                data-testid="body-system-cardiovascular"
              >
                <ellipse
                  cx="185"
                  cy="140"
                  rx="25"
                  ry="30"
                  fill={getSystemColor('cardiovascular')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <Heart className="w-4 h-4" x="177" y="132" stroke="#fff" />
              </motion.g>

              {/* Lungs/Respiratory System */}
              <motion.g
                id="respiratory"
                className="cursor-pointer"
                onClick={() => handleSystemClick('respiratory')}
                onMouseEnter={() => setHoveredSystem('respiratory')}
                onMouseLeave={() => setHoveredSystem(null)}
                animate={{ opacity: getSystemOpacity('respiratory') }}
                data-testid="body-system-respiratory"
              >
                <ellipse
                  cx="215"
                  cy="140"
                  rx="25"
                  ry="30"
                  fill={getSystemColor('respiratory')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <Lungs className="w-4 h-4" x="207" y="132" stroke="#fff" />
              </motion.g>

              {/* Digestive System */}
              <motion.g
                id="digestive"
                className="cursor-pointer"
                onClick={() => handleSystemClick('digestive')}
                onMouseEnter={() => setHoveredSystem('digestive')}
                onMouseLeave={() => setHoveredSystem(null)}
                animate={{ opacity: getSystemOpacity('digestive') }}
                data-testid="body-system-digestive"
              >
                <ellipse
                  cx="200"
                  cy="220"
                  rx="30"
                  ry="40"
                  fill={getSystemColor('digestive')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <Activity className="w-4 h-4" x="192" y="212" stroke="#fff" />
              </motion.g>

              {/* Immune System */}
              <motion.g
                id="immune"
                className="cursor-pointer"
                onClick={() => handleSystemClick('immune')}
                onMouseEnter={() => setHoveredSystem('immune')}
                onMouseLeave={() => setHoveredSystem(null)}
                animate={{ opacity: getSystemOpacity('immune') }}
                data-testid="body-system-immune"
              >
                <circle
                  cx="160"
                  cy="200"
                  r="15"
                  fill={getSystemColor('immune')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <circle
                  cx="240"
                  cy="200"
                  r="15"
                  fill={getSystemColor('immune')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <Shield className="w-3 h-3" x="154" y="194" stroke="#fff" />
                <Shield className="w-3 h-3" x="234" y="194" stroke="#fff" />
              </motion.g>

              {/* Renal System */}
              <motion.g
                id="renal"
                className="cursor-pointer"
                onClick={() => handleSystemClick('renal')}
                onMouseEnter={() => setHoveredSystem('renal')}
                onMouseLeave={() => setHoveredSystem(null)}
                animate={{ opacity: getSystemOpacity('renal') }}
                data-testid="body-system-renal"
              >
                <ellipse
                  cx="175"
                  cy="280"
                  rx="20"
                  ry="25"
                  fill={getSystemColor('renal')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <ellipse
                  cx="225"
                  cy="280"
                  rx="20"
                  ry="25"
                  fill={getSystemColor('renal')}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </motion.g>

              {/* Musculoskeletal System */}
              <motion.g
                id="musculoskeletal"
                className="cursor-pointer"
                onClick={() => handleSystemClick('musculoskeletal')}
                onMouseEnter={() => setHoveredSystem('musculoskeletal')}
                onMouseLeave={() => setHoveredSystem(null)}
                animate={{ opacity: getSystemOpacity('musculoskeletal') }}
                data-testid="body-system-musculoskeletal"
              >
                <rect
                  x="145"
                  y="350"
                  width="15"
                  height="180"
                  rx="5"
                  fill={getSystemColor('musculoskeletal')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <rect
                  x="240"
                  y="350"
                  width="15"
                  height="180"
                  rx="5"
                  fill={getSystemColor('musculoskeletal')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <rect
                  x="130"
                  y="120"
                  width="40"
                  height="15"
                  rx="5"
                  fill={getSystemColor('musculoskeletal')}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <rect
                  x="230"
                  y="120"
                  width="40"
                  height="15"
                  rx="5"
                  fill={getSystemColor('musculoskeletal')}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </motion.g>

              {/* Hover tooltips */}
              {hoveredSystem && systemDataMap[hoveredSystem] && !isMobile && (
                <foreignObject x="10" y="10" width="150" height="80">
                  <div className="bg-white p-2 rounded shadow-lg border">
                    <p className="font-semibold text-sm capitalize">{hoveredSystem}</p>
                    <p className="text-xs text-gray-600">
                      {systemDataMap[hoveredSystem].count} studies
                    </p>
                    <p className="text-xs text-blue-600">
                      Impact Score: {systemDataMap[hoveredSystem].impactScore}%
                    </p>
                  </div>
                </foreignObject>
              )}
            </svg>
          </div>

          {/* System Information Panel */}
          <div className="lg:w-96">
            <Card className="p-4">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Body Systems Research Impact
              </h3>

              {selectedSystem ? (
                renderSystemInfo(selectedSystem)
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Click on any body system to explore hydrogen therapy research in that area.
                  </p>
                  
                  {/* Legend */}
                  <div className="border-t pt-3">
                    <p className="text-sm font-semibold mb-2">Impact Score Legend:</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-emerald-500 rounded" />
                        <span className="text-xs">Very High (80-100)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded" />
                        <span className="text-xs">High (60-79)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-violet-500 rounded" />
                        <span className="text-xs">Moderate (40-59)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-amber-500 rounded" />
                        <span className="text-xs">Low (20-39)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-500 rounded" />
                        <span className="text-xs">Minimal (&lt;20)</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Systems */}
                  <div className="border-t pt-3">
                    <p className="text-sm font-semibold mb-2">Top Researched Systems:</p>
                    <div className="space-y-2">
                      {systemsData?.slice(0, 5).map(system => (
                        <button
                          key={system.system}
                          onClick={() => handleSystemClick(system.system)}
                          className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                          data-testid={`top-system-${system.system}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm capitalize">{system.system}</span>
                            <Badge variant="outline" className="text-xs">
                              {system.count} studies
                            </Badge>
                          </div>
                          <div className="flex gap-1 mt-1">
                            {system.benefits.slice(0, 2).map(benefit => (
                              <Badge key={benefit} variant="secondary" className="text-xs">
                                {benefit}
                              </Badge>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}