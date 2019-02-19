import { setAdditionalTrackArray } from './additionalTrack';
import { setBlockDictionary } from './blockDictionary';
import { setBlockViewStateDictionary } from './blockViewStateDictionary';
import { setCurrentChromosomeMouseDown } from './currentChromosomeMouseDown';
import { setCurrentChromosomeOrder, setDefaultChromosomeOrder } from './currentChromosomeOrder';
import { setCurrentFlippedChromosomes } from './currentFlippedChromosomes';
import { setDataChords } from './dataChords';
import { setDataChromosomes } from './dataChromosomes';
import { setGeneDictionary } from './geneDictionary';
import { setGffDictionary } from './gffDictionary';
import { setSavedSolutions } from './savedSolutions';
import { resetUndoRedoButtons } from './../vendor/undoManager';

/**
 * Resets all variables
 * NOTE: This function should only be used in generateData
 *
 * @return {undefined} undefined
 */
export default function resetAllVariables() {
  setAdditionalTrackArray([]);
  setBlockDictionary({});
  setBlockViewStateDictionary({});
  setCurrentChromosomeMouseDown("");
  setCurrentChromosomeOrder([]);
  setDefaultChromosomeOrder([]);
  setCurrentFlippedChromosomes([]);
  setDataChords([]);
  setDataChromosomes([]);
  setGeneDictionary({});
  setGffDictionary({});
  setSavedSolutions([]);
  resetUndoRedoButtons();
};
