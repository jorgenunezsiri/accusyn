let _currentChromosomeOrder = []; // Array that stores the current order of chromosomes
let _DEFAULT = []; // Array that stores the default order of chromosomes (i.e. increasing order)

/**
 * Getter function for current chromosome order
 *
 * @return {Array<string>} Current chromosome order
 */
export function getCurrentChromosomeOrder() {
  return _currentChromosomeOrder;
};

/**
 * Setter function for current chromosome order
 *
 * @param {Array<string>} order Current chromosome order
 * @return {undefined} undefined
 */
export function setCurrentChromosomeOrder(order) {
  _currentChromosomeOrder = order.slice();
};

/**
 * Getter function for defaut chromosome order
 *
 * @return {Array<string>} Default chromosome order
 */
export function getDefaultChromosomeOrder() {
  return _DEFAULT;
}

/**
 * Setter function for default chromosome order
 *
 * @param {Array<string>} order Default chromosome order
 * @return {undefined} undefined
 */
export function setDefaultChromosomeOrder(order) {
  // Should only be modified in generateData function
  _DEFAULT = order.slice();
}

/**
 * Extracts chromosome order from chromosome data
 *
 * @param  {Array<Object>}  dataChr        Chromosome data
 * @param  {boolean}        [setAll=false] True if new order should include all chromosomes
 * @return {Array<string>}  newChrOrder    New chromosome order
 */
export function toChromosomeOrder(dataChr, setAll = false) {
  let newChrOrder = dataChr.map(x => x.id);
  const allChromosomes = getCurrentChromosomeOrder().slice();
  const allChromosomesLength = allChromosomes.length;
  const newChrOrderLength = newChrOrder.length;

  if (setAll && newChrOrderLength !== allChromosomesLength) {
    const notAddedChromosomes = [];

    for (let i = 0; i < allChromosomesLength; i++) {
      let found = false;

      for (let j = 0; j < newChrOrderLength; j++) {
        if (allChromosomes[i] === newChrOrder[j]) {
          found = true;
          break;
        }
      }

      if (!found) notAddedChromosomes.push(allChromosomes[i]);
    }

    newChrOrder = newChrOrder.concat(notAddedChromosomes);
  }

  return newChrOrder;
};
