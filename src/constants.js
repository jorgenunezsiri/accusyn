const CONNECTION_COLOR = "sandybrown"; // Default connection color
const GAP_AMOUNT = 0.04; // Circos plot gap - Value in radians
const GENOME_INNER_RADIUS = 300; // Circos plot inner radius
const GENOME_OUTER_RADIUS = GENOME_INNER_RADIUS + 50; // Circos plot outer radius
const RADIANS_TO_DEGREES = (180.0 / Math.PI); // Convert radians to degrees
const DEGREES_TO_RADIANS = (Math.PI / 180.0); // Concert degrees to radians
const WIDTH = 800; // Circos plot width
const HEIGHT = 800; // Circos plot height

// Genome view
const CIRCOS_CONF = {
  innerRadius: GENOME_INNER_RADIUS,
  outerRadius: GENOME_OUTER_RADIUS,
  cornerRadius: 1,
  gap: GAP_AMOUNT,
  labels: {
    display: true,
    position: 'center',
    size: '16px',
    color: '#000000',
    radialOffset: 20
  },
  ticks: {
    display: false
  },
  events: {}
};

// Genome view transitions
const DEFAULT_GENOME_TRANSITION_TIME = 250;
const FLIPPING_CHROMOSOME_TIME = 400;
const TRANSITION_DRAG_TIME = 125;
const TRANSITION_SWAPPING_TIME = 250;

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
  DEFAULT_GENOME_TRANSITION_TIME,
  RADIANS_TO_DEGREES,
  DEGREES_TO_RADIANS,
  WIDTH,
  HEIGHT,
  // Genome view
  CIRCOS_CONF,
  GAP_AMOUNT,
  GENOME_INNER_RADIUS,
  // Genome view transitions
  FLIPPING_CHROMOSOME_TIME,
  TRANSITION_DRAG_TIME,
  TRANSITION_SWAPPING_TIME,
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
