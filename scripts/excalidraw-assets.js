// Copies Excalidraw's fonts into static/ so the editor works without a CDN.
import { cpSync, existsSync } from 'node:fs';

const src = 'node_modules/@excalidraw/excalidraw/dist/prod/fonts';
const dest = 'static/excalidraw/fonts';
if (!existsSync(dest)) cpSync(src, dest, { recursive: true });
