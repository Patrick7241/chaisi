// Pure Chinese chess (both sides use Chinese pieces)
// Based on game.js, overrides init / isInCheck / isFacingGenerals / getValidMoves

import { COLS, ROWS, COLOR, PIECE_TYPES, RIVER_TOP_ROW, RIVER_BOT_ROW } from './constants.js';
import { getCandidateMoves } from './pieces.js';
export { BoardState } from './game.js';
import { GameState as BaseGameState } from './game.js';

export class GameState extends BaseGameState {
  initializeBoard() {
    // ── Red pieces (bottom) — same as hybrid ──────────────────────────────
    const PT = PIECE_TYPES;
    const R  = COLOR.RED;
    const B  = COLOR.BLACK;
    const p  = (type, color, col, row) =>
      this.board.addPiece({ type, color, col, row, hasMoved: false });

    [PT.ROOK_C, PT.HORSE, PT.ELEPHANT, PT.ADVISOR, PT.GENERAL,
     PT.ADVISOR, PT.ELEPHANT, PT.HORSE, PT.ROOK_C].forEach((t, c) => p(t, R, c, 9));
    p(PT.CANNON, R, 1, 7); p(PT.CANNON, R, 7, 7);
    [0, 2, 4, 6, 8].forEach(c => p(PT.SOLDIER, R, c, 6));

    // ── Black pieces (top) — mirrored Chinese setup ────────────────────────
    [PT.ROOK_C, PT.HORSE, PT.ELEPHANT, PT.ADVISOR, PT.GENERAL,
     PT.ADVISOR, PT.ELEPHANT, PT.HORSE, PT.ROOK_C].forEach((t, c) => p(t, B, c, 0));
    p(PT.CANNON, B, 1, 2); p(PT.CANNON, B, 7, 2);
    [0, 2, 4, 6, 8].forEach(c => p(PT.SOLDIER, B, c, 3));
  }

  // Both sides use GENERAL as king piece
  isInCheck(color, board) {
    if (!board) board = this.board;
    const king = board.findPiece(PIECE_TYPES.GENERAL, color);
    if (!king) return false;
    const enemy = color === COLOR.RED ? COLOR.BLACK : COLOR.RED;
    const enemyPieces = board.findAllPieces ? board.findAllPieces(enemy) : board.pieces.filter(p => p.color === enemy);
    for (const ep of enemyPieces) {
      const moves = getCandidateMoves(ep, board);
      for (const mv of moves) {
        if (mv.to.col === king.col && mv.to.row === king.row) return true;
      }
    }
    return false;
  }

  // Both generals face each other → illegal
  isFacingGenerals(board) {
    const red   = board.findPiece(PIECE_TYPES.GENERAL, COLOR.RED);
    const black = board.findPiece(PIECE_TYPES.GENERAL, COLOR.BLACK);
    if (!red || !black) return false;
    if (red.col !== black.col) return false;
    const minRow = Math.min(red.row, black.row);
    const maxRow = Math.max(red.row, black.row);
    for (let row = minRow + 1; row < maxRow; row++) {
      if (!board.isEmpty(red.col, row)) return false;
    }
    return true;
  }

  getValidMoves(piece, board = null) {
    const valid = super.getValidMoves(piece, board);
    // Elephant cannot cross the river
    if (piece.type === PIECE_TYPES.ELEPHANT) {
      return valid.filter(mv => {
        if (piece.color === COLOR.RED)   return mv.to.row > RIVER_TOP_ROW;
        return mv.to.row < RIVER_BOT_ROW;
      });
    }
    return valid;
  }
}
