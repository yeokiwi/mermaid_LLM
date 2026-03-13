import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export async function validateSyntax(mermaidSyntax) {
  const tmpDir = os.tmpdir();
  const id = randomUUID();
  const inputFile = path.join(tmpDir, `mermaid-validate-${id}.mmd`);
  const outputFile = path.join(tmpDir, `mermaid-validate-${id}.svg`);

  try {
    await fs.writeFile(inputFile, mermaidSyntax, 'utf-8');

    const result = await new Promise((resolve) => {
      const proc = spawn('npx', ['--yes', 'mmdc', '-i', inputFile, '-o', outputFile], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (exitCode) => {
        resolve({ exitCode, stderr });
      });

      proc.on('error', (err) => {
        resolve({ exitCode: 1, stderr: err.message });
      });
    });

    if (result.exitCode === 0) {
      return { valid: true, errors: [] };
    }

    const errors = result.stderr
      .split('\n')
      .filter(line => line.trim().length > 0);

    return { valid: false, errors };
  } catch (err) {
    return { valid: false, errors: [err.message] };
  } finally {
    await fs.unlink(inputFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});
  }
}
