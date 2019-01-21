import {
  select as d3Select
} from 'd3';

const UndoManager = require('undo-manager'); // requires the lib from node_modules

let singletonManager;
if (!singletonManager) singletonManager = new UndoManager();

/**
 * Adds event action to undo manager
 *
 * @param {node} currentNode          Node to dispatch the event
 * @param {string} [eventName='change'] Event type
 * @return {undefined} undefined
 */
export function addActionToUndoManager(currentNode, eventName = 'change') {
  const clickFunction = () => d3Select(currentNode).dispatch(eventName);
  singletonManager.add({
    undo: clickFunction,
    redo: clickFunction
  });
};

/**
 * Updates the undo and redo buttons based on their state
 *
 * @return {undefined} undefined
 */
export function updateUndoRedoButtons() {
  d3Select("#form-config .decluttering-panel .layout-panel-buttons div.undo-layout button")
    .attr("class", !singletonManager.hasUndo() ? 'button-disabled' : '');
  d3Select("#form-config .decluttering-panel .layout-panel-buttons div.redo-layout button")
    .attr("class", !singletonManager.hasRedo() ? 'button-disabled' : '');
};

/**
 * Resets the undo manager by clearing all the states
 *
 * @return {undefined} undefined
 */
export function resetUndoRedoButtons() {
  singletonManager.clear();
  updateUndoRedoButtons();
};

export default singletonManager;
