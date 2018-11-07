import { zoomIdentity as d3ZoomIdentity } from 'd3';
import {
  schemeAccent,
  schemeDark2,
  schemePastel2,
  schemeSet2
} from 'd3-scale-chromatic';

const CONNECTION_COLOR = "sandybrown"; // Default connection color
const GAP_AMOUNT = 0.03; // Circos plot gap - Value in radians
const GENOME_INNER_RADIUS = 245; // Circos plot inner radius
const GENOME_OUTER_RADIUS = GENOME_INNER_RADIUS + 30; // Circos plot outer radius
const RADIANS_TO_DEGREES = (180.0 / Math.PI); // Convert radians to degrees
const DEGREES_TO_RADIANS = (Math.PI / 180.0); // Concert degrees to radians
const WIDTH = 700; // Circos plot width
const HEIGHT = 700; // Circos plot height

// Genome view
const CIRCOS_CONF = {
  innerRadius: GENOME_INNER_RADIUS,
  outerRadius: GENOME_OUTER_RADIUS,
  cornerRadius: 2,
  gap: GAP_AMOUNT,
  labels: {
    display: true,
    position: 'center',
    size: '11', // 'px' is added in Circos library
    color: '#000000',
    radialOffset: 12
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

// Using 10% separation between inner and outer radius in tracks
// and 2% separation from genome inner radius

// Track inside top
const TRACK_INNER_RADIUS_INSIDE_TOP = 0.88;
const TRACK_OUTER_RADIUS_INSIDE_TOP = 0.98;
// Track inside bottom
const TRACK_INNER_RADIUS_INSIDE_BOTTOM = 0.76;
const TRACK_OUTER_RADIUS_INSIDE_BOTTOM = 0.86;

// Track outside top
const TRACK_INNER_RADIUS_OUTSIDE_TOP = 1.14;
const TRACK_OUTER_RADIUS_OUTSIDE_TOP = 1.24;
// Track outside bottom
const TRACK_INNER_RADIUS_OUTSIDE_BOTTOM = 1.02;
const TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM = 1.12;

// Transform changes when adding tracks
const SCALE_DECREASE = 6; // 6% scaling decrese
const TRANSLATE_INSCREASE = 24; // 24px increase in both x and y coordinates

// Categorical color scales - palettes
// Each scale is using 8 colors
const CATEGORICAL_COLOR_SCALES = {
  Normal: schemeSet2,
  Accent: schemeAccent,
  Dark: schemeDark2,
  Pastel: schemePastel2,
  Disabled: "Disabled",
  Flipped: ["#00bfff", "#dc143c"], // deepskyblue and crimson colors (blue-ish and red-ish)
  Multiple: schemeSet2
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
const FLIPPING_CHROMOSOME_TIME = 350;
const TRANSITION_DRAG_TIME = 100;
const TRANSITION_SWAPPING_TIME = 200;

// Block view
const OFFSET_DOMAIN = 50000; // Offset to be used for the scales domain
const REMOVE_BLOCK_VIEW_TRANSITION_TIME = 250;

// Default block view zoom state
const DEFAULT_BLOCK_VIEW_ZOOM_STATE = {
  defaultY0Domain: [],
  defaultY1Domain: [],
  flipped: false,
  y0Domain: [],
  y1Domain: [],
  zoom: d3ZoomIdentity.scale(1).translate(0, 0)
};

// Flipping block view constants
const COLOR_CHANGE_TIME = 40;
const MAX_INDEX_TRANSITION = 11;
const TRANSITION_NORMAL_TIME = 40;
const TRANSITION_FLIPPING_TIME = TRANSITION_NORMAL_TIME + 5;
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
  DEFAULT_BLOCK_VIEW_ZOOM_STATE,
  OFFSET_DOMAIN,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME,
  // Block view transition constants
  COLOR_CHANGE_TIME,
  MAX_INDEX_TRANSITION,
  TRANSITION_NORMAL_TIME,
  TRANSITION_FLIPPING_TIME,
  TRANSITION_HEIGHT_DIVISION_MULTIPLE
};
