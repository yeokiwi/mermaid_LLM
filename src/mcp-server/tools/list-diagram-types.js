const DIAGRAM_TYPES = [
  { type: "flowchart", description: "Flow charts and process diagrams with nodes and edges", keywords: ["flow", "process", "workflow", "decision", "steps"] },
  { type: "sequenceDiagram", description: "Sequence diagrams showing interactions between actors/systems over time", keywords: ["sequence", "interaction", "message", "request", "response", "api"] },
  { type: "classDiagram", description: "UML class diagrams showing classes, properties, methods, and relationships", keywords: ["class", "object", "inheritance", "oop", "uml", "interface"] },
  { type: "stateDiagram-v2", description: "State machine diagrams showing states and transitions", keywords: ["state", "transition", "machine", "status", "lifecycle"] },
  { type: "erDiagram", description: "Entity-relationship diagrams for database schemas and data models", keywords: ["entity", "relationship", "database", "schema", "table", "er"] },
  { type: "gantt", description: "Gantt charts for project scheduling and timelines", keywords: ["gantt", "schedule", "timeline", "project", "task", "milestone"] },
  { type: "pie", description: "Pie charts for proportional data visualization", keywords: ["pie", "percentage", "proportion", "share", "distribution"] },
  { type: "gitGraph", description: "Git branch and commit history visualization", keywords: ["git", "branch", "commit", "merge", "version"] },
  { type: "mindmap", description: "Mind maps for brainstorming and hierarchical idea organization", keywords: ["mindmap", "brainstorm", "idea", "hierarchy", "concept"] },
  { type: "timeline", description: "Timeline diagrams for chronological events", keywords: ["timeline", "chronological", "history", "events", "dates"] },
  { type: "quadrantChart", description: "Quadrant charts for 2D categorization (e.g., priority matrices)", keywords: ["quadrant", "matrix", "priority", "categorize", "2d"] },
  { type: "sankey-beta", description: "Sankey diagrams for flow/quantity visualization between nodes", keywords: ["sankey", "flow", "quantity", "energy", "transfer"] },
  { type: "xychart-beta", description: "XY charts (bar and line charts) for data plotting", keywords: ["chart", "bar", "line", "plot", "data", "graph", "xy"] },
  { type: "block-beta", description: "Block diagrams for system architecture and component layouts", keywords: ["block", "architecture", "component", "system", "layout"] },
  { type: "architecture-beta", description: "Architecture diagrams with cloud/service icons", keywords: ["architecture", "cloud", "service", "infrastructure", "deploy"] },
];

export function listDiagramTypes() {
  return DIAGRAM_TYPES;
}
