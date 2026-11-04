import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Film, Shuffle, Check, X, AlertTriangle, RotateCcw, Volume2, VolumeX,
  Play, Youtube, Search, Tv, FolderOpen, Music2
} from 'lucide-react';

const API = '/api';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const shuffled = items => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

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
  const [currentMovie, setCurrentMovie] = useState(null);
  const [movieLoading, setMovieLoading] = useState(false);
  const [movieError, setMovieError] = useState('');
  const [videoSearch, setVideoSearch] = useState('');
  const [videoRefresh, setVideoRefresh] = useState(0);
  const [bootMessage, setBootMessage] = useState(0);
  const [carouselSpin, setCarouselSpin] = useState(null);
  const [carouselRun, setCarouselRun] = useState(0);
  const [anthemPlaying, setAnthemPlaying] = useState(false);
  const [anthemVolume, setAnthemVolume] = useState(0.35);
  const anthemRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const audio = useRetroAudio(soundOn);

  const movies = data?.movies || [];
  const session = data?.session;
  const available = useMemo(
    () => movies.filter(movie =>
      !session?.watchedIds?.includes(movie.id) &&
      !session?.rejectedIds?.includes(movie.id) &&
      !session?.missingIds?.includes(movie.id)
    ),
    [movies, session]
  );
  const watched = session?.watchedIds?.length || 0;
  const rejectedCount = session?.rejectedIds?.length || 0;
  const missingCount = session?.missingIds?.length || 0;

  const refresh = useCallback(async () => {
    const response = await fetch(API + '/movies');
    if (!response.ok) throw new Error('No se pudo conectar con SOC Player API.');
    setData(await response.json());
    hasLoadedRef.current = true;
  }, []);

  useEffect(() => {
    let active = true;
    const loadMovies = () => refresh().catch(e => { if (active && !hasLoadedRef.current) setError(e.message); });
    loadMovies();
    const timer = window.setInterval(loadMovies, 15000);
    window.addEventListener('focus', loadMovies);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', loadMovies); };
  }, [refresh]);

  useEffect(() => {
    if (drawing || winner || !session?.selectedId) return;
    const pendingMovie = movies.find(movie => movie.id === session.selectedId);
    if (pendingMovie) setWinner(pendingMovie);
  }, [drawing, winner, session?.selectedId, movies]);
  useEffect(() => {
    if (bootDone) return;
    const started = Date.now();
    const timer = setInterval(() => setProgress(Math.min(100, (Date.now() - started) / 5000 * 100)), 50);
    const messages = window.setInterval(() => setBootMessage(value => (value + 1) % 5), 1800);
    return () => { clearInterval(timer); clearInterval(messages); };
  }, [bootDone]);

  useEffect(() => {
    if (tab !== 'videos') return;
    let active = true;
    setVideosLoading(true);
    setVideosError('');
    const loadVideos = () => fetch(API + '/videos')
      .then(response => {
        if (!response.ok) throw new Error('No se pudo leer la carpeta de vídeos.');
        return response.json();
      })
      .then(result => { if (active) setVideos(result.videos || []); })
      .catch(e => { if (active) setVideosError(e.message); })
      .finally(() => { if (active) setVideosLoading(false); });
    loadVideos();
    const timer = window.setInterval(loadVideos, 30000);
    const onFocus = () => loadVideos();
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [tab, videoRefresh]);

  const post = async endpoint => {
    const response = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Error');
    await refresh();
    return result;
  };

  const enter = () => {
    audio('boot');
    setBootDone(true);
  };

  const toggleAnthem = async () => {
    const player = anthemRef.current;
    if (!player) return;
    if (player.paused) {
      try { player.volume = anthemVolume; await player.play(); setAnthemPlaying(true); }
      catch { setNotice('No se pudo reproducir SOC2.mp3. Comprueba que el archivo esté en Canciones/.'); }
    } else {
      player.pause();
      setAnthemPlaying(false);
    }
  };

  useEffect(() => {
    if (bootDone || progress < 100) return;
    const handler = event => { if (event.key === 'Enter') enter(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bootDone, progress]);

  const draw = async () => {
    setNotice('A ver qué toca…');
    audio('spin');
    setDrawing(true);
    setWinner(null);
    try {
      const result = await post('/randomizer/draw');
      const selectedMovie = result.movie;
      const pool = available.filter(movie => movie.id !== selectedMovie.id);
      const stopAt = pool.length * 2 + Math.floor(Math.random() * Math.max(1, pool.length));
      const tape = [];
      while (tape.length < stopAt) tape.push(...shuffled(pool));
      tape.length = stopAt;
      tape.push(selectedMovie);
      while (tape.length < stopAt + pool.length * 2 + 1) tape.push(...shuffled(pool));
      setCarouselSpin({ stopAt, movies: tape, selectedId: selectedMovie.id });
      setCarouselRun(run => run + 1);
      await sleep(4800);
      setWinner(selectedMovie);
      setNotice(`Ha salido ${selectedMovie.title}.`);
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
      setNotice(action === 'watched' ? 'Apuntada como vista.' :
        action === 'reject' ? 'Vale, queda fuera por hoy.' : 'Apuntada como no encontrada.');
      setWinner(null);
      audio('click');
    } catch (e) { setNotice(e.message); }
  };

  const reset = async () => {
    try {
      await post('/session/reset');
      setWinner(null);
      setCurrentMovie(null);
      setMovieError('');
      setMovieLoading(false);
      setNotice('Sesión reiniciada.');
      audio('boot');
    } catch (e) { setNotice(e.message); }
  };

  const playMovie = async () => {
    if (!winner) return;
    setMovieError('');
    setMovieLoading(true);
    setCurrentMovie(winner);
    setNotice('Reproduciendo en esta página.');
  };

  const handleMovieDecodeError = async () => {
    setMovieLoading(false);
    setMovieError('El navegador no puede decodificar este archivo. Intentando abrirlo con VLC…');
    try {
      const response = await fetch(API + '/movies/' + encodeURIComponent(currentMovie.id) + '/vlc', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'VLC no está disponible.');
      setMovieError('El navegador no admite este formato. Se ha enviado la película a VLC.');
    } catch (error) {
      setMovieError(`${error.message} Prueba con un archivo MP4 compatible con el navegador.`);
    }
  };

  const playMovieFile = movie => { setMovieError(''); setMovieLoading(true); setCurrentMovie(movie); setWinner(movie); window.setTimeout(() => document.getElementById('movie-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };
  const bootMessages = ['Buscando las películas…', 'Encendiendo el proyector…', 'Preparando el salón…', 'Un momento, que ya casi está.'];
  const carouselMovies = available.length ? [...available, ...available, ...available, ...available] : [];
  const carouselItems = carouselSpin?.movies || carouselMovies;
  const carouselStyle = { '--carousel-index': carouselSpin?.stopAt ?? 0, '--carousel-duration': '4.8s' };

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
          <p>PORTO DO SON · CINE, VÍDEOS Y SOBREMESA</p>
          <div className="boot-track"><i style={{ width: progress + '%' }} /></div>
          <div className="boot-percent"><span>{bootMessages[bootMessage]}</span><b>{Math.floor(progress)}%</b></div>
          <button onClick={enter}>{progress < 100 ? 'SALTAR INTRO ▶' : 'ABRIR LAS PUERTAS ▶'}</button>
          <small>{progress < 100 ? 'O ESPERA A QUE TERMINE EL ESPECTÁCULO…' : 'PULSA ENTER Y CARGA CON LAS CONSECUENCIAS'}</small>
        </div>
      </div>
      <div className="boot-copyright">SOC ENTERTAINMENT SYSTEM © 2026</div>
    </main>
  );

  return (
    <main className="site">
      <div className="utility-bar"><span>SON OF A COMEDY · PORTO DO SON</span><span>PELÍCULAS PARA VER JUNTOS</span></div>
      <header className="masthead">
        <div className="masthead-logo"><span className="logo-soc">SOC</span><div><h1>SON OF A COMEDY</h1><p>PELÍCULAS, VÍDEOS Y LO QUE SURJA</p></div></div>
        <div className="masthead-date">EDICIÓN 2026<br /><b>PORTO DO SON</b></div>
      </header>

      <nav className="main-nav">
        <button className={tab === 'movies' ? 'selected' : ''} onClick={() => setTab('movies')}><Film /> PELÍCULAS</button>
        <button className={tab === 'videos' ? 'selected' : ''} onClick={() => setTab('videos')}><Youtube /> EL RELLANO</button>
        <span className="nav-spacer" />
        <div className="anthem-control">
          <audio ref={anthemRef} src="/songs/SOC2.mp3" preload="none" loop onPlay={() => setAnthemPlaying(true)} onPause={() => setAnthemPlaying(false)} />
          <button className={'anthem-toggle ' + (anthemPlaying ? 'playing' : '')} aria-label={anthemPlaying ? 'Pausar himno SOC' : 'Reproducir himno SOC'} title="Himno SOC2" onClick={toggleAnthem}><Music2 /> <span>{anthemPlaying ? 'SOC2 EN EL AIRE' : 'HIMNO SOC2'}</span></button>
          <input aria-label="Volumen del himno SOC2" type="range" min="0" max="1" step="0.05" value={anthemVolume} onChange={event => { const value = Number(event.target.value); setAnthemVolume(value); if (anthemRef.current) anthemRef.current.volume = value; }} />
        </div>
        <button className="sound-toggle" aria-label={`Efectos de sonido ${soundOn ? 'activados' : 'desactivados'}`} onClick={() => setSoundOn(value => !value)}>{soundOn ? <Volume2 /> : <VolumeX />} EFECTOS {soundOn ? 'ON' : 'OFF'}</button>
      </nav>

      {tab === 'movies' ? (
        <>
          <div className="section-title"><span>01.</span><div><h2>¿QUÉ VEMOS?</h2><p>Elegid una de la lista o dejad que salga sola.</p></div></div>
          <section className="movie-layout">
            <article className="roulette-box">
              <div className="box-caption"><b>EL SORTEO</b><span>{available.length} {available.length === 1 ? 'PELÍCULA' : 'PELÍCULAS'} EN LA BOLSA</span></div>
              <div className={'roulette-stage ' + (drawing ? 'is-spinning' : '')}>
                <div className="carousel-pointer">▼</div>
                <div className="loot-window"><div key={carouselRun} className={'loot-track ' + (drawing && carouselSpin ? 'spinning' : '')} style={carouselStyle}>{carouselItems.map((movie, index) => <div className={'loot-card ' + (carouselSpin?.selectedId === movie.id && carouselSpin.stopAt === index ? 'selected' : '')} key={`${movie.id}-${index}`}><div className="loot-cover">{movie.cover ? <img src={movie.cover} alt="" /> : <div className="cover-placeholder"><Film /><small>PORTADA PENDIENTE</small></div>}</div><b>{movie.title}</b></div>)}</div></div>
                <div className="carousel-pointer bottom">▲</div>
              </div>
              <div className="roulette-controls">
                <button className="draw-button" disabled={drawing || !available.length} onClick={draw}>
                  <Shuffle /> {drawing ? 'A VER, A VER…' : 'SACAR PELÍCULA'}
                </button>
                <button className="new-session" disabled={drawing} onClick={reset}><RotateCcw /> NUEVA SESIÓN</button>
              </div>
              <p className="roulette-disclaimer">Si alguien tiene una propuesta mejor, que la diga ahora.</p>
            </article>

            <aside className="movie-sidebar">
              <div className="winner-box">
                <div className="box-caption"><b>Y EL PREMIO ES PARA…</b><span>★★★</span></div>
                {winner ? (
                  <div className="winner-content">
                    <div className="winner-ribbon">HOY TOCA</div>
                    <h3>{winner.title}</h3>
                    <p>¿La ponemos?</p>
                    <div className="winner-actions">
                      <button className="action-play" onClick={playMovie}><Play /> VER AQUÍ</button>
                      <button className="action-watched" onClick={() => act('watched')}><Check /> YA LA VIMOS</button>
                      <button onClick={() => act('reject')}><X /> HOY NO</button>
                      <button onClick={() => act('missing')}><AlertTriangle /> NO ESTÁ</button>
                    </div>
                    {currentMovie && currentMovie.id === winner.id && <div id="movie-player" className="movie-player-inline">
                      <div className="player-title"><b>{currentMovie.title}</b><span>REPRODUCIENDO AQUÍ</span></div>
                      <div className="movie-video-frame">
                        {movieError ? <div className="movie-play-error"><b>EL PROYECTOR SE HA ATRAGANTADO</b><span>{movieError}</span><small>MKV y AVI suelen necesitar VLC; MP4 suele funcionar en el navegador.</small></div> : <video key={currentMovie.file} src={'/movie-files/' + encodeURIComponent(currentMovie.file)} controls autoPlay playsInline preload="auto" muted={false} onLoadStart={() => { setMovieLoading(true); setMovieError(''); }} onCanPlay={() => setMovieLoading(false)} onError={handleMovieDecodeError} />}
                      </div>
                      <div className="player-footer"><span>{currentMovie.file}</span><button onClick={() => { setCurrentMovie(null); setMovieLoading(false); setMovieError(''); }}>CERRAR SALA ×</button></div>
                    </div>}
                  </div>
                ) : (
                  <div className="empty-winner">
                    <div className="question-mark">{available.length ? '?' : '✓'}</div>
                    <b>{available.length ? 'Todavía no hay película' : movies.length ? 'Por hoy, ya está' : 'No hay películas en la carpeta'}</b>
                    <p>{available.length ? 'Sacad una y vemos qué nos toca.' : movies.length ? 'Ya han salido todas. ¿Otra ronda?' : 'Añade los archivos MP4 a la carpeta Peliculas.'}</p>
                    {!available.length && movies.length > 0 && <button className="new-session" onClick={reset}>OTRA RONDA</button>}
                  </div>
                )}
              </div>
              <div className="session-box">
                <div className="box-caption"><b>ESTA SESIÓN</b><span>EN DIRECTO</span></div>
                <div className="session-numbers">
                  <div><strong>{available.length}</strong><span>DISPONIBLES</span></div>
                  <div><strong>{watched}</strong><span>VISTAS</span></div>
                  <div><strong>{rejectedCount}</strong><span>HOY NO</span></div>
                  <div><strong>{missingCount}</strong><span>NO ENCONTRADAS</span></div>
                </div>
                <div className="session-progress"><i style={{ width: (movies.length ? watched / movies.length * 100 : 0) + '%' }} /></div>
                <p>{available.length ? `Quedan ${available.length} por elegir.` : 'No quedan películas disponibles.'}</p>
              </div>
            </aside>
          </section>
          <section className="movie-gallery">
            <div className="movie-gallery-heading"><b>TODA LA LISTA</b><span>PULSA UNA PORTADA PARA PONER ESA PELÍCULA</span></div>
            <div className="movie-gallery-grid">{movies.map(movie => {
              const rejected = session?.rejectedIds?.includes(movie.id) || session?.missingIds?.includes(movie.id);
              const watchedMovie = session?.watchedIds?.includes(movie.id);
              return <button key={movie.id} className={`movie-card ${watchedMovie ? 'watched' : ''} ${rejected ? 'rejected' : ''}`} onClick={() => playMovieFile(movie)}>
                <span className="movie-card-art">{movie.cover ? <img src={movie.cover} alt="" loading="lazy" /> : <><Film /><small>{movie.file?.split('.').pop()?.toUpperCase()}</small></>}</span>
                <span className="movie-card-title">{movie.title}</span><span className="movie-card-file">{movie.file}</span>
                {(watchedMovie || rejected) && <i>{watchedMovie ? 'VISTA' : session?.missingIds?.includes(movie.id) ? 'NO ESTÁ' : 'PASADA'}</i>}
              </button>;
            })}</div>
          </section>
        </>
      ) : (
        <>
          <div className="section-title"><span>02.</span><div><h2>EL RELLANO</h2><p>Para los vídeos que siempre acaban saliendo en la conversación.</p></div></div>
          <section className="rellano-page">
            <div className="rellano-heading"><b>EL RELLANO</b><span>VÍDEOS PARA PARTIRSE EL CULO DESDE 2004</span></div>
            <div className="rellano-intro">Los vídeos están en la carpeta compartida. Elige uno y se reproduce aquí.</div>
            {currentVideo && (
                <div className="video-player-box" id="rellano-player">
                <div className="player-title"><b>{currentVideo.title}</b><span>REPRODUCIENDO EN SOC PLAYER</span></div>
                <video key={currentVideo.url} src={currentVideo.url} controls autoPlay playsInline preload="metadata">
                  Tu navegador no puede reproducir este formato de vídeo.
                </video>
                <div className="player-footer"><span>{currentVideo.name}</span><button onClick={() => setCurrentVideo(null)}>CERRAR REPRODUCTOR ×</button></div>
              </div>
            )}
            <div className="video-list-heading">
              <div><b>VÍDEOS</b><span>{videos.length} {videos.length === 1 ? 'ARCHIVO' : 'ARCHIVOS'}</span></div>
              <label className="video-search"><Search /><input value={videoSearch} onChange={event => setVideoSearch(event.target.value)} placeholder="Buscar vídeo…" /></label>
              <button className="refresh-videos" onClick={() => setVideoRefresh(value => value + 1)}><RotateCcw /> ACTUALIZAR</button>
            </div>
            {videosLoading ? <p className="video-message">LEYENDO LA CARPETA DE VÍDEOS…</p> :
              videosError ? <p className="video-message error">{videosError}</p> :
              filteredVideos.length ? (
                <div className="video-grid">
                  {filteredVideos.map((video, index) => (
                    <button className={'video-card ' + (currentVideo?.url === video.url ? 'playing' : '')} key={video.name} onClick={() => { setCurrentVideo(video); window.setTimeout(() => document.getElementById('rellano-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>
                      <span className="video-thumb">
                        {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <><video src={video.url} muted preload="metadata" onLoadedMetadata={event => { const v = event.currentTarget; v.currentTime = Math.min(2, Math.max(0, v.duration - 0.1)); }} onSeeked={event => { const v = event.currentTarget; const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(v, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; if (d[0] < 22 && d[1] < 22 && d[2] < 22 && v.currentTime + 2 < v.duration) { v.currentTime = Math.min(v.currentTime + 2, v.duration - 0.1); return; } v.classList.add('ready'); }} /><span className="thumb-placeholder"><Tv /><b>EL RELLANO</b><small>VÍDEO #{String(index + 1).padStart(3, '0')}</small></span></>}
                        <i><Play /></i>
                      </span>
                      <span className="video-card-title">{video.title}</span>
                      <span className="video-card-meta">ARCHIVO LOCAL · {formatSize(video.size)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-videos"><FolderOpen /><b>NO HAY VÍDEOS TODAVÍA</b><p>Añade vídeos a la carpeta <code>Videos</code> junto al proyecto y pulsa «Actualizar».</p><small>Formatos compatibles: MP4, WebM, OGG, OGV y MOV (según navegador).</small></div>
              )}
            <div className="rellano-bottom">EL RELLANO SOC · ARCHIVO LOCAL · PROHIBIDO PONER TEMAS DE BUEN GUSTO</div>
          </section>

        </>
      )}

      <div className="notice" role="status">{notice}</div>
      <footer className="site-footer"><span>SON OF A COMEDY © 2026</span><span>PORTO DO SON, GALICIA</span></footer>
    </main>
  );
}








