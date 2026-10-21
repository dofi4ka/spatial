/// <reference lib="webworker" />
// Python kernel: runs notebook cells with Pyodide inside a Web Worker, so a busy cell never
// freezes the editor and "Stop" can simply terminate the worker. Nothing runs on the server.
//
// in:  { id, code }
// out: { t: 'status', v: 'loading' | 'ready' } | { t: 'log', id, v } | { t: 'out', id, out } | { t: 'done', id }

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';

// Display helpers available in every cell: display(), HTML(), SVG(); matplotlib figures show
// automatically after a cell (or on plt.show()); the value of the last expression is shown.
const PRELUDE = `
import sys, os, io, base64, traceback, warnings, importlib.util
os.environ['MPLBACKEND'] = 'agg'
from pyodide.code import eval_code_async
from _spatial import emit as _emit

class _Stream(io.TextIOBase):
    def __init__(self, kind): self.kind = kind
    def writable(self): return True
    def write(self, s):
        if s: _emit(self.kind, s)
        return len(s)

sys.stdout = _Stream('stdout')
sys.stderr = _Stream('stderr')

class HTML:
    """display(HTML('<b>hi</b>')) renders HTML (scripts run in a sandboxed frame)."""
    def __init__(self, data): self.data = data
    def _repr_html_(self): return self.data

class SVG:
    """display(SVG('<svg ...>')) renders an SVG image."""
    def __init__(self, data): self.data = data
    def _repr_svg_(self): return self.data

def _png(data):
    return 'data:image/png;base64,' + (base64.b64encode(data).decode() if isinstance(data, bytes) else data)

def _show_fig(fig):
    buf = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', DeprecationWarning)  # internal to this matplotlib build
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=110)
    _emit('image', _png(buf.getvalue()))

def _flush_figs():
    plt = sys.modules.get('matplotlib.pyplot')
    if not plt: return
    for n in plt.get_fignums():
        _show_fig(plt.figure(n))
    plt.close('all')

_mpl_ready = False
def _setup_mpl():
    global _mpl_ready
    if _mpl_ready or importlib.util.find_spec('matplotlib') is None: return
    import matplotlib
    matplotlib.use('agg')
    import matplotlib.pyplot as plt
    plt.show = lambda *a, **k: _flush_figs()
    _mpl_ready = True

def _is_mpl(o):
    return (type(o).__module__ or '').startswith('matplotlib')

def display(*objs):
    """Show rich output: figures, DataFrames, HTML(...), SVG(...), or anything with a repr."""
    for o in objs: _show(o)

def _show(o):
    if o is None: return
    if _is_mpl(o) or (isinstance(o, (list, tuple)) and o and all(_is_mpl(x) for x in o)):
        from matplotlib.figure import Figure
        if isinstance(o, Figure):
            _show_fig(o)
            plt = sys.modules.get('matplotlib.pyplot')
            if plt: plt.close(o)
        return  # artists returned by plt.plot() etc.: the figure is shown after the cell
    for meth, kind in (('_repr_html_', 'html'), ('_repr_svg_', 'svg'), ('_repr_png_', 'image')):
        f = getattr(o, meth, None)
        if not callable(f): continue
        try: v = f()
        except Exception: continue
        if v is None: continue
        _emit(kind, _png(v) if kind == 'image' else v)
        return
    _emit('result', repr(o))

_G = {'__name__': '__main__', 'display': display, 'HTML': HTML, 'SVG': SVG}

async def _run(src):
    if 'matplotlib' in src or 'pandas' in src or 'matplotlib' in sys.modules: _setup_mpl()
    try:
        _show(await eval_code_async(src, globals=_G, filename='<cell>'))
    except BaseException as e:
        tb = e.__traceback__
        while tb is not None and tb.tb_frame.f_code.co_filename != '<cell>': tb = tb.tb_next
        _emit('error', ''.join(traceback.format_exception(type(e), e, tb)))
    finally:
        try: _flush_figs()
        except Exception as e: _emit('error', repr(e))
`;

type Py = {
	registerJsModule(name: string, mod: object): void;
	runPythonAsync(code: string): Promise<unknown>;
	loadPackagesFromImports(code: string, opts?: { messageCallback?: (m: string) => void; errorCallback?: (m: string) => void }): Promise<unknown>;
	globals: { set(k: string, v: unknown): void };
};

let current = 0;
const post = (m: unknown) => self.postMessage(m);
let boot: Promise<Py> | null = null;

function kernel() {
	return (boot ??= (async () => {
		post({ t: 'status', v: 'loading' });
		const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`);
		const py: Py = await loadPyodide({ indexURL: PYODIDE });
		py.registerJsModule('_spatial', { emit: (t: string, v: string) => post({ t: 'out', id: current, out: { t, v } }) });
		await py.runPythonAsync(PRELUDE);
		post({ t: 'status', v: 'ready' });
		return py;
	})());
}

async function run(id: number, code: string) {
	current = id;
	try {
		const py = await kernel();
		const log = (v: string) => post({ t: 'log', id, v });
		await py.loadPackagesFromImports(code, { messageCallback: log, errorCallback: log });
		py.globals.set('_src', code);
		await py.runPythonAsync('await _run(_src)');
	} catch (e) {
		// if Pyodide itself failed to load (e.g. offline), try again on the next run
		if (boot && !(await boot.then(() => true, () => false))) boot = null;
		post({ t: 'out', id, out: { t: 'error', v: (e as Error)?.message ?? String(e) } });
	}
	post({ t: 'done', id });
}

// cells run strictly one after another, like a Jupyter kernel
let queue = Promise.resolve();
self.onmessage = (e: MessageEvent<{ id: number; code: string }>) => {
	const { id, code } = e.data;
	queue = queue.then(() => run(id, code));
};
