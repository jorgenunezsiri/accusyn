import cloneDeep from 'lodash/cloneDeep';
import findIndex from 'lodash/findIndex';

let _dataChromosomes = []; // Array that stores the current chromosomes in the Circos plot

/**
 * Getter function for data chromosomes
 *
 * @return {Array<Object>} Data chromosomes
 */
export function getDataChromosomes() {
  return _dataChromosomes;
};

/**
 * Setter function for data chromosomes
 *
 * @param {Array<Object>} dataChromosomes Data chromosomes
 * @return {undefined} undefined
 */
export function setDataChromosomes(chromosomes) {
  _dataChromosomes = cloneDeep(chromosomes);
};

/**
 * Generates updated data chromosome from chromosome order and local data for the properties
 *
 * @param  {Array<string>} chromosomeOrder      Current chromosome order
 * @param  {Array<Object>} localDataChromosomes Current data chromosomes
 * @return {Array<Object>}                      Updated data chromosomes from order
 */
export function generateUpdatedDataChromosomesFromOrder(chromosomeOrder, localDataChromosomes) {
  // Updated data chromosomes
  return chromosomeOrder.reduce(
    function(dataInside, currentChr) {
      const position = findIndex(localDataChromosomes, ['id', currentChr]);
      // Only choose the current layout chromosomes from localDataChromosomes
      if (position !== (-1)) dataInside.push(cloneDeep(localDataChromosomes[position]));
      return dataInside;
    }, []);
};
