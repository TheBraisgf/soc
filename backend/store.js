import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
export const mediaDir = path.join(root, 'media', 'movies');
export const videosDir = path.join(root, 'videos');

async function read(name, fallback) {
  try { return JSON.parse(await fs.readFile(path.join(dataDir, name), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function write(name, value) {
  await fs.mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, name);
  await fs.writeFile(file + '.tmp', JSON.stringify(value, null, 2));
  await fs.rename(file + '.tmp', file);
}
export const getMovies = () => read('movies.json', []);
export const saveMovies = value => write('movies.json', value);
export const getHistory = () => read('history.json', []);
export const saveHistory = value => write('history.json', value);
export const getSession = () => read('session.json', { id: 1, selectedId: null, rejectedIds: [], missingIds: [], startedAt: null });
export const saveSession = value => write('session.json', value);

export async function ensureData() {
  await fs.mkdir(mediaDir, { recursive: true });
  await fs.mkdir(videosDir, { recursive: true });
  for (const [name, value] of [
    ['movies.json', []],
    ['history.json', []],
    ['session.json', { id: 1, selectedId: null, rejectedIds: [], missingIds: [], startedAt: null }]
  ]) {
    try { await fs.access(path.join(dataDir, name)); }
    catch { await write(name, value); }
  }
}
