import cloneDeep from 'lodash/cloneDeep';

let _dataChords = []; // Array that stores the plotting information for each block chord

/**
 * Getter function for data chords
 *
 * @return {Array<Object>} Data chords
 */
export function getDataChords() {
  return _dataChords;
};

/**
 * Setter function for data chords
 *
 * @param {Array<Object>} dataChords Data chords
 * @return {undefined} undefined
 */
export function setDataChords(chords) {
  _dataChords = cloneDeep(chords);
};

/**
 * Extracts chords order from chords data
 *
 * @param  {Array<Object>}  dataChords     Chords data
 * @return {Array<string>}  newChrOrder    New chords order
 */
export function toChordsOrder(dataChords) {
  return dataChords.map(x => x.source.value.id);
};
