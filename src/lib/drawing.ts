// Drawing items store an Excalidraw scene as JSON, plus the PNG the editor last rendered of it
// (an upload named drawing-<id>.png). Previews and the zip export use that PNG.
import type { Item, ItemType } from './types.ts';

export type DrawingData = {
	elements: unknown[];
	appState: { viewBackgroundColor?: string };
	files: Record<string, unknown>;
	/** uploaded filename of the latest render, if any */
	png?: string | null;
	/** render time, used to bust the browser cache */
	pngAt?: number;
};

export function parseDrawing(content: string): DrawingData {
	try {
		const d = JSON.parse(content);
		if (d && Array.isArray(d.elements)) return { appState: {}, files: {}, ...d };
	} catch {
		/* empty or invalid */
	}
	return { elements: [], appState: {}, files: {} };
}

export const drawingPng = (content: string) => parseDrawing(content).png ?? null;

/** Things that render as a picture: images and drawings. */
export const isVisual = (type: ItemType | undefined) => type === 'image' || type === 'drawing';

/** Display URL of an image or a drawing's render ('' if none). */
export function visualSrc(it: Item | undefined): string {
	if (!it) return '';
	if (it.type === 'image') return it.content ? `/uploads/${it.content}` : '';
	if (it.type === 'drawing') {
		const d = parseDrawing(it.content);
		return d.png ? `/uploads/${d.png}?v=${d.pngAt ?? 0}` : '';
	}
	return '';
}
