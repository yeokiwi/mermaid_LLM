import { getDiagramTemplate } from '../tools/get-diagram-template.js';

export async function getTemplateResource(type) {
  return getDiagramTemplate(type);
}
