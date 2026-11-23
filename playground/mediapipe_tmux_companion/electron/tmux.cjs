const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const sessionFormat = '#{session_id}\t#{pid}\t#{start_time}\t#{session_created}\t#{session_attached}\t#{session_name}';
const panePattern = /^%\d+$/;
const windowPattern = /^@\d+$/;
const idPattern = /^\$\d+$/;
const digits = /^\d+$/;

const failure = (code, message) => Object.assign(new Error(message), { code });

function socketArgsFrom(env) {
  const { TMUX_COMPANION_SOCKET_NAME: name, TMUX_COMPANION_SOCKET_PATH: path } = env;
  if (name && path) throw failure('socket_config', 'Set either a tmux socket name or a socket path.');
  if (path) return ['-S', path];
  return name ? ['-L', name] : [];
}

async function execute(binary, argv, signal) {
  const env = { ...process.env };
  delete env.TMUX;
  delete env.TMUX_PANE;
  env.LC_ALL = 'C';
  try {
    return await exec(binary, argv, { env, signal, timeout: 750, maxBuffer: 64 * 1024 });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error.code === 'ENOENT') throw failure('tmux_missing', 'tmux is unavailable. Install tmux and refresh.');
    if (error.killed) throw failure('timeout', 'tmux timed out. The outcome may be uncertain.');
    if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw failure('output_limit', 'tmux exceeded the response limit. The action may have run.');
    }
    const stderr = (error.stderr ?? '').trim();
    if (/^no server running on |^error connecting to .* \((?:No such file or directory|Connection refused)\)$/m.test(stderr)) {
      throw failure('no_server', 'No tmux server is running on this socket.');
    }
    if (/not a terminal|terminal required|must be run.*(?:terminal|client)|not an interactive client/i.test(stderr)) {
      throw failure('interactive_required', 'This command requires an interactive tmux terminal.');
    }
    const line = stderr.split('\n')[0].replace(/[\p{Cc}\p{Cf}]/gu, '').slice(0, 240);
    throw failure('tmux_error', line || 'tmux could not run the command.');
  }
}

async function resolveTmuxPath(signal) {
  for (const binary of ['tmux', '/opt/homebrew/bin/tmux', '/usr/local/bin/tmux']) {
    try {
      if (/^tmux \S+/.test((await execute(binary, ['-V'], signal)).stdout)) return binary;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  throw failure('tmux_missing', 'tmux is unavailable. Install tmux and refresh.');
}

function lines(stdout) {
  return stdout.replace(/\n$/, '').split('\n').filter(Boolean);
}

function createTmuxClient({ binary, socketArgs }) {
  const run = (args, signal) => execute(binary, ['-N', '-u', ...socketArgs, ...args], signal);
  async function discover(signal) {
    try {
      const { stdout } = await run(['list-sessions', '-F', sessionFormat], signal);
      const list = lines(stdout).map(line => {
        const [sessionId, pid, start, created, attached, ...name] = line.split('\t');
        if (!idPattern.test(sessionId) || ![pid, start, created, attached].every(value => digits.test(value ?? ''))) {
          throw failure('tmux_format', 'tmux returned an unexpected session list.');
        }
        const serverKey = JSON.stringify([socketArgs, pid, start]);
        return {
          key: JSON.stringify([serverKey, sessionId, created]), serverKey, sessionId,
          pid, start, created, attachedClients: Number(attached), name: name.join('\t'),
        };
      });
      return { status: list.length ? 'ready' : 'empty', list };
    } catch (error) {
      if (error.code === 'no_server') return { status: 'empty', list: [] };
      throw error;
    }
  }

  async function listCommands(signal) {
    const { stdout } = await run(['list-commands', '-F', '#{command_list_name}\t#{command_list_usage}'], signal);
    return lines(stdout).flatMap(line => {
      const [name, ...usage] = line.split('\t');
      return /^[a-z][a-z0-9-]+$/.test(name) ? [{ name, usage: usage.join('\t') }] : [];
    });
  }

  async function readContext(session, signal, { includeClients = false } = {}) {
    async function verifyIdentity() {
      if (!(await discover(signal)).list.some(row => row.key === session.key)) {
        throw failure('stale_target', 'The selected tmux session is no longer available.');
      }
    }
    const { sessionId, pid, start, created } = session;
    if (!idPattern.test(sessionId)) throw failure('stale_target', 'The selected tmux session is invalid.');
    await verifyIdentity();
    const windowOutput = await run(['list-windows', '-t', sessionId, '-F', '#{window_id}\t#{window_index}\t#{window_active}'], signal);
    const paneOutput = await run(['list-panes', '-s', '-t', sessionId, '-F', '#{window_id}\t#{pane_id}\t#{pane_index}\t#{pane_active}'], signal);
    const windows = lines(windowOutput.stdout).map(line => {
      const [id, index, active] = line.split('\t');
      return { id, index: Number(index), active: active === '1', panes: [] };
    });
    const byId = new Map(windows.map(window => [window.id, window]));
    for (const line of lines(paneOutput.stdout)) {
      const [windowId, id, index, active] = line.split('\t');
      if (!byId.has(windowId)) throw failure('stale_target', 'The tmux layout changed. Try again.');
      byId.get(windowId).panes.push({ id, index: Number(index), active: active === '1' });
    }
    const active = windows.filter(window => window.active);
    if (active.length !== 1 || windows.some(window => !windowPattern.test(window.id)
        || !Number.isInteger(window.index) || window.panes.filter(pane => pane.active).length !== 1
        || window.panes.some(pane => !panePattern.test(pane.id) || !Number.isInteger(pane.index)))) {
      throw failure('stale_target', 'The tmux layout changed. Try again.');
    }
    const clients = includeClients
      ? lines((await run(['list-clients', '-t', sessionId, '-F', '#{client_name}'], signal)).stdout) : [];
    await verifyIdentity();
    return {
      sessionId, pid, start, created, activeWindowId: active[0].id,
      activePaneId: active[0].panes.find(pane => pane.active).id, windows, clients,
    };
  }

  const escape = arg => arg.endsWith(';') ? arg.slice(0, -1) + '\\;' : arg;

  async function readTarget(scope, target, context, signal) {
    const { sessionId, activeWindowId, windows } = context;
    let scoped = target;
    if (scope === 'session' && !target.includes(':')) {
      scoped = target + ':';
    } else if (scope === 'pane' && (target.startsWith('.') || /^\d+$/.test(target))) {
      scoped = sessionId + ':' + activeWindowId + (target.startsWith('.') ? '' : '.') + target;
    } else if (scope === 'pane' && target.startsWith('%')) {
      const window = windows.find(item => item.panes.some(pane => pane.id === target));
      if (window) scoped = sessionId + ':' + window.id + '.' + target;
    } else if (scope === 'window' && !target.includes(':')
        && (!target.startsWith('@') || windows.some(window => window.id === target))) {
      scoped = sessionId + ':' + target;
    }
    const output = await run(['display-message', '-p', '-t', escape(scoped), '#{session_id}\t#{window_id}\t#{pane_id}'], signal);
    const [session, id, pane] = output.stdout.trim().split('\t');
    if (!idPattern.test(session) || !windowPattern.test(id) || !panePattern.test(pane)) {
      throw failure('stale_target', 'tmux could not resolve the specified ' + scope + '.');
    }
    return { pane, target: { session, window: session + ':' + id, pane: session + ':' + id + '.' + pane }[scope] };
  }

  async function runAction(argv, signal) {
    return (await run(argv.map(escape), signal)).stdout;
  }

  return { discover, listCommands, readContext, readTarget, runAction };
}

module.exports = { socketArgsFrom, resolveTmuxPath, createTmuxClient, failure };
