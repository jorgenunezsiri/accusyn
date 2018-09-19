let _currentFlippedChromosomes = []; // Array that stores the current set of chromosomes with flipped locations

/**
 * Getter function for current flipped chromosomes
 *
 * @return {Array<string>} Current flipped chromosomes
 */
export function getCurrentFlippedChromosomes() {
  return _currentFlippedChromosomes;
};

/**
 * Setter function for current flipped chromosomes
 *
 * @param {Array<string>} order Current flipped chromosomes
 * @return {undefined} undefined
 */
export function setCurrentFlippedChromosomes(order) {
  _currentFlippedChromosomes = order.slice();
};
