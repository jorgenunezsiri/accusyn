import merge from 'lodash/merge';

let _gffPositionDictionary = {}; // Dictionary that includes the colors, start and end position data for each chromosome

/**
 * Getter function for gff dictionary
 *
 * @return {Object} Gff dictionary
 */
export function getGffDictionary() {
  return _gffPositionDictionary;
};

/**
 * Setter function for gff dictionary
 *
 * @param {Object} dictionary Gff dictionary
 * @return {undefined} undefined
 */
export function setGffDictionary(dictionary) {
  _gffPositionDictionary = merge({}, dictionary);
};
