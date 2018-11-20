let _currentChromosomeMouseDown = ""; // To store the current chromosome fired by the mousedown event

/**
 * Getter function for current chromosome mouse down
 *
 * @return {string} Current chromosome mouse down
 */
export function getCurrentChromosomeMouseDown() {
  return _currentChromosomeMouseDown;
};

/**
 * Setter function for current chromosome mouse down
 *
 * @param {string} currentChr Current chromosome mouse down
 * @return {undefined} undefined
 */
export function setCurrentChromosomeMouseDown(currentChr) {
  _currentChromosomeMouseDown = currentChr.slice(0);
};
