import { gestureLabels, guardHoldMs } from '../shared/config.js';
import { isGuardedBinding } from '../shared/commands.js';

export const gestureDefaults = Object.freeze({ fps: 5, confidence: 0.70, frames: 2, cooldown: 1000 });

export function createGestureGate() {
  let state, candidate, frames, neutralFrames, cooldownUntil;
  function reset(requireRelease = false) {
    state = requireRelease ? 'WAIT_FOR_RELEASE' : 'READY';
    candidate = undefined;
    frames = neutralFrames = cooldownUntil = 0;
  }
  reset();

  function startCooldown(timestampMs, cooldown) {
    reset();
    state = 'COOLDOWN';
    cooldownUntil = timestampMs + cooldown;
  }

  function inspect(timestampMs) {
    return {
      state: state === 'COOLDOWN' && timestampMs >= cooldownUntil ? 'WAIT_FOR_RELEASE' : state,
      candidate,
      frames,
      neutralFrames,
      cooldownRemainingMs: Math.max(0, cooldownUntil - timestampMs),
    };
  }

  function step({ label, score, timestampMs, mapped, settings = gestureDefaults }) {
    const supported = gestureLabels.includes(label);
    const qualifies = mapped && supported && score >= settings.confidence;
    const previousState = state;
    let fired, decision;

    if (state === 'COOLDOWN' && timestampMs >= cooldownUntil) state = 'WAIT_FOR_RELEASE';
    if (state === 'COOLDOWN') {
      decision = 'Ignored during cooldown';
    } else if (state === 'WAIT_FOR_RELEASE') {
      neutralFrames = qualifies ? 0 : neutralFrames + 1;
      decision = qualifies ? 'Waiting for a neutral frame' : `Neutral frame ${neutralFrames} / 2`;
      if (neutralFrames === 2) {
        reset();
        decision = 'Released; ready for another gesture';
      }
    } else if (!qualifies) {
      reset();
      decision = !supported ? 'No supported gesture' : !mapped ? 'Unassigned gesture' : 'Below confidence threshold';
    } else {
      frames = label === candidate ? frames + 1 : 1;
      candidate = label;
      state = 'CANDIDATE';
      decision = `Candidate ${frames} / ${settings.frames}`;
      if (frames >= settings.frames) {
        fired = label;
        startCooldown(timestampMs, settings.cooldown);
        decision = 'Gesture accepted';
      }
    }
    // For a zero cooldown the firing frame still belongs to COOLDOWN.
    return { ...inspect(timestampMs), state, previousState, fired, decision };
  }

  return {
    reset, step, inspect, startCooldown,
    clearCandidate() {
      if (state === 'READY' || state === 'CANDIDATE') reset();
    },
  };
}

export function createGestureDispatch({
  getBinding, getSettings = () => gestureDefaults, canAct, canGuard, onAction, onDecision,
}) {
  const gate = createGestureGate();
  let pending;
  gate.reset(true);

  function cancel() {
    if (!pending) return;
    const action = pending;
    pending = undefined;
    void onAction(action.label, 'cancel', action.id);
  }

  return {
    reset() { cancel(); gate.reset(true); },
    inspect(now) {
      const state = gate.inspect(now);
      return pending ? { ...state, state: 'HOLDING' } : state;
    },
    sample(frame) {
      const settings = getSettings();
      const { label, score, timestampMs } = frame;
      if (!canAct()) {
        const previousState = gate.inspect(timestampMs).state;
        cancel();
        gate.reset(true);
        onDecision({ ...frame, ...gate.inspect(timestampMs), previousState, decision: 'Gesture actions paused' });
        return;
      }
      const binding = getBinding(label);
      if (pending) {
        const maxGap = Math.max(250, 2500 / settings.fps);
        if (!canGuard() || label !== pending.label || !binding || score < settings.confidence
            || timestampMs - pending.lastFrame > maxGap) {
          cancel();
          gate.reset(true);
          onDecision({ ...frame, ...gate.inspect(timestampMs), previousState: 'HOLDING', decision: 'Hold cancelled' });
          return;
        }
        pending.lastFrame = timestampMs;
        if (pending.armed && timestampMs - pending.startedAt >= guardHoldMs + 50) {
          const action = pending;
          pending = undefined;
          gate.startCooldown(timestampMs, settings.cooldown);
          onDecision({ ...frame, ...gate.inspect(timestampMs), previousState: 'HOLDING',
            decision: 'Hold accepted', action: binding.command });
          return onAction(label, 'commit', action.id);
        }
        onDecision({ ...frame, ...gate.inspect(timestampMs), previousState: 'HOLDING',
          state: 'HOLDING', decision: 'Keep holding', action: binding.command });
        return;
      }

      const decision = gate.step({ ...frame, mapped: Boolean(binding), settings });
      if (decision.fired && isGuardedBinding(binding)) {
        const allowed = canGuard();
        onDecision({ ...frame, ...decision, action: binding.command,
          decision: allowed ? 'Hold gesture to run' : 'Guard is locked' });
        if (!allowed) return;
        const attempt = { id: crypto.randomUUID(), label, startedAt: timestampMs, lastFrame: timestampMs, armed: false };
        pending = attempt;
        void Promise.resolve(onAction(label, 'begin', attempt.id)).then(result => {
          if (pending !== attempt) return;
          if (result?.ok) attempt.armed = true;
          else pending = undefined;
        });
        return;
      }
      onDecision({ ...frame, ...decision, action: decision.fired ? binding.command : undefined });
      if (decision.fired) return onAction(label);
    },
  };
}
