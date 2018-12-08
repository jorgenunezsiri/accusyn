import cloneDeep from 'lodash/cloneDeep';

let _additionalTrackArray = []; // Array that stores the data for the additional tracks

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
