import {
  schemeAccent,
  schemeDark2,
  schemePastel2,
  schemeSet2
} from 'd3-scale-chromatic';

const CONNECTION_COLOR = "sandybrown"; // Default connection color
const GAP_AMOUNT = 0.04; // Circos plot gap - Value in radians
const GENOME_INNER_RADIUS = 375; // Circos plot inner radius
const GENOME_OUTER_RADIUS = GENOME_INNER_RADIUS + 50; // Circos plot outer radius
const RADIANS_TO_DEGREES = (180.0 / Math.PI); // Convert radians to degrees
const DEGREES_TO_RADIANS = (Math.PI / 180.0); // Concert degrees to radians
const WIDTH = 1100; // Circos plot width
const HEIGHT = 1100; // Circos plot height

// Genome view
const CIRCOS_CONF = {
  innerRadius: GENOME_INNER_RADIUS,
  outerRadius: GENOME_OUTER_RADIUS,
  cornerRadius: 2,
  gap: GAP_AMOUNT,
  labels: {
    display: true,
    position: 'center',
    size: '16', // 'px' is added in Circos library
    color: '#000000',
    radialOffset: 20
  },
  ticks: {
    display: false
  },
  events: {}
};

// Genome view additional tracks
// NOTE: Histogram is always on top of heatmap
// 4 positioning options:
//  -> heatmap outside, histogram inside
//  -> histogram outside, heatmap inside
//  -> heatmap outside, histogram outside
//  -> heatmap inside, histogram inside

// Using 12% separation between inner and outer radius in tracks
// and 3% separation from genome inner radius

// Track inside top
const TRACK_INNER_RADIUS_INSIDE_TOP = 0.85;
const TRACK_OUTER_RADIUS_INSIDE_TOP = 0.97;
// Track inside bottom
const TRACK_INNER_RADIUS_INSIDE_BOTTOM = 0.70;
const TRACK_OUTER_RADIUS_INSIDE_BOTTOM = 0.82;

// Track outside top
const TRACK_INNER_RADIUS_OUTSIDE_TOP = 1.18;
const TRACK_OUTER_RADIUS_OUTSIDE_TOP = 1.30;
// Track outside bottom
const TRACK_INNER_RADIUS_OUTSIDE_BOTTOM = 1.03;
const TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM = 1.15;

// Transform changes when adding tracks
const SCALE_DECREASE = 6; // 6% scaling decrese
const TRANSLATE_INSCREASE = 40; // 40px increase in both x and y coordinates

// Categorical color scales - palettes
// Each scale is using 8 colors
const CATEGORICAL_COLOR_SCALES = {
  Normal: schemeSet2,
  Accent: schemeAccent,
  Dark: schemeDark2,
  Pastel: schemePastel2
};

// Sequential color scales - palettes
// More info: https://github.com/d3/d3-scale-chromatic
const SEQUENTIAL_COLOR_SCALES = {
  Blues: 'Blues',
  Greens: 'Greens',
  Greys: 'Greys',
  Oranges: 'Oranges',
  Purples: 'Purples',
  Reds: 'Reds',
  BuGn: 'Blue-Green',
  BuPu: 'Blue-Purple',
  GnBu: 'Green-Blue',
  OrRd: 'Orange-Red',
  PuBu: 'Purple-Blue',
  PuBuGn: 'Purple-Blue-Green',
  PuRd: 'Purple-Red',
  RdPu: 'Red-Purple',
  YlGn: 'Yellow-Green',
  YlGnBu: 'Yellow-Green-Blue',
  YlOrBr: 'Yellow-Orange-Brown',
  YlOrRd: 'Yellow-Orange-Red'
};

// Genome view transitions
const DEFAULT_GENOME_TRANSITION_TIME = 250;
const FLIPPING_CHROMOSOME_TIME = 400;
const TRANSITION_DRAG_TIME = 100;
const TRANSITION_SWAPPING_TIME = 200;

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
  TRACK_INNER_RADIUS_INSIDE_TOP,
  TRACK_OUTER_RADIUS_INSIDE_TOP,
  TRACK_INNER_RADIUS_INSIDE_BOTTOM,
  TRACK_OUTER_RADIUS_INSIDE_BOTTOM,
  TRACK_INNER_RADIUS_OUTSIDE_TOP,
  TRACK_OUTER_RADIUS_OUTSIDE_TOP,
  TRACK_INNER_RADIUS_OUTSIDE_BOTTOM,
  TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM,
  CATEGORICAL_COLOR_SCALES,
  SEQUENTIAL_COLOR_SCALES,
  SCALE_DECREASE,
  TRANSLATE_INSCREASE,
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
