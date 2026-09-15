import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DATA = resolve(ROOT, 'data');

export async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(DATA, relativePath), 'utf8')) as T;
}

export async function readPolicyFiles(): Promise<Record<string, string>> {
  const dir = resolve(DATA, 'policies');
  const policies: Record<string, string> = {};
  for (const file of (await readdir(dir)).sort())
    if (file.endsWith('.md'))
      policies[file.slice(0, -3)] = await readFile(resolve(dir, file), 'utf8');
  return policies;
}

export async function readScenarioFiles(): Promise<Record<string, any>> {
  const scenarios: Record<string, any> = {};
  const walk = async (relativeDir: string): Promise<void> => {
    const dir = resolve(DATA, relativeDir);
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.json') && entry.name !== 'index.json')
        scenarios[entry.name.slice(0, -5)] = await readJson(path);
    }
  };
  await walk('scenarios');
  return scenarios;
}
