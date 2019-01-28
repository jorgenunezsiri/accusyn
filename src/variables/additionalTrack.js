import {
  format as d3Format
} from 'd3';

import cloneDeep from 'lodash/cloneDeep';

let _additionalTrackArray = []; // Array that stores the data for the additional tracks
let _genomeWindowSize = 0; // To store the minimum window size for the genome

/**
 * Getter function for additional tracks
 *
 * @return {Array<Object>} Data from additionalTrackArray
 */
export function getAdditionalTrackArray() {
  return _additionalTrackArray;
};

/**
 * Getter function for additional tracks names
 *
 * @return {Array<string>} Names from additionalTrackArray
 */
export function getAdditionalTrackNames() {
  return _additionalTrackArray.map((current) => current.name);
};

/**
 * Setter function for additional tracks
 *
 * @param {Array<Object>} track Data for additionalTrackArray
 * @return {undefined} undefined
 */
export function setAdditionalTrackArray(track) {
  _additionalTrackArray = cloneDeep(track);
};

/**
 * To check whether an additional track is added or no
 *
 * @return {boolean} True if added, false otherwise
 */
export function isAdditionalTrackAdded() {
  return _additionalTrackArray && _additionalTrackArray.length > 0;
};

/**
 * Function to push an additional track
 *
 * @param {Array<Object>} track Data for additionalTrackArray
 * @return {undefined} undefined
 */
export function pushAdditionalTrack(track) {
  _additionalTrackArray.push(track);
};

/**
 * Getter function for genome window size
 *
 * @return {number} Genome window size
 */
export function getGenomeWindowSize() {
  return _genomeWindowSize;
};

/**
 * Setter function for genome window size
 *
 * @param {number} windowSize Genome window size
 * @return {undefined} undefined
 */
export function setGenomeWindowSize(windowSize) {
  _genomeWindowSize = windowSize;
};

/**
 * Converts the total genome bases to minimum window size round number
 * e.g. from 835,580 to 800,000
 *
 * @param  {number} totalGenomeBases Total genome bases
 * @param  {number} factor           Ideal amount of bins to be visualized
 * @param  {boolean} shouldFormat    Whether the window size should be formatted or not
 * @return {number|string}           Minimum window size
 */
export function convertToMinimumWindowSize(totalGenomeBases, factor = 2000, shouldFormat = false) {
  /**
   * As a rule of thumb you can’t effectively show more than 2,000 windows (bins) in a single track,
   * not only that rendering would take a long time - but also human eyes can't appreciate that much details.
   * The minimum window size equals to totalGenomeBases/2,000.
   */
  const minimumWindowSize = (Math.ceil(totalGenomeBases / factor)).toString();
  const firstNumber = parseInt(minimumWindowSize.charAt(0));
  const magnitude = parseInt(Math.pow(10, minimumWindowSize.length - 1));
  const result = (firstNumber * magnitude);

  console.log('MINIMUM WINDOW SIZE: ', minimumWindowSize, result);

  if (shouldFormat) {
    return d3Format(",")(result.toString());
  }

  return result;
};
