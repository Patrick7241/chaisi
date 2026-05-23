import { COLS, ROWS, COLOR, PIECE_TYPES, RED_PALACE, BLACK_PALACE, RIVER_TOP_ROW, RIVER_BOT_ROW } from './constants.js';
import { getCandidateMoves } from './pieces.js';

export class BoardState {
  constructor() {
    // 2D array: cells[row][col]
    this.cells = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    this.pieces = []; // Flat list of all pieces for easier iteration
  }

  at(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return this.cells[row][col];
  }

  isEmpty(col, row) {
    return this.at(col, row) === null;
  }

  clone() {
    const cloned = new BoardState();
    this.pieces.forEach(piece => {
      const copy = { ...piece };
      cloned.addPiece(copy);
    });
    return cloned;
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
      piece.col = toCol;
      piece.row = toRow;
      piece.hasMoved = true;
      this.addPiece(piece);
    }
    return piece;
  }

  findPiece(type, color) {
    return this.pieces.find(p => p.type === type && p.color === color);
  }

  findAllPieces(color) {
    return this.pieces.filter(p => p.color === color);
  }
}

export class GameState {
  constructor(customPieces = null) {
    this.board = new BoardState();
    this.currentTurn = COLOR.RED;
    this.selectedPiece = null;
    this.validMoves = [];
    this.moveHistory = [];
    this.positionCount = {};
    this.status = 'ongoing';
    this.winner = null;
    this.checkCell = null;
    this._startPieces = customPieces ? customPieces.map(p => ({ ...p })) : null;

    if (customPieces) {
      customPieces.forEach(p => this.board.addPiece({ ...p, hasMoved: false }));
    } else {
      this.initializeBoard();
    }
  }

  initializeBoard() {
    // Red pieces (Chinese chess) - bottom
    this.board.addPiece({ type: PIECE_TYPES.ROOK_C, color: COLOR.RED, col: 0, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.HORSE, color: COLOR.RED, col: 1, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.ELEPHANT, color: COLOR.RED, col: 2, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.ADVISOR, color: COLOR.RED, col: 3, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.GENERAL, color: COLOR.RED, col: 4, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.ADVISOR, color: COLOR.RED, col: 5, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.ELEPHANT, color: COLOR.RED, col: 6, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.HORSE, color: COLOR.RED, col: 7, row: 9, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.ROOK_C, color: COLOR.RED, col: 8, row: 9, hasMoved: false });

    this.board.addPiece({ type: PIECE_TYPES.CANNON, color: COLOR.RED, col: 1, row: 7, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.CANNON, color: COLOR.RED, col: 7, row: 7, hasMoved: false });

    this.board.addPiece({ type: PIECE_TYPES.SOLDIER, color: COLOR.RED, col: 0, row: 6, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.SOLDIER, color: COLOR.RED, col: 2, row: 6, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.SOLDIER, color: COLOR.RED, col: 4, row: 6, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.SOLDIER, color: COLOR.RED, col: 6, row: 6, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.SOLDIER, color: COLOR.RED, col: 8, row: 6, hasMoved: false });

    // Black pieces (International chess) - top
    this.board.addPiece({ type: PIECE_TYPES.ROOK_I, color: COLOR.BLACK, col: 0, row: 0, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.KNIGHT, color: COLOR.BLACK, col: 1, row: 0, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.BISHOP, color: COLOR.BLACK, col: 2, row: 0, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.QUEEN, color: COLOR.BLACK, col: 3, row: 0, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.KING, color: COLOR.BLACK, col: 4, row: 0, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.BISHOP, color: COLOR.BLACK, col: 5, row: 0, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.KNIGHT, color: COLOR.BLACK, col: 6, row: 0, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.ROOK_I, color: COLOR.BLACK, col: 7, row: 0, hasMoved: false });

    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 0, row: 1, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 1, row: 1, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 2, row: 1, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 3, row: 1, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 4, row: 1, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 5, row: 1, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 6, row: 1, hasMoved: false });
    this.board.addPiece({ type: PIECE_TYPES.PAWN, color: COLOR.BLACK, col: 7, row: 1, hasMoved: false });
  }

  getValidMoves(piece, board = null) {
    if (!board) board = this.board;

    const candidates = getCandidateMoves(piece, board);
    const valid = [];

    for (const move of candidates) {
      // Castling: king must not currently be in check, must not pass through attacked square
      if (move.castling) {
        if (this.isInCheck(piece.color, board)) continue;
        const midCol = (piece.col + move.castling.kingTo.col) / 2;
        const midBoard = board.clone();
        midBoard.movePiece(piece.col, piece.row, midCol, piece.row);
        if (this.isInCheck(piece.color, midBoard)) continue;
      }

      const testBoard = board.clone();
      const target = testBoard.at(move.to.col, move.to.row);
      if (target && !move.castling) testBoard.removePiece(move.to.col, move.to.row);
      // Move rook first if castling, so final board state is correct
      if (move.castling) {
        testBoard.movePiece(move.castling.rFrom.col, move.castling.rFrom.row,
                            move.castling.rTo.col,   move.castling.rTo.row);
      }
      const kingDest = move.castling ? move.castling.kingTo : move.to;
      testBoard.movePiece(move.from.col, move.from.row, kingDest.col, kingDest.row);
      if (move.promotion) {
        const movedPiece = testBoard.at(kingDest.col, kingDest.row);
        if (movedPiece) movedPiece.type = move.promotion;
      }

      if (!this.isFacingGenerals(testBoard) && !this.isInCheck(piece.color, testBoard)) {
        valid.push(move);
      }
    }

    return valid;
  }

  isInCheck(color, board) {
    // Find own king/general
    const kingType = color === COLOR.RED ? PIECE_TYPES.GENERAL : PIECE_TYPES.KING;
    const king = board.findPiece(kingType, color);
    if (!king) return false;

    // Check if any enemy piece can attack the king
    const enemyColor = color === COLOR.RED ? COLOR.BLACK : COLOR.RED;
    const enemyPieces = board.findAllPieces(enemyColor);

    for (const enemy of enemyPieces) {
      const moves = getCandidateMoves(enemy, board);
      for (const move of moves) {
        if (move.to.col === king.col && move.to.row === king.row) {
          return true;
        }
      }
    }

    return false;
  }

  isFacingGenerals(board) {
    const red = board.findPiece(PIECE_TYPES.GENERAL, COLOR.RED);
    const black = board.findPiece(PIECE_TYPES.KING, COLOR.BLACK);

    if (!red || !black) return false;

    // Must be in same column
    if (red.col !== black.col) return false;

    // Check if there are any pieces between them
    const minRow = Math.min(red.row, black.row);
    const maxRow = Math.max(red.row, black.row);

    for (let row = minRow + 1; row < maxRow; row++) {
      if (!board.isEmpty(red.col, row)) {
        return false; // There's a piece between them, so it's fine
      }
    }

    return true; // They face each other
  }

  isCheckmate(color, board) {
    // Must be in check
    if (!this.isInCheck(color, board)) return false;

    // Must have no valid moves
    const pieces = board.findAllPieces(color);
    for (const piece of pieces) {
      const validMoves = this.getValidMoves(piece, board);
      if (validMoves.length > 0) {
        return false; // Has at least one valid move
      }
    }

    return true;
  }

  selectPiece(col, row) {
    const piece = this.board.at(col, row);

    if (this.selectedPiece && piece !== this.selectedPiece) {
      // Try to move to this position (check validMoves first, handles castling onto rook)
      const move = this.validMoves.find(m => m.to.col === col && m.to.row === row);
      if (move) {
        this.executeMove(move);
        return;
      }
    }

    if (piece && piece.color === this.currentTurn) {
      // Select this piece
      this.selectedPiece = piece;
      this.validMoves = this.getValidMoves(piece);
    } else if (this.selectedPiece) {
      // Deselect
      this.selectedPiece = null;
      this.validMoves = [];
    } else {
      // Nothing selected, nothing to do
      this.selectedPiece = null;
      this.validMoves = [];
    }
  }

  executeMove(move) {
    // Apply move
    const capturedPiece = this.board.at(move.to.col, move.to.row);
    if (capturedPiece && !move.castling) {
      this.board.removePiece(move.to.col, move.to.row);
    }

    // Castling: move rook before the king so hasMoved flags are correct
    if (move.castling) {
      this.board.movePiece(move.castling.rFrom.col, move.castling.rFrom.row,
                           move.castling.rTo.col,   move.castling.rTo.row);
    }

    const kingDest = move.castling ? move.castling.kingTo : move.to;
    const piece = this.board.movePiece(move.from.col, move.from.row, kingDest.col, kingDest.row);

    // Handle promotion
    if (move.promotion && piece) {
      piece.type = move.promotion;
    }

    // Record move
    this.moveHistory.push({
      move,
      captured: capturedPiece
    });

    // Check for facing generals (now illegal)
    if (this.isFacingGenerals(this.board)) {
      // Undo the move
      if (piece) {
        this.board.movePiece(kingDest.col, kingDest.row, move.from.col, move.from.row);
      }
      if (capturedPiece) {
        this.board.addPiece(capturedPiece);
      }
      this.moveHistory.pop();
      this.selectedPiece = null;
      this.validMoves = [];
      return false; // Move failed
    }

    // Switch turn
    this.currentTurn = this.currentTurn === COLOR.RED ? COLOR.BLACK : COLOR.RED;

    // Track position for draw-by-repetition
    const key = this.board.pieces.map(p => `${p.type[0]}${p.color[0]}${p.col},${p.row}`).sort().join('|');
    this.positionCount[key] = (this.positionCount[key] || 0) + 1;
    if (this.positionCount[key] >= 3) {
      this.status = 'draw';
      this.selectedPiece = null;
      this.validMoves = [];
      return true;
    }

    // Update check/checkmate status
    this.updateGameStatus();

    // Clear selection
    this.selectedPiece = null;
    this.validMoves = [];

    return true;
  }

  updateGameStatus() {
    this.status = 'ongoing';
    this.checkCell = null;

    // Check if current turn is in check
    if (this.isInCheck(this.currentTurn, this.board)) {
      // Find the king/general
      const kingType = this.currentTurn === COLOR.RED ? PIECE_TYPES.GENERAL : PIECE_TYPES.KING;
      this.checkCell = this.board.findPiece(kingType, this.currentTurn);

      if (this.isCheckmate(this.currentTurn, this.board)) {
        this.status = 'checkmate';
        this.winner = this.currentTurn === COLOR.RED ? COLOR.BLACK : COLOR.RED;
      } else {
        this.status = 'check';
      }
    }
  }

  undoMove(n = 2) {
    if (this.moveHistory.length === 0) return false;
    const actualN   = Math.min(n, this.moveHistory.length);
    const remaining = this.moveHistory.slice(0, -actualN).map(e => e.move);
    this.reset(this._startPieces);
    remaining.forEach(m => this.executeMove(m));
    return true;
  }

  reset(customPieces = null) {
    this.board = new BoardState();
    this.currentTurn = COLOR.RED;
    this.selectedPiece = null;
    this.validMoves = [];
    this.moveHistory = [];
    this.positionCount = {};
    this.status = 'ongoing';
    this.winner = null;
    this.checkCell = null;
    if (customPieces) {
      customPieces.forEach(p => this.board.addPiece({ ...p, hasMoved: false }));
    } else {
      this.initializeBoard();
    }
  }

}
