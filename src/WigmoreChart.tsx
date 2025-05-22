import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  label: string;
  type: 'evidence' | 'inference' | 'conclusion' | 'explanation' | 'refutation';
  source?: '*' | 'q';
  belief?: '?' | '·' | '··' | '-' | 'oo';
}

interface Edge {
  source: string;
  target: string;
  type: 'support' | 'refute' | 'explain';
  strength?: 'strong' | 'weak';
}

interface WigmoreData {
  nodes: Node[];
  edges: Edge[];
}

interface WigmoreChartProps {
  data: WigmoreData;
  width?: number;
  height?: number;
}

const WigmoreChart: React.FC<WigmoreChartProps> = ({ data, width = 1400, height = 4000 }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const margin = { top: 200, right: 300, bottom: 200, left: 300 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const nodeSpacing = 50; // Vertical spacing for readability
  const horizontalOffset = 200; // For explain/refute edges

  const { nodes, edges, nodeMap } = useMemo(() => {
    const nodeMap = new Map<string, Node>(data.nodes.map(node => [node.id, { ...node }]));
    return { nodes: data.nodes, edges: data.edges, nodeMap };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    // Define arrow and cross markers
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'green');

    svg.append('defs').append('marker')
      .attr('id', 'cross')
      .attr('viewBox', '-5 -5 10 10')
      .attr('refX', 0)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M-4,-4L4,4M-4,4L4,-4')
      .attr('stroke', 'black')
      .attr('stroke-width', 2);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => g.attr('transform', event.transform)));

    // Calculate node positions based on edges
    const nodePositions = new Map<string, { x: number; y: number }>();
    const occupiedYLevels = new Set<number>();
    const conclusionNode = nodes.find(node => node.type === 'conclusion') || nodes[0];

    // Initialize conclusion node at top center
    nodePositions.set(conclusionNode.id, { x: chartWidth / 2, y: 0 });
    occupiedYLevels.add(0);

    // Process edges to position nodes
    const processedNodes = new Set<string>([conclusionNode.id]);

    const positionNode = (nodeId: string, parentPos: { x: number; y: number }, edge: Edge, index: number) => {
      if (processedNodes.has(nodeId)) return;
      processedNodes.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) return;

      let x: number, y: number;
      if (edge.type === 'support') {
        // Place below parent
        x = parentPos.x;
        y = parentPos.y + nodeSpacing;
        while (occupiedYLevels.has(Math.round(y / nodeSpacing) * nodeSpacing)) y += nodeSpacing;
      } else if (edge.type === 'explain') {
        // Place to the left
        x = parentPos.x - horizontalOffset;
        y = parentPos.y + (index - edges.filter(e => e.type === 'explain' && e.target === edge.target).length / 2) * nodeSpacing;
        while (occupiedYLevels.has(Math.round(y / nodeSpacing) * nodeSpacing)) y += nodeSpacing;
      } else if (edge.type === 'refute') {
        // Place to the right
        x = parentPos.x + horizontalOffset + (index * nodeSpacing);
        y = parentPos.y;
        while (occupiedYLevels.has(Math.round(y / nodeSpacing) * nodeSpacing)) y += nodeSpacing;
      } else {
        x = parentPos.x;
        y = parentPos.y + nodeSpacing;
      }

      // Clamp positions
      x = Math.max(0, Math.min(x, chartWidth));
      y = Math.max(0, Math.min(y, chartHeight));
      nodePositions.set(nodeId, { x, y });
      occupiedYLevels.add(Math.round(y / nodeSpacing) * nodeSpacing);

      // Process child edges
      edges.filter(e => e.target === nodeId).forEach((childEdge, i) => {
        positionNode(childEdge.source, { x, y }, childEdge, i);
      });
    };

    // Start positioning from conclusion
    edges.filter(e => e.target === conclusionNode.id).forEach((edge, i) => {
      positionNode(edge.source, nodePositions.get(conclusionNode.id)!, edge, i);
    });

    // Draw edges
    const edgeGroup = g.append('g').attr('class', 'edges');

    edgeGroup.selectAll('.support-edge')
      .data(edges.filter(e => e.type === 'support'))
      .enter()
      .append('path')
      .attr('d', d => {
        const sourcePos = nodePositions.get(d.source) || { x: 0, y: 0 };
        const targetPos = nodePositions.get(d.target) || { x: 0, y: 0 };
        return `M${sourcePos.x},${sourcePos.y}L${targetPos.x},${targetPos.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'green')
      .attr('stroke-width', d => d.strength === 'strong' ? 2 : 1)
      .attr('marker-end', 'url(#arrow)');

    edgeGroup.selectAll('.explain-edge')
      .data(edges.filter(e => e.type === 'explain'))
      .enter()
      .append('path')
      .attr('d', d => {
        const sourcePos = nodePositions.get(d.source) || { x: 0, y: 0 };
        const targetPos = nodePositions.get(d.target) || { x: 0, y: 0 };
        return `M${targetPos.x},${targetPos.y}H${sourcePos.x}V${sourcePos.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'gray')
      .attr('stroke-width', d => d.strength === 'strong' ? 2 : 1)
      .attr('stroke-dasharray', '5,5');

    edgeGroup.selectAll('.refute-edge')
      .data(edges.filter(e => e.type === 'refute'))
      .enter()
      .append('path')
      .attr('d', d => {
        const sourcePos = nodePositions.get(d.source) || { x: 0, y: 0 };
        const targetPos = nodePositions.get(d.target) || { x: 0, y: 0 };
        return `M${targetPos.x},${targetPos.y}H${sourcePos.x}V${sourcePos.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', d => d.strength === 'strong' ? 2 : 1)
      .attr('marker-end', 'url(#cross)');

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const node = nodeGroup.selectAll<SVGGElement, { data: Node; x: number; y: number }>('.node')
      .data(nodes.map(node => {
        const pos = nodePositions.get(node.id) || { x: 0, y: 0 };
        return { data: node, x: pos.x, y: pos.y };
      }))
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    node.each(function (d) {
      const group = d3.select(this);
      if (d.data.type === 'evidence') {
        group.append('rect')
          .attr('x', -10)
          .attr('y', -10)
          .attr('width', 20)
          .attr('height', 20)
          .attr('fill', 'lightblue');
      } else if (d.data.type === 'conclusion') {
        group.append('circle')
          .attr('r', 10)
          .attr('fill', 'purple');
      } else if (d.data.type === 'explanation') {
        group.append('path')
          .attr('d', d3.symbol().type(d3.symbolTriangle).size(150))
          .attr('fill', 'gray')
          .attr('transform', 'rotate(-90)');
      } else if (d.data.type === 'refutation') {
        group.append('path')
          .attr('d', d3.symbol().type(d3.symbolTriangle).size(150))
          .attr('fill', 'lightgreen')
          .attr('transform', 'rotate(90)');
      }
    });

    node.filter(d => d.data.source !== undefined)
      .append('text')
      .attr('x', 15)
      .attr('y', 5)
      .attr('font-size', '10px')
      .attr('fill', 'black')
      .text(d => d.data.source!);

    node.filter(d => d.data.belief !== undefined)
      .append('text')
      .attr('x', 0)
      .attr('y', 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .text(d => d.data.belief!);

    node.each(function (d) {
      const group = d3.select(this);
      const label = group.append('text')
        .attr('dy', d.data.type === 'conclusion' ? -30 : 20)
        .attr('text-anchor', 'middle')
        .text(d.data.label)
        .attr('font-size', '12px');

      const bbox = (label.node() as SVGTextElement).getBBox();
      group.insert('rect', 'text')
        .attr('x', bbox.x - 5)
        .attr('y', bbox.y - 2)
        .attr('width', bbox.width + 10)
        .attr('height', bbox.height + 4)
        .attr('fill', 'white');
    });

    node.each(function (d) {
      const group = d3.select(this);
      const idLabel = group.append('text')
        .attr('dy', d.data.type === 'conclusion' ? -40 : 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', 'gray')
        .text(d.data.id);

      const bbox = (idLabel.node() as SVGTextElement).getBBox();
      group.insert('rect', 'text')
        .attr('x', bbox.x - 5)
        .attr('y', bbox.y - 2)
        .attr('width', bbox.width + 10)
        .attr('height', bbox.height + 4)
        .attr('fill', 'white');
    });
  }, [nodes, edges, nodeMap]);

  return nodes.length === 0 ? <div>No valid data to display</div> : <svg ref={svgRef}></svg>;
};

export default WigmoreChart;