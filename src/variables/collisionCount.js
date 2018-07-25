let _collisionCount = 0; // To store collision count
let _superimposedCollisionCount = 0; // To store superimposed collision count

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
