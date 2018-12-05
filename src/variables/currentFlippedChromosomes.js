let _currentFlippedChromosomes = []; // Array that stores the current set of chromosomes with flipped locations
let _previousFlippedChromosomes = []; // Array to keep track of previous flipped chromosomes

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

/**
 * Getter function for previous flipped chromosomes
 *
 * @return {Array<string>} Previous flipped chromosomes
 */
export function getPreviousFlippedChromosomes() {
  return _previousFlippedChromosomes;
};

/**
 * Setter function for previous flipped chromosomes
 *
 * @param {Array<string>} order Previous flipped chromosomes
 * @return {undefined} undefined
 */
export function setPreviousFlippedChromosomes(order) {
  _previousFlippedChromosomes = order.slice();
};
