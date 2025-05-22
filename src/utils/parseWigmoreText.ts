interface Node {
    id: string;
    label: string;
    type: 'evidence' | 'inference' | 'conclusion' | 'explanation' | 'refutation';
    source?: '*' | 'q'; // Immediately present (*) or judicially noticed (q)
    belief?: '?' | '·' | '··' | '-' | 'oo'; // Belief markers
    children?: Node[];
  }
  
  interface Edge {
    source: string;
    target: string;
    type: 'support' | 'refute' | 'explain';
    strength?: 'strong' | 'weak'; // Strength of the relationship
  }
  
  interface WigmoreData {
    nodes: Node[];
    edges: Edge[];
  }
  
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
        const parts = line.split('|').map(s => s.trim());
        const [id, label, type, ...attributes] = parts;
        if (
          id &&
          label &&
          ['evidence', 'inference', 'conclusion', 'explanation', 'refutation'].includes(type)
        ) {
          const node: Node = { id, label, type: type as Node['type'] };
          attributes.forEach(attr => {
            const [key, value] = attr.split(':').map(s => s.trim());
            if (key === 'source' && ['*', 'q'].includes(value)) {
              node.source = value as '*' | 'q';
            }
            if (key === 'belief' && ['?', '·', '··', '-', 'oo'].includes(value)) {
              node.belief = value as '?' | '·' | '··' | '-' | 'oo';
            }
          });
          nodes.push(node);
        }
      }
  
      if (isEdgesSection) {
        const [sourceTarget, type, ...attributes] = line.split('|').map(s => s.trim());
        const [source, target] = sourceTarget.split('->').map(s => s.trim());
        if (source && target && ['support', 'explain', 'refute'].includes(type)) {
          const edge: Edge = { source, target, type: type as Edge['type'] };
          attributes.forEach(attr => {
            const [key, value] = attr.split(':').map(s => s.trim());
            if (key === 'strength' && ['strong', 'weak'].includes(value)) {
              edge.strength = value as 'strong' | 'weak';
            }
          });
          edges.push(edge);
        }
      }
    }
  
    return { nodes, edges };
  };