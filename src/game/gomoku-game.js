export const BOARD_SIZE = 15;

export class GomokuState {
  constructor() {
    this.board       = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.currentTurn = 'black';
    this.status      = 'playing'; // 'playing' | 'win' | 'draw'
    this.winner      = null;
    this.moveHistory = [];
    this.lastMove    = null;
    this.winLine     = null;
  }

  executeMove(row, col) {
    if (this.status !== 'playing') return false;
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
    if (this.board[row][col] !== null) return false;

    const color = this.currentTurn;
    this.board[row][col] = color;
    this.lastMove = { row, col };
    this.moveHistory.push({ row, col, color });

    const line = this.checkWin(row, col, color);
    if (line) {
      this.status = 'win';
      this.winner = color;
      this.winLine = line;
      return true;
    }

    // Check draw (board full)
    let full = true;
    for (let r = 0; r < BOARD_SIZE && full; r++) {
      for (let c = 0; c < BOARD_SIZE && full; c++) {
        if (this.board[r][c] === null) full = false;
      }
    }
    if (full) {
      this.status = 'draw';
      return true;
    }

    this.currentTurn = color === 'black' ? 'white' : 'black';
    return true;
  }

  checkWin(row, col, color) {
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of DIRS) {
      const cells = [[row, col]];
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== color) break;
        cells.push([r, c]);
      }
      for (let i = 1; i < 5; i++) {
        const r = row - dr * i, c = col - dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== color) break;
        cells.push([r, c]);
      }
      if (cells.length >= 5) {
        return cells.map(([r, c]) => ({ row: r, col: c }));
      }
    }
    return null;
  }

  reset() {
    this.board       = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.currentTurn = 'black';
    this.status      = 'playing';
    this.winner      = null;
    this.moveHistory = [];
    this.lastMove    = null;
    this.winLine     = null;
  }

  clone() {
    const g = new GomokuState();
    g.board       = this.board.map(row => [...row]);
    g.currentTurn = this.currentTurn;
    g.status      = this.status;
    g.winner      = this.winner;
    g.moveHistory = [...this.moveHistory];
    g.lastMove    = this.lastMove ? { ...this.lastMove } : null;
    g.winLine     = this.winLine ? this.winLine.map(c => ({ ...c })) : null;
    return g;
  }
}
