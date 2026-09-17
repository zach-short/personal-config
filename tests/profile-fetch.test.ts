import { describe, expect, test } from 'bun:test';
import { loadProfileFrom } from '../src/lib/profile-source.ts';

const PROFILE = { answers: { 'track-mode': 'tracked' } };

/**
 * Serves one scripted answer per path, on a loopback port the test owns. The handler must not
 * read `server` — that makes the binding reference its own initializer, which `tsc` rejects even
 * though it runs — so every route here uses a relative or absolute location instead.
 */
function serve(routes: (url: URL) => Response | null) {
  const server = Bun.serve({
    port: 0,
    fetch: (request) => routes(new URL(request.url)) ?? new Response('no', { status: 404 }),
  });
  return { server, base: `http://localhost:${server.port}` };
}

describe('a redirect is followed, but every hop is checked', () => {
  test('a hop that stays on the loopback origin is followed, including a relative location', async () => {
    const { server, base } = serve((url) => {
      if (url.pathname === '/start') {
        return new Response(null, { status: 302, headers: { location: '/p/ab12cd34' } });
      }
      return url.pathname === '/p/ab12cd34' ? Response.json(PROFILE) : null;
    });
    try {
      expect(await loadProfileFrom(`${base}/start`)).toEqual(PROFILE);
    } finally {
      await server.stop(true);
    }
  });

  // The defect: the https check ran once, against the URL typed, and `fetch` followed redirects
  // itself — so a 302 down to http was requested anyway. example.com is never contacted; the
  // refusal happens before the second request is sent.
  test('a hop that leaves https for plain http is refused, not requested', async () => {
    const { server, base } = serve((url) =>
      url.pathname === '/downgrade'
        ? new Response(null, {
            status: 302,
            headers: { location: 'http://example.com/p/ab12cd34' },
          })
        : null,
    );
    try {
      expect(loadProfileFrom(`${base}/downgrade`)).rejects.toThrow('is not https');
    } finally {
      await server.stop(true);
    }
  });

  test('a redirect that never lands stops instead of looping forever', async () => {
    const { server, base } = serve((url) =>
      url.pathname === '/loop'
        ? new Response(null, { status: 302, headers: { location: '/loop' } })
        : null,
    );
    try {
      expect(loadProfileFrom(`${base}/loop`)).rejects.toThrow('redirected more than 5 times');
    } finally {
      await server.stop(true);
    }
  });

  test('a 3xx carrying no location is reported as the status it is', async () => {
    const { server, base } = serve((url) =>
      url.pathname === '/bare' ? new Response(null, { status: 302 }) : null,
    );
    try {
      expect(loadProfileFrom(`${base}/bare`)).rejects.toThrow('HTTP 302');
    } finally {
      await server.stop(true);
    }
  });
});

describe('a request that cannot complete says so in one line', () => {
  test('a refused connection is a message, not a raw network error', async () => {
    // Bound and immediately released, so the port is almost certainly closed.
    const { server, base } = serve(() => null);
    await server.stop(true);

    const failure = loadProfileFrom(`${base}/p/ab12cd34`);
    await expect(failure).rejects.toThrow('the request failed');
    await expect(failure).rejects.toThrow('--from');
  });
});
