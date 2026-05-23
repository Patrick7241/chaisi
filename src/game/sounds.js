/**
 * Chess sound effects using Web Audio API.
 * No external files needed — sounds are synthesized in-browser.
 */

let _ctx = null;

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/** Soft wooden click — piece placed on board */
export function playMove() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.04);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.start(t);
    osc.stop(t + 0.11);
  } catch (_) { /* silently ignore if audio unavailable */ }
}

/** Deeper thump — piece captured */
export function playCapture() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Low thud
    const osc1  = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(380, t);
    osc1.frequency.exponentialRampToValueAtTime(90, t + 0.18);
    gain1.gain.setValueAtTime(0.32, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc1.start(t);
    osc1.stop(t + 0.22);

    // Sharp snap overtone
    const osc2  = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1100, t);
    osc2.frequency.exponentialRampToValueAtTime(300, t + 0.035);
    gain2.gain.setValueAtTime(0.10, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc2.start(t);
    osc2.stop(t + 0.04);
  } catch (_) { /* silently ignore */ }
}

/**
 * Inspect the last move in a game state's history and play the right sound.
 * Works for game.js / split-game.js (moveHistory = [{move, captured}])
 * and intl-game.js (history = [moveObj])
 */
export function playSoundForLastMove(gs) {
  if (gs.moveHistory?.length > 0) {
    const last = gs.moveHistory[gs.moveHistory.length - 1];
    last?.captured ? playCapture() : playMove();
    return;
  }
  if (gs.history?.length > 0) {
    const last = gs.history[gs.history.length - 1];
    last?.capture ? playCapture() : playMove();
    return;
  }
  playMove(); // gomoku or fallback
}
