import { Circos } from './../circos';

// Contants
import {
  WIDTH,
  HEIGHT
} from './../constants';

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
      container: '#chart',
      width: WIDTH,
      height: HEIGHT
    });
};
