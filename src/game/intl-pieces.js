// All piece move rules for the 8×8 hybrid board
import {
  COLS, ROWS, PIECE_TYPES, COLOR,
  RED_PALACE, BLACK_PALACE, RIVER_TOP_ROW, RIVER_BOT_ROW
} from './intl-constants.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function ok(col, row)  { return col >= 0 && col < COLS && row >= 0 && row < ROWS; }

function inPalace(col, row, p) {
  return col >= p.colMin && col <= p.colMax && row >= p.rowMin && row <= p.rowMax;
}

function mv(piece, col, row, target, promotion = null, needsChoice = undefined) {
  const m = { from: { col: piece.col, row: piece.row }, to: { col, row },
           capture: target || null, promotion };
  if (needsChoice) m.needsChoice = true;
  return m;
}

function palace(piece) {
  return piece.color === COLOR.RED ? RED_PALACE : BLACK_PALACE;
}

function slide(piece, board, dirs) {
  const moves = [];
  dirs.forEach(([dc, dr]) => {
    for (let d = 1; d < 9; d++) {
      const col = piece.col + dc * d, row = piece.row + dr * d;
      if (!ok(col, row)) break;
      const t = board.at(col, row);
      if (!t) { moves.push(mv(piece, col, row, null)); }
      else { if (t.color !== piece.color) moves.push(mv(piece, col, row, t)); break; }
    }
  });
  return moves;
}

// ── International pieces ──────────────────────────────────────────────────────

// King: free 1-step in all 8 directions (international rules, no palace)
function getKingMoves(piece, board) {
  const moves = [];
  [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dc, dr]) => {
    const col = piece.col + dc, row = piece.row + dr;
    if (!ok(col, row)) return;
    const t = board.at(col, row);
    if (!t || t.color !== piece.color) moves.push(mv(piece, col, row, t));
  });

  // Castling
  if (!piece.hasMoved) {
    const rookTypes = ['rook', 'rook_i'];
    // Kingside (col 7)
    const kr = board.at(7, piece.row);
    if (kr && kr.color === piece.color && rookTypes.includes(kr.type) && !kr.hasMoved &&
        !board.at(5, piece.row) && !board.at(6, piece.row)) {
      moves.push({ from: { col: piece.col, row: piece.row }, to: { col: 6, row: piece.row },
                   capture: null, promotion: null,
                   castling: { kingTo: { col: 6, row: piece.row }, rFrom: { col: 7, row: piece.row }, rTo: { col: 5, row: piece.row } } });
    }
    // Queenside (col 0)
    const qr = board.at(0, piece.row);
    if (qr && qr.color === piece.color && rookTypes.includes(qr.type) && !qr.hasMoved &&
        !board.at(1, piece.row) && !board.at(2, piece.row) && !board.at(3, piece.row)) {
      moves.push({ from: { col: piece.col, row: piece.row }, to: { col: 2, row: piece.row },
                   capture: null, promotion: null,
                   castling: { kingTo: { col: 2, row: piece.row }, rFrom: { col: 0, row: piece.row }, rTo: { col: 3, row: piece.row } } });
    }
  }

  return moves;
}

function getQueenMoves(piece, board) {
  return slide(piece, board, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
}

function getRookMoves(piece, board) {
  return slide(piece, board, [[1,0],[-1,0],[0,1],[0,-1]]);
}

function getBishopMoves(piece, board) {
  return slide(piece, board, [[1,1],[1,-1],[-1,1],[-1,-1]]);
}

function getKnightMoves(piece, board) {
  const moves = [];
  [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dc, dr]) => {
    const col = piece.col + dc, row = piece.row + dr;
    if (!ok(col, row)) return;
    const t = board.at(col, row);
    if (!t || t.color !== piece.color) moves.push(mv(piece, col, row, t));
  });
  return moves;
}

function getPawnMoves(piece, board) {
  const moves = [];
  const isRed   = piece.color === COLOR.RED;
  const dir      = isRed ? -1 : 1;
  const startRow = isRed ? 6 : 1;
  const promoRow = isRed ? 0 : 7;

  const oneRow = piece.row + dir;
  if (ok(piece.col, oneRow) && !board.at(piece.col, oneRow)) {
    const isPromo = oneRow === promoRow;
    moves.push(mv(piece, piece.col, oneRow, null, isPromo ? PIECE_TYPES.QUEEN : null, isPromo ? true : undefined));
    if (piece.row === startRow) {
      const twoRow = piece.row + dir * 2;
      if (ok(piece.col, twoRow) && !board.at(piece.col, twoRow))
        moves.push(mv(piece, piece.col, twoRow, null));
    }
  }
  [-1, 1].forEach(dc => {
    const col = piece.col + dc, row = piece.row + dir;
    if (!ok(col, row)) return;
    const t = board.at(col, row);
    if (t && t.color !== piece.color) {
      const isPromo = row === promoRow;
      moves.push(mv(piece, col, row, t, isPromo ? PIECE_TYPES.QUEEN : null, isPromo ? true : undefined));
    }
  });
  return moves;
}

// ── Chinese pieces ────────────────────────────────────────────────────────────

function getGeneralMoves(piece, board) {
  const pal = palace(piece);
  const moves = [];
  [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dc, dr]) => {
    const col = piece.col + dc, row = piece.row + dr;
    if (!inPalace(col, row, pal)) return;
    const t = board.at(col, row);
    if (!t || t.color !== piece.color) moves.push(mv(piece, col, row, t));
  });
  return moves;
}

function getAdvisorMoves(piece, board) {
  const pal = palace(piece);
  const moves = [];
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dc, dr]) => {
    const col = piece.col + dc, row = piece.row + dr;
    if (!inPalace(col, row, pal)) return;
    const t = board.at(col, row);
    if (!t || t.color !== piece.color) moves.push(mv(piece, col, row, t));
  });
  return moves;
}

function getElephantMoves(piece, board) {
  const moves = [];
  [[2,2],[2,-2],[-2,2],[-2,-2]].forEach(([dc, dr]) => {
    const col = piece.col + dc, row = piece.row + dr;
    if (!ok(col, row)) return;
    if (board.at(piece.col + dc / 2, piece.row + dr / 2)) return; // leg blocked
    const t = board.at(col, row);
    if (!t || t.color !== piece.color) moves.push(mv(piece, col, row, t));
  });
  return moves;
}

function getHorseMoves(piece, board) {
  const moves = [];
  [
    { to: [2,  1], leg: [1,  0] }, { to: [2, -1], leg: [1,  0] },
    { to: [-2, 1], leg: [-1, 0] }, { to: [-2,-1], leg: [-1, 0] },
    { to: [1,  2], leg: [0,  1] }, { to: [-1, 2], leg: [0,  1] },
    { to: [1, -2], leg: [0, -1] }, { to: [-1,-2], leg: [0, -1] }
  ].forEach(({ to: [dc, dr], leg: [lc, lr] }) => {
    const legCol = piece.col + lc, legRow = piece.row + lr;
    if (!ok(legCol, legRow) || board.at(legCol, legRow)) return;
    const col = piece.col + dc, row = piece.row + dr;
    if (!ok(col, row)) return;
    const t = board.at(col, row);
    if (!t || t.color !== piece.color) moves.push(mv(piece, col, row, t));
  });
  return moves;
}

function getRookCMoves(piece, board) {
  return slide(piece, board, [[1,0],[-1,0],[0,1],[0,-1]]);
}

function getCannonMoves(piece, board) {
  const moves = [];
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dc, dr]) => {
    // Movement (no capture)
    for (let d = 1; d < 9; d++) {
      const col = piece.col + dc * d, row = piece.row + dr * d;
      if (!ok(col, row)) break;
      if (board.at(col, row)) break;
      moves.push(mv(piece, col, row, null));
    }
    // Capture (exactly 1 barrier between)
    let barriers = 0;
    for (let d = 1; d < 9; d++) {
      const col = piece.col + dc * d, row = piece.row + dr * d;
      if (!ok(col, row)) break;
      const t = board.at(col, row);
      if (t) {
        barriers++;
        if (barriers === 2) {
          if (t.color !== piece.color) moves.push(mv(piece, col, row, t));
          break;
        }
      }
    }
  });
  return moves;
}

function getSoldierMoves(piece, board) {
  const moves = [];
  const isRed = piece.color === COLOR.RED;
  const dir   = isRed ? -1 : 1;
  const crossed = isRed ? piece.row <= RIVER_TOP_ROW : piece.row >= RIVER_BOT_ROW;

  const fRow = piece.row + dir;
  if (ok(piece.col, fRow)) {
    const t = board.at(piece.col, fRow);
    if (!t || t.color !== piece.color) moves.push(mv(piece, piece.col, fRow, t));
  }
  if (crossed) {
    [-1, 1].forEach(dc => {
      const col = piece.col + dc;
      if (!ok(col, piece.row)) return;
      const t = board.at(col, piece.row);
      if (!t || t.color !== piece.color) moves.push(mv(piece, col, piece.row, t));
    });
  }
  return moves;
}

// ── dispatch ──────────────────────────────────────────────────────────────────
export function getCandidateMoves(piece, board) {
  switch (piece.type) {
    case PIECE_TYPES.KING:     return getKingMoves(piece, board);
    case PIECE_TYPES.QUEEN:    return getQueenMoves(piece, board);
    case PIECE_TYPES.ROOK:     return getRookMoves(piece, board);
    case PIECE_TYPES.BISHOP:   return getBishopMoves(piece, board);
    case PIECE_TYPES.KNIGHT:   return getKnightMoves(piece, board);
    case PIECE_TYPES.PAWN:     return getPawnMoves(piece, board);
    case PIECE_TYPES.GENERAL:  return getGeneralMoves(piece, board);
    case PIECE_TYPES.ADVISOR:  return getAdvisorMoves(piece, board);
    case PIECE_TYPES.ELEPHANT: return getElephantMoves(piece, board);
    case PIECE_TYPES.HORSE:    return getHorseMoves(piece, board);
    case PIECE_TYPES.ROOK_C:   return getRookCMoves(piece, board);
    case PIECE_TYPES.CANNON:   return getCannonMoves(piece, board);
    case PIECE_TYPES.SOLDIER:  return getSoldierMoves(piece, board);
    default: return [];
  }
}
