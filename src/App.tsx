import React from 'react';
import WigmoreChart from './WigmoreChart';
import { parseWigmoreText } from './utils/parseWigmoreText';

const App: React.FC = () => {
  const textInput = `
Nodes:
E1 | Witness testimony | evidence
E2 | Documentary evidence | evidence
I1 | Inference of guilt | inference
C1 | Defendant is guilty | conclusion
E3 | Contradictory testimony | evidence
Edges:
E1 -> I1 | support
E2 -> I1 | support
I1 -> C1 | support
E3 -> I1 | contradict
`;

  const wigmoreData = parseWigmoreText(textInput);

  return (
    <div>
      <h1>Wigmore Chart Visualization</h1>
      <WigmoreChart data={wigmoreData} width={800} height={800} />
    </div>
  );
};

export default App;