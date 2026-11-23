import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGestureDispatch, createGestureGate, gestureDefaults } from '../renderer/gesture-gate.js';

test('FR-2/3: short or low-confidence poses do not fire, held poses fire once', () => {
  const gate = createGestureGate();
  const pose = { label: 'Thumb_Up', score: 0.9, mapped: true };
  const step = (timestampMs, sample = pose) => gate.step({ ...sample, timestampMs }).fired;
  const neutral = { label: 'None', score: 1, mapped: false };
  assert.equal(step(0, { ...pose, score: 0.69 }), undefined);
  assert.equal(step(100), undefined);
  assert.equal(step(300), 'Thumb_Up');
  assert.equal(step(1600), undefined);
  assert.equal(step(1800, neutral), undefined);
  assert.equal(step(2000, neutral), undefined);
  assert.equal(step(2200), undefined);
  assert.equal(step(2400), 'Thumb_Up');
});

test('a guarded pose needs a continuous hold and a fresh release after eligibility resets', async () => {
  let unlocked = true;
  const changes = [];
  const binding = { command: 'kill-pane', mode: 'guided', args: [], options: {} };
  const router = createGestureDispatch({
    getBinding: label => label === 'Closed_Fist' ? binding : null,
    getSettings: () => ({ ...gestureDefaults, cooldown: 0 }),
    canAct: () => true, canGuard: () => unlocked,
    onAction: (_gesture, phase, id) => { changes.push({ phase, id }); return { ok: true }; },
    onDecision: () => {},
  });
  const sample = (timestampMs, label) => router.sample({ timestampMs, label, score: 0.99 });
  const pose = timestamp => sample(timestamp, 'Closed_Fist');
  sample(0); sample(200); pose(400); pose(600);
  await Promise.resolve();
  pose(1400);
  assert.deepEqual(changes.map(item => item.phase), ['begin', 'cancel']);
  assert.equal(changes[0].id, changes[1].id);
  sample(1600); sample(1800); pose(2000); pose(2200);
  await Promise.resolve();
  router.reset();
  pose(2400); pose(2600);
  assert.deepEqual(changes.map(item => item.phase), ['begin', 'cancel', 'begin', 'cancel']);
  sample(2800); sample(3000); pose(3200); pose(3400);
  await Promise.resolve();
  for (let timestamp = 3600; timestamp <= 4600; timestamp += 200) pose(timestamp);
  unlocked = false;
  pose(4800);
  assert.deepEqual(changes.map(item => item.phase), ['begin', 'cancel', 'begin', 'cancel', 'begin', 'commit']);
  assert.equal(changes[4].id, changes[5].id);
});
