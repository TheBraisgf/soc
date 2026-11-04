# SOC Player 2026

Aplicación oficial del **SON OF A COMEDY**.

## Requisitos
- Node.js 20 o superior.
- HandBrake para crear copias MP4 compatibles con el navegador (opcional pero recomendado para MKV/AVI).

## Arranque
```bash
npm install
npm run dev
```
Abre http://localhost:5173.

## Películas
Los archivos se detectan automáticamente en la carpeta `Peliculas/`, situada junto al proyecto. Cuando hay un MP4 y un MKV/AVI con el mismo nombre base, la app muestra solo el MP4.

Para MKV/AVI, crea una cola en HandBrake y conserva los originales. Elige contenedor MP4, vídeo H.264 (NVEnc si está disponible; la RTX 2060 de este PC lo admite) y audio AAC. H.264/AAC reproduce en más navegadores. La recodificación puede perder algo de calidad; un preset NVEnc de calidad alta suele ser un buen equilibrio.

## Videoteca estilo El Rellano
Copia los vídeos sueltos directamente en la carpeta `Videos/`, situada junto al proyecto. La aplicación vuelve a escanear la carpeta al entrar en la pestaña **El Rellano** y al pulsar **Actualizar**, por lo que los archivos nuevos aparecen sin modificar la aplicación.

Formatos habituales compatibles: MP4, WebM, OGG/OGV y MOV (la reproducción depende del navegador y de los códecs del archivo). Los vídeos se reproducen dentro de la propia página, sin abrir VLC ni otra pestaña.

Para añadir una miniatura personalizada, coloca una imagen con el mismo nombre que el vídeo y extensión JPG, PNG, WEBP o GIF. Ejemplo:
- `Numa Numa.mp4`
- `Numa Numa.jpg`

Pulsa **Actualizar** en la videoteca después de copiar nuevos archivos.

## Himno SOC
El botón discreto **HIMNO SOC2** de la barra superior reproduce `Canciones/SOC2.mp3` y permanece disponible al cambiar entre películas y El Rellano. El deslizador junto al botón controla su volumen.

## Añadir películas
La carpeta `Peliculas/` se vuelve a escanear al cargar la web, al volver a la pestaña y cada 15 segundos. Al copiar un MP4 compatible, aparece automáticamente en la galería y en la selección aleatoria. No hace falta editar `movies.json` ni reiniciar el servidor.

## Datos
Los datos de sesión, historial y estados se guardan en `data/`. Conserva esos JSON al actualizar el código. Las carpetas externas `Videos/` y `Peliculas/` contienen archivos locales y no se suben a GitHub.
