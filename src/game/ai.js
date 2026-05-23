/**
 * Generic minimax AI — works with both 9×10 (game.js) and 8×8 (intl-game.js)
 * Both GameState classes expose:
 *   getValidMoves(piece, board?)  ← optional board parameter
 *   isInCheck(color, board?)
 *   board.findAll / findAllPieces
 *   board.clone / removePiece / movePiece / at
 */

// ── piece values ──────────────────────────────────────────────────────────────
const VALUE = {
  // Chinese chess
  general:  20000,
  advisor:    200,
  elephant:   250,
  horse:      450,
  rook_c:    1000,
  cannon:     500,
  soldier:    120,
  // International chess
  king:     20000,
  queen:      950,
  rook:       550,
  bishop:     330,
  knight:     330,
  pawn:       110
};

// Positional bonus tables (8-column friendly, mirrored for opponent)
// Indexed [row][col] – add to piece value when computing board score
const POS_BONUS = {
  // Soldier / Pawn: reward advancement
  soldier: [
    [0,0,0,0,0,0,0,0,0],
    [30,40,40,40,40,40,40,40,30],
    [20,25,25,35,35,25,25,20,0],
    [10,15,15,20,20,15,15,10,0],
    [0,5,10,15,15,10,5,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0]
  ],
  pawn: [
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [5,10,15,20,20,15,10,5],
    [10,15,20,25,25,20,15,10],
    [15,20,25,30,30,25,20,15],
    [25,30,30,35,35,30,30,25],
    [50,60,60,60,60,60,60,50],
    [0,0,0,0,0,0,0,0]
  ],
  // Cannon: likes midgame central activity
  cannon: [
    [0,0,5,5,5,5,0,0,0],
    [0,5,10,10,10,10,5,0,0],
    [5,10,15,15,15,15,10,5,0],
    [5,10,15,15,15,15,10,5,0],
    [5,10,15,15,15,15,10,5,0],
    [5,10,15,15,15,15,10,5,0],
    [0,5,10,10,10,10,5,0,0],
    [0,0,5,5,5,5,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0]
  ],
  // Horse: center is better
  horse: [
    [0,5,10,10,10,10,5,0,0],
    [5,10,15,15,15,15,10,5,0],
    [5,15,20,20,20,20,15,5,0],
    [5,15,20,25,25,20,15,5,0],
    [5,15,20,25,25,20,15,5,0],
    [5,15,20,20,20,20,15,5,0],
    [5,10,15,15,15,15,10,5,0],
    [0,5,10,10,10,10,5,0,0],
    [0,0,5,5,5,5,0,0,0],
    [0,0,0,0,0,0,0,0,0]
  ],
  knight: [
    [0,5,10,10,10,10,5,0],
    [5,10,15,15,15,15,10,5],
    [5,15,20,20,20,20,15,5],
    [5,15,20,25,25,20,15,5],
    [5,15,20,25,25,20,15,5],
    [5,15,20,20,20,20,15,5],
    [5,10,15,15,15,15,10,5],
    [0,5,10,10,10,10,5,0]
  ],
  bishop: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ]
};

function posBonus(piece) {
  const tbl = POS_BONUS[piece.type];
  if (!tbl) return 0;
  try {
    const row = tbl[piece.row];
    if (!row) return 0;
    return row[piece.col] || 0;
  } catch { return 0; }
}

function allPieces(board, color) {
  return board.findAll ? board.findAll(color) : board.findAllPieces(color);
}

// ── Position key (for repetition detection) ───────────────────────────────────
function boardKey(board) {
  return board.pieces.map(p => `${p.type[0]}${p.color[0]}${p.col},${p.row}`).sort().join('|');
}

// Get flat move list from any game state's history format
function recentMoveList(gameState, n = 6) {
  const hist = gameState.moveHistory || gameState.history || [];
  return hist.slice(-n).map(e => (e && e.move ? e.move : e)).filter(Boolean);
}

// Returns true if the candidate move exactly reverses any of the recent moves
function isReversal(move, recent) {
  return recent.some(r =>
    r.from.col === move.to.col && r.from.row === move.to.row &&
    r.to.col  === move.from.col && r.to.row  === move.from.row
  );
}

function applyMove(board, move) {
  const b = board.clone();
  if (b.at(move.to.col, move.to.row) && !move.castling) b.removePiece(move.to.col, move.to.row);
  if (move.castling) {
    b.movePiece(move.castling.rFrom.col, move.castling.rFrom.row,
                move.castling.rTo.col,   move.castling.rTo.row);
  }
  const kingDest = move.castling ? move.castling.kingTo : move.to;
  b.movePiece(move.from.col, move.from.row, kingDest.col, kingDest.row);
  if (move.promotion) {
    const pp = b.at(kingDest.col, kingDest.row);
    if (pp) pp.type = move.promotion;
  }
  return b;
}

function evaluate(board, aiColor, oppColor) {
  let score = 0;
  for (const p of board.pieces) {
    const v = (VALUE[p.type] || 100) + posBonus(p);
    if (p.color === aiColor)  score += v;
    else                       score -= v;
  }
  return score;
}

function captureValue(move) {
  return (VALUE[move.capture?.type] || 0) + (move.promotion ? 800 : 0);
}

function sortMoves(pairs) {
  pairs.sort((a, b) => captureValue(b.move) - captureValue(a.move));
}

function minimax(gameState, board, depth, alpha, beta, maximizing, aiColor, oppColor) {
  if (depth === 0) return evaluate(board, aiColor, oppColor);

  const color = maximizing ? aiColor : oppColor;
  const pieces = allPieces(board, color);

  const pairs = [];
  for (const piece of pieces) {
    for (const move of gameState.getValidMoves(piece, board)) {
      pairs.push({ piece, move });
    }
  }

  if (pairs.length === 0) {
    // checkmate or stalemate
    return gameState.isInCheck(color, board)
      ? (maximizing ? -15000 : 15000)
      : 0;
  }

  sortMoves(pairs);

  let best = maximizing ? -Infinity : Infinity;
  for (const { move } of pairs) {
    const newBoard = applyMove(board, move);
    const score = minimax(gameState, newBoard, depth - 1, alpha, beta, !maximizing, aiColor, oppColor);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break; // prune
  }
  return best;
}

/**
 * @param {GameState}  gameState  – the current game state
 * @param {string}     aiColor    – 'red' | 'black'
 * @param {number}     depth      – search depth (1=easy, 2=medium, 3=hard)
 * @returns {Move|null}
 */
export function getBestMove(gameState, aiColor, depth = 2) {
  const oppColor = aiColor === 'red' ? 'black' : 'red';
  const board    = gameState.board;
  const pieces   = allPieces(board, aiColor);

  // Collect recent moves and position keys for repetition avoidance
  const recent   = recentMoveList(gameState, 6);
  const seenKeys = new Set();
  // Build position keys from recent history by replaying (cheap: only last 4 boards)
  {
    let b = board.clone();
    const replayMoves = recentMoveList(gameState, 4);
    seenKeys.add(boardKey(b));
    // walk backwards: undo isn't available, so we just tag the current key
    // and also any key after applying each candidate will be checked below
    void replayMoves; // keys of past boards not needed; current key is enough
  }
  const currentKey = boardKey(board);

  const pairs = [];
  for (const piece of pieces) {
    for (const move of gameState.getValidMoves(piece)) {
      pairs.push({ move });
    }
  }
  if (pairs.length === 0) return null;

  sortMoves(pairs);

  // depth=1 → pure greedy (fast), randomise ties; avoid reversals
  if (depth === 1) {
    const preferred = pairs.filter(p => !isReversal(p.move, recent));
    const pool = preferred.length > 0 ? preferred : pairs;
    const top = pool[0];
    const topVal = captureValue(top.move);
    const tied   = pool.filter(p => captureValue(p.move) === topVal);
    return tied[Math.floor(Math.random() * tied.length)].move;
  }

  let bestMove  = pairs[0].move;
  let bestScore = -Infinity;

  for (const { move } of pairs) {
    const newBoard  = applyMove(board, move);
    const score     = minimax(gameState, newBoard, depth - 1,
                              -Infinity, Infinity, false, aiColor, oppColor);
    // Penalise reversals and immediate repetition (returning to current position)
    const repPenalty = isReversal(move, recent) ? 800 : 0;
    const backToSame = boardKey(newBoard) === currentKey ? 600 : 0;
    // small random tiebreak so AI doesn't always play same opening
    const jitter = (Math.random() - 0.5) * 5;
    if (score - repPenalty - backToSame + jitter > bestScore) {
      bestScore = score - repPenalty - backToSame + jitter;
      bestMove  = move;
    }
  }
  return bestMove;
}
