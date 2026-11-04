# SOC Player 2026

Aplicación oficial del **SON OF A COMEDY**.

## Requisitos
- Node.js 20 o superior.
- VLC para abrir las películas de la ruleta con el reproductor externo.

## Arranque
```bash
npm install
npm run dev
```
Abre http://localhost:5173.

## Películas
Asocia el nombre exacto del archivo en el campo `file` de `data/movies.json`. Los archivos de las películas van en `media/movies/`.

## Videoteca estilo El Rellano
Copia los vídeos sueltos directamente en la carpeta `videos/` que está en la raíz del proyecto. La aplicación escanea esa carpeta automáticamente al entrar en la pestaña **El Rellano**.

Formatos habituales compatibles: MP4, WebM, OGG/OGV y MOV (la reproducción depende del navegador y de los códecs del archivo). Los vídeos se reproducen dentro de la propia página, sin abrir VLC ni otra pestaña.

Para añadir una miniatura personalizada, coloca una imagen con el mismo nombre que el vídeo y extensión JPG, PNG, WEBP o GIF. Ejemplo:
- `Numa Numa.mp4`
- `Numa Numa.jpg`

Pulsa **Actualizar** en la videoteca después de copiar nuevos archivos.

## Datos
Los datos de sesión, historial y estados se guardan en `data/`. Conserva esos JSON al actualizar el código. Los vídeos de `videos/` y las películas de `media/movies/` son archivos locales: no se suben a GitHub.
