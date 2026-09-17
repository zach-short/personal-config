import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { parseCli } from '../src/lib/args.ts';
import { loadConfig } from '../src/lib/config.ts';
import { classifySource, loadProfileFrom, profileUrl } from '../src/lib/profile-source.ts';
import { cleanup, tempDir } from './helpers.ts';

const PROFILE = {
  profile: 'from-the-site',
  answers: { commitPolicy: 'agent-commits', mode: 'team', tracker: 'GitHub Issues' },
};

async function profileFile(): Promise<{ dir: string; path: string }> {
  const dir = await tempDir('pc-from-');
  const path = join(dir, 'profile.json');
  await Bun.write(path, JSON.stringify(PROFILE));
  return { dir, path };
}

describe('DIAL-6 disambiguation — no scheme, no slash, no dot, 8 of [a-z0-9]', () => {
  test('a bare short id is an id', () => {
    expect(classifySource('a1b2c3d4')).toBe('id');
    expect(classifySource('00000000')).toBe('id');
  });

  test('anything that is not exactly the id shape is a path', () => {
    // The near-misses are the whole reason the shape had to be pinned before the resolver.
    for (const value of ['a1b2c3d', 'a1b2c3d4e', 'A1B2C3D4', 'a1b2-c3d', 'profile']) {
      expect(classifySource(value)).toBe('path');
    }
  });

  test('a dot or a slash makes it a path, even at the id length', () => {
    expect(classifySource('./ab12cd34')).toBe('path');
    expect(classifySource('ab12cd34.json')).toBe('path');
    expect(classifySource('p/ab12cd34')).toBe('path');
  });

  test('a scheme makes it a url', () => {
    expect(classifySource('https://example.com/p/ab12cd34')).toBe('url');
    expect(classifySource('http://localhost:4321/p/ab12cd34')).toBe('url');
  });
});

describe('a short id resolves against the site, not a flag', () => {
  test('the origin comes from package.json homepage and the path is /p/<id>', async () => {
    const pkg = (await Bun.file('package.json').json()) as { homepage: string };
    expect(await profileUrl('ab12cd34')).toBe(`${pkg.homepage}/p/ab12cd34`);
  });
});

describe('--from reads a local profile', () => {
  test('a path loads the file', async () => {
    const { dir, path } = await profileFile();
    try {
      expect(await loadProfileFrom(path)).toEqual(PROFILE);
    } finally {
      await cleanup(dir);
    }
  });

  test('a missing file names the path it looked at', async () => {
    const dir = await tempDir('pc-from-');
    try {
      expect(loadProfileFrom(join(dir, 'nope.json'))).rejects.toThrow('--from found no file');
    } finally {
      await cleanup(dir);
    }
  });

  test('a JSON file that is not a profile object is refused', async () => {
    const dir = await tempDir('pc-from-');
    const path = join(dir, 'array.json');
    try {
      await Bun.write(path, '[1, 2, 3]');
      expect(loadProfileFrom(path)).rejects.toThrow('is not a profile object');
    } finally {
      await cleanup(dir);
    }
  });

  test('an "answers" that is not an object is refused before it reaches the merge', async () => {
    const dir = await tempDir('pc-from-');
    const path = join(dir, 'bad.json');
    try {
      await Bun.write(path, '{"answers": "everything"}');
      expect(loadProfileFrom(path)).rejects.toThrow('is not an object');
    } finally {
      await cleanup(dir);
    }
  });
});

describe('--from reads a profile over https', () => {
  test('a URL loads the body, and a 404 says so rather than merging nothing', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === '/p/ab12cd34') return Response.json(PROFILE);
        return new Response('no', { status: 404 });
      },
    });
    try {
      const base = `http://localhost:${server.port}`;
      expect(await loadProfileFrom(`${base}/p/ab12cd34`)).toEqual(PROFILE);
      expect(loadProfileFrom(`${base}/p/zzzzzzzz`)).rejects.toThrow('HTTP 404');
    } finally {
      await server.stop(true);
    }
  });

  test('a non-https origin that is not loopback is refused before the request', async () => {
    const refused = loadProfileFrom('http://example.com/p/ab12cd34');
    await expect(refused).rejects.toThrow('is not https');
  });

  // Until 2026-09-17 this spelling was refused while `localhost` was allowed, though the two
  // name the same machine to everyone except a string comparison.
  test('127.0.0.1 is the same carve-out as localhost, and loads', async () => {
    const server = Bun.serve({
      port: 0,
      fetch: (request) =>
        new URL(request.url).pathname === '/p/ab12cd34'
          ? Response.json(PROFILE)
          : new Response('no', { status: 404 }),
    });
    try {
      const from = `http://127.0.0.1:${server.port}/p/ab12cd34`;
      expect(await loadProfileFrom(from)).toEqual(PROFILE);
    } finally {
      await server.stop(true);
    }
  });

  test('the IPv6 loopback literal gets past the check and is requested', async () => {
    // Nothing is listening, so reaching the network error is itself the proof: a refusal is
    // thrown before any request is sent, and this one got as far as being refused out there.
    const server = Bun.serve({ port: 0, fetch: () => new Response('no', { status: 404 }) });
    const { port } = server;
    await server.stop(true);

    const attempted = loadProfileFrom(`http://[::1]:${port}/p/ab12cd34`);
    await expect(attempted).rejects.toThrow('the request failed');
  });

  test('0.0.0.0 is the unspecified address, not a loopback one, and stays refused', async () => {
    const refused = loadProfileFrom('http://0.0.0.0:8080/p/ab12cd34');
    await expect(refused).rejects.toThrow('is not https');
  });
});

describe('--from outranks the saved config and the repo file', () => {
  test('its answers win, and answers it does not carry survive underneath', async () => {
    const { dir, path } = await profileFile();
    try {
      const repoDir = await tempDir('pc-repo-');
      await Bun.write(
        join(repoDir, '.personal-config.json'),
        JSON.stringify({ answers: { commitPolicy: 'print-blocks', hooks: 'commit-guard' } }),
      );
      const config = await loadConfig(parseCli(['setup', '--from', path]), repoDir);
      expect(config.answers.commitPolicy).toBe('agent-commits');
      expect(config.answers.hooks).toBe('commit-guard');
      expect(config.answers['practices.comments']).toBe('why-only');
      await cleanup(repoDir);
    } finally {
      await cleanup(dir);
    }
  });

  test('no --from leaves the merge exactly as it was', async () => {
    const config = await loadConfig(parseCli(['setup']), null);
    expect(config.answers.commitPolicy).toBe('print-blocks');
  });
});
