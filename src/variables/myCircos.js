import { Circos } from './../vendor/circos.min';

// Contants
import {
  WIDTH,
  HEIGHT
} from './../variables/constants';

let _myCircos = null; // Circos variable

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
  // Loading the Circos plot in the svg element
  _myCircos = new Circos({
      container: '#genome-view',
      width: WIDTH,
      height: HEIGHT
    });
};

let _circosRotateValue = 0;

/**
 * Getter function for Circos rotate value
 *
 * @return {number} Circos rotate value
 */
export function getCircosRotateValue() {
  return _circosRotateValue;
};

/**
 * Setter function for Circos rotate value
 *
 * @param {number} rotateValue Rotate value
 * @return {undefined} undefined
 */
export function setCircosRotateValue(rotateValue) {
  _circosRotateValue = rotateValue;
};
