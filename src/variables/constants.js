import { zoomIdentity as d3ZoomIdentity } from 'd3-zoom';
import {
  interpolateBlues,
  interpolateGreens,
  interpolateGreys,
  interpolateOranges,
  interpolatePurples,
  interpolateReds,
  interpolateBuGn,
  interpolateBuPu,
  interpolateGnBu,
  interpolateOrRd,
  interpolatePuBu,
  interpolatePuBuGn,
  interpolatePuRd,
  interpolateRdPu,
  interpolateYlGn,
  interpolateYlGnBu,
  interpolateYlOrBr,
  interpolateYlOrRd,
  schemeAccent,
  schemeDark2,
  schemePastel2,
  schemeSet2
} from 'd3-scale-chromatic';

const CONNECTION_COLORS = {
  Combined: 'Combined',
  Source: 'Source',
  Target: 'Target',
  Flipped: 'Flipped',
  Disabled: 'Disabled',
  Blue: 'dodgerblue',
  Brown: 'brown',
  Green: 'green',
  Grey: 'grey',
  Orange: 'sandybrown',
  Purple: 'purple',
  Red: 'red',
  Yellow: 'khaki'
};

const GAP_AMOUNT = 0.03; // Circos plot gap - Value in radians
const GENOME_INNER_RADIUS = 250; // Circos plot inner radius
const GENOME_OUTER_RADIUS = GENOME_INNER_RADIUS + 30; // Circos plot outer radius
const RADIANS_TO_DEGREES = (180.0 / Math.PI); // Convert radians to degrees
const DEGREES_TO_RADIANS = (Math.PI / 180.0); // Concert degrees to radians
const WIDTH = 715; // Circos plot width
const HEIGHT = 715; // Circos plot height

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
// Positioning: Using 10% separation between inner and outer radius in tracks
// and 2% separation from genome inner radius
const TRACK_SEPARATION_INNER_OUTER = 0.10;
const TRACK_SEPARATION_GENOME = 0.02;

// Transform changes when adding tracks
const SCALE_DECREASE = 0.05; // 5% scaling decrese
const SCALE_INCREASE = 0.02; // 2% scaling increase

// Additional track types
const ADDITIONAL_TRACK_TYPES = {
  None: 'None',
  Heatmap: 'heatmap',
  Histogram: 'histogram',
  Line: 'line',
  Scatter: 'scatter'
};

// Categorical color scales - palettes
// Each scale is using 8 colors
// Colors are taken using the Color Brewer specification:
// https://www.cgl.ucsf.edu/chimerax/docs/user/commands/palettes.html
// Color advice article: https://medium.com/@Elijah_Meeks/color-advice-for-data-visualization-with-d3-js-33b5adc41c90
const CATEGORICAL_COLOR_SCALES = {
  'Light 1': schemeSet2,
  'Light 2': ['#8dd3c7','#ffea81','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5'],
  'Dark 1': schemeDark2,
  'Dark 2': ["#53b7b3", "#d47234", "#8a74ce", "#9eb33b", "#ca5f9d", "#63a65d", "#d25c64", "#ae8851"],
  'Accent 1': schemeAccent,
  'Accent 2': ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf'],
  'Pastel 1': ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc','#e5d8bd','#fddaec'],
  'Pastel 2': schemePastel2,
  Disabled: 'Disabled',
  Flipped: ['#00bfff', '#dc143c'], // deepskyblue and crimson colors (blue-ish and red-ish)
  'Multiple Light': schemeSet2,
  'Multiple Dark': ["#53b7b3", "#d47234", "#8a74ce", "#9eb33b", "#ca5f9d", "#63a65d", "#d25c64", "#ae8851"],
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

// Sequential color scales interpolators
const SEQUENTIAL_SCALES_INTERPOLATORS = {
  Blues: interpolateBlues,
  Greens: interpolateGreens,
  Greys: interpolateGreys,
  Oranges: interpolateOranges,
  Purples: interpolatePurples,
  Reds: interpolateReds,
  BuGn: interpolateBuGn,
  BuPu: interpolateBuPu,
  GnBu: interpolateGnBu,
  OrRd: interpolateOrRd,
  PuBu: interpolatePuBu,
  PuBuGn: interpolatePuBuGn,
  PuRd: interpolatePuRd,
  RdPu: interpolateRdPu,
  YlGn: interpolateYlGn,
  YlGnBu: interpolateYlGnBu,
  YlOrBr: interpolateYlOrBr,
  YlOrRd: interpolateYlOrRd
};

// Genome view transitions
const DEFAULT_GENOME_TRANSITION_TIME = 250;
const FLIPPING_CHROMOSOME_TIME = 350;
const TRANSITION_DRAG_TIME = 100;
const TRANSITION_SWAPPING_TIME = 200;

// Block view
const OFFSET_DOMAIN = 50000; // Offset to be used for the scales domain
const REMOVE_BLOCK_VIEW_TRANSITION_TIME = 250;

// Default block view state
const DEFAULT_BLOCK_VIEW_STATE = {
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
  CONNECTION_COLORS,
  DEFAULT_GENOME_TRANSITION_TIME,
  RADIANS_TO_DEGREES,
  DEGREES_TO_RADIANS,
  WIDTH,
  HEIGHT,
  // Genome view
  ADDITIONAL_TRACK_TYPES,
  CIRCOS_CONF,
  GAP_AMOUNT,
  GENOME_INNER_RADIUS,
  TRACK_SEPARATION_INNER_OUTER,
  TRACK_SEPARATION_GENOME,
  CATEGORICAL_COLOR_SCALES,
  SEQUENTIAL_COLOR_SCALES,
  SEQUENTIAL_SCALES_INTERPOLATORS,
  SCALE_DECREASE,
  SCALE_INCREASE,
  // Genome view transitions
  FLIPPING_CHROMOSOME_TIME,
  TRANSITION_DRAG_TIME,
  TRANSITION_SWAPPING_TIME,
  // Block view
  DEFAULT_BLOCK_VIEW_STATE,
  OFFSET_DOMAIN,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME,
  // Block view transition constants
  COLOR_CHANGE_TIME,
  MAX_INDEX_TRANSITION,
  TRANSITION_NORMAL_TIME,
  TRANSITION_FLIPPING_TIME,
  TRANSITION_HEIGHT_DIVISION_MULTIPLE
};
