/**
 * Clinic notification polling and the audible alert (Section 15).
 *
 * This is a **module-level store with one poller**, not per-component state.
 * Two components use it — the sidebar badge and the notifications page — and on
 * that page both are mounted at once. Per-component state meant two pollers and,
 * worse, two overlapping chimes.
 *
 * Transport is REST polling by decision; the service layer is kept
 * WebSocket-ready. Only Clinic Users poll. Admin and Superadmin get a chain-wide
 * feed on the page for oversight, but no badge and no sound.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { notificationService } from '../services';

const POLL_MS = 30000;

/**
 * The alert repeats until someone acknowledges, because a single chime is easy
 * to miss when the desk is busy — which is the whole point of having one.
 *
 * It slows down rather than continuing at full rate forever. An alarm that
 * never lets up is one staff learn to mute permanently, and a muted alarm
 * protects nobody. After two minutes unanswered it drops to a slow reminder:
 * still impossible to miss, no longer a siren.
 */
const REPEAT_MS = 5000;
const SLOW_REPEAT_MS = 30000;
const BACK_OFF_AFTER_MS = 120000;

const SOUND_PREF_KEY = 'clinic.notifications.sound';

const EMPTY = {
  unacknowledged: 0,
  total: 0,
  latest_id: null,
  latest: null,
  alerts_enabled: false,
  soundEnabled: true,
  soundBlocked: false,
  alarmActive: false,
  //: 'unsupported' | 'default' | 'granted' | 'denied'
  desktopPermission: 'unsupported',
};

let state = {
  ...EMPTY,
  soundEnabled: window.localStorage.getItem(SOUND_PREF_KEY) !== 'off',
  desktopPermission:
    typeof window.Notification === 'undefined' ? 'unsupported' : Notification.permission,
};

const listeners = new Set();
let pollTimer = null;
let chimeTimer = null;
let ringingSince = null;

function emit(patch) {
  const next = { ...state, ...patch };
  // Referential stability matters: useSyncExternalStore re-renders on identity
  // change, so returning a fresh object every poll would re-render constantly.
  const changed = Object.keys(next).some((key) => next[key] !== state[key]);
  if (!changed) return;
  state = next;
  listeners.forEach((listener) => listener());
}

/* -------------------------------------------------------------------------- *
 * The chime
 *
 * Synthesised rather than shipped as an audio file: nothing binary in the repo,
 * nothing to 404, works offline.
 *
 * Tuned to carry across a reception desk without sounding like an emergency.
 * Three things do that, and they are the knobs worth turning if it still is not
 * right:
 *
 *   - **Timbre.** A pure sine has no harmonics, so it reads as quiet however
 *     loud you make it. A triangle plus an octave above gives a bell-like
 *     brightness that cuts through conversation; a sawtooth or square would cut
 *     through too, but as a buzzer.
 *   - **A rising three-note figure** (E-A-E) instead of two notes. Recognisable
 *     as "the appointment sound" rather than as generic device noise, and the
 *     rise reads as an announcement rather than a warning.
 *   - **A gentle attack and a lowpass at 5 kHz**, which is what keeps it from
 *     turning shrill at the higher volume.
 * -------------------------------------------------------------------------- */

/** E5 - A5 - E6: a perfect fourth then a fifth. Bright, resolved, not anxious. */
const CHIME_NOTES = [659.25, 880.0, 1318.51];
const NOTE_SPACING = 0.12;
const NOTE_LENGTH = 0.5;
const ATTACK = 0.008;
const PEAK_GAIN = 0.34;
/** The octave partial that supplies the "bell" without adding harshness. */
const OVERTONE_RATIO = 0.3;

/**
 * One AudioContext, reused.
 *
 * Chrome caps how many a page may hold, and the alert now fires every few
 * seconds — building and tearing one down per chime would eventually run out.
 * Reusing it also means `resume()` from a user gesture unblocks every later
 * chime, not just the one that triggered it.
 */
let audioContext = null;

function getAudioContext() {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (audioContext === null) {
    try {
      audioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function renderChime(context) {
  const now = context.currentTime;

  // Shared voicing chain: everything runs through one lowpass so the whole
  // figure keeps a consistent warmth.
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  tone.Q.value = 0.6;
  tone.connect(context.destination);

  CHIME_NOTES.forEach((frequency, index) => {
    const start = now + index * NOTE_SPACING;
    const end = start + NOTE_LENGTH;

    // Fundamental plus one octave: two partials is enough to read as a bell.
    [
      { type: 'triangle', hz: frequency, level: PEAK_GAIN },
      { type: 'sine', hz: frequency * 2, level: PEAK_GAIN * OVERTONE_RATIO },
    ].forEach(({ type, hz, level }) => {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = hz;

      const gain = context.createGain();
      // Ramped rather than switched, so it reads as a chime and not a click.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + ATTACK);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain).connect(tone);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });
  });
}

/**
 * Play once. Returns false when the browser is still blocking audio, which is
 * how the caller knows to offer the "Enable sound" control.
 */
function playChime() {
  const context = getAudioContext();
  if (context === null) return false;
  // Browsers hand back a suspended context until the page has been interacted
  // with. Reporting that honestly is the whole point.
  if (context.state !== 'running') return false;
  try {
    renderChime(context);
    return true;
  } catch {
    return false;
  }
}

/** Play from a user gesture, resuming the context first. */
async function unlockAndPlay() {
  const context = getAudioContext();
  if (context === null) return false;
  try {
    await context.resume();
    if (context.state !== 'running') return false;
    renderChime(context);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- *
 * Desktop notifications
 *
 * The in-app card only helps while the app is the visible tab. Reception
 * switching to WhatsApp Web or minimising the browser is precisely when things
 * get missed, and an OS-level notification is the only thing that reaches them
 * there.
 *
 * Posted **only when the tab is hidden**: when it is visible the floating card
 * already says the same thing, and two alerts for one event is how people learn
 * to turn both off.
 * -------------------------------------------------------------------------- */
const DESKTOP_TAG = 'clinic-notifications';

/** Highest notification id already announced to the OS, so it fires once. */
let lastDesktopId = 0;

function postDesktopNotification() {
  if (state.desktopPermission !== 'granted') return;
  if (!document.hidden) return;

  const latest = state.latest;
  if (!latest || latest.id <= lastDesktopId) return;
  lastDesktopId = latest.id;

  const extra = state.unacknowledged - 1;
  const detail = [latest.patient_name, latest.time, latest.clinic_name]
    .filter(Boolean)
    .join(' · ');

  try {
    const notification = new Notification(latest.title, {
      body: extra > 0 ? `${detail}\n+${extra} more awaiting acknowledgement` : detail,
      // A shared tag replaces the previous one instead of stacking a wall of
      // them down the corner of the screen.
      tag: DESKTOP_TAG,
      renotify: true,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers throw for constructor-based notifications outside a service
    // worker. Nothing to do -- the in-app card still covers the visible case.
  }
}

function shouldRing() {
  return state.alerts_enabled && state.soundEnabled && state.unacknowledged > 0;
}

function stopAlarm() {
  if (chimeTimer !== null) {
    window.clearTimeout(chimeTimer);
    chimeTimer = null;
  }
  ringingSince = null;
  emit({ alarmActive: false });
}

function ringOnce() {
  if (!playChime()) {
    // Blocked by autoplay policy. Stop trying until the user unblocks it,
    // rather than looping uselessly, and surface the "Enable sound" control.
    emit({ soundBlocked: true });
    stopAlarm();
    return false;
  }
  emit({ soundBlocked: false });
  return true;
}

function scheduleNext() {
  if (chimeTimer !== null) window.clearTimeout(chimeTimer);
  if (!shouldRing()) {
    stopAlarm();
    return;
  }
  const elapsed = ringingSince === null ? 0 : Date.now() - ringingSince;
  const delay = elapsed >= BACK_OFF_AFTER_MS ? SLOW_REPEAT_MS : REPEAT_MS;
  chimeTimer = window.setTimeout(() => {
    chimeTimer = null;
    if (!shouldRing()) {
      stopAlarm();
      return;
    }
    if (ringOnce()) scheduleNext();
  }, delay);
}

/** Start, continue or stop the alarm to match the current unread count. */
function syncAlarm() {
  if (!shouldRing()) {
    stopAlarm();
    return;
  }
  if (ringingSince !== null) return; // already ringing; the timer keeps going

  ringingSince = Date.now();
  emit({ alarmActive: true });
  if (ringOnce()) scheduleNext();
}

async function poll() {
  try {
    const data = await notificationService.counters();
    emit({
      unacknowledged: data.unacknowledged,
      total: data.total,
      latest_id: data.latest_id,
      // Replaced wholesale rather than merged: `latest` is null once everything
      // is acknowledged, and the card must disappear when that happens.
      latest: data.latest ?? null,
      alerts_enabled: data.alerts_enabled,
    });
    if (data.alerts_enabled) {
      syncAlarm();
      postDesktopNotification();
    }
    return data;
  } catch {
    // A failed poll is not worth surfacing: the next one is 15 seconds away,
    // and an error banner that appears on every network hiccup is noise.
    return null;
  }
}

function startPolling() {
  if (pollTimer !== null) return;
  poll();
  pollTimer = window.setInterval(poll, POLL_MS);
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  stopAlarm();
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) startPolling();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopPolling();
  };
}

const noopSubscribe = () => () => {};
const getSnapshot = () => state;

export function useNotifications({ enabled = true } = {}) {
  // Non-clinic roles never subscribe, so no poller runs for them at all.
  const subscribeIfEnabled = useCallback(
    (listener) => (enabled ? subscribe(listener) : noopSubscribe()),
    [enabled],
  );
  const snapshot = useSyncExternalStore(subscribeIfEnabled, getSnapshot, getSnapshot);

  const setSound = useCallback((on) => {
    window.localStorage.setItem(SOUND_PREF_KEY, on ? 'on' : 'off');
    emit({ soundEnabled: on, soundBlocked: on ? false : state.soundBlocked });
    if (on) syncAlarm();
    else stopAlarm();
  }, []);

  /**
   * Called from a click, so the browser will allow audio. Used by the
   * "Enable sound" control, the Test button, and to re-arm after muting.
   *
   * Async because resuming a suspended AudioContext returns a promise, and
   * checking `state` before it settles reports a stale answer.
   */
  const unlockSound = useCallback(async () => {
    window.localStorage.setItem(SOUND_PREF_KEY, 'on');
    emit({ soundEnabled: true, soundBlocked: false });
    const ok = await unlockAndPlay();
    emit({ soundBlocked: !ok });
    if (ok) {
      // Reset the back-off so an alarm that was already slow starts over.
      ringingSince = null;
      syncAlarm();
    }
    return ok;
  }, []);

  /** Silence the current alarm without turning sound off for good. */
  const silence = useCallback(() => {
    stopAlarm();
  }, []);

  /**
   * Ask for desktop-notification permission. Must be called from a click —
   * browsers refuse the prompt otherwise, and Chrome permanently blocks origins
   * that ask on page load.
   */
  const enableDesktop = useCallback(async () => {
    if (typeof window.Notification === 'undefined') {
      emit({ desktopPermission: 'unsupported' });
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      emit({ desktopPermission: result });
      return result;
    } catch {
      emit({ desktopPermission: Notification.permission });
      return Notification.permission;
    }
  }, []);

  return {
    counters: snapshot,
    unread: snapshot.unacknowledged,
    latest: snapshot.latest,
    alertsEnabled: snapshot.alerts_enabled,
    soundEnabled: snapshot.soundEnabled,
    soundBlocked: snapshot.soundBlocked,
    alarmActive: snapshot.alarmActive,
    desktopPermission: snapshot.desktopPermission,
    setSound,
    unlockSound,
    silence,
    enableDesktop,
    refresh: poll,
  };
}
