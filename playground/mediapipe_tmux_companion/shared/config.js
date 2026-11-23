export const gestureLabels = Object.freeze([
  'Closed_Fist', 'Open_Palm', 'Pointing_Up', 'Thumb_Down', 'Thumb_Up', 'Victory', 'ILoveYou',
]);

export const guardHoldMs = 1000;
export const poseNames = Object.freeze({
  Closed_Fist: 'Closed fist', Open_Palm: 'Open palm', Pointing_Up: 'Pointing up', Thumb_Down: 'Thumb down',
  Thumb_Up: 'Thumb up', Victory: 'Victory', ILoveYou: 'I love you',
});

const isObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const fail = (code, message, extra) => ({ ok: false, code, message, ...extra });

export function defaultMappings() {
  return { version: 1, gestures: Object.fromEntries(gestureLabels.map(label => [label, { enabled: false, binding: null }])) };
}

export function validateBinding(binding) {
  if (!isObject(binding) || typeof binding.command !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(binding.command)
      || !['guided', 'advanced'].includes(binding.mode) || !isObject(binding.options) || !Array.isArray(binding.args)) {
    return fail('invalid_binding', 'Choose a command and valid options.');
  }
  const { command, mode, args, options } = binding;
  const entries = Object.entries(options);
  if (entries.length > 16 || entries.some(([key, value]) =>
    !/^[a-z][a-z0-9-]{0,63}$/.test(key) || typeof value !== 'string' || value.length > 512 || value.includes('\0'))
    || args.length > 32 || args.some(arg => typeof arg !== 'string' || arg.length > 512 || /[\0\r\n]/.test(arg))
    || (mode === 'guided' ? args.length : entries.length)) {
    return fail('invalid_binding', 'Use up to 32 arguments, each at most 512 characters on one line.');
  }
  return { ok: true, binding: { command, mode, options: { ...options }, args: [...args] } };
}

export function validateMappings(value) {
  if (value?.version !== 1 || !isObject(value.gestures) || Object.keys(value.gestures).length !== gestureLabels.length) {
    return fail('invalid_mappings', 'Expected one mapping for each of the seven gestures.');
  }
  const mappings = defaultMappings();
  for (const gesture of gestureLabels) {
    const row = value.gestures[gesture];
    if (!isObject(row) || typeof row.enabled !== 'boolean' || (row.binding === null && row.enabled)) {
      return fail('invalid_mapping', 'An enabled gesture needs a command.', { gesture });
    }
    if (row.binding === null) continue;
    const result = validateBinding(row.binding);
    if (!result.ok) return { ...result, gesture };
    mappings.gestures[gesture] = { enabled: row.enabled, binding: result.binding };
  }
  return { ok: true, mappings };
}
