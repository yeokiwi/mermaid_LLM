import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const config = Object.freeze({
  deepseek: {
    apiKey: requireEnv('DEEPSEEK_API_KEY'),
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  security: {
    allowedRoots: (process.env.ALLOWED_ROOTS || os.homedir()).split(',').map(r => r.trim()),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '1', 10),
  },
  mermaid: {
    theme: process.env.MERMAID_THEME || 'dark',
    outputDir: path.resolve(__dirname, process.env.MERMAID_OUTPUT_DIR || './output/diagrams'),
  },
  parser: {
    strategy: process.env.PARSER_STRATEGY || 'auto',
    maxFiles: parseInt(process.env.MAX_PARSE_FILES || '200', 10),
    maxDepth: parseInt(process.env.MAX_PARSE_DEPTH || '10', 10),
  },
  paths: {
    root: __dirname,
    mcpServer: path.join(__dirname, 'src/mcp-server/server.js'),
    public: path.join(__dirname, 'public'),
    templates: path.join(__dirname, 'src/mcp-server/templates'),
  },
});

export default config;
