import { Circos } from './circos';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';

// Contants
import {
  WIDTH,
  HEIGHT
} from './constants';

let _blockDictionary = {}; // Dictionary to store the data for all blocks
let _currentChromosomeOrder = []; // Array that stores the current order of chromosomes
let _geneDictionary = {}; // Dictionary that includes the start and end position data for each gene
let _gffPositionDictionary = {}; // Dictionary that includes the colors, start and end position data for each chromosome
let _myCircos = null; // Circos variable

/**
 * Getter function for block dictionary
 *
 * @return {Object} Block dictionary
 */
export function getBlockDictionary() {
  return _blockDictionary;
};

/**
 * Setter function for block dictionary
 *
 * @param  {Object} dictionary Block dictionary
 * @return {undefined} undefined
 */
export function setBlockDictionary(dictionary) {
  _blockDictionary = merge({}, dictionary);
};

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
  _currentChromosomeOrder = cloneDeep(order);
};

/**
 * Getter function for gene dictionary
 *
 * @return {Object} Gene dictionary
 */
export function getGeneDictionary() {
  return _geneDictionary;
};

/**
 * Setter function for gene dictionary
 *
 * @param {Object} dictionary Gene dictionary
 * @return {undefined} undefined
 */
export function setGeneDictionary(dictionary) {
  _geneDictionary = merge({}, dictionary);
};

/**
 * Getter function for gff dictionary
 *
 * @return {Object} Gff dictionary
 */
export function getGffDictionary() {
  return _gffPositionDictionary;
};

/**
 * Setter function for gff dictionary
 *
 * @param {Object} dictionary Gff dictionary
 * @return {undefined} undefined
 */
export function setGffDictionary(dictionary) {
  _gffPositionDictionary = merge({}, dictionary);
};

/**
 * Getter function for Circos object
 *
 * @return {Object} Circos object
 */
export function getCircosObject() {
  return _myCircos;
};

/**
 * Setter function for Circos object
 *
 * @return {undefined} undefined
 */
export function setCircosObject() {
  // Loading the circos plot in the svg element
  _myCircos = new Circos({
      container: '#chart',
      width: WIDTH,
      height: HEIGHT
    });
};
