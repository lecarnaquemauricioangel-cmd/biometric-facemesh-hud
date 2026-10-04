<div align="center">

# 🧬 Biometric FaceMesh HUD & Virtual Try-On

**Visión artificial en tiempo real, 100 % en el navegador.**
Seguimiento facial de 478 puntos, telemetría biométrica (EAR, parpadeo y fatiga) y probador virtual de accesorios con renderizado neón.

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision-0097A7?style=for-the-badge&logo=google&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)

[Repositorio](https://github.com/lecarnaquemauricioangel-cmd/biometric-facemesh-hud) · [Instalación](#-instalación-y-ejecución) · [Arquitectura](#-estructura-del-proyecto)

</div>

---

## 📌 Descripción

**Biometric FaceMesh HUD & Virtual Try-On** es una aplicación web que usa la webcam del usuario para detectar el rostro en tiempo real con **MediaPipe FaceLandmarker**: 468 puntos de malla más 10 de iris, hasta **60 FPS** con aceleración por GPU (WebGL) y fallback automático a CPU.

Todo el procesamiento ocurre **en el cliente**: ningún frame de video sale del navegador.

### ✨ Funcionalidades principales

| Módulo | Descripción |
| --- | --- |
| 🛰️ **HUD biométrico** | Malla facial sutil, contornos neón, seguimiento de iris, anillos de escaneo animados, línea de barrido y panel de telemetría flotante. |
| 🧊 **Wireframe 3D** | Teselación completa del rostro coloreada por profundidad (eje Z), sobre un fondo oscuro. |
| 👓 **Virtual Try-On** | 3 accesorios dinámicos (**visor neón futurista**, **aviador de sol** y **máscara cyber**) que escalan con la distancia interocular, rotan con la inclinación de la cabeza y se deforman con el giro para simular perspectiva. |
| 👁️ **Telemetría EAR** | *Eye Aspect Ratio* por ojo, histórico en tiempo real y detección de parpadeo mediante una máquina de estados con umbral configurable. |
| 😴 **Detección de fatiga** | Parpadeos por minuto, **PERCLOS** en una ventana de 30 s y alerta de **microsueño** (ojos cerrados más de 1,5 s). |
| 🧭 **Pose de cabeza** | Pitch, yaw y roll extraídos de la matriz de transformación facial 4×4. |
| 🎛️ **Panel de control** | Cambio de modo, selección de accesorio, calibración de umbrales, **autocalibración del EAR**, suavizado y confianza de detección. |
| 📸 **Snapshot PNG** | Captura y descarga de la imagen con la superposición aplicada. |
| 🛡️ **Estados robustos** | Carga del modelo, permiso denegado, sin cámara (reintento automático al conectarla), cámara ocupada o desconectada, y contexto no seguro. |

**Atajos de teclado:** `H` / `W` / `A` cambian de modo · `0`–`3` cambian de accesorio · `S` captura un snapshot.

---

## 🛠️ Stack tecnológico

- **[React 19](https://react.dev/)**: UI declarativa con componentes memoizados.
- **[TypeScript](https://www.typescriptlang.org/)**: modo `strict`, `exactOptionalPropertyTypes` y `noUnusedLocals`.
- **[Vite 8](https://vite.dev/)**: servidor de desarrollo y build de producción.
- **[Tailwind CSS v4](https://tailwindcss.com/)**: diseño *dark mode* tipo dashboard con acentos neón cian y violeta.
- **[Lucide React](https://lucide.dev/)**: iconografía.
- **[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)**: `FaceLandmarker` (sucesor oficial de `@mediapipe/face_mesh`).
- **Canvas 2D API**: renderizado del HUD, el wireframe y los accesorios procedurales (sin imágenes externas).

---

## 📂 Estructura del proyecto

```text
biometric-facemesh-hud/
├── public/
│   └── favicon.svg
├── scripts/
│   └── copy-mediapipe-wasm.mjs   # Copia el WASM de MediaPipe a public/ (postinstall)
├── src/
│   ├── components/
│   │   ├── CameraFeed.tsx        # <video> fuente + overlays de carga, permisos y errores
│   │   ├── FaceCanvas.tsx        # Loop de requestAnimationFrame: inferencia + render
│   │   ├── ControlPanel.tsx      # Sidebar de modos, accesorios, calibración y captura
│   │   ├── TelemetryCards.tsx    # Tarjetas de pose, EAR, parpadeo y fatiga
│   │   └── Header.tsx            # Cabecera con indicadores de estado
│   ├── hooks/
│   │   ├── useCamera.ts          # getUserMedia, manejo de errores y liberación de pistas
│   │   └── useFaceLandmarker.ts  # Carga/cierre del modelo (GPU → CPU)
│   ├── lib/
│   │   ├── biometrics.ts         # EAR, pose de cabeza, BlinkTracker (PERCLOS / fatiga)
│   │   ├── drawing.ts            # Renderizado del HUD, wireframe y retícula
│   │   ├── accessories.ts        # Visor, aviador y máscara procedurales
│   │   ├── smoothing.ts          # Filtro exponencial de la transformación
│   │   ├── landmarks.ts          # Índices de la topología FaceMesh
│   │   └── snapshot.ts           # Exportación del canvas a PNG
│   ├── App.tsx
│   ├── config.ts
│   ├── types.ts
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tsconfig.app.json
└── package.json
```

### ⚡ Decisiones de rendimiento

- La inferencia corre **solo cuando llega un frame de video nuevo**; las animaciones siguen la frecuencia del monitor.
- La configuración se lee desde *refs*, así que mover un slider no reinicia el loop.
- La telemetría se publica a React a ~10 Hz en lugar de 60 re-renders por segundo.
- Los buffers de landmarks se reutilizan (`Float32Array`) y las colas de métricas tienen tamaño acotado, sin memory leaks.
- Limpieza completa al desmontar: `cancelAnimationFrame`, `track.stop()` y `FaceLandmarker.close()`.

---

## 🚀 Instalación y ejecución

**Requisitos:** Node.js 20+ y una webcam. La cámara solo funciona en `http://localhost` o bajo `https://`.

```bash
# 1. Clonar el repositorio
git clone https://github.com/lecarnaquemauricioangel-cmd/biometric-facemesh-hud.git
cd biometric-facemesh-hud

# 2. Instalar dependencias (también copia el WASM de MediaPipe a public/mediapipe/wasm)
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

Abre **http://localhost:5173** y acepta el permiso de cámara.

| Script | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Type-check estricto + build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run typecheck` | Solo verificación de tipos |

> 💡 Opcional: define `VITE_FACE_MODEL_URL` en un archivo `.env` para servir el modelo `face_landmarker.task` desde tu propio host.

---

## 👤 Autor

**Angel Mauricio Lecarnaque**
GitHub: [@lecarnaquemauricioangel-cmd](https://github.com/lecarnaquemauricioangel-cmd)

📦 Repositorio: [github.com/lecarnaquemauricioangel-cmd/biometric-facemesh-hud](https://github.com/lecarnaquemauricioangel-cmd/biometric-facemesh-hud.git)

---

<div align="center">

Hecho con React, MediaPipe y mucho neón 💜🩵

</div>
