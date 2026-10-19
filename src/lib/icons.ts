// Minimal inline icon set (24x24, stroke-based)
const p = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em">${d}</svg>`;

export const icons = {
	canvas: p('<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="7" y="7" width="4" height="4" rx="1"/><rect x="13" y="12" width="4" height="5" rx="1"/>'),
	markdown: p('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
	drawing: p('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
	image: p('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
	page: p('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M8 8v13"/>'),
	plus: p('<path d="M12 5v14M5 12h14"/>'),
	download: p('<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>'),
	back: p('<path d="m15 18-6-6 6-6"/>'),
	close: p('<path d="M18 6 6 18M6 6l12 12"/>'),
	trash: p('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
	copy: p('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
	upload: p('<path d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14"/>'),
	fit: p('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
	minus: p('<path d="M5 12h14"/>'),
	search: p('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
	layers: p('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
	grid: p('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
	code: p('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>'),
	up: p('<path d="m6 15 6-6 6 6"/>'),
	down: p('<path d="m6 9 6 6 6-6"/>'),
	wrap: p('<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="8" y="8" width="8" height="8" rx="1"/>'),
	parent: p('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/>'),
	undo: p('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
	redo: p('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
	desktop: p('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
	tablet: p('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>'),
	mobile: p('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>'),
	text: p('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
	sparkle: p('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>')
};
