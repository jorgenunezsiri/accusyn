import merge from 'lodash/merge';

let _geneDictionary = {}; // Dictionary that includes the start and end position data for each gene

/**
 * Getter function for gene dictionary
 *
 * @return {Object} Gene dictionary
 */
export function getGeneDictionary() {
  return _geneDictionary;
};

/**
 * Setter function for gene dictionary
 *
 * @param {Object} dictionary Gene dictionary
 * @return {undefined} undefined
 */
export function setGeneDictionary(dictionary) {
  _geneDictionary = merge({}, dictionary);
};
