import { BOARD_SIZE } from './gomoku-game.js';

const DIRS = [[0,1],[1,0],[1,1],[1,-1]];

// ── Candidate generation ──────────────────────────────────────────────────────

function getCandidates(board) {
  const RANGE = 2;
  const set = new Set();
  let hasAny = false;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) continue;
      hasAny = true;
      for (let dr = -RANGE; dr <= RANGE; dr++) {
        for (let dc = -RANGE; dc <= RANGE; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && !board[nr][nc]) {
            set.add(nr * BOARD_SIZE + nc);
          }
        }
      }
    }
  }

  if (!hasAny) return [{ row: 7, col: 7 }];
  return [...set].map(k => ({ row: Math.floor(k / BOARD_SIZE), col: k % BOARD_SIZE }));
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function countLine(board, row, col, dr, dc, color) {
  let count = 1, openEnds = 0;
  for (let i = 1; i < 5; i++) {
    const r = row + dr*i, c = col + dc*i;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
    if (board[r][c] === color) count++;
    else { if (board[r][c] === null) openEnds++; break; }
  }
  for (let i = 1; i < 5; i++) {
    const r = row - dr*i, c = col - dc*i;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
    if (board[r][c] === color) count++;
    else { if (board[r][c] === null) openEnds++; break; }
  }
  return { count, openEnds };
}

function scoreCell(board, row, col, color, opp) {
  let score = 0;
  for (const [dr, dc] of DIRS) {
    const { count: ac, openEnds: ao } = countLine(board, row, col, dr, dc, color);
    const { count: oc, openEnds: oo } = countLine(board, row, col, dr, dc, opp);
    score += cellScore(ac, ao) + cellScore(oc, oo) * 1.1;
  }
  return score;
}

function cellScore(count, openEnds) {
  if (count >= 5) return 100000;
  if (count === 4) return openEnds >= 1 ? 50000 : 5000;
  if (count === 3) return openEnds >= 2 ? 1000  : 100;
  if (count === 2) return openEnds >= 2 ? 50    : 10;
  return 1;
}

function evaluate(board, aiColor, oppColor) {
  let aiScore = 0, oppScore = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (const [dr, dc] of DIRS) {
        aiScore  += cellScore(...countLineTuple(board, r, c, dr, dc, aiColor));
        oppScore += cellScore(...countLineTuple(board, r, c, dr, dc, oppColor));
      }
    }
  }
  return aiScore - oppScore;
}

function countLineTuple(board, row, col, dr, dc, color) {
  const { count, openEnds } = countLine(board, row, col, dr, dc, color);
  return [count, openEnds];
}

// ── Minimax ───────────────────────────────────────────────────────────────────

function hasWon(board, row, col, color) {
  for (const [dr, dc] of DIRS) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const r = row+dr*i, c = col+dc*i;
      if (r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE||board[r][c]!==color) break;
      count++;
    }
    for (let i = 1; i < 5; i++) {
      const r = row-dr*i, c = col-dc*i;
      if (r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE||board[r][c]!==color) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

function minimax(board, depth, alpha, beta, maximizing, aiColor, oppColor) {
  if (depth === 0) return evaluate(board, aiColor, oppColor);

  const color = maximizing ? aiColor : oppColor;
  const candidates = getCandidates(board);
  candidates.sort((a, b) =>
    scoreCell(board, b.row, b.col, aiColor, oppColor) -
    scoreCell(board, a.row, a.col, aiColor, oppColor)
  );

  if (maximizing) {
    let best = -Infinity;
    for (const { row, col } of candidates) {
      board[row][col] = color;
      if (hasWon(board, row, col, color)) {
        board[row][col] = null;
        return 100000 + depth;
      }
      const v = minimax(board, depth - 1, alpha, beta, false, aiColor, oppColor);
      board[row][col] = null;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const { row, col } of candidates) {
      board[row][col] = color;
      if (hasWon(board, row, col, color)) {
        board[row][col] = null;
        return -(100000 + depth);
      }
      const v = minimax(board, depth - 1, alpha, beta, true, aiColor, oppColor);
      board[row][col] = null;
      if (v < best) best = v;
      if (v < beta) beta = v;
      if (alpha >= beta) break;
    }
    return best;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getBestGomokuMove(state, aiColor, depth) {
  const oppColor = aiColor === 'black' ? 'white' : 'black';
  const board = state.board.map(r => [...r]);
  const candidates = getCandidates(board);

  // Pure greedy for depth=1
  if (depth <= 1) {
    let best = -Infinity, bestMove = candidates[0];
    const JITTER = 3;
    for (const { row, col } of candidates) {
      const s = scoreCell(board, row, col, aiColor, oppColor) + (Math.random() * JITTER * 2 - JITTER);
      if (s > best) { best = s; bestMove = { row, col }; }
    }
    return bestMove;
  }

  candidates.sort((a, b) =>
    scoreCell(board, b.row, b.col, aiColor, oppColor) -
    scoreCell(board, a.row, a.col, aiColor, oppColor)
  );

  const JITTER = 3;
  let bestScore = -Infinity, bestMove = candidates[0];
  for (const { row, col } of candidates) {
    board[row][col] = aiColor;
    if (hasWon(board, row, col, aiColor)) {
      board[row][col] = null;
      return { row, col };
    }
    const score = minimax(board, depth - 1, -Infinity, Infinity, false, aiColor, oppColor)
                  + (Math.random() * JITTER * 2 - JITTER);
    board[row][col] = null;
    if (score > bestScore) { bestScore = score; bestMove = { row, col }; }
  }
  return bestMove;
}
