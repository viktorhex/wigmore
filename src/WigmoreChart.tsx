import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';

interface Node {
  id: string;
  label: string;
  type: 'evidence' | 'inference' | 'conclusion' | 'explanation' | 'refutation';
  source?: '*' | 'q';
  belief?: '?' | '·' | '··' | '-' | 'oo';
  children?: Node[];
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

// Use React.FC and remove incorrect return type
const WigmoreChart: React.FC<WigmoreChartProps> = ({ data, width = 1400, height = 4000 }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const margin = { top: 200, right: 300, bottom: 200, left: 300 };

  const { nodes, edges, root, nodeMap } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    data.nodes.forEach(node => nodeMap.set(node.id, { ...node, children: node.children || [] }));

    const supportEdges = data.edges.filter(edge => edge.type === 'support');
    supportEdges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (sourceNode && targetNode) {
        targetNode.children = targetNode.children || [];
        if (!targetNode.children.includes(sourceNode)) targetNode.children.push(sourceNode);
      }
    });

    const conclusionNode = nodeMap.get(data.nodes.find(node => node.type === 'conclusion')!.id);
    const refuteNodes = data.edges
      .filter(edge => edge.type === 'refute')
      .map(edge => nodeMap.get(edge.source))
      .filter(node => node && !node.children?.some(child => child.id === conclusionNode?.id));
    refuteNodes.forEach(refuteNode => {
      if (refuteNode && conclusionNode) {
        conclusionNode.children = conclusionNode.children || [];
        if (!conclusionNode.children.includes(refuteNode)) conclusionNode.children.push(refuteNode);
      }
    });

    const rootNode = conclusionNode || nodeMap.get(data.nodes[0].id);
    if(!rootNode) throw 'no rootNode';
    const updatedRoot = { ...nodeMap.get(rootNode.id)!, children: [...(nodeMap.get(rootNode.id)!.children || [])] };

    console.log('nodeMap entries:', Array.from(nodeMap.entries()).map(([id, node]) => ({ id, children: node.children?.map(c => c.id) })));

    return { nodes: Array.from(nodeMap.values()), edges: data.edges, root: updatedRoot, nodeMap };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !root || nodes.length === 0) return;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

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

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxDepth = hierarchy(root).height;
    const levelHeight = chartHeight / (maxDepth + 2);

    const treeLayout = tree<Node>().size([chartWidth, chartHeight]).separation((a, b) => (a.parent === b.parent ? 12 : 15));

    const normalizeNode = (node: Node): Node => ({
      ...node,
      children: node.children || []
    });

    const normalizedRoot = normalizeNode(root);
    const treeData: HierarchyPointNode<Node> = treeLayout(hierarchy(normalizedRoot));

    console.log('Hierarchy descendants:', treeData.descendants().map(d => d.data.id));

    const nodePositions = new Map<string, { x: number; y: number }>();
    treeData.descendants().forEach(d => {
      const adjustedY = d.y + levelHeight * 2;
      nodePositions.set(d.data.id, { x: d.x, y: adjustedY });
    });

    const explainEdges = edges.filter(edge => edge.type === 'explain');
    const refuteEdges = edges.filter(edge => edge.type === 'refute');
    const occupiedYLevels = new Set<number>(Array.from(nodePositions.values()).map(pos => Math.round(pos.y / 50) * 50));

    const explainStagger = levelHeight;
    explainEdges.forEach((edge, i) => {
      const targetPos = nodePositions.get(edge.target);
      if (targetPos) {
        const offsetX = -300;
        let staggerY = targetPos.y + (i - (explainEdges.length - 1) / 2) * explainStagger;
        while (occupiedYLevels.has(Math.round(staggerY / 50) * 50)) staggerY += 50;
        occupiedYLevels.add(Math.round(staggerY / 50) * 50);
        const clampedY = Math.min(staggerY, chartHeight);
        nodePositions.set(edge.source, { x: targetPos.x + offsetX, y: clampedY });
      }
    });

    refuteEdges.forEach((edge, i) => {
      const targetPos = nodePositions.get(edge.target);
      const sourcePos = nodePositions.get(edge.source);
      if (targetPos && sourcePos) {
        const nodesAtSamePosition = Array.from(nodePositions.entries())
          .filter(([id, pos]) => id !== edge.source && Math.abs(pos.x - sourcePos.x) < 10 && Math.abs(pos.y - sourcePos.y) < 10);
        let adjustedY = sourcePos.y;
        if (nodesAtSamePosition.length > 0) {
          adjustedY = sourcePos.y + 50;
          while (occupiedYLevels.has(Math.round(adjustedY / 50) * 50)) adjustedY += 50;
          occupiedYLevels.add(Math.round(adjustedY / 50) * 50);
        }

        const offsetX = 200 + (i * 150);
        let adjustedX = targetPos.x + offsetX;
        const allXPositionsAtY = Array.from(nodePositions.values())
          .filter(pos => Math.abs(pos.y - adjustedY) < 10)
          .map(pos => pos.x);
        while (allXPositionsAtY.some(x => Math.abs(x - adjustedX) < 100)) adjustedX += 50;
        const clampedY = Math.min(adjustedY, chartHeight);
        nodePositions.set(edge.source, { x: adjustedX, y: clampedY });

        const sourceNode = nodeMap.get(edge.source);
        if (sourceNode?.children) {
          sourceNode.children.forEach((child, childIndex) => {
            const childY = clampedY + levelHeight * (childIndex + 1);
            const childX = adjustedX + (childIndex + 1) * 50;
            nodePositions.set(child.id, { x: childX, y: childY });
            occupiedYLevels.add(Math.round(childY / 50) * 50);
          });
        }
      }
    });

    const x2Pos = nodePositions.get('X2') || { x: 400, y: 400 };
    nodePositions.set('R2', { x: x2Pos.x + 200, y: x2Pos.y });
    nodePositions.set('E3', { x: x2Pos.x + 250, y: x2Pos.y + levelHeight });

    const positionArray = Array.from(nodePositions.entries());
    for (let i = 0; i < positionArray.length; i++) {
      const [id1, pos1] = positionArray[i];
      for (let j = i + 1; j < positionArray.length; j++) {
        const [id2, pos2] = positionArray[j];
        if (Math.abs(pos1.x - pos2.x) < 50 && Math.abs(pos1.y - pos2.y) < 50) {
          let adjustedY = pos2.y + 50;
          while (occupiedYLevels.has(Math.round(adjustedY / 50) * 50)) adjustedY += 50;
          occupiedYLevels.add(Math.round(adjustedY / 50) * 50);
          nodePositions.set(id2, { x: pos2.x + 50, y: adjustedY });
        }
      }
    }

    nodePositions.forEach((pos, id) => {
      const clampedX = Math.max(0, Math.min(pos.x, chartWidth));
      const clampedY = Math.max(0, Math.min(pos.y, chartHeight));
      nodePositions.set(id, { x: clampedX, y: clampedY });
    });

    console.log('Final node positions:', Array.from(nodePositions.entries()));

    const edgeGroup = g.append('g').attr('class', 'edges');

    edgeGroup.selectAll('.support-edge')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('d', d => {
        const sourcePos = nodePositions.get(d.source.data.id) || { x: 0, y: 0 };
        const targetPos = nodePositions.get(d.target.data.id) || { x: 0, y: 0 };
        return `M${targetPos.x},${targetPos.y}L${sourcePos.x},${sourcePos.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'green')
      .attr('stroke-width', d => {
        const edge = edges.find(e => e.source === d.target.data.id && e.target === d.source.data.id && e.type === 'support');
        return edge?.strength === 'strong' ? 2 : 1;
      })
      .attr('marker-end', 'url(#arrow)');

    edgeGroup.selectAll('.explain-edge')
      .data(explainEdges)
      .enter()
      .append('path')
      .attr('d', d => {
        const sourcePos = nodePositions.get(d.source) || { x: 0, y: 0 };
        const targetPos = nodePositions.get(d.target) || { x: 0, y: 0 };
        const endX = sourcePos.x + 10;
        return `M${targetPos.x},${targetPos.y}H${endX}V${sourcePos.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'gray')
      .attr('stroke-width', d => d.strength === 'strong' ? 2 : 1)
      .attr('stroke-dasharray', '5,5');

    edgeGroup.selectAll('.refute-edge')
      .data(refuteEdges)
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

    const nodeGroup = g.append('g').attr('class', 'nodes');

    const node = nodeGroup.selectAll<SVGGElement, { data: Node; x: number; y: number }>('.node')
      .data(nodes.map(node => {
        const pos = nodePositions.get(node.id);
        const x = pos ? pos.x : 0;
        const y = pos ? pos.y : 0;
        return { data: node, x, y };
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
  }, [nodes, edges, root, nodeMap]);

  return nodes.length === 0 ? <div>No valid data to display</div> : <svg ref={svgRef}></svg>;
};

export default WigmoreChart;