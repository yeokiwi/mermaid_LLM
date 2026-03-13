import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export async function renderDiagram({ mermaidSyntax, outputFormat = 'svg', theme = 'dark', backgroundColor = 'transparent', width, height }) {
  const tmpDir = os.tmpdir();
  const id = randomUUID();
  const inputFile = path.join(tmpDir, `mermaid-${id}.mmd`);
  const outputFile = path.join(tmpDir, `mermaid-${id}.${outputFormat}`);

  try {
    await fs.writeFile(inputFile, mermaidSyntax, 'utf-8');

    const args = [
      '-i', inputFile,
      '-o', outputFile,
      '-t', theme,
      '-b', backgroundColor,
    ];

    if (width) args.push('-w', String(width));
    if (height) args.push('-H', String(height));

    const result = await runMmdc(args);

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || 'Mermaid rendering failed',
      };
    }

    const outputData = await fs.readFile(outputFile);
    let data;
    let filename;

    if (outputFormat === 'png') {
      data = outputData.toString('base64');
      filename = `diagram-${id}.png`;
    } else {
      data = outputData.toString('utf-8');
      filename = `diagram-${id}.svg`;
    }

    return {
      success: true,
      format: outputFormat,
      data,
      filename,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  } finally {
    await fs.unlink(inputFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});
  }
}

function runMmdc(args) {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['--yes', 'mmdc', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    proc.on('error', (err) => {
      resolve({ exitCode: 1, stdout: '', stderr: err.message });
    });
  });
}
