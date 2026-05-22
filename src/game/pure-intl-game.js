// Pure international chess (both sides use standard chess pieces)
// Based on intl-game.js, overrides _init and disables facing-rulers rule

import { GameState as BaseGameState } from './intl-game.js';
import { PIECE_TYPES, COLOR } from './intl-constants.js';
export { BoardState } from './intl-game.js';

export class GameState extends BaseGameState {
  _init() {
    const PT = PIECE_TYPES;
    const backRank = [PT.ROOK, PT.KNIGHT, PT.BISHOP, PT.QUEEN,
                      PT.KING, PT.BISHOP, PT.KNIGHT, PT.ROOK];

    // Black (top) — standard setup
    backRank.forEach((type, col) => {
      this.board.addPiece({ type,           color: COLOR.BLACK, col, row: 0, hasMoved: false });
      this.board.addPiece({ type: PT.PAWN,  color: COLOR.BLACK, col, row: 1, hasMoved: false });
    });

    // Red (bottom) — standard setup (red = white in standard chess)
    backRank.forEach((type, col) => {
      this.board.addPiece({ type,           color: COLOR.RED,   col, row: 7, hasMoved: false });
      this.board.addPiece({ type: PT.PAWN,  color: COLOR.RED,   col, row: 6, hasMoved: false });
    });
  }

  // Standard chess has no "facing rulers" rule
  isFacingRulers() { return false; }
}
