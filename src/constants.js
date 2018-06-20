const CONNECTION_COLOR = "sandybrown"; // Default connection color
const GAP_AMOUNT = 0.04; // Circos plot gap - Value in radians
const RADIANS_TO_DEGREES = (180.0 / Math.PI);
const DEGREES_TO_RADIANS = (Math.PI / 180.0);
const WIDTH = 800; // Circos plot width
const HEIGHT = 800; // Circos plot height

// Genome view transitions
const FLIPPING_CHROMOSOME_TIME = 400;
const TRANSITION_DRAG_TIME = 150;

// Block view
const OFFSET_DOMAIN = 50000; // Offset to be used for the scales domain
const REMOVE_BLOCK_VIEW_TRANSITION_TIME = 250;
// Flipping block view constants
const COLOR_CHANGE_TIME = 75;
const MAX_INDEX_TRANSITION = 13;
const TRANSITION_NORMAL_TIME = 50;
const TRANSITION_FLIPPING_TIME = TRANSITION_NORMAL_TIME * 2;
const TRANSITION_HEIGHT_DIVISION_MULTIPLE = 2;

export {
  CONNECTION_COLOR,
  GAP_AMOUNT,
  RADIANS_TO_DEGREES,
  DEGREES_TO_RADIANS,
  WIDTH,
  HEIGHT,
  // Genome view transitions
  FLIPPING_CHROMOSOME_TIME,
  TRANSITION_DRAG_TIME,
  // Block view
  OFFSET_DOMAIN,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME,
  // Block view transition constants
  COLOR_CHANGE_TIME,
  MAX_INDEX_TRANSITION,
  TRANSITION_NORMAL_TIME,
  TRANSITION_FLIPPING_TIME,
  TRANSITION_HEIGHT_DIVISION_MULTIPLE
};
