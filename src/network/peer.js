/**
 * PeerJS wrapper for chess P2P multiplayer.
 * - Host calls gc.host()  → gets a 6-char room code via 'open' event
 * - Guest calls gc.join(code) → triggers 'connect' when ready
 * - Both sides use gc.send(msg) / gc.on('data', ...) for game messages
 */
import Peer from 'peerjs';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

function randomCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

export class GameConnection {
  constructor() {
    this._peer = null;
    this._conn = null;
    this._handlers = {};
    this.isHost = false;
  }

  on(event, handler) {
    this._handlers[event] = handler;
    return this; // chainable
  }

  _emit(event, ...args) {
    this._handlers[event]?.(...args);
  }

  _bindConn(conn) {
    this._conn = conn;
    conn.on('open',  ()  => this._emit('connect'));
    conn.on('data',  (d) => this._emit('data', d));
    conn.on('close', ()  => this._emit('close'));
    conn.on('error', (e) => this._emit('error', e));
  }

  host(code = randomCode(), attempt = 0) {
    if (attempt > 9) { this._emit('error', new Error('无法创建房间，请重试')); return; }
    this.isHost = true;
    const peer = new Peer(code);
    this._peer = peer;
    peer.on('open', () => this._emit('open', code));
    peer.on('connection', (conn) => this._bindConn(conn));
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        this.host(randomCode(), attempt + 1);
      } else {
        this._emit('error', err);
      }
    });
  }

  join(code) {
    this.isHost = false;
    const peer = new Peer();
    this._peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(code.toUpperCase().trim(), { reliable: true });
      this._bindConn(conn);
    });
    peer.on('error', (e) => this._emit('error', e));
  }

  send(data) {
    if (this._conn?.open) this._conn.send(data);
  }

  destroy() {
    this._peer?.destroy();
    this._peer = null;
    this._conn = null;
    this._handlers = {};
  }
}

// Message type constants
export const MSG = {
  GAME_START:   'game_start',   // host→guest: { boardType, hostColor, pieces }
  MOVE:         'move',         // { move }
  UNDO_REQUEST: 'undo_request',
  UNDO_ACCEPT:  'undo_accept',
  UNDO_REJECT:  'undo_reject',
  SURRENDER:    'surrender',
};
