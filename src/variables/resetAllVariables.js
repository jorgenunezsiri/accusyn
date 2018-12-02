import { setAdditionalTrackArray } from './additionalTrack';
import { setBlockDictionary } from './blockDictionary';
import { setBlockViewZoomStateDictionary } from './blockViewZoomStateDictionary';
import { setCurrentChromosomeMouseDown } from './currentChromosomeMouseDown';
import { setCurrentChromosomeOrder, setDefaultChromosomeOrder } from './currentChromosomeOrder';
import { setCurrentFlippedChromosomes } from './currentFlippedChromosomes';
import { setDataChords } from './dataChords';
import { setDataChromosomes } from './dataChromosomes';
import { setGeneDictionary } from './geneDictionary';
import { setGffDictionary } from './gffDictionary';
import { setSavedCollisionSolutionsDictionary } from './savedCollisionSolutionsDictionary';

/**
 * Resets all variables
 * NOTE: This function should only be used in generateData
 *
 * @return {undefined} undefined
 */
export default function resetAllVariables() {
  setAdditionalTrackArray([]);
  setBlockDictionary({});
  setBlockViewZoomStateDictionary({});
  setCurrentChromosomeMouseDown("");
  setCurrentChromosomeOrder([]);
  setDefaultChromosomeOrder([]);
  setCurrentFlippedChromosomes([]);
  setDataChords([]);
  setDataChromosomes([]);
  setGeneDictionary({});
  setGffDictionary({});
  setSavedCollisionSolutionsDictionary({});
};