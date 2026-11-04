import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  getMovies, saveMovies, getHistory, saveHistory, getSession, saveSession,
  ensureData, mediaDir, videosDir, coversDir, songsDir
} from './store.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/media', express.static(mediaDir));
app.use('/videos', express.static(videosDir, { fallthrough: false, index: false }));
app.use('/covers', express.static(coversDir, { fallthrough: false, index: false }));
app.use('/movie-files', express.static(mediaDir, { fallthrough: false, index: false }));
app.use('/songs', express.static(songsDir, { fallthrough: false, index: false }));

const port = Number(process.env.PORT || 3001);
const safe = id => /^[a-zA-Z0-9_-]+$/.test(id);
const videoExtensions = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v']);
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

app.get('/api/movies', async (_q, r, n) => {
  try {
    const [movies, history, session] = await Promise.all([getMovies(), getHistory(), getSession()]);
    r.json({
      movies, history, session,
      stats: {
        total: movies.length,
        watched: movies.filter(m => m.status === 'watched').length,
        pending: movies.filter(m => m.status !== 'watched').length
      }
    });
  } catch (e) { n(e); }
});

app.get('/api/videos', async (_q, r, n) => {
  try {
    const entries = await fs.readdir(videosDir, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && videoExtensions.has(path.extname(entry.name).toLowerCase()))
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const videos = await Promise.all(files.map(async (name, index) => {
      const base = name.slice(0, -path.extname(name).length);
      let thumbnail = null;
      for (const ext of imageExtensions) {
        try {
          await fs.access(path.join(videosDir, base + ext));
          thumbnail = '/videos/' + encodeURIComponent(base + ext);
          break;
        } catch { /* no custom thumbnail */ }
      }
      const stat = await fs.stat(path.join(videosDir, name));
      return {
        id: String(index + 1),
        name,
        title: base.replace(/[._-]+/g, ' ').trim(),
        url: '/videos/' + encodeURIComponent(name),
        thumbnail,
        size: stat.size
      };
    }));
    r.json({ videos, count: videos.length });
  } catch (e) { n(e); }
});

app.post('/api/randomizer/draw', async (_q, r, n) => {
  try {
    const movies = await getMovies();
    const s = await getSession();
    const excluded = new Set([...s.rejectedIds, ...s.missingIds]);
    const eligible = movies.filter(m => m.status !== 'watched' && !excluded.has(m.id));
    if (!eligible.length) return r.status(404).json({ error: 'No quedan películas disponibles en esta sesión.' });
    const movie = eligible[Math.floor(Math.random() * eligible.length)];
    s.selectedId = movie.id;
    s.startedAt ||= new Date().toISOString();
    await saveSession(s);
    r.json({ movie, remaining: eligible.length - 1 });
  } catch (e) { n(e); }
});

app.post('/api/movies/:id/:action', async (q, r, n) => {
  try {
    const { id, action } = q.params;
    if (!safe(id)) return r.status(400).json({ error: 'ID no válido.' });
    const movies = await getMovies();
    const movie = movies.find(m => m.id === id);
    if (!movie) return r.status(404).json({ error: 'Película no encontrada.' });
    const s = await getSession();
    const h = await getHistory();
    if (action === 'watched') {
      movie.status = 'watched';
      h.push({ movieId: id, title: movie.title, action, at: new Date().toISOString(), sessionId: s.id });
      s.selectedId = null;
      await Promise.all([saveMovies(movies), saveHistory(h), saveSession(s)]);
    } else if (action === 'reject' || action === 'missing') {
      const key = action === 'reject' ? 'rejectedIds' : 'missingIds';
      if (!s[key].includes(id)) s[key].push(id);
      s.selectedId = null;
      h.push({ movieId: id, title: movie.title, action, at: new Date().toISOString(), sessionId: s.id });
      await Promise.all([saveSession(s), saveHistory(h)]);
    } else return r.status(400).json({ error: 'Acción desconocida.' });
    r.json({ ok: true, movie, session: s });
  } catch (e) { n(e); }
});

app.post('/api/movies/:id/play', async (q, r, n) => {
  try {
    const requestedFile = decodeURIComponent(q.params.id);
    if (path.basename(requestedFile) !== requestedFile) return r.status(400).json({ error: 'Ruta de película no válida.' });
    const movie = (await getMovies()).find(m => m.file === requestedFile || m.id === requestedFile);
    if (!movie) return r.status(404).json({ error: 'Película no encontrada.' });
    if (!movie.file) return r.status(400).json({ error: 'Asocia primero el archivo en data/movies.json.' });
    const file = path.resolve(mediaDir, movie.file);
    if (path.dirname(file) !== mediaDir) return r.status(400).json({ error: 'Ruta no válida.' });
    try { await fs.access(file); } catch { return r.status(404).json({ error: 'No encuentro el vídeo: ' + movie.file }); }
    r.json({ ok: true, title: movie.title, url: '/movie-files/' + encodeURIComponent(movie.file), message: 'Reproducción lista en SOC Player.' });
  } catch (e) { n(e); }
});

app.post('/api/movies/:id/vlc', async (q, r, n) => {
  try {
    const movie = (await getMovies()).find(m => m.id === q.params.id);
    if (!movie?.file) return r.status(404).json({ error: 'No encuentro el archivo de esta película.' });
    const file = path.resolve(mediaDir, movie.file);
    if (path.dirname(file) !== mediaDir) return r.status(400).json({ error: 'Ruta no válida.' });
    await fs.access(file);
    const vlc = process.env.VLC_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe' : 'vlc');
    const child = spawn(vlc, [file], { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', error => { console.error(error); if (!r.headersSent) r.status(500).json({ error: 'No se pudo iniciar VLC. Configura VLC_PATH en .env o usa el reproductor web.' }); });
    child.once('spawn', () => { if (!r.headersSent) r.json({ ok: true, message: 'Enviada a VLC.' }); });
    child.unref();
  } catch (e) { n(e); }
});

app.post('/api/session/reset', async (_q, r, n) => {
  try {
    const old = await getSession();
    const session = { id: old.id + 1, selectedId: null, rejectedIds: [], missingIds: [], startedAt: new Date().toISOString() };
    await saveSession(session);
    r.json({ ok: true, session });
  } catch (e) { n(e); }
});

app.use((e, _q, r, _n) => {
  console.error(e);
  if (!r.headersSent) r.status(500).json({ error: 'Error interno del servidor.' });
});
await ensureData();
app.listen(port, () => console.log('SOC Player API en http://localhost:' + port));






