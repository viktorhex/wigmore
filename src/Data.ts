export const data = {
    "nodes": [
        { "id": "E1", "label": "Witness testimony", "type": "evidence" },
        { "id": "E2", "label": "Documentary evidence", "type": "evidence" },
        { "id": "I1", "label": "Inference of guilt", "type": "inference" },
        { "id": "C1", "label": "Defendant is guilty", "type": "conclusion" },
        { "id": "E3", "label": "Contradictory testimony", "type": "evidence" }
    ],
    "edges": [
        { "source": "E1", "target": "I1", "type": "support" },
        { "source": "E2", "target": "I1", "type": "support" },
        { "source": "I1", "target": "C1", "type": "support" },
        { "source": "E3", "target": "I1", "type": "contradict" }
    ]
}