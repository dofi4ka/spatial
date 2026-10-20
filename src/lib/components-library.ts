// Component library for the page builder. Every component is just a starting element:
// tag + brief prompt (+ optional text, layout and children). `v` is a tiny HTML preview
// built from the .pv-* primitives defined in ComponentLibrary.svelte.
import { makeNode, upgradeLayout, type LegacyLayout, type PageNode } from './page';

export type Def = {
	n: string;
	t?: string;
	p?: string;
	x?: string;
	/** legacy units: gap/pad in Tailwind steps (×4px) */
	l?: LegacyLayout;
	c?: Def[];
	v: string;
};
export type Group = { name: string; items: Def[] };

const row: LegacyLayout = { dir: 'row', align: 'center', gap: 2 };
const rowB: LegacyLayout = { dir: 'row', align: 'center', justify: 'between', gap: 4 };
const col = (gap = 2, pad = 0): LegacyLayout => ({ dir: 'col', gap, pad });
const grid = (cols: number, gap = 4): LegacyLayout => ({ dir: 'grid', cols, gap });

// preview snippets
const B = (t = 'Button', k = 'b') => `<i class="pv-${k}">${t}</i>`;
const L = (w = 100) => `<i class="pv-l" style="width:${w}%"></i>`;
const H = (w = 70) => `<i class="pv-h" style="width:${w}%"></i>`;
const I = (t = '') => `<i class="pv-i">${t}</i>`;
const C = (s = 14) => `<i class="pv-c" style="width:${s}px;height:${s}px"></i>`;
const SQ = (h = 28, w = '100%') => `<i class="pv-sq" style="height:${h}px;width:${w}"></i>`;
const R = (...x: string[]) => `<i class="pv-r">${x.join('')}</i>`;
const K = (...x: string[]) => `<i class="pv-k">${x.join('')}</i>`;
const BX = (...x: string[]) => `<i class="pv-bx">${x.join('')}</i>`;
const BDG = (t = 'New') => `<i class="pv-bdg">${t}</i>`;
const IC = '<i class="pv-ic"></i>';
const T = (t: string) => `<i class="pv-t">${t}</i>`;

export const LIBRARY: Group[] = [
	{
		name: 'Buttons & actions',
		items: [
			{ n: 'Primary button', t: 'button', p: 'primary', x: 'Get started', v: B('Get started') },
			{ n: 'Secondary button', t: 'button', p: 'secondary', x: 'Learn more', v: B('Learn more', 'bs') },
			{ n: 'Outline button', t: 'button', p: 'outline', x: 'Button', v: B('Button', 'bo') },
			{ n: 'Ghost button', t: 'button', p: 'ghost', x: 'Cancel', v: B('Cancel', 'bg') },
			{ n: 'Destructive button', t: 'button', p: 'destructive', x: 'Delete', v: B('Delete', 'bd') },
			{ n: 'Link button', t: 'a', p: 'text link styled as a button, underline on hover', x: 'View all →', v: '<i class="pv-a">View all →</i>' },
			{ n: 'Icon button', t: 'button', p: 'square icon-only button with tooltip; icon: settings gear', v: R(`<i class="pv-bo pv-sqb">${IC}</i>`) },
			{ n: 'Button with icon', t: 'button', p: 'primary, leading icon: plus', x: 'New item', v: `<i class="pv-b">＋ New item</i>` },
			{ n: 'Loading button', t: 'button', p: 'primary, loading state with spinner, disabled while loading', x: 'Saving…', v: `<i class="pv-b">◌ Saving…</i>` },
			{ n: 'Button group', t: 'div', p: 'attached group of outline buttons, shared borders', l: { dir: 'row', gap: 0 }, c: [{ n: '', t: 'button', x: 'Day', v: '' }, { n: '', t: 'button', x: 'Week', v: '' }, { n: '', t: 'button', x: 'Month', v: '' }], v: `<i class="pv-r pv-grp">${B('Day', 'bo')}${B('Week', 'bo')}${B('Month', 'bo')}</i>` },
			{ n: 'Split button', t: 'div', p: 'primary action with attached chevron that opens a dropdown of related actions', l: { dir: 'row', gap: 0 }, c: [{ n: '', t: 'button', p: 'primary', x: 'Publish', v: '' }, { n: '', t: 'button', p: 'primary, chevron-down icon only', v: '' }], v: `<i class="pv-r pv-grp">${B('Publish')}${B('▾')}</i>` },
			{ n: 'Floating action button', t: 'button', p: 'circular floating action button fixed to bottom-right corner, plus icon, elevated shadow', v: `<i class="pv-fab">＋</i>` },
			{ n: 'Copy button', t: 'button', p: 'copies a value to clipboard; icon swaps to checkmark for 2s after click', x: 'Copy', v: B('⧉ Copy', 'bo') },
			{ n: 'Toggle button', t: 'button', p: 'pressable toggle (aria-pressed), shows active state when on; icon: bold', v: R(`<i class="pv-bs pv-sqb"><b>B</b></i>`, `<i class="pv-bo pv-sqb"><em>I</em></i>`) }
		]
	},
	{
		name: 'Form inputs',
		items: [
			{ n: 'Labeled field', t: 'label', p: 'form field: label above input, helper text below', l: col(1), c: [{ n: '', t: 'span', x: 'Email', v: '' }, { n: '', t: 'input', x: 'you@example.com', v: '' }, { n: '', t: 'small', p: 'muted helper text', x: "We'll never share your email.", v: '' }], v: K(T('Email'), I('you@example.com'), L(60)) },
			{ n: 'Password input', t: 'div', p: 'password input with eye toggle to show/hide value', l: row, c: [{ n: '', t: 'input', x: '••••••••', l: { w: 'fill' }, v: '' }, { n: '', t: 'button', p: 'ghost icon button: eye', v: '' }], v: I('•••••••• 👁') },
			{ n: 'Search input', t: 'input', p: 'search field with magnifier icon on the left and ⌘K hint on the right', x: 'Search…', v: I('⌕ Search…') },
			{ n: 'Textarea', t: 'textarea', p: 'multi-line text area, auto-grows with content', x: 'Write a message…', v: `<i class="pv-i" style="height:34px;align-items:flex-start">Write a message…</i>` },
			{ n: 'Select dropdown', t: 'select', p: 'native-feeling select with chevron', x: 'Choose an option', v: I('Choose an option ▾') },
			{ n: 'Combobox', t: 'div', p: 'autocomplete combobox: typing filters a floating list of suggestions, keyboard navigable', v: K(I('Ber|'), BX(L(70), L(50))) },
			{ n: 'Tags input', t: 'div', p: 'multi-select input that turns entries into removable chips', v: `<i class="pv-i">${BDG('react ×')}${BDG('svelte ×')}</i>` },
			{ n: 'Number stepper', t: 'div', p: 'numeric input with − and + buttons on either side', l: row, c: [{ n: '', t: 'button', x: '−', v: '' }, { n: '', t: 'input', x: '1', v: '' }, { n: '', t: 'button', x: '+', v: '' }], v: R(B('−', 'bo'), `<i class="pv-i" style="width:26px">1</i>`, B('+', 'bo')) },
			{ n: 'Date picker', t: 'div', p: 'date input that opens a month calendar popover', v: K(I('📅 Oct 19, 2026'), `<i class="pv-cal"></i>`) },
			{ n: 'Date range picker', t: 'div', p: 'two-month calendar for picking a start and end date, with presets (Last 7 days, This month)', v: I('Oct 1 → Oct 19') },
			{ n: 'Time picker', t: 'input', p: 'time input, 15-minute steps', x: '09:30', v: I('🕘 09:30') },
			{ n: 'Color picker', t: 'div', p: 'color swatch button that opens a saturation/hue picker with hex input', v: R(`<i class="pv-sw" style="background:#6366f1"></i>`, I('#6366F1')) },
			{ n: 'File dropzone', t: 'div', p: 'dashed drop zone for files: icon, “Drag files here or browse”, accepted types and max size', v: `<i class="pv-drop">⇪ Drop files or browse</i>` },
			{ n: 'OTP code input', t: 'div', p: 'six single-digit boxes for a one-time code, auto-advance and paste support', l: row, v: R(...Array(6).fill(`<i class="pv-i pv-otp"></i>`)) },
			{ n: 'Range slider', t: 'input', p: 'range slider with value bubble above thumb', v: `<i class="pv-sl"><i></i></i>` },
			{ n: 'Star rating', t: 'div', p: 'interactive 5-star rating input, hover previews value', v: `<i class="pv-t" style="color:#f59e0b;font-size:13px">★★★★☆</i>` },
			{ n: 'Phone input', t: 'div', p: 'phone number field with country flag + dial code dropdown', v: I('🇺🇸 +1 ▾ │ 555 0123') },
			{ n: 'Inline editable text', t: 'span', p: 'text that turns into an input on click; Enter saves, Esc cancels', x: 'Click to rename', v: `<i class="pv-t" style="border-bottom:1px dashed #a1a1aa">Click to rename</i>` },
			{ n: 'Form', t: 'form', p: 'vertical form with fields and a submit row', l: col(4), c: [{ n: '', t: 'input', x: 'Name', v: '' }, { n: '', t: 'input', x: 'Email', v: '' }, { n: '', t: 'div', l: { dir: 'row', justify: 'end', gap: 2 }, c: [{ n: '', t: 'button', p: 'ghost', x: 'Cancel', v: '' }, { n: '', t: 'button', p: 'primary', x: 'Submit', v: '' }], v: '' }], v: K(I('Name'), I('Email'), R(`<i style="flex:1"></i>`, B('Submit'))) }
		]
	},
	{
		name: 'Selection controls',
		items: [
			{ n: 'Checkbox', t: 'label', p: 'checkbox with label', l: row, c: [{ n: '', t: 'input', p: 'checkbox', v: '' }, { n: '', t: 'span', x: 'Remember me', v: '' }], v: R('<i class="pv-chk on"></i>', T('Remember me')) },
			{ n: 'Checkbox list', t: 'fieldset', p: 'group of checkboxes with a legend; includes an indeterminate “select all”', l: col(2), v: K(R('<i class="pv-chk mid"></i>', T('All')), R('<i class="pv-chk on"></i>', T('Email')), R('<i class="pv-chk"></i>', T('SMS'))) },
			{ n: 'Radio group', t: 'fieldset', p: 'radio buttons, one selectable', l: col(2), v: K(R('<i class="pv-rad on"></i>', T('Standard')), R('<i class="pv-rad"></i>', T('Express'))) },
			{ n: 'Toggle switch', t: 'label', p: 'on/off switch with label on the left', l: rowB, c: [{ n: '', t: 'span', x: 'Notifications', v: '' }, { n: '', t: 'button', p: 'switch (role=switch), on', v: '' }], v: R(T('Notifications'), '<i style="flex:1"></i>', '<i class="pv-tg on"></i>') },
			{ n: 'Segmented control', t: 'div', p: 'segmented control, one segment active, sliding indicator', l: { dir: 'row', gap: 0 }, c: [{ n: '', t: 'button', p: 'active', x: 'List', v: '' }, { n: '', t: 'button', x: 'Board', v: '' }, { n: '', t: 'button', x: 'Calendar', v: '' }], v: `<i class="pv-seg"><i class="on">List</i><i>Board</i><i>Cal</i></i>` },
			{ n: 'Filter chips', t: 'div', p: 'row of toggleable filter pills; selected ones show a check', l: { dir: 'row', wrap: true, gap: 2 }, v: R(BDG('✓ Open'), BDG('Closed'), BDG('Mine')) },
			{ n: 'Choice cards', t: 'div', p: 'large selectable cards acting as radio options, each with icon, title, description', l: grid(3), v: R(BX(IC, L(80)), BX(IC, L(60)), BX(IC, L(70))) },
			{ n: 'Color swatches', t: 'div', p: 'selectable color circles, selected has a ring', l: row, v: R(...['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'].map((c) => `<i class="pv-sw" style="background:${c};border-radius:99px"></i>`)) },
			{ n: 'Size selector', t: 'div', p: 'product size options (XS–XL) as square buttons; unavailable ones struck through', l: row, v: R(B('S', 'bo'), B('M'), B('L', 'bo'), `<i class="pv-bo" style="text-decoration:line-through;opacity:.5">XL</i>`) }
		]
	},
	{
		name: 'Navigation',
		items: [
			{ n: 'Navbar', t: 'nav', p: 'top navigation bar: logo left, links in the middle, primary action right; sticks to the top and gains a shadow on scroll', l: { ...rowB, pad: 4 }, c: [{ n: '', t: 'a', p: 'logo', x: 'Acme', v: '' }, { n: '', t: 'ul', p: 'nav links', l: { dir: 'row', gap: 6 }, c: [{ n: '', t: 'li', x: 'Product', v: '' }, { n: '', t: 'li', x: 'Pricing', v: '' }, { n: '', t: 'li', x: 'Docs', v: '' }], v: '' }, { n: '', t: 'button', p: 'primary', x: 'Sign up', v: '' }], v: BX(R(`<b class="pv-t">Acme</b>`, '<i style="flex:1"></i>', L(14), L(14), L(14), B('Sign up'))) },
			{ n: 'Sidebar navigation', t: 'aside', p: 'vertical app sidebar: workspace switcher on top, grouped nav links with icons, user menu at the bottom', l: col(1, 3), v: BX(K(R(C(10), L(50)), R(IC, L(60)), `<i class="pv-r pv-act">${IC}${L(50)}</i>`, R(IC, L(55)))) },
			{ n: 'Breadcrumbs', t: 'nav', p: 'breadcrumb trail separated by slashes; last item is current page', x: 'Home / Projects / Spatial', v: T('Home / Projects / <b>Spatial</b>') },
			{ n: 'Tabs', t: 'div', p: 'horizontal tabs with underline on active tab, content panel below', l: col(4), c: [{ n: '', t: 'div', p: 'tab list', l: { dir: 'row', gap: 4 }, c: [{ n: '', t: 'button', p: 'active tab', x: 'Overview', v: '' }, { n: '', t: 'button', x: 'Activity', v: '' }, { n: '', t: 'button', x: 'Settings', v: '' }], v: '' }, { n: '', t: 'section', p: 'tab panel content', v: '' }], v: K(`<i class="pv-tabs"><i class="on">Overview</i><i>Activity</i><i>Settings</i></i>`, L(90), L(60)) },
			{ n: 'Vertical tabs', t: 'div', p: 'tabs listed vertically on the left, content on the right (settings page style)', l: { dir: 'row', gap: 6 }, v: R(K(`<i class="pv-act">${L(80)}</i>`, L(70), L(60)), K(L(90), L(80), L(50))) },
			{ n: 'Pagination', t: 'nav', p: 'pagination: prev, page numbers with ellipsis, next', l: row, v: R(B('‹', 'bo'), B('1', 'bo'), B('2'), B('3', 'bo'), T('…'), B('9', 'bo'), B('›', 'bo')) },
			{ n: 'Stepper', t: 'ol', p: 'multi-step progress indicator: numbered circles connected by lines; done / current / upcoming states', l: rowB, v: `<i class="pv-r pv-steps"><i class="on">✓</i><b></b><i class="on">2</i><b></b><i>3</i></i>` },
			{ n: 'Dropdown menu', t: 'div', p: 'button that opens a menu of actions with icons, shortcuts, separators and a destructive item', v: K(B('Options ▾', 'bo'), BX(L(70), L(60), '<i class="pv-hr"></i>', `<i class="pv-l" style="width:50%;background:#fca5a5"></i>`)) },
			{ n: 'Mega menu', t: 'div', p: 'wide dropdown panel from navbar with columns of grouped links and a featured promo card', l: grid(4), v: BX(R(K(L(80), L(60), L(70)), K(L(70), L(80), L(50)), SQ(30, '30%'))) },
			{ n: 'Command palette', t: 'dialog', p: '⌘K command palette: search input on top, grouped results with icons and shortcuts, keyboard navigation', v: BX(K(I('⌕ Type a command…'), `<i class="pv-r pv-act">${IC}${L(50)}</i>`, R(IC, L(60)), R(IC, L(40)))) },
			{ n: 'Mobile tab bar', t: 'nav', p: 'fixed bottom tab bar for mobile with 4-5 icon+label items, active highlighted', l: { dir: 'row', justify: 'around' }, v: BX(R(IC, IC, `<i class="pv-ic" style="background:#6366f1"></i>`, IC, IC)) },
			{ n: 'Hamburger menu', t: 'button', p: 'hamburger icon that morphs into X and opens a full-screen mobile menu', v: R(`<i class="pv-t" style="font-size:16px">☰</i>`) },
			{ n: 'Table of contents', t: 'nav', p: 'sticky in-page table of contents; highlights the section currently in view', l: col(1), v: K(T('On this page'), `<i class="pv-l" style="width:60%;background:#818cf8"></i>`, L(50), L(70)) },
			{ n: 'Footer', t: 'footer', p: 'site footer: logo + tagline, 3-4 columns of links, bottom row with copyright and social icons', l: col(8, 6), c: [{ n: '', t: 'div', l: grid(4, 8), v: '' }, { n: '', t: 'div', p: 'copyright and social icons', l: rowB, v: '' }], v: BX(R(K(L(60), L(40)), K(L(50), L(60)), K(L(50), L(70))), '<i class="pv-hr"></i>', L(30)) },
			{ n: 'Skip link', t: 'a', p: 'visually hidden “skip to content” link that appears on keyboard focus', x: 'Skip to content', v: '<i class="pv-a">Skip to content</i>' },
			{ n: 'Back to top', t: 'button', p: 'small round button bottom-right that appears after scrolling and smooth-scrolls to top', v: '<i class="pv-fab" style="width:20px;height:20px">↑</i>' }
		]
	},
	{
		name: 'Layout',
		items: [
			{ n: 'Card', t: 'article', p: 'card with subtle border', l: col(3, 4), c: [{ n: '', t: 'h3', x: 'Card title', v: '' }, { n: '', t: 'p', p: 'one or two lines of supporting text', v: '' }], v: BX(H(50), L(90), L(70)) },
			{ n: 'Two columns', t: 'div', p: 'two equal columns, stack on mobile', l: grid(2, 8), c: [{ n: '', t: 'div', v: '' }, { n: '', t: 'div', v: '' }], v: R(BX(L(80), L(60)), BX(L(70), L(80))) },
			{ n: 'Three-up grid', t: 'div', p: 'responsive grid: 1 col mobile, 3 cols desktop', l: grid(3, 6), v: R(BX(SQ(16), L(70)), BX(SQ(16), L(60)), BX(SQ(16), L(80))) },
			{ n: 'Sidebar layout', t: 'div', p: 'app shell: fixed-width sidebar on the left, scrollable main area', l: { dir: 'row', gap: 0, align: 'stretch' }, c: [{ n: '', t: 'aside', p: 'sidebar, 260px wide', v: '' }, { n: '', t: 'main', p: 'main content', l: { w: 'fill' }, v: '' }], v: R(`<i class="pv-bx" style="width:30%;height:40px"></i>`, `<i class="pv-bx" style="flex:1;height:40px"></i>`) },
			{ n: 'Bento grid', t: 'div', p: 'bento-box grid with mixed tile sizes (one large 2x2 tile, several small)', l: grid(4, 4), v: `<i class="pv-bento"><i style="grid-row:span 2;grid-column:span 2"></i><i></i><i></i><i style="grid-column:span 2"></i></i>` },
			{ n: 'Masonry', t: 'div', p: 'masonry columns of varying-height cards (Pinterest style)', l: grid(3, 3), v: R(K(SQ(22), SQ(12)), K(SQ(12), SQ(22)), K(SQ(18), SQ(16))) },
			{ n: 'Divider with label', t: 'div', p: 'horizontal line with centered text, e.g. “or continue with”', x: 'or', v: R('<i class="pv-hr" style="flex:1"></i>', T('or'), '<i class="pv-hr" style="flex:1"></i>') },
			{ n: 'Scroll area', t: 'div', p: 'fixed-height area with its own scrollbar and fade at the edges', v: `<i class="pv-bx" style="height:34px;overflow:hidden">${L(80)}${L(70)}${L(85)}${L(60)}</i>` },
			{ n: 'Horizontal scroller', t: 'div', p: 'horizontally scrolling row of cards with snap points and arrow buttons', l: { dir: 'row', gap: 4 }, v: R(BX(SQ(18)), BX(SQ(18)), `<i class="pv-bx" style="opacity:.4">${SQ(18)}</i>`) }
		]
	},
	{
		name: 'Typography & content',
		items: [
			{ n: 'Eyebrow + heading', t: 'hgroup', p: 'small uppercase eyebrow above a large heading and a subheading', l: col(2), c: [{ n: '', t: 'span', p: 'eyebrow', x: 'FEATURES', v: '' }, { n: '', t: 'h2', x: 'Everything you need', v: '' }, { n: '', t: 'p', p: 'one-sentence subheading', v: '' }], v: K(`<i class="pv-t" style="color:#6366f1;font-size:7px">FEATURES</i>`, H(80), L(60)) },
			{ n: 'Gradient headline', t: 'h1', p: 'huge headline, key words with a gradient text fill', x: 'Build faster', v: `<b class="pv-t" style="font-size:15px;background:linear-gradient(90deg,#6366f1,#ec4899);-webkit-background-clip:text;color:transparent">Build faster</b>` },
			{ n: 'Blockquote', t: 'blockquote', p: 'pull quote with attribution', v: `<i class="pv-k" style="border-left:2px solid #a1a1aa;padding-left:5px">${L(90)}${L(60)}${T('— Ada L.')}</i>` },
			{ n: 'Check list', t: 'ul', p: 'list of benefits with check icons', l: col(2), v: K(R('<i class="pv-t" style="color:#22c55e">✓</i>', L(60)), R('<i class="pv-t" style="color:#22c55e">✓</i>', L(70))) },
			{ n: 'Code block', t: 'pre', p: 'syntax-highlighted code block with language label and copy button', v: `<i class="pv-code">const a = 1;<br/>log(a);</i>` },
			{ n: 'Callout', t: 'aside', p: 'callout box with icon: info / warning / tip variants', l: { dir: 'row', gap: 3, pad: 4 }, v: `<i class="pv-bx" style="background:#eff6ff;border-color:#bfdbfe">${R('ℹ', L(80))}</i>` },
			{ n: 'Prose article', t: 'article', p: 'long-form rich text article with comfortable reading width and typographic rhythm', l: col(3), v: K(H(70), L(100), L(95), L(100), L(40)) },
			{ n: 'Accordion', t: 'div', p: 'accordion: stacked collapsible items, one open at a time, chevron rotates', l: col(0), c: [{ n: '', t: 'details', p: 'open', x: 'What is it?', v: '' }, { n: '', t: 'details', x: 'How does billing work?', v: '' }, { n: '', t: 'details', x: 'Can I cancel?', v: '' }], v: K(BX(R(L(60), '<i style="flex:1"></i>', T('▴')), L(80)), BX(R(L(50), '<i style="flex:1"></i>', T('▾'))), BX(R(L(40), '<i style="flex:1"></i>', T('▾')))) },
			{ n: 'Read more', t: 'p', p: 'truncated text (3 lines) with a “Read more” toggle that expands it', v: K(L(100), L(95), `<i class="pv-r">${L(40)}<i class="pv-a">Read more</i></i>`) }
		]
	},
	{
		name: 'Data display',
		items: [
			{ n: 'Table', t: 'table', p: 'data table with header row, zebra rows, right-aligned numbers', v: `<i class="pv-tbl">${'<i></i>'.repeat(12)}</i>` },
			{ n: 'Data grid', t: 'div', p: 'interactive table: sortable columns, row selection checkboxes, column filters, sticky header, pagination footer', v: K(R(I('⌕ Filter'), B('Columns ▾', 'bo')), `<i class="pv-tbl">${'<i></i>'.repeat(9)}</i>`) },
			{ n: 'Stat card', t: 'div', p: 'KPI card: label, big number, trend delta (green up / red down)', l: col(1, 4), c: [{ n: '', t: 'span', x: 'Revenue', v: '' }, { n: '', t: 'strong', x: '$48,210', v: '' }, { n: '', t: 'span', p: 'positive trend', x: '+12.4%', v: '' }], v: BX(T('Revenue'), `<b class="pv-t" style="font-size:13px">$48.2k</b>`, `<i class="pv-t" style="color:#16a34a">▲ 12%</i>`) },
			{ n: 'Key-value list', t: 'dl', p: 'description list of label/value rows, labels muted on the left', l: col(2), v: K(R(L(30), '<i style="flex:1"></i>', L(30)), R(L(25), '<i style="flex:1"></i>', L(40)), R(L(35), '<i style="flex:1"></i>', L(20))) },
			{ n: 'Badge', t: 'span', p: 'small pill badge; variants: neutral / success / warning / danger', x: 'Active', v: R(BDG('Active'), `<i class="pv-bdg" style="background:#dcfce7;color:#166534">Paid</i>`, `<i class="pv-bdg" style="background:#fee2e2;color:#991b1b">Late</i>`) },
			{ n: 'Status dot', t: 'span', p: 'colored dot + label (online / away / offline)', x: 'Operational', v: R('<i class="pv-dot" style="background:#22c55e"></i>', T('Operational')) },
			{ n: 'Tooltip', t: 'span', p: 'small dark tooltip that appears on hover/focus above the trigger with an arrow', x: 'Hover me', v: K(`<i class="pv-tip">Tooltip</i>`, T('Hover me')) },
			{ n: 'Timeline', t: 'ol', p: 'vertical timeline: dots on a line, each event with date, title, description', l: col(4), v: `<i class="pv-k pv-tl">${R('<i class="pv-dot"></i>', L(60))}${R('<i class="pv-dot"></i>', L(50))}${R('<i class="pv-dot"></i>', L(70))}</i>` },
			{ n: 'Activity feed', t: 'ul', p: 'list of recent events: avatar, “Name did X on Y”, relative time', l: col(3), v: K(R(C(12), L(70)), R(C(12), L(55)), R(C(12), L(65))) },
			{ n: 'Tree view', t: 'ul', p: 'nested expandable tree (file explorer style) with chevrons and icons', v: K(T('▾ 📁 src'), T('&nbsp;&nbsp;&nbsp;▸ 📁 lib'), T('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;📄 app.ts')) },
			{ n: 'Kanban board', t: 'div', p: 'columns (To do / Doing / Done) of draggable cards with counts in headers', l: { dir: 'row', gap: 3, align: 'start' }, v: R(K(L(50), BX(L(80)), BX(L(60))), K(L(50), BX(L(70))), K(L(40), BX(L(80)), BX(L(50)))) },
			{ n: 'Calendar', t: 'div', p: 'month calendar grid with events as colored chips; today highlighted', v: `<i class="pv-cal big"></i>` },
			{ n: 'List with actions', t: 'ul', p: 'list rows: icon, title + subtitle, trailing action menu (⋯)', l: col(0), v: K(BX(R(IC, L(50), '<i style="flex:1"></i>', T('⋯'))), BX(R(IC, L(40), '<i style="flex:1"></i>', T('⋯')))) },
			{ n: 'Empty state', t: 'div', p: 'centered empty state: illustration, title, one-line explanation, primary action', l: { dir: 'col', align: 'center', gap: 3, pad: 8 }, c: [{ n: '', t: 'img', p: 'simple line illustration', v: '' }, { n: '', t: 'h3', x: 'No projects yet', v: '' }, { n: '', t: 'p', x: 'Create your first project to get started.', v: '' }, { n: '', t: 'button', p: 'primary', x: 'New project', v: '' }], v: `<i class="pv-k" style="align-items:center">${C(18)}${L(50)}${B('New')}</i>` },
			{ n: 'Progress bar', t: 'div', p: 'linear progress bar with percentage label', v: K(R(T('Uploading'), '<i style="flex:1"></i>', T('64%')), `<i class="pv-bar"><i style="width:64%"></i></i>`) },
			{ n: 'Progress ring', t: 'div', p: 'circular progress ring with percentage in the middle', v: `<i class="pv-ring">72%</i>` },
			{ n: 'Meter / quota', t: 'div', p: 'usage meter segmented by category (storage used: photos, docs, other)', v: K(`<i class="pv-bar"><i style="width:40%;background:#6366f1"></i><i style="width:25%;background:#f59e0b"></i></i>`, L(50)) },
			{ n: 'Diff view', t: 'pre', p: 'side-by-side or unified code diff with added (green) and removed (red) lines', v: `<i class="pv-code"><i style="background:#fee2e2;display:block">- old</i><i style="background:#dcfce7;display:block">+ new</i></i>` },
			{ n: 'JSON viewer', t: 'pre', p: 'collapsible JSON tree with syntax colors', v: `<i class="pv-code">{ ▾ "user": {…} }</i>` }
		]
	},
	{
		name: 'Media',
		items: [
			{ n: 'Avatar', t: 'img', p: 'circular user avatar; falls back to initials', v: R(C(24), `<i class="pv-c" style="width:24px;height:24px;display:grid;place-items:center;font-size:8px;color:#fff;background:#6366f1">AL</i>`) },
			{ n: 'Image gallery', t: 'div', p: 'grid of thumbnails that open a lightbox', l: grid(3, 2), v: `<i class="pv-bento" style="grid-template-columns:repeat(3,1fr)">${'<i></i>'.repeat(6)}</i>` },
			{ n: 'Carousel', t: 'div', p: 'slide carousel with prev/next arrows and dot indicators, swipeable', v: K(R(T('‹'), SQ(30), T('›')), `<i class="pv-r" style="justify-content:center">${'<i class="pv-dot"></i>'.repeat(3)}</i>`) },
			{ n: 'Video player', t: 'video', p: 'video player with poster, big play button, custom controls bar', v: `<i class="pv-sq" style="height:40px;display:grid;place-items:center;color:#fff;background:#27272a">▶</i>` },
			{ n: 'Audio player', t: 'div', p: 'compact audio player: play/pause, waveform scrubber, time', v: R(`<i class="pv-fab" style="width:16px;height:16px;font-size:8px">▶</i>`, `<i class="pv-wave"></i>`, T('2:31')) },
			{ n: 'Before / after slider', t: 'div', p: 'two overlapping images with a draggable vertical divider to compare', v: `<i class="pv-sq" style="height:36px;background:linear-gradient(90deg,#a1a1aa 50%,#e4e4e7 50%);position:relative"></i>` },
			{ n: 'Map embed', t: 'div', p: 'interactive map with a pin and a small info card', v: `<i class="pv-sq" style="height:36px;background:repeating-linear-gradient(45deg,#e0f2fe 0 6px,#f0f9ff 6px 12px);display:grid;place-items:center">📍</i>` },
			{ n: 'Logo', t: 'a', p: 'brand logo (wordmark + mark), links home', x: 'Acme', v: R(`<i class="pv-sw" style="background:#18181b;border-radius:4px"></i>`, `<b class="pv-t">Acme</b>`) },
			{ n: 'Embed (iframe)', t: 'iframe', p: 'embedded third-party content (e.g. YouTube, Figma, CodePen)', v: `<i class="pv-sq" style="height:34px;display:grid;place-items:center">&lt;/&gt;</i>` }
		]
	},
	{
		name: 'Feedback',
		items: [
			{ n: 'Alert', t: 'div', p: 'inline alert with icon, title and message; variants: info / success / warning / error; dismissible', l: { dir: 'row', gap: 3, pad: 4 }, v: `<i class="pv-bx" style="background:#fef2f2;border-color:#fecaca">${R('⚠', K(L(50), L(80)))}</i>` },
			{ n: 'Toast', t: 'div', p: 'toast notification in the corner: icon, message, undo action, auto-dismiss after 5s', v: `<i class="pv-bx" style="background:#18181b;color:#fff">${R('<i class="pv-t" style="color:#fff">✓ Saved</i>', '<i style="flex:1"></i>', '<i class="pv-t" style="color:#a5b4fc">Undo</i>')}</i>` },
			{ n: 'Spinner', t: 'div', p: 'indeterminate loading spinner that inherits the current text color', v: '<i class="pv-spin"></i>' },
			{ n: 'Skeleton', t: 'div', p: 'skeleton placeholder shimmer matching the shape of the content being loaded', l: col(2), v: K(R(C(16), K(L(60), L(40))), L(100), L(80)) },
			{ n: 'Field error', t: 'small', p: 'inline validation message under an input, red, with icon', x: 'Email is required', v: K(`<i class="pv-i" style="border-color:#f87171"></i>`, `<i class="pv-t" style="color:#dc2626">Email is required</i>`) },
			{ n: 'Success state', t: 'div', p: 'centered success confirmation: animated checkmark, title, next-step button', l: { dir: 'col', align: 'center', gap: 3 }, v: `<i class="pv-k" style="align-items:center"><i class="pv-c" style="width:20px;height:20px;background:#22c55e;color:#fff;display:grid;place-items:center;font-size:10px">✓</i>${L(40)}</i>` },
			{ n: 'Notification badge', t: 'span', p: 'red count bubble on the corner of an icon (e.g. bell with 3)', v: `<i class="pv-r"><i style="position:relative">🔔<i class="pv-cnt">3</i></i></i>` },
			{ n: 'Progress steps toast', t: 'div', p: 'persistent task progress panel listing background jobs with per-item progress', v: BX(R(T('Exporting'), '<i style="flex:1"></i>', T('2/3')), `<i class="pv-bar"><i style="width:66%"></i></i>`) }
		]
	},
	{
		name: 'Overlays',
		items: [
			{ n: 'Modal dialog', t: 'dialog', p: 'centered modal over dimmed backdrop: title, body, footer with cancel + confirm; Esc closes', l: col(4, 6), c: [{ n: '', t: 'h2', x: 'Delete project?', v: '' }, { n: '', t: 'p', x: 'This action cannot be undone.', v: '' }, { n: '', t: 'div', l: { dir: 'row', justify: 'end', gap: 2 }, c: [{ n: '', t: 'button', p: 'ghost', x: 'Cancel', v: '' }, { n: '', t: 'button', p: 'destructive', x: 'Delete', v: '' }], v: '' }], v: `<i class="pv-dim">${BX(H(50), L(80), R('<i style="flex:1"></i>', B('No', 'bg'), B('Yes', 'bd')))}</i>` },
			{ n: 'Drawer', t: 'aside', p: 'panel sliding in from the right edge with header, scrollable body, sticky footer', v: `<i class="pv-dim" style="justify-content:flex-end;padding:0"><i class="pv-bx" style="width:45%;height:44px;border-radius:0">${L(70)}${L(50)}</i></i>` },
			{ n: 'Popover', t: 'div', p: 'small floating panel anchored to a trigger with an arrow; closes on outside click', v: K(B('Filters', 'bo'), BX(L(70), L(50))) },
			{ n: 'Bottom sheet', t: 'div', p: 'mobile bottom sheet with drag handle, snaps to half and full height', v: `<i class="pv-dim" style="align-items:flex-end;padding:0"><i class="pv-bx" style="width:100%;border-radius:8px 8px 0 0"><i class="pv-l" style="width:20%;margin:0 auto"></i>${L(70)}</i></i>` },
			{ n: 'Context menu', t: 'menu', p: 'right-click menu with actions, submenus and keyboard shortcuts', v: BX(R(L(50), '<i style="flex:1"></i>', '<i class="pv-kbd">⌘C</i>'), R(L(40), '<i style="flex:1"></i>', T('▸')), R(L(45))) },
			{ n: 'Hover card', t: 'div', p: 'rich preview card on hovering a username: avatar, name, bio, follow button', v: BX(R(C(16), K(L(60), L(40))), L(90)) },
			{ n: 'Lightbox', t: 'dialog', p: 'full-screen image viewer with dark backdrop, arrows, close button, counter', v: `<i class="pv-dim" style="background:#18181bdd">${R(T('<b style="color:#fff">‹</b>'), SQ(30, '60%'), T('<b style="color:#fff">›</b>'))}</i>` },
			{ n: 'Cookie consent', t: 'div', p: 'cookie consent bar at bottom: short text, “Reject all”, “Customize”, “Accept”', l: rowB, v: BX(R(L(50), '<i style="flex:1"></i>', B('Reject', 'bo'), B('Accept'))) }
		]
	},
	{
		name: 'People & social',
		items: [
			{ n: 'Avatars stacked', t: 'div', p: 'overlapping row of circular avatars with white ring, last one shows “+5”', l: { dir: 'row', gap: 0 }, c: [{ n: '', t: 'img', p: 'avatar', v: '' }, { n: '', t: 'img', p: 'avatar, overlaps previous', v: '' }, { n: '', t: 'img', p: 'avatar, overlaps previous', v: '' }, { n: '', t: 'span', p: 'overflow count circle', x: '+5', v: '' }], v: `<i class="pv-stack">${C(18)}${C(18)}${C(18)}<i class="pv-c" style="width:18px;height:18px;font-size:7px;display:grid;place-items:center">+5</i></i>` },
			{ n: 'Avatar with status', t: 'div', p: 'avatar with a small online-status dot at bottom-right', v: `<i style="position:relative;display:inline-block">${C(24)}<i class="pv-dot" style="position:absolute;right:0;bottom:0;background:#22c55e;border:1.5px solid #fff"></i></i>` },
			{ n: 'User chip', t: 'div', p: 'avatar + name + muted handle, compact', l: row, v: R(C(14), K(L(50), L(30))) },
			{ n: 'Profile card', t: 'article', p: 'profile card: cover image, avatar overlapping cover, name, role, bio, follow + message buttons', l: col(3), v: BX(SQ(12), `<i style="margin-top:-8px">${C(16)}</i>`, L(50), R(B('Follow'), B('Msg', 'bo'))) },
			{ n: 'Comment', t: 'article', p: 'comment: avatar, name, timestamp, text, reply / like actions; supports nested replies', l: { dir: 'row', gap: 3, align: 'start' }, v: R(C(14), K(R(L(30), L(15)), L(90), L(30))) },
			{ n: 'Chat bubbles', t: 'div', p: 'chat conversation: incoming bubbles on left, outgoing on right, timestamps, read receipts', l: col(2), v: K(`<i class="pv-bub">Hey!</i>`, `<i class="pv-bub me">Hi there 👋</i>`) },
			{ n: 'Chat composer', t: 'form', p: 'message input bar: attach button, auto-growing textarea, emoji, send button', l: row, v: R(T('📎'), I('Message…'), `<i class="pv-fab" style="width:16px;height:16px;font-size:8px">➤</i>`) },
			{ n: 'Reactions bar', t: 'div', p: 'emoji reaction pills with counts; click to toggle your own', l: row, v: R(BDG('👍 12'), BDG('🎉 4'), BDG('＋')) },
			{ n: 'Testimonial', t: 'figure', p: 'customer quote with avatar, name, title and company logo', l: col(3, 4), v: BX(L(90), L(70), R(C(12), L(30))) },
			{ n: 'Team grid', t: 'div', p: 'grid of team members: photo, name, role, social links', l: grid(4), v: R(K(C(16), L(80)), K(C(16), L(70)), K(C(16), L(80)), K(C(16), L(60))) },
			{ n: 'Share buttons', t: 'div', p: 'share to X, LinkedIn, Facebook + copy link', l: row, v: R(B('𝕏', 'bo'), B('in', 'bo'), B('f', 'bo'), B('🔗', 'bo')) },
			{ n: 'Presence indicator', t: 'div', p: '“3 people viewing” with tiny live avatars and a pulsing dot', l: row, v: R('<i class="pv-dot" style="background:#22c55e"></i>', T('3 viewing'), `<i class="pv-stack">${C(10)}${C(10)}${C(10)}</i>`) },
			{ n: 'Follow button', t: 'button', p: 'follow button that switches to “Following” with check; shows follower count', x: 'Follow · 1.2k', v: B('Follow · 1.2k') },
			{ n: 'Mention / tag', t: 'span', p: 'inline @mention chip, highlighted, shows hover card', x: '@ada', v: `<i class="pv-t" style="background:#e0e7ff;color:#4338ca;padding:0 3px;border-radius:3px">@ada</i>` }
		]
	},
	{
		name: 'Commerce',
		items: [
			{ n: 'Product card', t: 'article', p: 'product card: image, name, rating, price, add-to-cart button; wishlist heart on image', l: col(2), c: [{ n: '', t: 'img', p: 'product photo, square', v: '' }, { n: '', t: 'h3', x: 'Product name', v: '' }, { n: '', t: 'span', p: 'price', x: '$49', v: '' }, { n: '', t: 'button', p: 'primary', x: 'Add to cart', v: '' }], v: BX(SQ(24), L(60), R(`<b class="pv-t">$49</b>`, '<i style="flex:1"></i>', B('Add'))) },
			{ n: 'Pricing card', t: 'article', p: 'pricing tier card: plan name, price per month, feature checklist, CTA; “Most popular” variant highlighted', l: col(4, 6), c: [{ n: '', t: 'h3', x: 'Pro', v: '' }, { n: '', t: 'p', p: 'price, large', x: '$29/mo', v: '' }, { n: '', t: 'ul', p: 'feature list with checkmarks', v: '' }, { n: '', t: 'button', p: 'primary', x: 'Start free trial', v: '' }], v: BX(L(30), `<b class="pv-t" style="font-size:12px">$29</b>`, L(70), L(60), B('Start')) },
			{ n: 'Pricing table', t: 'section', p: 'three pricing tiers side by side, middle one emphasized', l: grid(3), v: R(BX(L(40), H(50), L(70)), `<i class="pv-bx" style="border-color:#6366f1">${L(40)}${H(50)}${L(70)}</i>`, BX(L(40), H(50), L(70))) },
			{ n: 'Billing toggle', t: 'div', p: 'monthly / yearly switch with “Save 20%” badge', l: row, v: R(T('Monthly'), '<i class="pv-tg on"></i>', T('Yearly'), BDG('-20%')) },
			{ n: 'Price with discount', t: 'div', p: 'current price large, original price struck through, discount badge', l: row, v: R(`<b class="pv-t" style="font-size:12px">$39</b>`, `<i class="pv-t" style="text-decoration:line-through;opacity:.5">$59</i>`, BDG('-33%')) },
			{ n: 'Cart line item', t: 'div', p: 'cart row: thumbnail, name + variant, quantity selector, price, remove', l: { dir: 'row', gap: 3, align: 'center' }, v: R(`<i class="pv-sq" style="width:20px;height:20px"></i>`, K(L(60), L(30)), T('$49')) },
			{ n: 'Order summary', t: 'aside', p: 'checkout summary: subtotal, shipping, tax, total, coupon field, checkout button', l: col(2, 4), v: BX(R(L(30), '<i style="flex:1"></i>', L(15)), R(L(25), '<i style="flex:1"></i>', L(15)), '<i class="pv-hr"></i>', R(H(30), '<i style="flex:1"></i>', H(20)), B('Checkout')) },
			{ n: 'Coupon input', t: 'div', p: 'promo code input with apply button; shows applied code as removable chip', l: row, v: R(I('PROMO'), B('Apply', 'bo')) },
			{ n: 'Wishlist heart', t: 'button', p: 'heart icon toggle, fills with color and pops when added', v: `<i class="pv-t" style="color:#ef4444;font-size:14px">♥</i>` }
		]
	},
	{
		name: 'Marketing sections',
		items: [
			{ n: 'Hero', t: 'section', p: 'landing hero, centered', l: { dir: 'col', align: 'center', gap: 6, pad: 16 }, c: [{ n: '', t: 'span', p: 'announcement pill linking to changelog', x: 'New: v2.0 →', v: '' }, { n: '', t: 'h1', x: 'Headline that states the value', v: '' }, { n: '', t: 'p', p: 'one or two sentence subheadline', v: '' }, { n: '', t: 'div', l: row, c: [{ n: '', t: 'button', p: 'primary', x: 'Get started', v: '' }, { n: '', t: 'button', p: 'ghost', x: 'Watch demo', v: '' }], v: '' }], v: `<i class="pv-k" style="align-items:center">${BDG('New')}${H(80)}${L(60)}${R(B('Start'), B('Demo', 'bo'))}</i>` },
			{ n: 'Hero split', t: 'section', p: 'hero with copy on the left and product screenshot on the right', l: { ...grid(2, 12), align: 'center', pad: 12 }, c: [{ n: '', t: 'div', l: col(4), c: [{ n: '', t: 'h1', x: 'Headline', v: '' }, { n: '', t: 'p', p: 'supporting copy', v: '' }, { n: '', t: 'button', p: 'primary', x: 'Try it free', v: '' }], v: '' }, { n: '', t: 'img', p: 'product screenshot in a browser frame, slightly tilted', v: '' }], v: R(K(H(90), L(80), B('Try')), SQ(36, '50%')) },
			{ n: 'Logo cloud', t: 'section', p: '“Trusted by” row of grayscale customer logos', l: { dir: 'col', align: 'center', gap: 4 }, v: K(`<i class="pv-t" style="text-align:center">Trusted by</i>`, R(L(15), L(15), L(15), L(15), L(15))) },
			{ n: 'Feature grid', t: 'section', p: 'grid of features: icon, title, short description', l: grid(3, 8), v: R(K(IC, L(70), L(90)), K(IC, L(60), L(80)), K(IC, L(70), L(90))) },
			{ n: 'Feature alternating', t: 'section', p: 'feature rows alternating image left/right with text', l: col(12), v: K(R(SQ(18, '45%'), K(L(70), L(90))), R(K(L(70), L(90)), SQ(18, '45%'))) },
			{ n: 'CTA band', t: 'section', p: 'bold call-to-action band: headline + button, contrasting background', l: { ...rowB, pad: 8 }, v: `<i class="pv-r" style="background:#6366f1;padding:6px;border-radius:4px"><i class="pv-l" style="width:50%;background:#fff8"></i><i style="flex:1"></i><i class="pv-b" style="background:#fff;color:#4338ca">Start</i></i>` },
			{ n: 'FAQ', t: 'section', p: 'frequently asked questions as an accordion, two columns on desktop', l: col(4), v: K(H(40), BX(R(L(60), '<i style="flex:1"></i>', T('+'))), BX(R(L(50), '<i style="flex:1"></i>', T('+')))) },
			{ n: 'Newsletter signup', t: 'form', p: 'email capture: heading, input + subscribe button inline, privacy note', l: col(3), v: K(H(50), R(I('Email'), B('Subscribe'))) },
			{ n: 'Stats band', t: 'section', p: 'big numbers band: 4 headline metrics with labels', l: grid(4), v: R(K(H(70), L(50)), K(H(60), L(50)), K(H(70), L(40)), K(H(50), L(60))) },
			{ n: 'Testimonials wall', t: 'section', p: 'masonry wall of tweet-like testimonial cards', l: grid(3, 4), v: R(K(BX(L(80), L(50)), BX(L(70))), K(BX(L(60)), BX(L(90), L(40))), K(BX(L(80), L(70)))) },
			{ n: 'Announcement bar', t: 'div', p: 'thin bar above navbar with announcement and dismiss X', l: { dir: 'row', justify: 'center', gap: 2, pad: 2 }, v: `<i class="pv-r" style="background:#18181b;padding:2px;border-radius:2px;justify-content:center"><i class="pv-t" style="color:#fff">🎉 Launch week · Read more</i></i>` },
			{ n: 'Waitlist', t: 'section', p: 'minimal centered waitlist page: logo, headline, email input, “1,204 people joined” with stacked avatars', l: { dir: 'col', align: 'center', gap: 4, pad: 12 }, v: `<i class="pv-k" style="align-items:center">${H(60)}${R(I('Email'), B('Join'))}<i class="pv-stack">${C(10)}${C(10)}${C(10)}</i></i>` },
			{ n: 'Comparison table', t: 'table', p: 'us vs. competitors feature comparison with check / cross marks', v: `<i class="pv-tbl" style="grid-template-columns:2fr 1fr 1fr">${'<i></i><i>✓</i><i>✗</i>'.repeat(3)}</i>` },
			{ n: 'Contact section', t: 'section', p: 'contact form on one side, address / email / phone with icons on the other', l: grid(2, 8), v: R(K(I('Name'), I('Message'), B('Send')), K(R(IC, L(60)), R(IC, L(50)), R(IC, L(40)))) }
		]
	},
	{
		name: 'Charts',
		items: [
			{ n: 'Line chart', t: 'figure', p: 'line chart over time with axes, gridlines, hover tooltip; data: ', v: `<i class="pv-chart"><svg viewBox="0 0 60 30"><polyline points="0,25 10,18 20,21 30,10 40,13 50,5 60,8" fill="none" stroke="#6366f1" stroke-width="2"/></svg></i>` },
			{ n: 'Bar chart', t: 'figure', p: 'vertical bar chart with labels; data: ', v: `<i class="pv-chart"><svg viewBox="0 0 60 30"><g fill="#6366f1"><rect x="2" y="14" width="8" height="16"/><rect x="14" y="6" width="8" height="24"/><rect x="26" y="18" width="8" height="12"/><rect x="38" y="10" width="8" height="20"/><rect x="50" y="3" width="8" height="27"/></g></svg></i>` },
			{ n: 'Donut chart', t: 'figure', p: 'donut chart with legend and total in the center; data: ', v: `<i class="pv-chart"><svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="10" fill="none" stroke="#e4e4e7" stroke-width="6"/><circle cx="15" cy="15" r="10" fill="none" stroke="#6366f1" stroke-width="6" stroke-dasharray="40 63" transform="rotate(-90 15 15)"/><circle cx="15" cy="15" r="10" fill="none" stroke="#f59e0b" stroke-width="6" stroke-dasharray="14 63" stroke-dashoffset="-40" transform="rotate(-90 15 15)"/></svg></i>` },
			{ n: 'Sparkline', t: 'span', p: 'tiny inline trend line next to a number', v: R(`<b class="pv-t">1,284</b>`, `<svg viewBox="0 0 40 12" width="40"><polyline points="0,10 8,7 16,8 24,3 32,5 40,1" fill="none" stroke="#22c55e" stroke-width="1.5"/></svg>`) },
			{ n: 'Contribution heatmap', t: 'figure', p: 'GitHub-style calendar heatmap of daily activity', v: `<i class="pv-heat">${Array.from({ length: 42 }, (_, i) => `<i style="opacity:${[0.15, 0.4, 0.7, 1, 0.25][(i * 7) % 5]}"></i>`).join('')}</i>` },
			{ n: 'Gauge', t: 'figure', p: 'semicircle gauge showing a score out of 100', v: `<i class="pv-chart"><svg viewBox="0 0 40 22"><path d="M4,20 A16,16 0 0 1 36,20" fill="none" stroke="#e4e4e7" stroke-width="5"/><path d="M4,20 A16,16 0 0 1 30,8" fill="none" stroke="#22c55e" stroke-width="5"/></svg></i>` },
			{ n: 'Funnel', t: 'figure', p: 'conversion funnel with stage labels and drop-off %', v: `<i class="pv-k" style="align-items:center">${['100', '75', '45', '25'].map((w) => `<i class="pv-l" style="width:${w}%;height:6px;background:#818cf8"></i>`).join('')}</i>` },
			{ n: 'Uptime bars', t: 'figure', p: 'status-page style row of 90 thin daily bars, green/amber/red, with uptime %', v: `<i class="pv-r" style="gap:1px">${Array.from({ length: 30 }, (_, i) => `<i style="width:3px;height:14px;border-radius:1px;background:${i === 11 ? '#f59e0b' : i === 23 ? '#ef4444' : '#22c55e'}"></i>`).join('')}</i>` }
		]
	},
	{
		name: 'Unusual & delightful',
		items: [
			{ n: 'Marquee ticker', t: 'div', p: 'infinitely scrolling horizontal ticker of logos/words, pauses on hover', v: `<i class="pv-r" style="overflow:hidden;white-space:nowrap">${T('★ FAST ★ SIMPLE ★ OPEN ★ FAST ★')}</i>` },
			{ n: 'Typewriter text', t: 'span', p: 'headline where the last word is typed and deleted, cycling through a list of words with a blinking caret', x: 'Built for designers|', v: `<b class="pv-t">Built for <u>design|</u></b>` },
			{ n: 'Countdown timer', t: 'div', p: 'countdown to a launch date: days / hours / minutes / seconds in flip tiles', l: row, v: R(...['12', '04', '33', '09'].map((n) => `<i class="pv-flip">${n}</i>`)) },
			{ n: 'Tilt card', t: 'article', p: '3D card that tilts toward the cursor with a moving glare highlight', v: `<i class="pv-bx" style="transform:perspective(80px) rotateY(-14deg) rotateX(6deg);background:linear-gradient(135deg,#fff,#eef2ff)">${L(60)}${L(40)}</i>` },
			{ n: 'Spotlight card', t: 'article', p: 'dark card with a soft radial glow that follows the mouse', v: `<i class="pv-bx" style="background:radial-gradient(circle at 30% 30%,#6366f1aa,#18181b 60%);height:36px"></i>` },
			{ n: 'Gradient border', t: 'div', p: 'card with an animated rotating gradient border', v: `<i style="display:block;padding:2px;border-radius:6px;background:conic-gradient(#6366f1,#ec4899,#f59e0b,#6366f1)"><i class="pv-bx" style="border:0">${L(60)}</i></i>` },
			{ n: 'Glass card', t: 'div', p: 'frosted-glass card (backdrop blur) floating over a colorful blurred background', v: `<i style="display:block;padding:6px;border-radius:6px;background:linear-gradient(135deg,#f0abfc,#93c5fd)"><i class="pv-bx" style="background:#ffffff88">${L(60)}</i></i>` },
			{ n: 'Flip card', t: 'div', p: 'card that flips in 3D on hover to reveal the back side', v: R(BX(T('Front')), T('↻'), `<i class="pv-bx" style="background:#eef2ff">${T('Back')}</i>`) },
			{ n: 'Confetti button', t: 'button', p: 'primary button that bursts confetti when clicked', x: 'Celebrate', v: `<i class="pv-b">🎉 Celebrate</i>` },
			{ n: 'Scroll progress', t: 'div', p: 'thin bar fixed at the very top showing reading progress', v: `<i class="pv-bar" style="height:3px"><i style="width:40%"></i></i>` },
			{ n: 'Dock magnifier', t: 'nav', p: 'macOS-style dock: icons magnify smoothly as the cursor approaches', l: { dir: 'row', align: 'end', gap: 2 }, v: `<i class="pv-r" style="align-items:flex-end">${[10, 14, 20, 14, 10].map((s) => `<i class="pv-sq" style="width:${s}px;height:${s}px;border-radius:3px"></i>`).join('')}</i>` },
			{ n: 'Number ticker', t: 'span', p: 'number that counts up from 0 when scrolled into view', x: '10,000+', v: `<b class="pv-t" style="font-size:13px">10,000+</b>` },
			{ n: 'Shortcut cheat sheet', t: 'dialog', p: 'modal opened with “?” listing keyboard shortcuts grouped by area', v: BX(R(L(50), '<i style="flex:1"></i>', '<i class="pv-kbd">⌘K</i>'), R(L(40), '<i style="flex:1"></i>', '<i class="pv-kbd">?</i>')) },
			{ n: 'Sticker / stamp', t: 'span', p: 'rotated circular sticker badge with curved text, slowly spinning', x: 'NEW · NEW ·', v: `<i class="pv-c" style="width:26px;height:26px;border:1.5px dashed #6366f1;background:#eef2ff;display:grid;place-items:center;font-size:6px;transform:rotate(-15deg)">NEW</i>` },
			{ n: 'Infinite canvas', t: 'div', p: 'pannable, zoomable dotted canvas with draggable cards', v: `<i class="pv-sq" style="height:34px;background:radial-gradient(#a1a1aa 1px,transparent 1px) 0 0/6px 6px,#fff"></i>` },
			{ n: 'Terminal window', t: 'pre', p: 'fake terminal window with traffic-light dots and a typed command + output', v: `<i class="pv-code" style="background:#18181b;color:#a3e635"><i style="color:#f87171">●</i><i style="color:#facc15">●</i><i style="color:#4ade80">●</i><br/>$ npm i spatial</i>` },
			{ n: 'Browser frame', t: 'div', p: 'mock browser window chrome (dots + URL bar) wrapping a screenshot', v: BX(R('<i class="pv-dot"></i><i class="pv-dot"></i><i class="pv-dot"></i>', I('acme.com')), SQ(16)) },
			{ n: 'Phone mockup', t: 'div', p: 'phone device frame with notch wrapping a mobile screenshot', v: `<i class="pv-bx" style="width:26px;height:44px;margin:0 auto;border-radius:6px;border-width:2px;border-color:#27272a"></i>` },
			{ n: 'Emoji rating', t: 'div', p: 'feedback widget: row of 5 emoji faces from 😞 to 😍, selected one grows', l: row, v: T('😞 😐 🙂 <b style="font-size:14px">😍</b>') }
		]
	}
];

export const COMPONENT_COUNT = LIBRARY.reduce((s, g) => s + g.items.length, 0);

export function defToNode(d: Def): PageNode {
	return makeNode({
		tag: d.t ?? 'div',
		prompt: d.p ?? '',
		text: d.x ?? '',
		layout: upgradeLayout(d.l),
		children: (d.c ?? []).map(defToNode)
	});
}
