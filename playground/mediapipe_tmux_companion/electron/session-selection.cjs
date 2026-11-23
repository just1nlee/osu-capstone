const { randomUUID } = require('node:crypto');

function createSessionSelection() {
  let discovery = { status: 'loading', list: [] };
  let selectedKey = null;
  let targetToken = null;
  let requireChoice = false;
  let lost = false;

  const snapshot = () => ({
    status: lost && discovery.status !== 'error' ? 'lost' : discovery.status,
    list: discovery.list.map(({ key, name, attachedClients }) => ({ key, name, attachedClients })),
    selectedKey,
    targetToken,
    ...(discovery.message && { message: discovery.message }),
  });

  function select(key) {
    if (!discovery.list.some(row => row.key === key)) return null;
    if (selectedKey !== key) targetToken = randomUUID();
    selectedKey = key;
    requireChoice = true;
    lost = false;
    return snapshot();
  }

  function applyDiscovery(result) {
    discovery = result;
    if (selectedKey && !discovery.list.some(row => row.key === selectedKey)) {
      selectedKey = targetToken = null;
      lost = true;
    }
    if (!requireChoice && result.status === 'ready') {
      if (result.list.length === 1) return select(result.list[0].key);
      requireChoice = true;
    }
    return snapshot();
  }

  return { applyDiscovery, select, snapshot, target: () => discovery.list.find(row => row.key === selectedKey) };
}

module.exports = { createSessionSelection };
