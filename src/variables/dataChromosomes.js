import cloneDeep from 'lodash/cloneDeep';

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
