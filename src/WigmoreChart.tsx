import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import './WigmoreChart.css';

interface Node {
  id: string;
  label: string;
  type: 'evidence' | 'inference' | 'conclusion';
  children?: Node[];
}

interface Edge {
  source: string | Node;
  target: string | Node;
  type: 'support' | 'contradict';
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

const WigmoreChart: React.FC<WigmoreChartProps> = ({
  data,
  width = 800,
  height = 800,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };

  // Clean and validate data, then build hierarchy
  const { nodes, edges, root } = useMemo(() => {
    // Validate nodes
    const validNodes = data.nodes.filter(
      (node): node is Node =>
        node.id !== undefined &&
        node.id !== '' &&
        ['evidence', 'inference', 'conclusion'].includes(node.type)
    );
    const validNodeIds = new Set(validNodes.map(node => node.id));

    // Validate edges
    const validEdges = data.edges.filter(
      (edge): edge is Edge =>
        edge.source !== undefined &&
        edge.target !== undefined &&
        edge.type !== undefined &&
        ['support', 'contradict'].includes(edge.type) &&
        (typeof edge.source === 'string' ? validNodeIds.has(edge.source) : 'id' in edge.source && validNodeIds.has(edge.source.id)) &&
        (typeof edge.target === 'string' ? validNodeIds.has(edge.target) : 'id' in edge.target && validNodeIds.has(edge.target.id))
    );

    // Build node map for easy lookup
    const nodeMap = new Map<string, Node>();
    validNodes.forEach(node => {
      const nodeCopy = { ...node, children: [] };
      nodeMap.set(node.id, nodeCopy);
    });

    // Build hierarchy (target is parent, source is child)
    validEdges.forEach(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);
      if (sourceNode && targetNode) {
        if (!targetNode.children) targetNode.children = [];
        if (!targetNode.children.includes(sourceNode)) {
          targetNode.children.push(sourceNode);
        }
      }
    });

    // Find root (should be the conclusion node, C1)
    const rootNode = nodeMap.get(
      validNodes.find(node => node.type === 'conclusion')?.id || validNodes[0].id
    );

    console.log('Root Node Before Hierarchy:', rootNode);
    console.log('Nodes:', Array.from(nodeMap.values()));
    console.log('Edges:', validEdges);

    return { nodes: Array.from(nodeMap.values()), edges: validEdges, root: rootNode };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !root || nodes.length === 0) return;

    // Initialize SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Clear previous content
    svg.selectAll('*').remove();

    // Define arrow marker for supporting edges
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'green');

    // Create group for chart
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create tree layout with increased separation
    const treeLayout = tree<Node>()
      .size([chartWidth, chartHeight])
      .separation((a, b) => (a.parent === b.parent ? 3 : 4));

    // Generate hierarchy
    const rootHierarchy: HierarchyPointNode<Node> = treeLayout(hierarchy(root));

    console.log('Hierarchy After Layout:', rootHierarchy);

    // Draw edges (paths)
    const edge = g.selectAll('.edge')
      .data(rootHierarchy.links())
      .enter()
      .append('path')
      .attr('class', 'edge')
      .attr('d', d => {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;
        return `M${targetX},${targetY}L${sourceX},${sourceY}`;
      })
      .attr('fill', 'none')
      .attr('stroke', d => {
        const edgeType = edges.find(
          e => (typeof e.source === 'string' ? e.source : e.source.id) === d.target.data.id &&
               (typeof e.target === 'string' ? e.target : e.target.id) === d.source.data.id
        )?.type;
        return edgeType === 'support' ? 'green' : 'red';
      })
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => {
        const edgeType = edges.find(
          e => (typeof e.source === 'string' ? e.source : e.source.id) === d.target.data.id &&
               (typeof e.target === 'string' ? e.target : e.target.id) === d.source.data.id
        )?.type;
        return edgeType === 'contradict' ? '5,5' : 'none';
      })
      .attr('marker-end', d => {
        const edgeType = edges.find(
          e => (typeof e.source === 'string' ? e.source : e.source.id) === d.target.data.id &&
               (typeof e.target === 'string' ? e.target : e.target.id) === d.source.data.id
        )?.type;
        return edgeType === 'support' ? 'url(#arrow)' : 'none';
      });

    // Add contradiction symbols ('x') on edges
    const contradictSymbol = g.selectAll('.contradict-symbol')
      .data(rootHierarchy.links())
      .enter()
      .filter(d => {
        const edgeType = edges.find(
          e => (typeof e.source === 'string' ? e.source : e.source.id) === d.target.data.id &&
               (typeof e.target === 'string' ? e.target : e.target.id) === d.source.data.id
        )?.type;
        return edgeType === 'contradict';
      })
      .append('text')
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', 'red')
      .text('x');

    // Draw nodes
    const node = g.selectAll<SVGGElement, HierarchyPointNode<Node>>('.node')
      .data(rootHierarchy.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Node shapes based on type
    node.each(function (d) {
      const group = d3.select(this);
      const nodeType = d.data.type;

      if (nodeType === 'evidence') {
        group.append('circle')
          .attr('r', 10)
          .attr('fill', 'lightblue');
      } else if (nodeType === 'inference') {
        group.append('path')
          .attr('d', d3.symbol().type(d3.symbolTriangle).size(150))
          .attr('fill', 'orange');
      } else if (nodeType === 'conclusion') {
        group.append('rect')
          .attr('x', -15)
          .attr('y', -15)
          .attr('width', 30)
          .attr('height', 30)
          .attr('fill', 'purple');
      }
    });

    // Node labels with background
    node.each(function (d) {
      const group = d3.select(this);
      const label = group.append('text')
        .attr('dy', d.data.type === 'conclusion' ? -30 : d.data.type === 'inference' ? 30 : 20)
        .attr('text-anchor', 'middle')
        .text(d.data.label)
        .attr('font-size', '12px');

      // Add background rectangle for label
      const bbox = (label.node() as SVGTextElement).getBBox();
      group.insert('rect', 'text')
        .attr('x', bbox.x - 5)
        .attr('y', bbox.y - 2)
        .attr('width', bbox.width + 10)
        .attr('height', bbox.height + 4)
        .attr('fill', 'white')
        .attr('stroke', 'none');
    });

    // Node IDs with background
    node.each(function (d) {
      const group = d3.select(this);
      const idLabel = group.append('text')
        .attr('dy', d.data.type === 'conclusion' ? -40 : d.data.type === 'inference' ? 40 : 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', 'gray')
        .text(d.data.id);

      // Add background rectangle for ID
      const bbox = (idLabel.node() as SVGTextElement).getBBox();
      group.insert('rect', 'text')
        .attr('x', bbox.x - 5)
        .attr('y', bbox.y - 2)
        .attr('width', bbox.width + 10)
        .attr('height', bbox.height + 4)
        .attr('fill', 'white')
        .attr('stroke', 'none');
    });
  }, [nodes, edges, root, width, height]);

  return nodes.length === 0 ? (
    <div>No valid data to display</div>
  ) : (
    <svg ref={svgRef}></svg>
  );
};

export default WigmoreChart;

export const parseWigmoreText = (text: string): WigmoreData => {
    const lines = text.trim().split('\n');
    let isNodesSection = false;
    let isEdgesSection = false;
    const nodes: Node[] = [];
    const edges: Edge[] = [];
  
    for (const line of lines) {
      if (line === 'Nodes:') {
        isNodesSection = true;
        isEdgesSection = false;
        continue;
      }
      if (line === 'Edges:') {
        isNodesSection = false;
        isEdgesSection = true;
        continue;
      }
  
      if (isNodesSection) {
        const [id, label, type] = line.split('|').map(s => s.trim());
        if (
          id &&
          label &&
          ['evidence', 'inference', 'conclusion'].includes(type)
        ) {
          nodes.push({ id, label, type: type as Node['type'] });
        }
      }
  
      if (isEdgesSection) {
        const [sourceTarget, type] = line.split('|').map(s => s.trim());
        const [source, target] = sourceTarget.split('->').map(s => s.trim());
        if (source && target && ['support', 'contradict'].includes(type)) {
          edges.push({ source, target, type: type as Edge['type'] });
        }
      }
    }
  
    return { nodes, edges };
  };