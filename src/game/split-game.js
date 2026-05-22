import { COLS, ROWS, COLOR, PIECE_TYPES, BLACK_PALACE } from './split-constants.js';
import { getCandidateMoves } from './split-pieces.js';

export class BoardState {
  constructor() {
    this.cells  = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    this.pieces = [];
  }

  at(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return this.cells[row][col];
  }

  isEmpty(col, row) { return this.at(col, row) === null; }

  clone() {
    const b = new BoardState();
    this.pieces.forEach(p => b.addPiece({ ...p }));
    return b;
  }

  addPiece(piece) {
    this.pieces.push(piece);
    this.cells[piece.row][piece.col] = piece;
  }

  removePiece(col, row) {
    const piece = this.at(col, row);
    if (piece) {
      this.pieces = this.pieces.filter(p => p !== piece);
      this.cells[row][col] = null;
    }
    return piece;
  }

  movePiece(fromCol, fromRow, toCol, toRow) {
    const piece = this.removePiece(fromCol, fromRow);
    if (piece) {
      piece.col = toCol; piece.row = toRow; piece.hasMoved = true;
      this.addPiece(piece);
    }
    return piece;
  }

  findPiece(type, color) {
    return this.pieces.find(p => p.type === type && p.color === color);
  }

  // ai.js calls board.findAll() or board.findAllPieces()
  findAllPieces(color) { return this.pieces.filter(p => p.color === color); }
  findAll(color)       { return this.findAllPieces(color); }
}

export class GameState {
  constructor(customPieces = null) {
    this.board        = new BoardState();
    this.currentTurn  = COLOR.RED;
    this.selectedPiece = null;
    this.validMoves   = [];
    this.moveHistory  = [];
    this.status       = 'ongoing';
    this.winner       = null;
    this.checkCell    = null;

    if (customPieces) {
      customPieces.forEach(p => this.board.addPiece({ ...p, hasMoved: p.hasMoved ?? false }));
    } else {
      this._init();
    }
  }

  _init() {
    // Black (Chinese pieces) — top, rows 0–4
    const B = COLOR.BLACK;
    const add = (type, color, col, row) =>
      this.board.addPiece({ type, color, col, row, hasMoved: false });

    // Row 0: back rank
    add(PIECE_TYPES.ROOK_C,    B, 0, 0);
    add(PIECE_TYPES.HORSE,     B, 1, 0);
    add(PIECE_TYPES.ELEPHANT,  B, 2, 0);
    add(PIECE_TYPES.ADVISOR,   B, 3, 0);
    add(PIECE_TYPES.GENERAL,   B, 4, 0);
    add(PIECE_TYPES.ADVISOR,   B, 5, 0);
    add(PIECE_TYPES.ELEPHANT,  B, 6, 0);
    add(PIECE_TYPES.HORSE,     B, 7, 0);
    add(PIECE_TYPES.ROOK_C,    B, 8, 0);
    // Row 2: cannons
    add(PIECE_TYPES.CANNON,    B, 1, 2);
    add(PIECE_TYPES.CANNON,    B, 7, 2);
    // Row 3: soldiers
    add(PIECE_TYPES.SOLDIER,   B, 0, 3);
    add(PIECE_TYPES.SOLDIER,   B, 2, 3);
    add(PIECE_TYPES.SOLDIER,   B, 4, 3);
    add(PIECE_TYPES.SOLDIER,   B, 6, 3);
    add(PIECE_TYPES.SOLDIER,   B, 8, 3);

    // Red (International pieces) — bottom, rows 5–9
    const R = COLOR.RED;
    // Row 9: back rank (8 pieces, col 8 empty)
    add(PIECE_TYPES.ROOK_I,    R, 0, 9);
    add(PIECE_TYPES.KNIGHT,    R, 1, 9);
    add(PIECE_TYPES.BISHOP,    R, 2, 9);
    add(PIECE_TYPES.QUEEN,     R, 3, 9);
    add(PIECE_TYPES.KING,      R, 4, 9);
    add(PIECE_TYPES.BISHOP,    R, 5, 9);
    add(PIECE_TYPES.KNIGHT,    R, 6, 9);
    add(PIECE_TYPES.ROOK_I,    R, 7, 9);
    // Row 8: 9 pawns
    for (let c = 0; c < COLS; c++) add(PIECE_TYPES.PAWN, R, c, 8);
  }

  getValidMoves(piece, board = null) {
    if (!board) board = this.board;
    const candidates = getCandidateMoves(piece, board);
    const valid = [];

    for (const move of candidates) {
      const testBoard = board.clone();
      const target = testBoard.at(move.to.col, move.to.row);
      if (target) testBoard.removePiece(move.to.col, move.to.row);
      testBoard.movePiece(move.from.col, move.from.row, move.to.col, move.to.row);
      if (move.promotion) {
        const pp = testBoard.at(move.to.col, move.to.row);
        if (pp) pp.type = move.promotion;
      }
      if (!this.isFacingRulers(testBoard) && !this.isInCheck(piece.color, testBoard)) {
        valid.push(move);
      }
    }
    return valid;
  }

  isInCheck(color, board) {
    // Red king = type 'king'; Black king = type 'general'
    const kingType = color === COLOR.RED ? PIECE_TYPES.KING : PIECE_TYPES.GENERAL;
    const king = board.findPiece(kingType, color);
    if (!king) return false;

    const enemyColor = color === COLOR.RED ? COLOR.BLACK : COLOR.RED;
    for (const enemy of board.findAllPieces(enemyColor)) {
      for (const move of getCandidateMoves(enemy, board)) {
        if (move.to.col === king.col && move.to.row === king.row) return true;
      }
    }
    return false;
  }

  // 将帅照面 rule: Red King and Black General in same column with no pieces between
  isFacingRulers(board) {
    const redKing  = board.findPiece(PIECE_TYPES.KING,    COLOR.RED);
    const blackGen = board.findPiece(PIECE_TYPES.GENERAL, COLOR.BLACK);
    if (!redKing || !blackGen) return false;
    if (redKing.col !== blackGen.col) return false;

    const minRow = Math.min(redKing.row, blackGen.row);
    const maxRow = Math.max(redKing.row, blackGen.row);
    for (let r = minRow + 1; r < maxRow; r++) {
      if (!board.isEmpty(redKing.col, r)) return false;
    }
    return true;
  }

  isCheckmate(color, board) {
    if (!this.isInCheck(color, board)) return false;
    for (const piece of board.findAllPieces(color)) {
      if (this.getValidMoves(piece, board).length > 0) return false;
    }
    return true;
  }

  selectPiece(col, row) {
    const piece = this.board.at(col, row);

    if (piece && piece.color === this.currentTurn) {
      this.selectedPiece = piece;
      this.validMoves = this.getValidMoves(piece);
    } else if (this.selectedPiece) {
      const move = this.validMoves.find(m => m.to.col === col && m.to.row === row);
      if (move) {
        this.executeMove(move);
      } else if (piece && piece.color === this.currentTurn) {
        this.selectedPiece = piece;
        this.validMoves = this.getValidMoves(piece);
      } else {
        this.selectedPiece = null;
        this.validMoves = [];
      }
    } else {
      this.selectedPiece = null;
      this.validMoves = [];
    }
  }

  executeMove(move) {
    const captured = this.board.at(move.to.col, move.to.row);
    if (captured) this.board.removePiece(move.to.col, move.to.row);

    const piece = this.board.movePiece(move.from.col, move.from.row, move.to.col, move.to.row);
    if (move.promotion && piece) piece.type = move.promotion;

    this.moveHistory.push({ move, captured });

    // Undo if facing-rulers rule violated
    if (this.isFacingRulers(this.board)) {
      if (piece) this.board.movePiece(move.to.col, move.to.row, move.from.col, move.from.row);
      if (captured) this.board.addPiece(captured);
      this.moveHistory.pop();
      this.selectedPiece = null;
      this.validMoves = [];
      return false;
    }

    this.currentTurn = this.currentTurn === COLOR.RED ? COLOR.BLACK : COLOR.RED;
    this._updateStatus();
    this.selectedPiece = null;
    this.validMoves = [];
    return true;
  }

  _updateStatus() {
    this.status    = 'ongoing';
    this.checkCell = null;

    if (this.isInCheck(this.currentTurn, this.board)) {
      const kingType = this.currentTurn === COLOR.RED ? PIECE_TYPES.KING : PIECE_TYPES.GENERAL;
      this.checkCell = this.board.findPiece(kingType, this.currentTurn);

      if (this.isCheckmate(this.currentTurn, this.board)) {
        this.status = 'checkmate';
        this.winner = this.currentTurn === COLOR.RED ? COLOR.BLACK : COLOR.RED;
      } else {
        this.status = 'check';
      }
    }
  }

  reset(customPieces = null) {
    this.board        = new BoardState();
    this.currentTurn  = COLOR.RED;
    this.selectedPiece = null;
    this.validMoves   = [];
    this.moveHistory  = [];
    this.status       = 'ongoing';
    this.winner       = null;
    this.checkCell    = null;
    if (customPieces) {
      customPieces.forEach(p => this.board.addPiece({ ...p, hasMoved: p.hasMoved ?? false }));
    } else {
      this._init();
    }
  }
}
