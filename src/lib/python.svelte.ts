import type { Output } from './notebook.ts';

type Msg =
	| { t: 'status'; v: 'loading' | 'ready' }
	| { t: 'log'; id: number; v: string }
	| { t: 'out'; id: number; out: Output }
	| { t: 'done'; id: number };

type Job = { onout: (o: Output) => void; onlog: (s: string) => void; done: () => void };

/** One Python interpreter (in a Web Worker) per open notebook; variables persist between cells. */
export class PythonKernel {
	/** off = not started yet, loading = downloading Pyodide, idle/busy once ready */
	status = $state<'off' | 'loading' | 'idle' | 'busy'>('off');
	#worker: Worker | null = null;
	#jobs = new Map<number, Job>();
	#seq = 0;

	#spawn() {
		const w = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' });
		w.onmessage = (e: MessageEvent<Msg>) => {
			const m = e.data;
			if (m.t === 'status') this.status = m.v === 'loading' ? 'loading' : 'busy';
			else if (m.t === 'log') this.#jobs.get(m.id)?.onlog(m.v);
			else if (m.t === 'out') this.#jobs.get(m.id)?.onout(m.out);
			else if (m.t === 'done') {
				const job = this.#jobs.get(m.id);
				this.#jobs.delete(m.id);
				job?.done();
				if (!this.#jobs.size) this.status = 'idle';
			}
		};
		w.onerror = (e) => {
			for (const job of this.#jobs.values()) (job.onout({ t: 'error', v: `Python worker failed: ${e.message}` }), job.done());
			this.#jobs.clear();
			this.stop();
		};
		return w;
	}

	run(code: string, onout: Job['onout'], onlog: Job['onlog'] = () => {}): Promise<void> {
		this.#worker ??= this.#spawn();
		const id = ++this.#seq;
		if (this.status !== 'loading' && this.status !== 'off') this.status = 'busy';
		return new Promise((done) => {
			this.#jobs.set(id, { onout, onlog, done });
			this.#worker!.postMessage({ id, code });
		});
	}

	/** Kills the interpreter (the only way to interrupt running Python); state is lost. */
	stop() {
		this.#worker?.terminate();
		this.#worker = null;
		for (const job of this.#jobs.values()) (job.onout({ t: 'stderr', v: 'Interrupted — kernel restarted.\n' }), job.done());
		this.#jobs.clear();
		this.status = 'off';
	}
}
