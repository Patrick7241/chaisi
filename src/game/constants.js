// Board dimensions
export const COLS = 9;
export const ROWS = 10;
export const RIVER_TOP_ROW = 4;
export const RIVER_BOT_ROW = 5;

// Piece types
export const PIECE_TYPES = {
  // Chinese chess
  GENERAL: 'general',
  ADVISOR: 'advisor',
  ELEPHANT: 'elephant',
  HORSE: 'horse',
  ROOK_C: 'rook_c',
  CANNON: 'cannon',
  SOLDIER: 'soldier',
  // International chess
  KING: 'king',
  QUEEN: 'queen',
  ROOK_I: 'rook_i',
  BISHOP: 'bishop',
  KNIGHT: 'knight',
  PAWN: 'pawn'
};

// Colors
export const COLOR = {
  RED: 'red',
  BLACK: 'black'
};

// Palace boundaries (for general/advisor/king movement restrictions)
export const RED_PALACE = {
  colMin: 3,
  colMax: 5,
  rowMin: 7,
  rowMax: 9
};

export const BLACK_PALACE = {
  colMin: 3,
  colMax: 5,
  rowMin: 0,
  rowMax: 2
};

// Canvas constants
export const CELL_SIZE = 52;
export const PIECE_RADIUS = 20;
export const BOARD_PADDING = 36;
export const CANVAS_WIDTH = CELL_SIZE * (COLS - 1) + BOARD_PADDING * 2;
export const CANVAS_HEIGHT = CELL_SIZE * (ROWS - 1) + BOARD_PADDING * 2;

// Colors
export const BOARD_COLOR = '#c8a060';
export const LINE_COLOR = '#7a4e1e';
export const RED_PIECE_BG = '#c0392b';
export const BLACK_PIECE_BG = '#1c1c1c';
export const HIGHLIGHT_COLOR = 'rgba(120, 190, 75, 0.55)';
export const LAST_MOVE_COLOR = 'rgba(210, 175, 50, 0.45)';
export const CHECK_COLOR = 'rgba(220, 50, 50, 0.55)';
export const TEXT_COLOR = '#f5e030';
export const COORD_COLOR = 'rgba(90, 50, 10, 0.55)';
