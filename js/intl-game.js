import { COLS, ROWS, COLOR, PIECE_TYPES } from './intl-constants.js';
import { getCandidateMoves } from './intl-pieces.js';

export class BoardState {
  constructor() {
    this.cells  = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    this.pieces = [];
  }

  at(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return this.cells[row][col];
  }

  clone() {
    const c = new BoardState();
    this.pieces.forEach(p => c.addPiece({ ...p }));
    return c;
  }

  addPiece(p) {
    this.pieces.push(p);
    this.cells[p.row][p.col] = p;
  }

  removePiece(col, row) {
    const p = this.at(col, row);
    if (p) { this.pieces = this.pieces.filter(x => x !== p); this.cells[row][col] = null; }
    return p;
  }

  movePiece(fc, fr, tc, tr) {
    const p = this.removePiece(fc, fr);
    if (p) { p.col = tc; p.row = tr; p.hasMoved = true; this.addPiece(p); }
    return p;
  }

  findPiece(type, color) { return this.pieces.find(p => p.type === type && p.color === color); }
  findAll(color)          { return this.pieces.filter(p => p.color === color); }
}

export class GameState {
  constructor(customPieces = null) {
    this.board       = new BoardState();
    this.currentTurn = COLOR.RED;
    this.selected    = null;
    this.validMoves  = [];
    this.history     = [];
    this.status      = 'ongoing';
    this.winner      = null;
    this.checkCell   = null;

    if (customPieces) customPieces.forEach(p => this.board.addPiece({ ...p, hasMoved: false }));
    else this._init();
  }

  _init() {
    // Red side (bottom) – Chinese chess setup
    const backRed = [
      PIECE_TYPES.ROOK_C, PIECE_TYPES.HORSE, PIECE_TYPES.ELEPHANT,
      PIECE_TYPES.ADVISOR, PIECE_TYPES.GENERAL, PIECE_TYPES.ADVISOR,
      PIECE_TYPES.ELEPHANT, PIECE_TYPES.HORSE  // col 7 = rook_c but only 8 cols
    ];
    backRed.forEach((type, col) => {
      this.board.addPiece({ type, color: COLOR.RED, col, row: 7, hasMoved: false });
    });
    // Cannons at row 5
    this.board.addPiece({ type: PIECE_TYPES.CANNON, color: COLOR.RED, col: 1, row: 5, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.CANNON, color: COLOR.RED, col: 6, row: 5, hasMoved: false });
    // Soldiers at row 4 (every other col – 4 soldiers on 8×8)
    [0, 2, 4, 6].forEach(col => {
      this.board.addPiece({ type: PIECE_TYPES.SOLDIER, color: COLOR.RED, col, row: 4, hasMoved: false });
    });

    // Black side (top) – International chess setup
    const backBlack = [
      PIECE_TYPES.ROOK, PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP,
      PIECE_TYPES.QUEEN, PIECE_TYPES.KING, PIECE_TYPES.BISHOP,
      PIECE_TYPES.KNIGHT, PIECE_TYPES.ROOK
    ];
    backBlack.forEach((type, col) => {
      this.board.addPiece({ type, color: COLOR.BLACK, col, row: 0, hasMoved: false });
      this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col, row: 1, hasMoved: false });
    });
  }

  // ── legality ────────────────────────────────────────────────────────────────

  getValidMoves(piece, board = this.board) {
    return getCandidateMoves(piece, board).filter(move => {
      const b = board.clone();
      if (b.at(move.to.col, move.to.row)) b.removePiece(move.to.col, move.to.row);
      b.movePiece(move.from.col, move.from.row, move.to.col, move.to.row);
      if (move.promotion) { const pp = b.at(move.to.col, move.to.row); if (pp) pp.type = move.promotion; }
      return !this.isFacingRulers(b) && !this.isInCheck(piece.color, b);
    });
  }

  // "将帅照面": any two rulers on opposite sides in same column with nothing between
  isFacingRulers(board = this.board) {
    const RULER_TYPES = [PIECE_TYPES.GENERAL, PIECE_TYPES.KING];
    const redRuler   = board.pieces.find(p => p.color === COLOR.RED   && RULER_TYPES.includes(p.type));
    const blackRuler = board.pieces.find(p => p.color === COLOR.BLACK && RULER_TYPES.includes(p.type));
    if (!redRuler || !blackRuler) return false;
    if (redRuler.col !== blackRuler.col) return false;
    const minRow = Math.min(redRuler.row, blackRuler.row);
    const maxRow = Math.max(redRuler.row, blackRuler.row);
    for (let r = minRow + 1; r < maxRow; r++) {
      if (!board.at(redRuler.col, r)) continue;
      return false; // piece in between → NOT facing
    }
    return true; // no pieces between → facing (illegal)
  }

  isInCheck(color, board = this.board) {
    const RULER_TYPES = [PIECE_TYPES.GENERAL, PIECE_TYPES.KING];
    const ruler = board.pieces.find(p => p.color === color && RULER_TYPES.includes(p.type));
    if (!ruler) return false;
    const enemy = color === COLOR.RED ? COLOR.BLACK : COLOR.RED;
    return board.findAll(enemy).some(e =>
      getCandidateMoves(e, board).some(m => m.to.col === ruler.col && m.to.row === ruler.row)
    );
  }

  _noMoves(color, board = this.board) {
    return board.findAll(color).every(p => this.getValidMoves(p, board).length === 0);
  }

  // ── interaction ──────────────────────────────────────────────────────────────
  selectPiece(col, row) {
    const piece = this.board.at(col, row);
    if (piece && piece.color === this.currentTurn) {
      this.selected   = piece;
      this.validMoves = this.getValidMoves(piece);
    } else if (this.selected) {
      const move = this.validMoves.find(m => m.to.col === col && m.to.row === row);
      if (move) {
        this._execute(move);
      } else if (piece && piece.color === this.currentTurn) {
        this.selected   = piece;
        this.validMoves = this.getValidMoves(piece);
      } else {
        this.selected = null; this.validMoves = [];
      }
    }
  }

  _execute(move) {
    if (this.board.at(move.to.col, move.to.row)) this.board.removePiece(move.to.col, move.to.row);
    const piece = this.board.movePiece(move.from.col, move.from.row, move.to.col, move.to.row);
    if (move.promotion && piece) piece.type = move.promotion;
    this.history.push(move);
    this.currentTurn = this.currentTurn === COLOR.RED ? COLOR.BLACK : COLOR.RED;
    this._updateStatus();
    this.selected = null; this.validMoves = [];
  }

  _updateStatus() {
    this.status = 'ongoing'; this.checkCell = null;
    const inCheck = this.isInCheck(this.currentTurn);
    const noMoves = this._noMoves(this.currentTurn);
    const RULER_TYPES = [PIECE_TYPES.GENERAL, PIECE_TYPES.KING];
    if (inCheck && noMoves) {
      this.status    = 'checkmate';
      this.winner    = this.currentTurn === COLOR.RED ? COLOR.BLACK : COLOR.RED;
      this.checkCell = this.board.pieces.find(p => p.color === this.currentTurn && RULER_TYPES.includes(p.type));
    } else if (!inCheck && noMoves) {
      this.status = 'stalemate';
    } else if (inCheck) {
      this.status    = 'check';
      this.checkCell = this.board.pieces.find(p => p.color === this.currentTurn && RULER_TYPES.includes(p.type));
    }
  }

  reset(customPieces = null) {
    this.board = new BoardState(); this.currentTurn = COLOR.RED;
    this.selected = null; this.validMoves = []; this.history = [];
    this.status = 'ongoing'; this.winner = null; this.checkCell = null;
    if (customPieces) customPieces.forEach(p => this.board.addPiece({ ...p, hasMoved: false }));
    else this._init();
  }
}
