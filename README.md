# SOC Player 2026

Aplicación oficial del **SON OF A COMEDY**.

## Requisitos
Node.js 20+ y VLC para reproducir películas.

## Arranque
```bash
npm install
npm run dev
```
Abre http://localhost:5173.

## Asociar películas
Rellena el campo `file` en `data/movies.json` con el nombre exacto del vídeo situado en `media/movies/`.
Si Windows no encuentra VLC, copia `.env.example` a `.env` y define `VLC_PATH`.

Los datos de sesión, historial y estados se guardan en `data/`. Conserva esos JSON al actualizar el código.
