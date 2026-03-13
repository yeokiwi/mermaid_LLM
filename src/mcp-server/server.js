import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { renderDiagram } from "./tools/render-diagram.js";
import { validateSyntax } from "./tools/validate-syntax.js";
import { listDiagramTypes } from "./tools/list-diagram-types.js";
import { getDiagramTemplate } from "./tools/get-diagram-template.js";
import { getTemplateResource } from "./resources/templates.js";

const server = new McpServer({
  name: "mermaid-diagram-server",
  version: "1.0.0",
});

// Register tools
server.tool(
  "render_diagram",
  "Renders Mermaid diagram syntax into SVG or PNG format",
  {
    mermaidSyntax: z.string().describe("The Mermaid diagram syntax to render"),
    outputFormat: z.enum(["svg", "png"]).default("svg").describe("Output format"),
    theme: z.enum(["default", "dark", "forest", "neutral"]).default("dark").describe("Mermaid theme"),
    backgroundColor: z.string().default("transparent").describe("Background color"),
    width: z.number().optional().describe("Output width in pixels"),
    height: z.number().optional().describe("Output height in pixels"),
  },
  async (args) => {
    const result = await renderDiagram(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

server.tool(
  "validate_syntax",
  "Validates Mermaid syntax without rendering",
  {
    mermaidSyntax: z.string().describe("The Mermaid syntax to validate"),
  },
  async (args) => {
    const result = await validateSyntax(args.mermaidSyntax);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

server.tool(
  "list_diagram_types",
  "Lists all supported Mermaid diagram types with descriptions",
  {},
  async () => {
    const result = listDiagramTypes();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

server.tool(
  "get_diagram_template",
  "Returns a starter Mermaid template for the requested diagram type",
  {
    diagramType: z.string().describe("The diagram type to get a template for"),
  },
  async (args) => {
    const result = await getDiagramTemplate(args.diagramType);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

// Register resource template
server.resource(
  "diagram-template",
  "mermaid://templates/{type}",
  async (uri, { type }) => {
    const result = await getTemplateResource(type);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
