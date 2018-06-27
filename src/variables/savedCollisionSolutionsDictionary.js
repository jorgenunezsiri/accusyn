import merge from 'lodash/merge';

let _savedCollisionSolutionsDictionary = {}; // Dictionary to store saved block collisions solutions

/**
 * Getter function for saved collision solutions dictionary
 *
 * @return {Object} Saved collision solutions dictionary
 */
export function getSavedCollisionSolutionsDictionary() {
  return _savedCollisionSolutionsDictionary;
};

/**
 * Setter function for block dictionary
 *
 * @param  {Object} dictionary Saved collision solutions dictionary
 * @return {undefined} undefined
 */
export function setSavedCollisionSolutionsDictionary(dictionary) {
  _savedCollisionSolutionsDictionary = merge({}, dictionary);
};
