const { contextBridge, ipcRenderer } = require('electron');

const actions = [
  'getState', 'refreshSessions', 'selectSession', 'listCommands', 'saveMappings', 'checkMapping',
  'setCameraEnabled', 'reportCameraStatus', 'setGuardUnlocked', 'dispatchGesture',
];
const api = Object.fromEntries(actions.map(name => [
  name, (...args) => ipcRenderer.invoke('companion:' + name, ...args),
]));
api.onStateChanged = listener => {
  if (typeof listener !== 'function') throw new TypeError('Expected a listener function');
  const receive = (_event, payload) => listener(payload);
  ipcRenderer.on('companion:stateChanged', receive);
  return () => ipcRenderer.removeListener('companion:stateChanged', receive);
};

contextBridge.exposeInMainWorld('gestureCompanion', api);
