/**
 * split-pieces.js — zone-aware move generation for the Split Board
 *
 * Board layout:
 *   rows 0–4  = Chinese chess zone  (Black home, 象棋区)
 *   rows 5–9  = International zone  (Red  home, 国际区)
 *
 * Black pieces (Chinese types):
 *   将/士: palace-confined in Chinese zone; King-like / Bishop-like in Int'l zone
 *   象:    Chinese zone only (cannot cross boundary)
 *   马:    Horse (leg-blocked) in Chinese zone; Knight (free) in Int'l zone
 *   车/炮: same everywhere
 *   兵:    forward-only in Chinese zone; pawn-style in Int'l zone
 *
 * Red pieces (International types):
 *   ♔:  King (8-dir) in Int'l zone; General-like (4-dir) in Chinese zone
 *   ♕:  Queen (8-dir slide) everywhere
 *   ♖:  Rook (straight slide) everywhere
 *   ♗:  Bishop (diagonal slide) in Int'l zone; Elephant-style in Chinese zone
 *   ♘:  Knight (free L) in Int'l zone; Horse-style (leg-blocked) in Chinese zone
 *   ♙:  Pawn (forward+diagonal capture) in Int'l zone; Soldier-style in Chinese zone
 */

import { COLS, ROWS, CHINESE_ZONE_MAX, INTL_ZONE_MIN,
         BLACK_PALACE, PIECE_TYPES, COLOR } from './split-constants.js';

function inBounds(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

function inPalace(col, row, palace) {
  return col >= palace.colMin && col <= palace.colMax &&
         row >= palace.rowMin && row <= palace.rowMax;
}

function mv(piece, toCol, toRow, target = null, promotion = null) {
  return {
    from:      { col: piece.col, row: piece.row },
    to:        { col: toCol,     row: toRow },
    capture:   target || null,
    promotion: promotion
  };
}

// ─────────────────────────────── dispatch ────────────────────────────────────

export function getCandidateMoves(piece, board) {
  const inChinese = piece.row <= CHINESE_ZONE_MAX;
  switch (piece.type) {
    case PIECE_TYPES.GENERAL:  return generalMoves(piece, board);
    case PIECE_TYPES.ADVISOR:  return inChinese ? advisorMoves(piece, board) : advisorAsBishopMoves(piece, board);
    case PIECE_TYPES.ELEPHANT: return elephantMoves(piece, board);         // always Chinese zone
    case PIECE_TYPES.HORSE:    return inChinese ? horseMoves(piece, board) : knightFreeMoves(piece, board);
    case PIECE_TYPES.ROOK_C:   return straightMoves(piece, board);
    case PIECE_TYPES.CANNON:   return cannonMoves(piece, board);           // same everywhere
    case PIECE_TYPES.SOLDIER:  return inChinese ? soldierMoves(piece, board) : soldierAsPawnMoves(piece, board);
    case PIECE_TYPES.KING:     return inChinese ? kingAsGeneralMoves(piece, board) : kingMoves(piece, board);
    case PIECE_TYPES.QUEEN:    return queenMoves(piece, board);            // slides everywhere
    case PIECE_TYPES.ROOK_I:   return straightMoves(piece, board);
    case PIECE_TYPES.BISHOP:   return inChinese ? bishopAsElephantMoves(piece, board) : bishopMoves(piece, board);
    case PIECE_TYPES.KNIGHT:   return inChinese ? horseMoves(piece, board) : knightFreeMoves(piece, board);
    case PIECE_TYPES.PAWN:     return inChinese ? pawnAsSoldierMoves(piece, board) : pawnMoves(piece, board);
    default: return [];
  }
}

// ─────────────────────────── shared helpers ───────────────────────────────────

function straightMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    for (let d = 1; d < Math.max(COLS, ROWS); d++) {
      const c = piece.col + dc * d, r = piece.row + dr * d;
      if (!inBounds(c, r)) break;
      const t = board.at(c, r);
      if (!t) { moves.push(mv(piece, c, r)); }
      else     { if (t.color !== piece.color) moves.push(mv(piece, c, r, t)); break; }
    }
  }
  return moves;
}

function cannonMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    // Movement (no capture until barrier)
    for (let d = 1; d < Math.max(COLS, ROWS); d++) {
      const c = piece.col + dc * d, r = piece.row + dr * d;
      if (!inBounds(c, r)) break;
      if (!board.at(c, r)) { moves.push(mv(piece, c, r)); } else { break; }
    }
    // Capture (need exactly one barrier)
    let barriers = 0;
    for (let d = 1; d < Math.max(COLS, ROWS); d++) {
      const c = piece.col + dc * d, r = piece.row + dr * d;
      if (!inBounds(c, r)) break;
      const t = board.at(c, r);
      if (t) {
        barriers++;
        if (barriers === 2) {
          if (t.color !== piece.color) moves.push(mv(piece, c, r, t));
          break;
        }
      }
    }
  }
  return moves;
}

// ─────────────────────────── Black (Chinese) pieces ──────────────────────────

// 将 — always orthogonal 1-step; palace-confined in Chinese zone, free in Int'l zone
function generalMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const c = piece.col + dc, r = piece.row + dr;
    const shouldCheckPalace = (r <= CHINESE_ZONE_MAX);
    if (shouldCheckPalace && !inPalace(c, r, BLACK_PALACE)) continue;
    if (!inBounds(c, r)) continue;
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }
  return moves;
}

// 士 in Chinese zone — diagonal 1-step, palace-confined
function advisorMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const c = piece.col + dc, r = piece.row + dr;
    if (!inPalace(c, r, BLACK_PALACE)) continue;
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }
  return moves;
}

// 士 in Int'l zone — diagonal slide (Bishop)
function advisorAsBishopMoves(piece, board) {
  return bishopMoves(piece, board);
}

// 象 — always in Chinese zone only; 2-diagonal with leg block; cannot cross boundary
function elephantMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[2,2],[2,-2],[-2,2],[-2,-2]]) {
    const c = piece.col + dc, r = piece.row + dr;
    if (r > CHINESE_ZONE_MAX) continue;   // cannot cross into Int'l zone
    if (!inBounds(c, r)) continue;
    const legC = piece.col + dc / 2, legR = piece.row + dr / 2;
    if (board.at(legC, legR)) continue;   // leg blocked
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }
  return moves;
}

// 马 in Chinese zone — L-shape with leg blocking
function horseMoves(piece, board) {
  const moves = [];
  const lMoves = [
    { to:[2,1],  leg:[1,0]  }, { to:[2,-1], leg:[1,0]  },
    { to:[-2,1], leg:[-1,0] }, { to:[-2,-1],leg:[-1,0] },
    { to:[1,2],  leg:[0,1]  }, { to:[-1,2], leg:[0,1]  },
    { to:[1,-2], leg:[0,-1] }, { to:[-1,-2],leg:[0,-1] }
  ];
  for (const { to:[dc,dr], leg:[lc,lr] } of lMoves) {
    const legC = piece.col + lc, legR = piece.row + lr;
    if (!inBounds(legC, legR) || board.at(legC, legR)) continue;
    const c = piece.col + dc, r = piece.row + dr;
    if (!inBounds(c, r)) continue;
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }
  return moves;
}

// 兵 in Chinese zone — forward only (for black: row increases)
function soldierMoves(piece, board) {
  const moves = [];
  const dir = piece.color === COLOR.RED ? -1 : 1;
  const fr  = piece.row + dir;
  if (inBounds(piece.col, fr)) {
    const t = board.at(piece.col, fr);
    if (!t || t.color !== piece.color) moves.push(mv(piece, piece.col, fr, t));
  }
  return moves;
}

// 兵 in Int'l zone — pawn-style: forward + diagonal capture + double-step; can promote
function soldierAsPawnMoves(piece, board) {
  const moves = [];
  const dir  = piece.color === COLOR.RED ? -1 : 1;
  const promRow = piece.color === COLOR.RED ? 0 : ROWS - 1;

  // Forward 1
  const fr = piece.row + dir;
  if (inBounds(piece.col, fr)) {
    const t = board.at(piece.col, fr);
    if (!t || t.color !== piece.color) {
      const prom = fr === promRow ? PIECE_TYPES.QUEEN : null;
      const move = mv(piece, piece.col, fr, t, prom);
      if (prom) move.needsChoice = true;
      moves.push(move);
    }
    // Double step on first move
    if (!piece.hasMoved && !t) {
      const dr2 = piece.row + dir * 2;
      if (inBounds(piece.col, dr2) && !board.at(piece.col, dr2)) {
        moves.push(mv(piece, piece.col, dr2));
      }
    }
  }

  // Diagonal captures
  for (const dc of [-1, 1]) {
    const c = piece.col + dc, r = piece.row + dir;
    if (!inBounds(c, r)) continue;
    const t = board.at(c, r);
    if (t && t.color !== piece.color) {
      const prom = r === promRow ? PIECE_TYPES.QUEEN : null;
      const move = mv(piece, c, r, t, prom);
      if (prom) move.needsChoice = true;
      moves.push(move);
    }
  }

  return moves;
}

// ────────────────────────── Red (International) pieces ───────────────────────

// ♔ in Int'l zone — 1-step 8 directions + castling
function kingMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const c = piece.col + dc, r = piece.row + dr;
    if (!inBounds(c, r)) continue;
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }

  // Castling (only in international zone, king on its home row)
  if (!piece.hasMoved) {
    const rookTypes = ['rook_i', 'rook'];
    // Kingside (col 7)
    const kr = board.at(7, piece.row);
    if (kr && kr.color === piece.color && rookTypes.includes(kr.type) && !kr.hasMoved &&
        !board.at(5, piece.row) && !board.at(6, piece.row)) {
      moves.push({ from: { col: piece.col, row: piece.row }, to: { col: 7, row: piece.row },
                   capture: null, promotion: null,
                   castling: { kingTo: { col: 6, row: piece.row }, rFrom: { col: 7, row: piece.row }, rTo: { col: 5, row: piece.row } } });
    }
    // Queenside (col 0)
    const qr = board.at(0, piece.row);
    if (qr && qr.color === piece.color && rookTypes.includes(qr.type) && !qr.hasMoved &&
        !board.at(1, piece.row) && !board.at(2, piece.row) && !board.at(3, piece.row)) {
      moves.push({ from: { col: piece.col, row: piece.row }, to: { col: 0, row: piece.row },
                   capture: null, promotion: null,
                   castling: { kingTo: { col: 2, row: piece.row }, rFrom: { col: 0, row: piece.row }, rTo: { col: 3, row: piece.row } } });
    }
  }

  return moves;
}

// ♔ in Chinese zone — orthogonal 1-step only (General-like, no palace confinement)
function kingAsGeneralMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const c = piece.col + dc, r = piece.row + dr;
    if (!inBounds(c, r)) continue;
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }
  return moves;
}

// ♕ — 8-direction slide, same everywhere
function queenMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    for (let d = 1; d < Math.max(COLS, ROWS); d++) {
      const c = piece.col + dc * d, r = piece.row + dr * d;
      if (!inBounds(c, r)) break;
      const t = board.at(c, r);
      if (!t) { moves.push(mv(piece, c, r)); }
      else     { if (t.color !== piece.color) moves.push(mv(piece, c, r, t)); break; }
    }
  }
  return moves;
}

// ♗ in Int'l zone — diagonal slide
function bishopMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
    for (let d = 1; d < Math.max(COLS, ROWS); d++) {
      const c = piece.col + dc * d, r = piece.row + dr * d;
      if (!inBounds(c, r)) break;
      const t = board.at(c, r);
      if (!t) { moves.push(mv(piece, c, r)); }
      else     { if (t.color !== piece.color) moves.push(mv(piece, c, r, t)); break; }
    }
  }
  return moves;
}

// ♗ in Chinese zone — Elephant-style (2-diagonal, leg-blocked); CAN cross back to Int'l zone
function bishopAsElephantMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[2,2],[2,-2],[-2,2],[-2,-2]]) {
    const c = piece.col + dc, r = piece.row + dr;
    if (!inBounds(c, r)) continue;
    const legC = piece.col + dc / 2, legR = piece.row + dr / 2;
    if (board.at(legC, legR)) continue;
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }
  return moves;
}

// ♘ in Int'l zone — free L-shape (no leg blocking)
function knightFreeMoves(piece, board) {
  const moves = [];
  for (const [dc, dr] of [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]) {
    const c = piece.col + dc, r = piece.row + dr;
    if (!inBounds(c, r)) continue;
    const t = board.at(c, r);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, r, t));
  }
  return moves;
}

// ♙ in Int'l zone — standard pawn (forward + double-step + diagonal capture + promotion)
function pawnMoves(piece, board) {
  const moves = [];
  const dir    = piece.color === COLOR.RED ? -1 : 1;
  const promRow = piece.color === COLOR.RED ? 0 : ROWS - 1;

  const fr = piece.row + dir;
  if (inBounds(piece.col, fr)) {
    const t = board.at(piece.col, fr);
    if (!t) {
      const prom = fr === promRow ? PIECE_TYPES.QUEEN : null;
      const move = mv(piece, piece.col, fr, null, prom);
      if (prom) move.needsChoice = true;
      moves.push(move);
      // Double step on first move
      if (!piece.hasMoved) {
        const dr2 = piece.row + dir * 2;
        if (inBounds(piece.col, dr2) && !board.at(piece.col, dr2)) {
          moves.push(mv(piece, piece.col, dr2));
        }
      }
    }
    // Diagonal captures
    for (const dc of [-1, 1]) {
      const c = piece.col + dc;
      if (!inBounds(c, fr)) continue;
      const t2 = board.at(c, fr);
      if (t2 && t2.color !== piece.color) {
        const prom = fr === promRow ? PIECE_TYPES.QUEEN : null;
        const move = mv(piece, c, fr, t2, prom);
        if (prom) move.needsChoice = true;
        moves.push(move);
      }
    }
  }

  return moves;
}

// ♙ in Chinese zone — soldier-style: forward + lateral (already "crossed")
function pawnAsSoldierMoves(piece, board) {
  const moves = [];
  const dir = piece.color === COLOR.RED ? -1 : 1;

  // Forward
  const fr = piece.row + dir;
  if (inBounds(piece.col, fr)) {
    const t = board.at(piece.col, fr);
    if (!t || t.color !== piece.color) {
      const prom = fr === 0 && piece.color === COLOR.RED ? PIECE_TYPES.QUEEN : null;
      const move = mv(piece, piece.col, fr, t, prom);
      if (prom) move.needsChoice = true;
      moves.push(move);
    }
  }

  // Lateral (like soldier after crossing river)
  for (const dc of [-1, 1]) {
    const c = piece.col + dc;
    if (!inBounds(c, piece.row)) continue;
    const t = board.at(c, piece.row);
    if (!t || t.color !== piece.color) moves.push(mv(piece, c, piece.row, t));
  }

  return moves;
}
