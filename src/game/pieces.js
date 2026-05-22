import { COLS, ROWS, RIVER_TOP_ROW, RIVER_BOT_ROW, RED_PALACE, BLACK_PALACE, COLOR, PIECE_TYPES } from './constants.js';

// Helper: Check if a position is within bounds
function isInBounds(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

// Helper: Check if a position is in palace
function isInPalace(col, row, palace) {
  return col >= palace.colMin && col <= palace.colMax &&
    row >= palace.rowMin && row <= palace.rowMax;
}

// Helper: Check if piece can cross river (only Chinese pieces cannot)
function canCrossRiver(piece) {
  // International chess pieces can always cross
  if (piece.color === COLOR.BLACK) return true;

  // Chinese chess: soldiers can cross, elephants cannot
  if (piece.type === PIECE_TYPES.SOLDIER) return true;
  if (piece.type === PIECE_TYPES.ELEPHANT) return false;

  return true; // Other Chinese pieces can cross
}

// Get all candidate moves (before legality check)
export function getCandidateMoves(piece, boardState) {
  switch (piece.type) {
    case PIECE_TYPES.GENERAL:
      return getGeneralMoves(piece, boardState);
    case PIECE_TYPES.ADVISOR:
      return getAdvisorMoves(piece, boardState);
    case PIECE_TYPES.ELEPHANT:
      return getElephantMoves(piece, boardState);
    case PIECE_TYPES.HORSE:
      return getHorseMoves(piece, boardState);
    case PIECE_TYPES.ROOK_C:
      return getRookCMoves(piece, boardState);
    case PIECE_TYPES.CANNON:
      return getCannonMoves(piece, boardState);
    case PIECE_TYPES.SOLDIER:
      return getSoldierMoves(piece, boardState);
    case PIECE_TYPES.KING:
      return getKingMoves(piece, boardState);
    case PIECE_TYPES.QUEEN:
      return getQueenMoves(piece, boardState);
    case PIECE_TYPES.ROOK_I:
      return getRookIMoves(piece, boardState);
    case PIECE_TYPES.BISHOP:
      return getBishopMoves(piece, boardState);
    case PIECE_TYPES.KNIGHT:
      return getKnightMoves(piece, boardState);
    case PIECE_TYPES.PAWN:
      return getPawnMoves(piece, boardState);
    default:
      return [];
  }
}

function getGeneralMoves(piece, boardState) {
  const moves = [];
  const palace = piece.color === COLOR.RED ? RED_PALACE : BLACK_PALACE;
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // up, down, right, left

  directions.forEach(([dc, dr]) => {
    const newCol = piece.col + dc;
    const newRow = piece.row + dr;

    if (isInPalace(newCol, newRow, palace)) {
      const target = boardState.at(newCol, newRow);
      if (!target || target.color !== piece.color) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: target || null,
          promotion: null
        });
      }
    }
  });

  return moves;
}

function getAdvisorMoves(piece, boardState) {
  const moves = [];
  const palace = piece.color === COLOR.RED ? RED_PALACE : BLACK_PALACE;
  const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]]; // diagonals

  directions.forEach(([dc, dr]) => {
    const newCol = piece.col + dc;
    const newRow = piece.row + dr;

    if (isInPalace(newCol, newRow, palace)) {
      const target = boardState.at(newCol, newRow);
      if (!target || target.color !== piece.color) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: target || null,
          promotion: null
        });
      }
    }
  });

  return moves;
}

function getElephantMoves(piece, boardState) {
  const moves = [];
  const directions = [[2, 2], [2, -2], [-2, 2], [-2, -2]];

  directions.forEach(([dc, dr]) => {
    const newCol = piece.col + dc;
    const newRow = piece.row + dr;

    // Check elephant leg (middle point must be empty)
    const legCol = piece.col + dc / 2;
    const legRow = piece.row + dr / 2;
    if (boardState.at(legCol, legRow)) return;

    if (isInBounds(newCol, newRow)) {
      const target = boardState.at(newCol, newRow);
      if (!target || target.color !== piece.color) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: target || null,
          promotion: null
        });
      }
    }
  });

  return moves;
}

function getHorseMoves(piece, boardState) {
  const moves = [];
  // Chinese chess horse: step 1 orthogonally (leg), then 1 diagonally perpendicular.
  // leg = first orthogonal step offset; to = total displacement to destination.
  // step right (+1,0)  → destinations (+2,+1) and (+2,-1)
  // step left  (-1,0)  → destinations (-2,+1) and (-2,-1)
  // step down  (0,+1)  → destinations (+1,+2) and (-1,+2)
  // step up    (0,-1)  → destinations (+1,-2) and (-1,-2)
  const lMoves = [
    { to: [2,  1], leg: [1,  0] },
    { to: [2, -1], leg: [1,  0] },
    { to: [-2,  1], leg: [-1, 0] },
    { to: [-2, -1], leg: [-1, 0] },
    { to: [1,  2], leg: [0,  1] },
    { to: [-1, 2], leg: [0,  1] },
    { to: [1, -2], leg: [0, -1] },
    { to: [-1,-2], leg: [0, -1] }
  ];

  lMoves.forEach(({ to: [dc, dr], leg: [lc, lr] }) => {
    const legCol = piece.col + lc;
    const legRow = piece.row + lr;
    const newCol = piece.col + dc;
    const newRow = piece.row + dr;

    // Check if leg is blocked
    if (!isInBounds(legCol, legRow)) return;
    const legPiece = boardState.at(legCol, legRow);
    if (legPiece) return;

    if (isInBounds(newCol, newRow)) {
      const target = boardState.at(newCol, newRow);
      if (!target || target.color !== piece.color) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: target || null,
          promotion: null
        });
      }
    }
  });

  return moves;
}

function getRookCMoves(piece, boardState) {
  return getStraightMoves(piece, boardState);
}

function getStraightMoves(piece, boardState) {
  const moves = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  directions.forEach(([dc, dr]) => {
    for (let dist = 1; dist < Math.max(COLS, ROWS); dist++) {
      const newCol = piece.col + dc * dist;
      const newRow = piece.row + dr * dist;

      if (!isInBounds(newCol, newRow)) break;

      const target = boardState.at(newCol, newRow);
      if (!target) {
        // Empty square
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: null,
          promotion: null
        });
      } else {
        // Occupied square
        if (target.color !== piece.color) {
          moves.push({
            from: { col: piece.col, row: piece.row },
            to: { col: newCol, row: newRow },
            capture: target,
            promotion: null
          });
        }
        break; // Can't move past
      }
    }
  });

  return moves;
}

function getCannonMoves(piece, boardState) {
  const moves = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  directions.forEach(([dc, dr]) => {
    // Movement without capture
    for (let dist = 1; dist < Math.max(COLS, ROWS); dist++) {
      const newCol = piece.col + dc * dist;
      const newRow = piece.row + dr * dist;

      if (!isInBounds(newCol, newRow)) break;

      const target = boardState.at(newCol, newRow);
      if (!target) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: null,
          promotion: null
        });
      } else {
        // Found barrier, now check for cannon capture
        break;
      }
    }

    // Capture with barrier (need exactly one piece in between)
    let barrierCount = 0;
    let barrierDist = 0;
    for (let dist = 1; dist < Math.max(COLS, ROWS); dist++) {
      const col = piece.col + dc * dist;
      const row = piece.row + dr * dist;

      if (!isInBounds(col, row)) break;

      const target = boardState.at(col, row);
      if (target) {
        barrierCount++;
        if (barrierCount === 1) {
          barrierDist = dist;
        } else if (barrierCount === 2) {
          // Found second piece, can capture it if it's enemy
          if (target.color !== piece.color) {
            moves.push({
              from: { col: piece.col, row: piece.row },
              to: { col, row },
              capture: target,
              promotion: null
            });
          }
          break;
        }
      }
    }
  });

  return moves;
}

function getSoldierMoves(piece, boardState) {
  const moves = [];
  const isRed = piece.color === COLOR.RED;
  const direction = isRed ? -1 : 1; // Red goes up (row -), Black goes down (row +)

  // Check if soldier has crossed river
  const hasCrossedRiver = isRed ? piece.row <= RIVER_TOP_ROW : piece.row >= RIVER_BOT_ROW;

  // Forward move
  const forwardRow = piece.row + direction;
  if (isInBounds(piece.col, forwardRow)) {
    const target = boardState.at(piece.col, forwardRow);
    if (!target || target.color !== piece.color) {
      moves.push({
        from: { col: piece.col, row: piece.row },
        to: { col: piece.col, row: forwardRow },
        capture: target || null,
        promotion: null
      });
    }
  }

  // Lateral moves (only after crossing river)
  if (hasCrossedRiver) {
    [[1, 0], [-1, 0]].forEach(([dc, dr]) => {
      const newCol = piece.col + dc;
      const newRow = piece.row + dr;

      if (isInBounds(newCol, newRow)) {
        const target = boardState.at(newCol, newRow);
        if (!target || target.color !== piece.color) {
          moves.push({
            from: { col: piece.col, row: piece.row },
            to: { col: newCol, row: newRow },
            capture: target || null,
            promotion: null
          });
        }
      }
    });
  }

  return moves;
}

function getKingMoves(piece, boardState) {
  const moves = [];
  // International king: free 1-step in all 8 directions (no palace confinement)
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  directions.forEach(([dc, dr]) => {
    const newCol = piece.col + dc;
    const newRow = piece.row + dr;
    if (!isInBounds(newCol, newRow)) return;
    const target = boardState.at(newCol, newRow);
    if (!target || target.color !== piece.color) {
      moves.push({
        from: { col: piece.col, row: piece.row },
        to:   { col: newCol, row: newRow },
        capture: target || null, promotion: null
      });
    }
  });

  // Castling — king must not have moved, rooks must be in original positions
  if (!piece.hasMoved) {
    const rookTypes = ['rook_i', 'rook'];
    // Kingside (col 7)
    const kr = boardState.at(7, piece.row);
    if (kr && kr.color === piece.color && rookTypes.includes(kr.type) && !kr.hasMoved &&
        !boardState.at(5, piece.row) && !boardState.at(6, piece.row)) {
      moves.push({
        from: { col: piece.col, row: piece.row },
        to:   { col: 6, row: piece.row },
        capture: null, promotion: null,
        castling: { rFrom: { col: 7, row: piece.row }, rTo: { col: 5, row: piece.row } }
      });
    }
    // Queenside (col 0)
    const qr = boardState.at(0, piece.row);
    if (qr && qr.color === piece.color && rookTypes.includes(qr.type) && !qr.hasMoved &&
        !boardState.at(1, piece.row) && !boardState.at(2, piece.row) && !boardState.at(3, piece.row)) {
      moves.push({
        from: { col: piece.col, row: piece.row },
        to:   { col: 2, row: piece.row },
        capture: null, promotion: null,
        castling: { rFrom: { col: 0, row: piece.row }, rTo: { col: 3, row: piece.row } }
      });
    }
  }

  return moves;
}

function getQueenMoves(piece, boardState) {
  const moves = [];
  // Queen can move in all 8 directions
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  directions.forEach(([dc, dr]) => {
    for (let dist = 1; dist < Math.max(COLS, ROWS); dist++) {
      const newCol = piece.col + dc * dist;
      const newRow = piece.row + dr * dist;

      if (!isInBounds(newCol, newRow)) break;

      const target = boardState.at(newCol, newRow);
      if (!target) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: null,
          promotion: null
        });
      } else {
        if (target.color !== piece.color) {
          moves.push({
            from: { col: piece.col, row: piece.row },
            to: { col: newCol, row: newRow },
            capture: target,
            promotion: null
          });
        }
        break;
      }
    }
  });

  return moves;
}

function getRookIMoves(piece, boardState) {
  return getStraightMoves(piece, boardState);
}

function getBishopMoves(piece, boardState) {
  const moves = [];
  const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  directions.forEach(([dc, dr]) => {
    for (let dist = 1; dist < Math.max(COLS, ROWS); dist++) {
      const newCol = piece.col + dc * dist;
      const newRow = piece.row + dr * dist;

      if (!isInBounds(newCol, newRow)) break;

      const target = boardState.at(newCol, newRow);
      if (!target) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: null,
          promotion: null
        });
      } else {
        if (target.color !== piece.color) {
          moves.push({
            from: { col: piece.col, row: piece.row },
            to: { col: newCol, row: newRow },
            capture: target,
            promotion: null
          });
        }
        break;
      }
    }
  });

  return moves;
}

function getKnightMoves(piece, boardState) {
  const moves = [];
  // Knight moves in L-shape without leg blocking (international chess)
  const lMoves = [
    [1, 2], [1, -2], [-1, 2], [-1, -2],
    [2, 1], [2, -1], [-2, 1], [-2, -1]
  ];

  lMoves.forEach(([dc, dr]) => {
    const newCol = piece.col + dc;
    const newRow = piece.row + dr;

    if (isInBounds(newCol, newRow)) {
      const target = boardState.at(newCol, newRow);
      if (!target || target.color !== piece.color) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to: { col: newCol, row: newRow },
          capture: target || null,
          promotion: null
        });
      }
    }
  });

  return moves;
}

function getPawnMoves(piece, boardState) {
  const moves = [];
  const isBlack = piece.color === COLOR.BLACK;
  const direction = isBlack ? 1 : -1;
  const promotionRow = isBlack ? ROWS - 1 : 0;

  // Single step forward — ONLY if square is empty (pawns cannot capture forward)
  const oneStep = piece.row + direction;
  if (isInBounds(piece.col, oneStep) && !boardState.at(piece.col, oneStep)) {
    const moveObj = {
      from: { col: piece.col, row: piece.row },
      to:   { col: piece.col, row: oneStep },
      capture: null,
      promotion: oneStep === promotionRow ? PIECE_TYPES.QUEEN : null
    };
    moves.push(moveObj);

    // Two steps forward on first move (only if both squares are empty)
    if (!piece.hasMoved) {
      const twoSteps = piece.row + direction * 2;
      if (isInBounds(piece.col, twoSteps) && !boardState.at(piece.col, twoSteps)) {
        moves.push({
          from: { col: piece.col, row: piece.row },
          to:   { col: piece.col, row: twoSteps },
          capture: null, promotion: null
        });
      }
    }
  }

  // Diagonal captures
  [[1, 0], [-1, 0]].forEach(([dc]) => {
    const newCol = piece.col + dc;
    const newRow = piece.row + direction;
    if (!isInBounds(newCol, newRow)) return;
    const target = boardState.at(newCol, newRow);
    if (target && target.color !== piece.color) {
      moves.push({
        from: { col: piece.col, row: piece.row },
        to:   { col: newCol, row: newRow },
        capture: target,
        promotion: newRow === promotionRow ? PIECE_TYPES.QUEEN : null
      });
    }
  });

  return moves;
}
