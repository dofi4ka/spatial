// Production entry point. Wraps the SvelteKit Node server so the public URL can be configured
// at runtime instead of being baked into the image:
//  - ORIGIN set (e.g. https://spatial.example.com): every request is treated as coming from it
//  - ORIGIN unset: use X-Forwarded-Proto / X-Forwarded-Host from a reverse proxy, else plain http
import { server } from './build/index.js';

const origin = process.env.ORIGIN ? new URL(process.env.ORIGIN) : null;

server.prependListener('request', (req) => {
	if (origin) {
		req.headers['x-forwarded-proto'] = origin.protocol.slice(0, -1);
		req.headers['x-forwarded-host'] = origin.host;
	} else {
		req.headers['x-forwarded-proto'] ??= 'http';
	}
});
