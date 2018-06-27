import merge from 'lodash/merge';

let _blockDictionary = {}; // Dictionary to store the data for all blocks

/**
 * Getter function for block dictionary
 *
 * @return {Object} Block dictionary
 */
export function getBlockDictionary() {
  return _blockDictionary;
};

/**
 * Setter function for block dictionary
 *
 * @param  {Object} dictionary Block dictionary
 * @return {undefined} undefined
 */
export function setBlockDictionary(dictionary) {
  _blockDictionary = merge({}, dictionary);
};
