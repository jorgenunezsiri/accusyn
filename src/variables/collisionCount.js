let _collisionCount = 0; // To store collision count
let _superimposedCollisionCount = 0; // To store superimposed collision count
// To store collision calculation time (i.e. time it takes for getBlockCollisions to run once)
let _collisionCalculationTime = 0;
// To store the total number of iterations for the SA algorithm
let _totalNumberOfIterations = 0;

/**
 * Getter function for collision count
 *
 * @return {number} Current collision count
 */
export function getCollisionCount() {
  return _collisionCount;
};

/**
 * Setter function for collision count
 *
 * @param {number} collisionCount Collision count for the current layout
 * @return {undefined} undefined
 */
export function setCollisionCount(collisionCount) {
  _collisionCount = collisionCount;
};

/**
 * Getter function for superimposed collision count
 *
 * @return {number} Current superimposed collision count
 */
export function getSuperimposedCollisionCount() {
  return _superimposedCollisionCount;
};

/**
 * Setter function for superimposed collision count
 *
 * @param {number} superimposedCollisionCount Superimposed collision count for the current layout
 * @return {undefined} undefined
 */
export function setSuperimposedCollisionCount(superimposedCollisionCount) {
  _superimposedCollisionCount = superimposedCollisionCount;
};

/**
 * Getter function for collision calculation time
 *
 * @return {number} Current collision calculation time
 */
export function getCollisionCalculationTime() {
  return _collisionCalculationTime;
};

/**
 * Setter function for collision calculation time
 *
 * @param {number} collisionCalc Current collision calculation time
 * @return {undefined} undefined
 */
export function setCollisionCalculationTime(collisionCalc) {
  _collisionCalculationTime = collisionCalc;
};

/**
 * Getter function for total number of iterations for the SA algorithm
 *
 * @return {number} Total number of iterations
 */
export function getTotalNumberOfIterations() {
  return _totalNumberOfIterations;
};

/**
 * Setter function for total number of iterations
 *
 * @param {number} iterations Total number of iterations
 * @return {undefined} undefined
 */
export function setTotalNumberOfIterations(iterations) {
  _totalNumberOfIterations = iterations;
};
