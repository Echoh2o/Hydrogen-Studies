
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, Citation, BookOpen, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface NetworkNode {
  id: string;
  title: string;
  citations: number;
  category: string;
  year: number;
  x?: number;
  y?: number;
}

interface NetworkLink {
  source: string;
  target: string;
  strength: number;
}

interface CitationNetworkMapProps {
  data?: any;
  isLoading?: boolean;
  className?: string;
}

export default function CitationNetworkMap({ 
  data: propData, 
  isLoading: propLoading, 
  className = "" 
}: CitationNetworkMapProps) {
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);

  // Fetch citation network data if not provided
  const { data: fetchedData, isLoading: fetchLoading } = useQuery({
    queryKey: ['/api/studies/citation-network'],
    enabled: !propData,
    staleTime: 10 * 60 * 1000,
  });

  const networkData = propData || fetchedData;
  const isLoading = propLoading || fetchLoading;

  // Generate mock network data
  const mockNetworkData = {
    nodes: [
      { id: '1', title: 'Molecular hydrogen: preventive and therapeutic medical gas', citations: 425, category: 'Cardiovascular', year: 2010 },
      { id: '2', title: 'Hydrogen water prevents oxidative stress in athletes', citations: 318, category: 'Exercise', year: 2012 },
      { id: '3', title: 'Effects of hydrogen-rich water on fatigue in hemodialysis', citations: 267, category: 'Renal', year: 2014 },
      { id: '4', title: 'Hydrogen inhalation therapy for COPD patients', citations: 189, category: 'Respiratory', year: 2016 },
      { id: '5', title: 'Neuroprotective effects of molecular hydrogen', citations: 234, category: 'Neurological', year: 2015 },
      { id: '6', title: 'Hydrogen therapy in metabolic syndrome', citations: 156, category: 'Metabolic', year: 2017 },
      { id: '7', title: 'Anti-inflammatory properties of hydrogen gas', citations: 203, category: 'Immune', year: 2013 },
      { id: '8', title: 'Hydrogen water for skin health and aging', citations: 142, category: 'Dermatological', year: 2018 },
      { id: '9', title: 'Cardiac protection via hydrogen supplementation', citations: 187, category: 'Cardiovascular', year: 2019 },
      { id: '10', title: 'Hydrogen therapy in cancer treatment', citations: 165, category: 'Oncological', year: 2020 },
    ],
    links: [
      { source: '1', target: '2', strength: 0.8 },
      { source: '1', target: '5', strength: 0.7 },
      { source: '1', target: '7', strength: 0.9 },
      { source: '2', target: '3', strength: 0.6 },
      { source: '2', target: '9', strength: 0.5 },
      { source: '3', target: '4', strength: 0.4 },
      { source: '5', target: '7', strength: 0.8 },
      { source: '5', target: '10', strength: 0.6 },
      { source: '6', target: '8', strength: 0.5 },
      { source: '7', target: '9', strength: 0.7 },
      { source: '8', target: '10', strength: 0.4 },
    ],
    stats: {
      totalNodes: 10,
      totalConnections: 11,
      clusters: 6,
      averageCitations: 228.6
    }
  };

  const displayData = networkData || mockNetworkData;

  // Simple network visualization using Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayData.nodes) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Position nodes in a circular layout
    const nodes = displayData.nodes.map((node: NetworkNode, index: number) => {
      const angle = (index / displayData.nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      const centerX = width / 2;
      const centerY = height / 2;
      
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });

    // Draw links
    if (displayData.links) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      
      displayData.links.forEach((link: NetworkLink) => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x!, sourceNode.y!);
          ctx.lineTo(targetNode.x!, targetNode.y!);
          ctx.globalAlpha = link.strength;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
    }

    // Draw nodes
    nodes.forEach((node: NetworkNode) => {
      const radius = Math.max(8, Math.min(20, node.citations / 20));
      
      // Node circle
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
      
      // Color by category
      const colors = {
        'Cardiovascular': '#ef4444',
        'Exercise': '#22c55e',
        'Renal': '#3b82f6',
        'Respiratory': '#a855f7',
        'Neurological': '#f59e0b',
        'Metabolic': '#10b981',
        'Immune': '#8b5cf6',
        'Dermatological': '#f97316',
        'Oncological': '#dc2626'
      };
      
      ctx.fillStyle = colors[node.category as keyof typeof colors] || '#6b7280';
      ctx.fill();
      
      // Highlight if hovered
      if (hoveredNode?.id === node.id) {
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

  }, [displayData, hoveredNode]);

  // Handle canvas interactions
  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !displayData.nodes) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find hovered node
    const nodes = displayData.nodes.map((node: NetworkNode, index: number) => {
      const angle = (index / displayData.nodes.length) * 2 * Math.PI;
      const radius = Math.min(canvas.width, canvas.height) * 0.3;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });

    const hoveredNode = nodes.find((node: NetworkNode) => {
      const distance = Math.sqrt(Math.pow(x - node.x!, 2) + Math.pow(y - node.y!, 2));
      const nodeRadius = Math.max(8, Math.min(20, node.citations / 20));
      return distance <= nodeRadius;
    });

    setHoveredNode(hoveredNode || null);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Citation Network Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading citation network...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Network Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Citation Network Visualization
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Interactive map showing relationships between highly cited studies. 
            Hover over nodes to see details, click to select.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              className="w-full h-96 border rounded-lg cursor-pointer"
              onMouseMove={handleCanvasMouseMove}
              onClick={handleCanvasClick}
            />
            
            {/* Hover tooltip */}
            {hoveredNode && (
              <div className="absolute top-2 left-2 bg-background border rounded-lg p-3 shadow-lg max-w-xs">
                <div className="font-medium text-sm mb-1">{hoveredNode.title}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Citations: {hoveredNode.citations}</div>
                  <div>Category: {hoveredNode.category}</div>
                  <div>Year: {hoveredNode.year}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Network Statistics */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Studies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {displayData.stats?.totalNodes || displayData.nodes?.length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Connected studies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="w-5 h-5" />
              Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {displayData.stats?.totalConnections || displayData.links?.length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Citation links</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Citation className="w-5 h-5" />
              Avg Citations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(displayData.stats?.averageCitations || 229)}
            </div>
            <p className="text-sm text-muted-foreground">Per study</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {displayData.stats?.clusters || 6}
            </div>
            <p className="text-sm text-muted-foreground">Research areas</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Cited Studies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Citation className="w-5 h-5" />
            Most Cited Studies in Network
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayData.nodes
              ?.sort((a: NetworkNode, b: NetworkNode) => b.citations - a.citations)
              ?.slice(0, 5)
              ?.map((study: NetworkNode, index: number) => (
                <div key={study.id} className="flex items-start gap-4 p-3 rounded-lg border">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm mb-1 line-clamp-2">
                      {study.title}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{study.citations} citations</span>
                      <Badge variant="secondary" className="text-xs">
                        {study.category}
                      </Badge>
                      <span>{study.year}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
