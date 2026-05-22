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

function applyMove(board, move) {
  const b = board.clone();
  if (b.at(move.to.col, move.to.row)) b.removePiece(move.to.col, move.to.row);
  if (move.castling) {
    b.movePiece(move.castling.rFrom.col, move.castling.rFrom.row,
                move.castling.rTo.col,   move.castling.rTo.row);
  }
  b.movePiece(move.from.col, move.from.row, move.to.col, move.to.row);
  if (move.promotion) {
    const pp = b.at(move.to.col, move.to.row);
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

  const pairs = [];
  for (const piece of pieces) {
    for (const move of gameState.getValidMoves(piece)) {
      pairs.push({ move });
    }
  }
  if (pairs.length === 0) return null;

  sortMoves(pairs);

  // depth=1 → pure greedy (fast), randomise ties
  if (depth === 1) {
    const top = pairs[0];
    const topVal = captureValue(top.move);
    const tied   = pairs.filter(p => captureValue(p.move) === topVal);
    // among captures / quiets, shuffle equally-valued moves
    return tied[Math.floor(Math.random() * tied.length)].move;
  }

  let bestMove  = pairs[0].move;
  let bestScore = -Infinity;

  for (const { move } of pairs) {
    const newBoard = applyMove(board, move);
    const score    = minimax(gameState, newBoard, depth - 1,
                             -Infinity, Infinity, false, aiColor, oppColor);
    // small random tiebreak so AI doesn't always play same opening
    const jitter = (Math.random() - 0.5) * 5;
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      bestMove  = move;
    }
  }
  return bestMove;
}
