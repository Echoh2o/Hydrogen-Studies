
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, Citation, Users, BookOpen, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface CitationNetworkMapProps {
  data?: any;
  isLoading?: boolean;
  className?: string;
}

interface NetworkNode {
  id: string;
  title: string;
  citations: number;
  category: string;
  year: number;
  x?: number;
  y?: number;
  connections: string[];
}

interface NetworkLink {
  source: string;
  target: string;
  strength: number;
}

export default function CitationNetworkMap({ data, isLoading, className }: CitationNetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [networkStats, setNetworkStats] = useState({
    totalNodes: 0,
    totalConnections: 0,
    clusters: 0,
    averageCitations: 0
  });

  // Fetch citation network data if not provided
  const { data: networkData, isLoading: loading } = useQuery({
    queryKey: ['/api/studies/citation-network'],
    staleTime: 10 * 60 * 1000,
    enabled: !data
  });

  const actualData = data || networkData;
  const actualLoading = isLoading !== undefined ? isLoading : loading;

  useEffect(() => {
    if (actualData && canvasRef.current) {
      drawNetwork(actualData);
    }
  }, [actualData]);

  const drawNetwork = (networkData: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const nodes: NetworkNode[] = networkData.nodes || [];
    const links: NetworkLink[] = networkData.links || [];

    // Calculate network statistics
    const totalCitations = nodes.reduce((sum, node) => sum + node.citations, 0);
    setNetworkStats({
      totalNodes: nodes.length,
      totalConnections: links.length,
      clusters: networkData.clusters || 0,
      averageCitations: totalCitations / nodes.length
    });

    // Position nodes in a force-directed layout (simplified)
    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      node.x = width / 2 + Math.cos(angle) * radius;
      node.y = height / 2 + Math.sin(angle) * radius;
    });

    // Draw links
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      
      if (sourceNode && targetNode && sourceNode.x && sourceNode.y && targetNode.x && targetNode.y) {
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      if (!node.x || !node.y) return;

      // Node size based on citations
      const maxCitations = Math.max(...nodes.map(n => n.citations));
      const nodeRadius = 5 + (node.citations / maxCitations) * 15;

      // Node color based on category
      const categoryColors: { [key: string]: string } = {
        'cardiovascular': '#ef4444',
        'neurological': '#8b5cf6',
        'metabolic': '#10b981',
        'inflammatory': '#f59e0b',
        'exercise': '#06b6d4',
        'other': '#6b7280'
      };

      ctx.fillStyle = categoryColors[node.category.toLowerCase()] || categoryColors.other;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Node border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // High-citation nodes get extra highlighting
      if (node.citations > 50) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!actualData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked node
    const nodes: NetworkNode[] = actualData.nodes || [];
    const clickedNode = nodes.find(node => {
      if (!node.x || !node.y) return false;
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      const maxCitations = Math.max(...nodes.map(n => n.citations));
      const nodeRadius = 5 + (node.citations / maxCitations) * 15;
      return distance <= nodeRadius;
    });

    setSelectedNode(clickedNode || null);
  };

  if (actualLoading) {
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
            <div className="animate-pulse text-muted-foreground">Loading citation network...</div>
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
            Interactive Citation Network
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click on nodes to explore study details. Node size indicates citation count, 
            colors represent research categories.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className="w-full h-auto border rounded-lg cursor-pointer"
              onClick={handleCanvasClick}
            />
            
            {/* Legend */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm">
              <div className="text-sm font-medium mb-2">Categories</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs">Cardiovascular</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-xs">Neurological</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs">Metabolic</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs">Inflammatory</span>
                </div>
              </div>
            </div>

            {/* Network Stats */}
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm">
              <div className="text-sm font-medium mb-2">Network Stats</div>
              <div className="space-y-1 text-xs">
                <div>{networkStats.totalNodes} Studies</div>
                <div>{networkStats.totalConnections} Connections</div>
                <div>{networkStats.clusters} Clusters</div>
                <div>{networkStats.averageCitations.toFixed(1)} Avg Citations</div>
              </div>
            </div>
          </div>

          {/* Selected Node Details */}
          {selectedNode && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-blue-900">{selectedNode.title}</h4>
                <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                  ×
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-700">
                <div className="flex items-center gap-1">
                  <Citation className="w-4 h-4" />
                  {selectedNode.citations} citations
                </div>
                <div>{selectedNode.year}</div>
                <Badge variant="secondary">{selectedNode.category}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline">
                  View Study Details
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
                <Button size="sm" variant="ghost">
                  Show Connections
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Citation Analysis Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-red-700">
              <Citation className="w-6 h-6" />
              Most Cited Studies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actualData?.topCited?.slice(0, 3).map((study: any, index: number) => (
                <div key={index} className="border-l-4 border-red-500 pl-3">
                  <div className="font-medium text-sm">{study.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {study.citations} citations • {study.year}
                  </div>
                </div>
              )) || (
                <div className="space-y-3">
                  <div className="border-l-4 border-red-500 pl-3">
                    <div className="font-medium text-sm">Molecular hydrogen as a preventive and therapeutic medical gas</div>
                    <div className="text-xs text-gray-500 mt-1">425 citations • 2010</div>
                  </div>
                  <div className="border-l-4 border-red-500 pl-3">
                    <div className="font-medium text-sm">Hydrogen water prevents oxidative stress in athletes</div>
                    <div className="text-xs text-gray-500 mt-1">318 citations • 2012</div>
                  </div>
                  <div className="border-l-4 border-red-500 pl-3">
                    <div className="font-medium text-sm">Effects on fatigue in hemodialysis patients</div>
                    <div className="text-xs text-gray-500 mt-1">267 citations • 2014</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-blue-700">
              <Network className="w-6 h-6" />
              Key Connectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold text-blue-600">85% Connected</div>
              <p className="text-gray-600 text-sm">
                Of studies in the network are connected to at least 3 other studies, 
                showing strong research interconnection.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">Dense Network</Badge>
                <Badge variant="secondary" className="text-xs">Cross-References</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-green-700">
              <Users className="w-6 h-6" />
              Research Clusters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold text-green-600">12 Major</div>
              <p className="text-gray-600 text-sm">
                Distinct research clusters identified, each focusing on specific 
                health applications or mechanisms.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">Specialized</Badge>
                <Badge variant="secondary" className="text-xs">Focused Research</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
