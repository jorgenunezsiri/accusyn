let _currentSelectedBlock = ""; // To store the block id of the current selected block in the genome view

/**
 * Getter function for current selected block
 *
 * @return {string} Current selected block
 */
export function getCurrentSelectedBlock() {
  return _currentSelectedBlock;
};

/**
 * Setter function for current selected block
 *
 * @param {string} currentBlock Current selected block
 * @return {undefined} undefined
 */
export function setCurrentSelectedBlock(currentBlock) {
  _currentSelectedBlock = currentBlock.slice(0);
};
