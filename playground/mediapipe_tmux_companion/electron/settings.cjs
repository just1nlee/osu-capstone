const { mkdir, readFile, writeFile, rename, unlink } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { join } = require('node:path');
const { defaultMappings, validateMappings } = require('../shared/config.js');

async function openSettings(directory) {
  await mkdir(directory, { recursive: true });
  const filename = join(directory, 'gesture-mappings.v1.json');
  let mappings = defaultMappings();
  let revision = 0;
  let notice;
  try {
    const result = validateMappings(JSON.parse(await readFile(filename, 'utf8')));
    if (result.ok) mappings = result.mappings;
    else notice = 'Saved mappings could not be read. The saved file is still on disk.';
  } catch (error) {
    if (error.code !== 'ENOENT') notice = 'Saved mappings could not be read. The saved file is still on disk.';
  }

  let pending = Promise.resolve();
  const read = () => ({ ok: true, mappings: structuredClone(mappings), revision, ...(notice && { notice }) });

  function save(candidate) {
    const result = validateMappings(candidate);
    if (!result.ok) return Promise.resolve(result);
    const update = pending.then(async () => {
      const temporary = join(directory, '.mappings-' + randomUUID() + '.tmp');
      try {
        await writeFile(temporary, JSON.stringify(result.mappings, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        await rename(temporary, filename);
      } catch {
        await unlink(temporary).catch(() => {});
        return { ok: false, code: 'save_failed', message: 'Could not save mappings. Your previous mappings are still active.' };
      }
      mappings = result.mappings;
      revision++;
      notice = undefined;
      return read();
    });
    pending = update;
    return update;
  }

  return { read, save };
}

module.exports = { openSettings };
