let _savedSolutions = [];

/**
 * Getter function for saved solutions array
 *
 * @return {Array<Object>} Saved solutions array
 */
export function getSavedSolutions() {
  return _savedSolutions;
};

/**
 * Setter function for saved solutions
 *
 * @param  {Array<Object>} solutions Saved solutions
 * @return {undefined} undefined
 */
export function setSavedSolutions(solutions) {
  _savedSolutions = solutions.slice();
};
