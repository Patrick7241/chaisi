// Split board: 9×10 grid
// rows 0–4 = Chinese chess zone (Black's home)
// rows 5–9 = International chess zone (Red's home)

export const COLS = 9;
export const ROWS = 10;

// Zone boundary
export const CHINESE_ZONE_MAX = 4;   // rows 0–4
export const INTL_ZONE_MIN    = 5;   // rows 5–9

// Black palace (top, Chinese zone)
export const BLACK_PALACE = { colMin: 3, colMax: 5, rowMin: 0, rowMax: 2 };

export const PIECE_TYPES = {
  GENERAL: 'general', ADVISOR: 'advisor', ELEPHANT: 'elephant',
  HORSE: 'horse', ROOK_C: 'rook_c', CANNON: 'cannon', SOLDIER: 'soldier',
  KING: 'king', QUEEN: 'queen', ROOK_I: 'rook_i',
  BISHOP: 'bishop', KNIGHT: 'knight', PAWN: 'pawn'
};

export const COLOR = { RED: 'red', BLACK: 'black' };

// Canvas constants (same grid as 9×10 hybrid board)
export const CELL_SIZE    = 52;
export const PIECE_RADIUS = 20;
export const BOARD_PADDING = 36;
export const CANVAS_WIDTH  = CELL_SIZE * (COLS - 1) + BOARD_PADDING * 2;
export const CANVAS_HEIGHT = CELL_SIZE * (ROWS - 1) + BOARD_PADDING * 2;

// Colors
export const LINE_COLOR        = '#7a4e1e';
export const CHINESE_BOARD_BG  = '#c8a060';
export const LIGHT_SQUARE      = '#f0d9b5';
export const DARK_SQUARE       = '#b58863';
export const HIGHLIGHT_COLOR   = 'rgba(120, 190, 75, 0.55)';
export const LAST_MOVE_COLOR   = 'rgba(210, 175, 50, 0.45)';
export const CHECK_COLOR       = 'rgba(220, 50, 50, 0.55)';
export const COORD_COLOR       = 'rgba(90, 50, 10, 0.55)';
