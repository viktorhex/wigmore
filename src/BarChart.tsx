import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface BarChartProps {
  data: (number | string | undefined)[];
}

const BarChart = ({ data }: BarChartProps) => {
  const svgRef = useRef(null);
  const width = 600;
  const height = 400;
  const margin = { top: 20, right: 30, bottom: 30, left: 40 };

  useEffect(() => {
    // Clean and convert data to numbers, filtering out undefined
    const cleanData = data
      .filter((d): d is number | string => d !== undefined)
      .map(d => +d) // Coerce to number
      .filter(d => !isNaN(d)); // Remove invalid numbers

    if (cleanData.length === 0) return; // Exit if no valid data

    // Select SVG element
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Clear previous content
    svg.selectAll('*').remove();

    // Set up dimensions
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create scales
    const x = d3.scaleBand()
      .domain(cleanData.map((_, i) => i.toString())) // Use string indices
      .range([margin.left, chartWidth + margin.left])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(cleanData) as number]).nice() // d3.max is safe now
      .range([chartHeight, margin.top]);

    // Create axes
    svg.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x).tickFormat(() => ''));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    // Render bars
    svg.selectAll('.bar')
      .data(cleanData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(i.toString()) as number)
      .attr('y', d => y(d))
      .attr('width', x.bandwidth())
      .attr('height', d => chartHeight - y(d))
      .attr('fill', 'steelblue');
  }, [data]);

  return <svg ref={svgRef}></svg>;
};

export default BarChart;