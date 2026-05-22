// ── 8×8 hybrid board constants ────────────────────────────────────────────────

export const COLS = 8;
export const ROWS = 8;

// International piece types
export const INTL_TYPES = {
  KING: 'king', QUEEN: 'queen', ROOK: 'rook',
  BISHOP: 'bishop', KNIGHT: 'knight', PAWN: 'pawn'
};

// Chinese piece types
export const CHINESE_TYPES = {
  GENERAL: 'general', ADVISOR: 'advisor', ELEPHANT: 'elephant',
  HORSE: 'horse', ROOK_C: 'rook_c', CANNON: 'cannon', SOLDIER: 'soldier'
};

export const PIECE_TYPES = { ...INTL_TYPES, ...CHINESE_TYPES };

// Colors (sides)
export const COLOR = { RED: 'red', BLACK: 'black' };

// Palace on 8×8 board
export const RED_PALACE   = { colMin: 3, colMax: 5, rowMin: 5, rowMax: 7 };
export const BLACK_PALACE = { colMin: 3, colMax: 5, rowMin: 0, rowMax: 2 };

// River on 8×8 board (between rows 3 and 4)
export const RIVER_TOP_ROW = 3;
export const RIVER_BOT_ROW = 4;

// Canvas
export const CELL_SIZE     = 55;
export const BOARD_PADDING = 32;
export const PIECE_RADIUS  = 20;
export const CANVAS_SIZE   = CELL_SIZE * COLS + BOARD_PADDING * 2;

// Board square colours
export const LIGHT_SQUARE = '#f0d9b5';
export const DARK_SQUARE  = '#b58863';

// Piece colours
export const RED_PIECE_BG   = '#be1e1e';
export const BLACK_PIECE_BG = '#1c1c1c';

// Highlight colours
export const HIGHLIGHT_COLOR = 'rgba(120, 190, 75,  0.60)';
export const CAPTURE_COLOR   = 'rgba(120, 190, 75,  0.60)';
export const LAST_MOVE_COLOR = 'rgba(210, 175, 50,  0.45)';
export const CHECK_COLOR     = 'rgba(220, 50,  50,  0.55)';
export const SELECT_COLOR    = 'rgba(120, 190, 75,  0.45)';
