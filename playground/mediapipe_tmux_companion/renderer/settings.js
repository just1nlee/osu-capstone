import { defaultMappings, gestureLabels, poseNames } from '/shared/config.js';
import { getCommandForm, isGuardedBinding, validateBindingOptions } from '/shared/commands.js';

function make(tag, text, attributes = {}) {
  const element = Object.assign(document.createElement(tag), attributes);
  if (text) element.textContent = text;
  return element;
}

export function mountSettings(root, api) {
  const container = root.querySelector('#gesture-rows');
  const save = root.querySelector('#save-mappings');
  const refresh = root.querySelector('#refresh-commands');
  const catalogMessage = root.querySelector('#catalog-message');
  const settingsMessage = root.querySelector('#settings-message');
  const guard = root.querySelector('#close-lock');
  const rows = new Map();
  let draft = defaultMappings();
  let stored;
  let revision;
  let catalogEpoch;
  let checkedTarget;
  let state;
  let saving = false;
  let catalogRequest = 0;
  let commands = new Map();

  function showCatalog() {
    for (const [gesture, row] of rows) {
      const name = draft.gestures[gesture].binding?.command ?? '';
      const options = [new Option('No command', '')];
      if (name && !commands.has(name)) options.push(new Option(name + ' (catalog unavailable)', name));
      options.push(...[...commands.keys()].sort().map(command => new Option(command, command)));
      row.picker.replaceChildren(...options);
      row.picker.value = name;
      row.picker.disabled = !name && !commands.size;
    }
  }

  async function loadCatalog() {
    const request = ++catalogRequest;
    refresh.disabled = true;
    try {
      const result = await api.listCommands();
      if (request !== catalogRequest) return;
      if (result.ok) {
        commands = new Map(result.commands.map(command => [command.name, command]));
        catalogMessage.textContent = '';
        showCatalog();
        for (const [gesture, row] of rows) showDetails(gesture, row.details.open);
      } else catalogMessage.textContent = result.message;
    } finally {
      if (request === catalogRequest) refresh.disabled = false;
    }
  }

  function markEdit(row) {
    row.checkCount++;
    row.message.textContent = '';
    settingsMessage.textContent = 'Unsaved changes.';
    save.disabled = saving || !stored;
  }

  function showDetails(gesture, open = false) {
    const row = rows.get(gesture);
    const { binding, enabled } = draft.gestures[gesture];
    row.enabled.checked = enabled;
    row.enabled.disabled = !binding;
    row.check.hidden = !binding;
    row.details.hidden = !binding || ['kill-pane', 'kill-window', 'kill-session'].includes(binding.command);
    row.details.open = open || binding?.mode === 'advanced';
    row.hint.textContent = isGuardedBinding(binding) ? 'Requires guard and hold' : '';
    row.inputs.replaceChildren();
    row.advancedInput.replaceChildren();
    if (!binding) return;

    const metadata = commands.get(binding.command);
    const form = getCommandForm(metadata, binding);
    const showAdvanced = binding.mode === 'advanced';
    if (!showAdvanced) {
      for (const { key, label, choices } of form.fields) {
        const input = choices ? make('select') : make('input', '', { type: 'text', maxLength: 512 });
        if (choices) input.append(new Option('Choose a destination', ''),
          ...choices.map(([value, text]) => new Option(text, value)));
        input.value = binding.options[key] ?? '';
        input.addEventListener('input', () => {
          binding.options[key] = input.value;
          markEdit(row);
        });
        const field = make('label', label, { className: 'command-field' });
        field.append(input);
        row.inputs.append(field);
      }
    }

    const advanced = make('input', '', { type: 'checkbox', checked: showAdvanced });
    const mode = make('label', '', { className: 'inline-control' });
    mode.append(advanced, ' Use advanced arguments');
    advanced.addEventListener('change', () => {
      if (advanced.checked) {
        row.guidedOptions = { ...binding.options };
        binding.args = row.advancedArgs || (binding.options.value ? [binding.options.value] : []);
        binding.options = {};
      } else {
        row.advancedArgs = [...binding.args];
        binding.options = row.guidedOptions ?? {};
        binding.args = [];
      }
      binding.mode = advanced.checked ? 'advanced' : 'guided';
      markEdit(row);
      showDetails(gesture, true);
      row.advancedInput.querySelector('input').focus();
    });
    row.advancedInput.append(mode);
    if (showAdvanced) {
      const input = make('textarea', '', { value: binding.args.join('\n'), rows: 3, spellcheck: false });
      input.addEventListener('input', () => {
        binding.args = input.value.split('\n').filter(line => line.length);
        markEdit(row);
      });
      const field = make('label', 'Arguments, one per line', { className: 'command-field' });
      field.append(input);
      row.advancedInput.append(field);
    }
    if (metadata?.usage) row.advancedInput.append(make('code', binding.command + ' ' + metadata.usage));
    if (showAdvanced) row.advancedInput.append(make('p',
      'Explicit targets or server-wide commands can affect other sessions.', { className: 'guard-hint' }));
    else if (form.advancedRequired) {
      row.hint.textContent = 'Fill in the required values in Advanced options';
    }
  }

  function createRow(gesture) {
    const caption = poseNames[gesture];
    const group = make('fieldset', '', { className: 'gesture-row' });
    group.dataset.gesture = gesture;
    const picker = make('select');
    picker.setAttribute('aria-label', caption + ' command');
    const enabled = make('input', '', { type: 'checkbox' });
    enabled.setAttribute('aria-label', 'Enable ' + caption);
    const label = make('label', '', { className: 'inline-control enabled' });
    label.append(enabled, ' Enabled');
    const controls = make('div', '', { className: 'row-controls' });
    controls.append(picker, label);
    const check = make('button', 'Check settings', { type: 'button' });
    const hint = make('span', '', { className: 'guard-hint' });
    const rowStatus = make('div', '', { className: 'row-status' });
    rowStatus.append(check, hint);
    const details = make('details');
    const advancedInput = make('div', '', { className: 'advanced-input' });
    details.append(make('summary', 'Advanced options'), advancedInput);
    const inputs = make('div', '', { className: 'guided-input' });
    const message = make('p', '', { className: 'row-message' });
    message.setAttribute('role', 'status');
    group.append(make('legend', caption), controls, inputs, details, rowStatus, message);
    container.append(group);
    const row = { picker, enabled, check, details, inputs, advancedInput, message, hint, checkCount: 0 };
    picker.addEventListener('change', () => {
      const prior = draft.gestures[gesture];
      draft.gestures[gesture] = picker.value
        ? { enabled: prior.binding ? prior.enabled : true, binding: { command: picker.value, mode: 'guided', options: {}, args: [] } }
        : { enabled: false, binding: null };
      row.guidedOptions = row.advancedArgs = undefined;
      markEdit(row);
      showDetails(gesture);
      updateChecks();
    });
    enabled.addEventListener('change', () => {
      draft.gestures[gesture].enabled = enabled.checked;
      markEdit(row);
    });
    check.addEventListener('click', async () => {
      const targetToken = state.sessions.targetToken;
      const request = ++row.checkCount;
      check.disabled = true;
      try {
        const result = await api.checkMapping({ gesture, binding: draft.gestures[gesture].binding, targetToken });
        if (row.checkCount !== request || targetToken !== state.sessions.targetToken) return;
        message.dataset.error = String(!result.ok);
        message.textContent = result.ok ? 'Ready for ' + result.target : result.message;
      } finally {
        updateChecks();
      }
    });
    return row;
  }

  function updateChecks() {
    for (const [, row] of rows) row.check.disabled = !state?.sessions.targetToken || saving;
  }

  for (const gesture of gestureLabels) rows.set(gesture, createRow(gesture));
  showCatalog();
  for (const gesture of gestureLabels) showDetails(gesture);

  function render(next) {
    state = next;
    guard.disabled = false;
    guard.checked = state.guardUnlocked;
    if (revision !== state.revision && state.mappings) {
      revision = state.revision;
      draft = structuredClone(state.mappings);
      stored = structuredClone(state.mappings);
      showCatalog();
      for (const [gesture, row] of rows) showDetails(gesture, row.details.open);
      if (state.notice) settingsMessage.textContent = state.notice;
    }
    if (catalogEpoch !== state.catalogEpoch) {
      catalogEpoch = state.catalogEpoch;
      void loadCatalog();
    }
    if (checkedTarget !== state.sessions.targetToken) {
      checkedTarget = state.sessions.targetToken;
      for (const [, row] of rows) row.message.textContent = '';
    }
    updateChecks();
  }
  refresh.addEventListener('click', () => void loadCatalog());
  guard.addEventListener('change', () => void api.setGuardUnlocked(guard.checked));
  save.addEventListener('click', async () => {
    if (saving || !stored) return;
    for (const [gesture, { binding }] of Object.entries(draft.gestures)) {
      const row = rows.get(gesture);
      row.message.textContent = '';
      const metadata = binding && commands.get(binding.command);
      if (!metadata) continue;
      const validation = validateBindingOptions(metadata, binding);
      if (!validation.ok) {
        row.message.dataset.error = 'true';
        row.message.textContent = validation.message;
        settingsMessage.textContent = 'Review the highlighted gesture.';
        row.picker.focus();
        return;
      }
    }
    saving = true;
    save.disabled = true;
    updateChecks();
    container.inert = true;
    try {
      const result = await api.saveMappings(draft);
      if (result.ok) {
        render({ ...state, ...result });
        settingsMessage.textContent = 'Mappings saved.';
      } else {
        settingsMessage.textContent = result.message;
        if (result.gesture) {
          const row = rows.get(result.gesture);
          row.message.dataset.error = 'true';
          row.message.textContent = result.message;
        }
      }
    } finally {
      saving = container.inert = false;
      save.disabled = JSON.stringify(draft) === JSON.stringify(stored);
      updateChecks();
    }
  });
  return { render, refreshCatalog: loadCatalog };
}
