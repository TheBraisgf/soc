# SON OF A COMEDY · SOC Player

El salón de mando del SOC: aquí se decide qué película le toca al grupo, se ponen vídeos del Rellano y, si apetece, suena el himno. La decisión puede ser democrática; el resultado, ya tal.

## Arrancar el tinglado

Necesitas Node.js 20 o superior. Desde esta carpeta:

```bash
npm ci
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). `npm run dev` arranca la web y el servidor local. Para generar una versión de producción: `npm run build`.

## Las carpetas

Las carpetas de archivos van junto a `soc`, no dentro del repositorio:

```text
SON OF A COMEDY/
├── Peliculas/       # películas
├── Videos/          # vídeos para El Rellano
├── Canciones/
│   └── SOC2.mp3     # himno oficial, se discute en otra reunión
└── soc/
    ├── public/covers/  # carátulas, dentro del repositorio
    └── data/           # catálogo y estado de las sesiones
```

El servidor busca esos nombres exactos al lado del proyecto. Añade archivos a las carpetas y la web los detecta sin editar código.

## Películas y sorteo

Deja las películas directamente en `Peliculas/`. La carpeta se vuelve a leer al abrir la web, al volver a ella y cada 15 segundos. Se aceptan MP4, MKV, AVI, WebM, MOV, M4V, MPG y MPEG. Si hay un MP4 y un MKV, AVI, MPG o MPEG con el mismo nombre, se usa solo el MP4 para evitar duplicados.

El sorteo baraja las portadas, pero el resultado siempre coincide con la película elegida por el servidor. Una película que ya salió no vuelve a entrar en el sorteo de esa sesión. Al marcarla como vista, pasarla o indicar que no está, queda apartada hasta la siguiente sesión. Una saga con varias partes numeradas favorece la primera: cuando se reconoce la serie, la primera parte tiene cinco veces el peso de cada secuela. El azar sigue teniendo la última palabra.

Para elegir una película concreta, pulsa su carátula en la galería. Los botones del resultado sirven para **YA LA VIMOS**, **HOY NO** o **NO ESTÁ**. **NUEVA SESIÓN** limpia esos estados y permite empezar de cero; el historial anterior se conserva.

### Carátulas

Guarda cada imagen en `soc/public/covers/` con el mismo nombre base que el vídeo. Por ejemplo:

```text
Peliculas/Austin Powers 1.mp4
soc/public/covers/Austin Powers 1.jpg
```

Se aceptan JPG, JPEG, PNG y WebP. La galería usa las mismas portadas en formato vertical. Las carátulas están incluidas en Git para que el selector no aparezca sin vestir.

### Si el navegador no reproduce una película

El reproductor web funciona mejor con MP4 codificado en H.264 y audio AAC. HandBrake puede crear una copia compatible; conserva el original por si acaso. La app intenta abrir VLC cuando el navegador no puede reproducir el archivo. Si VLC no está en su ruta habitual, configura `VLC_PATH` en un archivo `.env` basado en `.env.example` y reinicia el servidor.

## El Rellano

Copia vídeos directamente en `Videos/`. Al entrar en **EL RELLANO** se escanean los archivos; **ACTUALIZAR** vuelve a leer la carpeta. La lista se actualiza sola cada 30 segundos mientras la pestaña está abierta.

Formatos: MP4, WebM, OGG/OGV, MOV y M4V, según el navegador y los códecs. Se reproducen dentro de la página. Para poner una miniatura propia, deja junto al vídeo una imagen con el mismo nombre base, por ejemplo `Numa Numa.mp4` y `Numa Numa.jpg`. Si no hay imagen, la web intenta sacar una captura del vídeo.

## El himno

El botón **HIMNO SOC2** de la barra superior reproduce `Canciones/SOC2.mp3`. Pulsa para ponerlo o pausarlo y ajusta el volumen con el deslizador. Sigue disponible al cambiar entre Películas y El Rellano; el navegador espera a que alguien pulse el botón, como manda la convivencia.

Los efectos de sonido del selector se pueden apagar desde **EFECTOS ON/OFF**.

## Datos y configuración

`data/movies.json`, `data/session.json` y `data/history.json` guardan el catálogo detectado, el estado actual y el historial. El historial no se borra al iniciar otra sesión. Haz una copia de `data/` si quieres conservar el recorrido del evento antes de cambiar archivos a mano.

El puerto del servidor es `3001` por defecto y puede cambiarse con `PORT` en `.env`. La web de desarrollo se sirve en el puerto `5173`.

## Una última cosa

Las películas, los vídeos y `SOC2.mp3` se quedan en las carpetas locales y no forman parte de este repositorio. Las carátulas sí. Así el repo conserva la web y su aspecto sin intentar subir una tarde entera de MP4.
