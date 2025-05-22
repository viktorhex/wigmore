interface Node {
    id: string;
    label: string;
    type: 'evidence' | 'inference' | 'conclusion';
    children?: Node[];
  }
  
  interface Edge {
    source: string;
    target: string;
    type: 'support' | 'contradict';
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