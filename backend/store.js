import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
// Media folders live beside the project (../Peliculas and ../Videos).
export const mediaDir = path.resolve(root, '..', 'Peliculas');
export const videosDir = path.resolve(root, '..', 'Videos');
export const coversDir = path.join(root, 'public', 'covers');
export const songsDir = path.resolve(root, '..', 'Canciones');
const movieExtensions = new Set(['.mkv', '.avi', '.mp4', '.webm', '.mov', '.m4v', '.mpg', '.mpeg']);

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim();
const titleFromFile = file => path.basename(file, path.extname(file)).replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function getMovies() {
  const configured = await read('movies.json', []);
  const entries = await fs.readdir(mediaDir, { withFileTypes: true });
  let files = entries.filter(entry => entry.isFile() && movieExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const browserReadyBases = new Set(files.filter(file => path.extname(file).toLowerCase() === '.mp4').map(file => normalize(path.basename(file, path.extname(file)))));
  files = files.filter(file => !['.mkv', '.avi', '.mpg', '.mpeg'].includes(path.extname(file).toLowerCase()) || !browserReadyBases.has(normalize(path.basename(file, path.extname(file)))));
  const byTitle = new Map(configured.map(movie => [normalize(movie.title), movie]));
  const covers = await fs.readdir(coversDir).catch(() => []);
  const movies = files.map(file => {
    const title = titleFromFile(file);
    const existing = byTitle.get(normalize(title));
    const stableId = 'f_' + Buffer.from(file.toLocaleLowerCase('es')).toString('hex');
    const base = path.basename(file, path.extname(file));
    const cover = covers.find(name => path.parse(name).name.toLocaleLowerCase('es') === base.toLocaleLowerCase('es'));
    return { ...(existing || {}), id: existing?.id || stableId, title: existing?.title || title, file, cover: cover ? '/covers/' + encodeURIComponent(cover) : existing?.cover || null, status: existing?.status || 'pending' };
  });
  return movies;
}

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
export const saveMovies = value => write('movies.json', value);
export const getHistory = () => read('history.json', []);
export const saveHistory = value => write('history.json', value);
export const getSession = () => read('session.json', { id: 1, selectedId: null, rejectedIds: [], missingIds: [], startedAt: null });
export const saveSession = value => write('session.json', value);

export async function ensureData() {
  await fs.access(mediaDir);
  await fs.access(videosDir);
  await fs.access(songsDir);
  await fs.mkdir(coversDir, { recursive: true });
  for (const [name, value] of [
    ['movies.json', []],
    ['history.json', []],
    ['session.json', { id: 1, selectedId: null, rejectedIds: [], missingIds: [], startedAt: null }]
  ]) {
    try { await fs.access(path.join(dataDir, name)); }
    catch { await write(name, value); }
  }
}
