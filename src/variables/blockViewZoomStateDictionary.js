import merge from 'lodash/merge';

let _blockViewZoomStateDictionary = {}; // To save the current zoom state for each block

/**
 * Getter function for block view zoom state dictionary
 *
 * @return {Object} Block view zoom state dictionary
 */
export function getBlockViewZoomStateDictionary() {
  return _blockViewZoomStateDictionary;
};

/**
 * Setter function for block view zoom state dictionary
 *
 * @param  {Object} dictionary Block view zoom state dictionary
 * @return {undefined} undefined
 */
export function setBlockViewZoomStateDictionary(dictionary) {
  _blockViewZoomStateDictionary = merge({}, dictionary);
};
