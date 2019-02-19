import merge from 'lodash/merge';

let _blockViewStateDictionary = {}; // To save the current state for each block

/**
 * Getter function for block view state dictionary
 *
 * @return {Object} Block view state dictionary
 */
export function getBlockViewStateDictionary() {
  return _blockViewStateDictionary;
};

/**
 * Setter function for block view state dictionary
 *
 * @param  {Object} dictionary Block view state dictionary
 * @return {undefined} undefined
 */
export function setBlockViewStateDictionary(dictionary) {
  _blockViewStateDictionary = merge({}, dictionary);
};
