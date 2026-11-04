import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Film, Shuffle, Check, X, AlertTriangle, RotateCcw, Volume2, VolumeX,
  Play, Youtube, Search, Tv, FolderOpen, ExternalLink
} from 'lucide-react';

const API = '/api';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function useRetroAudio(enabled) {
  const context = useRef(null);
  const playTone = useCallback((frequency, duration = 0.08, delay = 0) => {
    if (!enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context.current ||= new AudioContext();
    const audio = context.current;
    if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime + delay);
    gain.gain.setValueAtTime(0.0001, audio.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.035, audio.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(audio.currentTime + delay);
    oscillator.stop(audio.currentTime + delay + duration + 0.02);
  }, [enabled]);
  return useCallback(kind => {
    if (kind === 'spin') [240, 310, 390, 480, 590, 720, 880].forEach((f, i) => playTone(f, 0.09, i * 0.11));
    if (kind === 'click') playTone(660, 0.06);
    if (kind === 'win') [440, 554, 659, 880].forEach((f, i) => playTone(f, 0.18, i * 0.13));
    if (kind === 'boot') [330, 440, 550].forEach((f, i) => playTone(f, 0.13, i * 0.12));
  }, [playTone]);
}

function formatSize(bytes) {
  if (!bytes) return '0 MB';
  return bytes > 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB';
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [bootDone, setBootDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [winner, setWinner] = useState(null);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('movies');
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [videoSearch, setVideoSearch] = useState('');
  const [videoRefresh, setVideoRefresh] = useState(0);
  const audio = useRetroAudio(soundOn);

  const movies = data?.movies || [];
  const session = data?.session;
  const available = useMemo(
    () => movies.filter(movie =>
      movie.status !== 'watched' &&
      !session?.rejectedIds?.includes(movie.id) &&
      !session?.missingIds?.includes(movie.id)
    ),
    [movies, session]
  );
  const watched = movies.filter(movie => movie.status === 'watched').length;

  const refresh = useCallback(async () => {
    const response = await fetch(API + '/movies');
    if (!response.ok) throw new Error('No se pudo conectar con SOC Player API.');
    setData(await response.json());
  }, []);

  useEffect(() => { refresh().catch(e => setError(e.message)); }, [refresh]);
  useEffect(() => {
    if (bootDone) return;
    const started = Date.now();
    const timer = setInterval(() => setProgress(Math.min(100, (Date.now() - started) / 12000 * 100)), 50);
    return () => clearInterval(timer);
  }, [bootDone]);

  useEffect(() => {
    if (tab !== 'videos') return;
    let active = true;
    setVideosLoading(true);
    setVideosError('');
    fetch(API + '/videos')
      .then(response => {
        if (!response.ok) throw new Error('No se pudo leer la carpeta de vídeos.');
        return response.json();
      })
      .then(result => { if (active) setVideos(result.videos || []); })
      .catch(e => { if (active) setVideosError(e.message); })
      .finally(() => { if (active) setVideosLoading(false); });
    return () => { active = false; };
  }, [tab, videoRefresh]);

  const post = async endpoint => {
    const response = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Error');
    await refresh();
    return result;
  };

  const enter = () => {
    if (progress < 100) return;
    audio('boot');
    setBootDone(true);
  };

  useEffect(() => {
    if (bootDone || progress < 100) return;
    const handler = event => { if (event.key === 'Enter') enter(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bootDone, progress]);

  const draw = async () => {
    setNotice('La ruleta está decidiendo vuestro destino…');
    audio('spin');
    setDrawing(true);
    setWinner(null);
    await sleep(2800);
    try {
      const result = await post('/randomizer/draw');
      setWinner(result.movie);
      setNotice('Película seleccionada. No se admiten reclamaciones.');
      audio('win');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setDrawing(false);
    }
  };

  const act = async action => {
    if (!winner) return;
    try {
      await post('/movies/' + winner.id + '/' + action);
      setNotice(action === 'watched' ? 'Película archivada como vista.' :
        action === 'reject' ? 'Rechazada hasta la próxima sesión.' : 'Marcada como no encontrada.');
      setWinner(null);
      audio('click');
    } catch (e) { setNotice(e.message); }
  };

  const reset = async () => {
    try {
      await post('/session/reset');
      setWinner(null);
      setNotice('Nueva sesión. La vergüenza continúa.');
      audio('boot');
    } catch (e) { setNotice(e.message); }
  };

  const playMovie = async () => {
    try {
      const result = await post('/movies/' + winner.id + '/play');
      setNotice(result.message);
    } catch (e) { setNotice(e.message); }
  };

  const filteredVideos = useMemo(() => {
    const query = videoSearch.trim().toLocaleLowerCase('es');
    return videos.filter(video => video.title.toLocaleLowerCase('es').includes(query));
  }, [videos, videoSearch]);

  if (error) return <main className="error-screen"><h1>SOC PLAYER</h1><p>{error}</p><p>Arranca el servidor con <code>npm run dev</code>.</p></main>;
  if (!data) return <main className="boot-screen"><div className="boot-box">CARGANDO SOC PLAYER…</div></main>;

  if (!bootDone) return (
    <main className="boot-screen">
      <div className="boot-box">
        <div className="boot-title"><span>SON OF A COMEDY</span><span>_ □ ×</span></div>
        <div className="boot-body">
          <div className="boot-logo">SOC<span>®</span></div>
          <h1>SON OF A COMEDY</h1>
          <p>PORTO DO SON · SISTEMA DE ENTRETENIMIENTO</p>
          <div className="boot-track"><i style={{ width: progress + '%' }} /></div>
          <div className="boot-percent"><span>PREPARANDO EL DESASTRE</span><b>{Math.floor(progress)}%</b></div>
          <button disabled={progress < 100} onClick={enter}>ENTRAR EN SOC ▶</button>
          <small>{progress < 100 ? 'UN MOMENTO, POR FAVOR…' : 'PULSA ENTER PARA CONTINUAR'}</small>
        </div>
      </div>
      <div className="boot-copyright">SOC ENTERTAINMENT SYSTEM © 2026</div>
    </main>
  );

  return (
    <main className="site">
      <div className="utility-bar"><span>SON OF A COMEDY · PORTO DO SON</span><span>LA WEB OFICIAL DEL EVENTO (NO HAY OTRA)</span></div>
      <header className="masthead">
        <div className="masthead-logo"><span className="logo-soc">SOC</span><div><h1>SON OF A COMEDY</h1><p>PELÍCULAS, VÍDEOS Y OTRAS MALAS DECISIONES</p></div></div>
        <div className="masthead-date">EDICIÓN 2026<br /><b>DESDE 2026</b></div>
      </header>

      <nav className="main-nav">
        <button className={tab === 'movies' ? 'selected' : ''} onClick={() => setTab('movies')}><Film /> PELÍCULAS</button>
        <button className={tab === 'videos' ? 'selected' : ''} onClick={() => setTab('videos')}><Youtube /> EL RELLANO</button>
        <span className="nav-spacer" />
        <button className="sound-toggle" onClick={() => setSoundOn(value => !value)}>{soundOn ? <Volume2 /> : <VolumeX />} SONIDO {soundOn ? 'ON' : 'OFF'}</button>
      </nav>

      {tab === 'movies' ? (
        <>
          <div className="section-title"><span>01.</span><div><h2>LA RULETA DEL DESTINO</h2><p>52 películas. Dos hermanos. Una decisión que nadie quiere tomar.</p></div></div>
          <section className="movie-layout">
            <article className="roulette-box">
              <div className="box-caption"><b>SELECTOR ALEATORIO DE PELÍCULAS</b><span>NO MANIPULADO*</span></div>
              <div className={'roulette-stage ' + (drawing ? 'is-spinning' : '')}>
                <div className="wheel-pointer">▼</div>
                <div className="roulette-wheel">
                  <div className="wheel-rings" />
                  <div className="wheel-slices" />
                  <div className="wheel-hub"><strong>SOC</strong><small>2026</small></div>
                </div>
              </div>
              <div className="roulette-controls">
                <button className="draw-button" disabled={drawing || !available.length} onClick={draw}>
                  <Shuffle /> {drawing ? 'GIRANDO…' : '¡ELEGIR PELÍCULA!'}
                </button>
                <button className="new-session" onClick={reset}><RotateCcw /> NUEVA SESIÓN</button>
              </div>
              <p className="roulette-disclaimer">* La organización no se hace responsable de los resultados.</p>
            </article>

            <aside className="movie-sidebar">
              <div className="winner-box">
                <div className="box-caption"><b>Y EL PREMIO ES PARA…</b><span>★★★</span></div>
                {winner ? (
                  <div className="winner-content">
                    <div className="winner-ribbon">PELÍCULA SELECCIONADA</div>
                    <h3>{winner.title}</h3>
                    <p>La suerte ha hablado. Sed buenos perdedores.</p>
                    <div className="winner-actions">
                      <button className="action-play" onClick={playMovie}><Play /> ABRIR EN VLC</button>
                      <button className="action-watched" onClick={() => act('watched')}><Check /> VISTA</button>
                      <button onClick={() => act('reject')}><X /> PASAR</button>
                      <button onClick={() => act('missing')}><AlertTriangle /> NO ESTÁ</button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-winner"><div className="question-mark">?</div><b>¿QUÉ TOCARÁ?</b><p>La película elegida aparecerá aquí.</p></div>
                )}
              </div>
              <div className="session-box">
                <div className="box-caption"><b>ESTADÍSTICAS DE LA SESIÓN</b><span>EN DIRECTO</span></div>
                <div className="session-numbers">
                  <div><strong>{available.length}</strong><span>DISPONIBLES</span></div>
                  <div><strong>{watched}</strong><span>VISTAS</span></div>
                  <div><strong>{session?.rejectedIds?.length || 0}</strong><span>RECHAZADAS</span></div>
                  <div><strong>{session?.missingIds?.length || 0}</strong><span>NO ESTÁN</span></div>
                </div>
                <div className="session-progress"><i style={{ width: (movies.length ? watched / movies.length * 100 : 0) + '%' }} /></div>
                <p>{watched} de {movies.length} películas vistas en total.</p>
              </div>
            </aside>
          </section>
        </>
      ) : (
        <>
          <div className="section-title"><span>02.</span><div><h2>EL RELLANO · VIDEOTECA</h2><p>Los grandes clásicos de internet que no deberían seguir existiendo.</p></div></div>
          <section className="rellano-page">
            <div className="rellano-heading"><b>EL RELLANO</b><span>VÍDEOS PARA PARTIRSE EL CULO DESDE 2004</span></div>
            <div className="rellano-intro">Bienvenido a nuestra colección de vídeos. Elige uno de la lista y disfrútalo sin salir de esta página.</div>
            {currentVideo && (
              <div className="video-player-box">
                <div className="player-title"><b>{currentVideo.title}</b><span>REPRODUCIENDO EN SOC PLAYER</span></div>
                <video key={currentVideo.url} src={currentVideo.url} controls autoPlay playsInline preload="metadata">
                  Tu navegador no puede reproducir este formato de vídeo.
                </video>
                <div className="player-footer"><span>{currentVideo.name}</span><button onClick={() => setCurrentVideo(null)}>CERRAR REPRODUCTOR ×</button></div>
              </div>
            )}
            <div className="video-list-heading">
              <div><b>VÍDEOS DISPONIBLES</b><span>{videos.length} ARCHIVOS EN LA CARPETA</span></div>
              <label className="video-search"><Search /><input value={videoSearch} onChange={event => setVideoSearch(event.target.value)} placeholder="Buscar vídeo…" /></label>
              <button className="refresh-videos" onClick={() => setVideoRefresh(value => value + 1)}><RotateCcw /> ACTUALIZAR</button>
            </div>
            {videosLoading ? <p className="video-message">LEYENDO LA CARPETA DE VÍDEOS…</p> :
              videosError ? <p className="video-message error">{videosError}</p> :
              filteredVideos.length ? (
                <div className="video-grid">
                  {filteredVideos.map((video, index) => (
                    <button className={'video-card ' + (currentVideo?.url === video.url ? 'playing' : '')} key={video.name} onClick={() => setCurrentVideo(video)}>
                      <span className="video-thumb">
                        {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <><video src={video.url} muted preload="metadata" onLoadedData={event => event.currentTarget.classList.add('ready')} /><span className="thumb-placeholder"><Tv /><b>EL RELLANO</b><small>VÍDEO #{String(index + 1).padStart(3, '0')}</small></span></>}
                        <i><Play /></i>
                      </span>
                      <span className="video-card-title">{video.title}</span>
                      <span className="video-card-meta">ARCHIVO LOCAL · {formatSize(video.size)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-videos"><FolderOpen /><b>NO HAY VÍDEOS TODAVÍA</b><p>Copia tus vídeos a la carpeta <code>videos</code> del proyecto y pulsa «Actualizar».</p><small>Formatos compatibles: MP4, WebM, OGG, OGV y MOV (según navegador).</small></div>
              )}
            <div className="rellano-bottom">EL RELLANO SOC · ARCHIVO LOCAL · PROHIBIDO PONER TEMAS DE BUEN GUSTO</div>
          </section>
        </>
      )}

      <div className="notice" role="status">{notice}</div>
      <footer className="site-footer"><span>SON OF A COMEDY © 2026</span><span>HECHO CON MUY POCO PRESUPUESTO Y MENOS VERGÜENZA</span><span>PORTO DO SON, GALICIA</span></footer>
    </main>
  );
}
