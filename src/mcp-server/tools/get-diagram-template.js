import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const TEMPLATE_DESCRIPTIONS = {
  flowchart: "A basic flowchart with decision points and process steps",
  sequenceDiagram: "A sequence diagram showing interactions between participants",
  classDiagram: "A UML class diagram with classes, properties, and relationships",
  "stateDiagram-v2": "A state machine diagram with states and transitions",
  erDiagram: "An entity-relationship diagram for database modeling",
  gantt: "A Gantt chart for project scheduling",
  pie: "A pie chart for proportional data",
  gitGraph: "A git graph showing branches and commits",
  mindmap: "A mind map for hierarchical idea organization",
  timeline: "A timeline diagram for chronological events",
};

export async function getDiagramTemplate(diagramType) {
  const templateFile = path.join(TEMPLATES_DIR, `${diagramType}.mmd`);

  try {
    const template = await fs.readFile(templateFile, 'utf-8');
    return {
      type: diagramType,
      template,
      description: TEMPLATE_DESCRIPTIONS[diagramType] || `Template for ${diagramType} diagram`,
    };
  } catch (err) {
    return {
      type: diagramType,
      template: null,
      description: `No template available for ${diagramType}`,
      error: `Template file not found for type: ${diagramType}`,
    };
  }
}
