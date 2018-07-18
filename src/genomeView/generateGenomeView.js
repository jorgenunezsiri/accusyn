/*
University of Saskatchewan
GSB: A Web-based Genome Synteny Browser
Course: CMPT994 - Research

Name: Jorge Nunez Siri
E-mail: jdn766@mail.usask.ca
NSID: jdn766
Student ID: 11239727

Function file: generateGenomeView.js

@2018, Jorge Nunez Siri, All rights reserved
*/

import * as d3 from 'd3';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import AlertWithTimeout from './../reactComponents/Alert';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import defaultsDeep from 'lodash/defaultsDeep';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import findIndex from 'lodash/findIndex';

import generateBlockView from './../generateBlockView';

import {
  fixSourceTargetCollinearity,
  getSelectedCheckboxes,
  removeBlockView,
  sortGffKeys,
  updateBlockNumberHeadline
} from './../helpers';

import {
  addSvgDragHandler,
  generateDraggingAnglesDictionary
} from './dragging';

import {
  callSwapPositionsAnimation,
  getBlockCollisions,
  loopUpPositionCollisionsDictionary,
  saveToCollisionsDictionary,
  simulatedAnnealing,
  updateBlockCollisionHeadline
} from './blockCollisions';

// Variable getters and setters
import { getBlockDictionary } from './../variables/blockDictionary';
import { getCircosObject } from './../variables/myCircos';
import {
  getCurrentChromosomeMouseDown,
  setCurrentChromosomeMouseDown
} from './../variables/currentChromosomeMouseDown';
import {
  getCurrentChromosomeOrder,
  toChromosomeOrder
} from './../variables/currentChromosomeOrder';
import { getGffDictionary } from './../variables/gffDictionary';
import { getSavedCollisionSolutionsDictionary } from './../variables/savedCollisionSolutionsDictionary';

// Contants
import {
  CIRCOS_CONF,
  CONNECTION_COLOR,
  DEFAULT_GENOME_TRANSITION_TIME,
  FLIPPING_CHROMOSOME_TIME,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME
} from './../constants';

// Local variables
const currentFlippedChromosomes = []; // Array that stores the current set of chromosomes with flipped locations
let currentSelectedBlock = {}; // To store the data of the current selected block
const currentRemovedBlocks = []; // Array that stores the current set of blocks that are removed
let dataChords = []; // Array that stores the plotting information for each block chord
let dataChromosomes = []; // Array that stores the current chromosomes in the Circos plot
let foundCurrentSelectedBlock = false; // To keep track of whether the selected block was found or not

/**
 * Helps in transitioning and removing the block view when necessary
 *
 * @param  {boolean}  condition True or false. Condition that has to be met to remove block view
 * @param  {Function} callback  Callback function
 * @return {undefined}             undefined
 */
function transitionRemoveBlockView(condition, callback) {
  // TODO: Send this function as callback to Circos library instead of boolean
  // To maintain things on this side

  let removingBlockView = false; // To keep track of when the block view is being removed

  if (condition) {
    removingBlockView = true;
    removeBlockView(REMOVE_BLOCK_VIEW_TRANSITION_TIME);
  }

  if (removingBlockView) {
    setTimeout(callback, REMOVE_BLOCK_VIEW_TRANSITION_TIME);
  } else {
    callback();
  }
}

/**
 * Generates chromosome data from chromosome order
 *
 * @return {Array<Object>} dataChromosomes
 */
function getDataChromosomes() {
  const gffPositionDictionary = getGffDictionary();
  const selectedCheckbox = getSelectedCheckboxes();

  // To keep track of the Show All input state
  const showAllChromosomes = d3.select("p.show-all > input").property("checked");

  const dataChromosomes = []; // Local data chromosomes array

  let currentChromosomeOrder = getCurrentChromosomeOrder();

  // Using currentChromosomeOrder array to add selected chromosomes to the genome view
  for (let i = 0; i < currentChromosomeOrder.length; i++) {
    const key = currentChromosomeOrder[i];

    const currentObj = {
      color: gffPositionDictionary[key].color,
      label: key,
      len: (gffPositionDictionary[key].end - gffPositionDictionary[key].start),
      id: key
    };

    if (showAllChromosomes) {
      // All the chromosomes will show
      dataChromosomes.push(currentObj);
    } else {
      if (selectedCheckbox.indexOf(key) > -1) {
        // If current chromosome is selected and showAllChromosomes is
        // not selected, then add it
        dataChromosomes.push(currentObj);
      }
    }
  }

  return cloneDeep(dataChromosomes);
}

/**
 * Generates Circos layout from chromosome data
 *
 * @return {undefined} undefined
 */
function generateCircosLayout() {
  const myCircos = getCircosObject();

  dataChromosomes = getDataChromosomes();

  // Generating layout configuration for the Circos plot
  myCircos.layout(dataChromosomes, defaultsDeep({
    events: {
      'contextmenu.chr': function(d, i, nodes, event) {
        // To prevent default right click action
        event.preventDefault();

        // Before flipping, set all chords with the same opacity
        d3.selectAll("path.chord").attr("opacity", 0.7);

        const currentID = d.id;
        const currentPosition = currentFlippedChromosomes.indexOf(currentID);

        d3.selectAll(`path.chord.${currentID}`)
          .raise()
          .transition()
          .duration(FLIPPING_CHROMOSOME_TIME)
          .ease(d3.easeLinear)
          .style("fill", "lightblue");

        // Setting flipping transition object
        // NOTE: When flipping chromosomes to emphasize the flipped blocks only
        const transition = {
          shouldDo: true,
          from: "lightblue",
          time: FLIPPING_CHROMOSOME_TIME,
          chr: currentID
        };

        // If chromosome id is present, then remove it
        if (currentPosition !== (-1)) {
          currentFlippedChromosomes.splice(currentPosition, 1);
        } else {
          currentFlippedChromosomes.push(currentID);
        }

        console.log('CURRENT FLIPPED CHR: ', currentFlippedChromosomes);

        setTimeout(() => generateGenomeView({
          "transition": transition,
          "shouldUpdateBlockCollisions": true,
          "shouldUpdateLayout": true
        }), FLIPPING_CHROMOSOME_TIME + (FLIPPING_CHROMOSOME_TIME / 2));
      },
      'mousedown.chr': function(d) {
        setCurrentChromosomeMouseDown(d.id);
      }
    }
  }, cloneDeep(CIRCOS_CONF)));

  // Adding the dragHandler to the svg after populating the dataChromosomes object
  addSvgDragHandler(dataChromosomes);

  // Generating dragging angles dictionary for each chromosome
  generateDraggingAnglesDictionary(dataChromosomes);
}

/**
 * Generates all the chords and renders the Circos plot with the
 * current configuration
 *
 * @param  {boolean} shouldUpdateBlockCollisions True if should update block collisions
 *                                               in genome view, false otherwise
 * @param  {boolean} shouldUpdateLayout          True if Circos layout should be updated
 *                                               (i.e. chromosome order changed)
 * @param  {Object}  transition                  Current transition configuration
 * @param  {boolean} transitionRemove            True if Circos layout should be removed
 *                                               with transition
 * @return {undefined} undefined
 */
function generatePathGenomeView({
  shouldUpdateBlockCollisions,
  shouldUpdateLayout,
  transition,
  transitionRemove
}) {
  // To keep track of the value of the color blocks checkbox
  const coloredBlocks = d3.select("p.color-blocks > input").property("checked");
  const gffPositionDictionary = getGffDictionary();

  // To keep track of the value of highlight flipped blocks checkbox
  const highlightFlippedBlocks = d3.select("p.highlight-flipped-blocks > input").property("checked");

  const myCircos = getCircosObject();

  // Setting transition to default object if not defined at this point
  // NOTE: Default object is used each time that the genome view is rendered
  if (transition == null) {
    transition = {
      shouldDo: true,
      from: "white",
      time: DEFAULT_GENOME_TRANSITION_TIME
    };
  }

  // TODO: Think about this condition and the Updating label (multiple d3.select everywhere)
  // Updating block collisions should happen if flag is true
  // (when filtering transitions are not happening and flag is true at the end of filtering)
  // It should also happen when transitions are true
  if (shouldUpdateBlockCollisions || (transition && transition.shouldDo)) {
    setTimeout(() => updateBlockCollisionHeadline(dataChromosomes, dataChords),
      DEFAULT_GENOME_TRANSITION_TIME + (DEFAULT_GENOME_TRANSITION_TIME / 2));

    d3.select(".block-collision-headline")
      .text("Updating block collisions ...");
  }

  // Adding the configuration for the Circos chords using the generated array
  myCircos.chords('chords', dataChords, {
    radius: null,
    logScale: false,
    opacity: function(d) {
      if (foundCurrentSelectedBlock) {
        if (isEqual(d, currentSelectedBlock)) {
          return 0.9;
        } else {
          return 0.3;
        }
      } else {
        return 0.7;
      }
    },
    color: function(d) {
      if (coloredBlocks) {
        return gffPositionDictionary[d.source.id].color;
      }

      return CONNECTION_COLOR;
    },
    tooltipContent: function(d) {
      // Only show tooltip if the user is not dragging
      const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
      if (currentChromosomeMouseDown === "") {
        const { id: sourceID } = d.source;
        const { id: targetID } = d.target;
        const { id: blockID, score, eValue, length, isFlipped } = d.source.value;
        return `<h6>${sourceID} ➤ ${targetID}</h6>
          <h6><u>Block information</u></h6>
          <h6>ID: ${blockID}</h6>
          <h6>Score: ${score}</h6>
          <h6>E-value: ${eValue}</h6>
          <h6>Size: ${length}</h6>
          <h6>Flipped: ${(isFlipped ? "Yes" : "No")}</h6>`;
      }

      return;
    },
    events: {
      'mouseover.block': function(d, i, nodes) {
        // Only update block view if the user is not dragging
        const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
        if (currentChromosomeMouseDown === "") {
          currentSelectedBlock = d;

          d3.selectAll(nodes).attr("opacity", 0.7);

          if (d3.selectAll(nodes).attr("opacity") != 0.3) {
            d3.selectAll(nodes).attr("opacity", 0.3);
            d3.select(nodes[i]).raise().attr("opacity", 0.9);
          }

          // Showing block view for current block
          generateBlockView(d);
        }
      },
      'contextmenu.block': function(d, i, nodes, event) {
        // To prevent default right click action
        event.preventDefault();

        // Hide tooltip and node when right clicking block
        d3.select('.circos-tooltip')
          .transition()
          .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
          .style("opacity", 0);

        // Setting opacity 0.7 to all chords, except current node with 0
        d3.selectAll('path.chord')
          .transition()
          .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
          .attr("opacity", 0.7);

        d3.select(nodes[i])
          .raise()
          .transition()
          .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
          .style("opacity", 0)
          .remove();

        // Removing block view
        removeBlockView(REMOVE_BLOCK_VIEW_TRANSITION_TIME);

        // Resetting current selected block object
        currentSelectedBlock = {};

        const { id: currentID } = d.source.value;
        const currentPosition = findIndex(dataChords, ['source.value.id', currentID]);

        console.log('REMOVING ID: ', currentID);

        if (currentPosition !== (-1)) {
          dataChords.splice(currentPosition, 1);
        }

        // Pushing block id to array to keep track
        currentRemovedBlocks.push(currentID);

        // Updating block number
        updateBlockNumberHeadline(dataChords);

        // Updating collision headline
        updateBlockCollisionHeadline(dataChromosomes, dataChords);
      }
    }
  });

  // Rendering Circos plot with current configuration
  if (transition && transition.shouldDo) {
    myCircos.render(undefined, undefined, transition, transitionRemove);
  } else {
    myCircos.render();
  }

  // Highlighting flipped blocks if checkbox is true
  if (highlightFlippedBlocks) {
    d3.selectAll("path.chord.isFlipped")
      .style("stroke", "#ea4848")
      .style("stroke-width", "1px");
  }

  // Highlighting flipped chromosomes by default
  for (let i = 0; i < currentFlippedChromosomes.length; i++) {
    // d3.select(`g.${currentFlippedChromosomes[i]}`).attr("opacity", 0.6);
    d3.select(`g.${currentFlippedChromosomes[i]} path#arc-label${currentFlippedChromosomes[i]}`)
      .style("stroke", "#ea4848")
      .style("stroke-width", "1px");
    // d3.select(`g.${currentFlippedChromosomes[i]}`).style("stroke", "#ea4848");
  }

  // Show best / saved layout checkbox
  let showBestPossibleLayout =
    d3.select("p.show-best-layout > input").property("checked");

  if (shouldUpdateLayout && showBestPossibleLayout) {
    const { currentPosition, key } = loopUpPositionCollisionsDictionary(dataChromosomes, dataChords);
    const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();

    showBestPossibleLayout = showBestPossibleLayout && currentPosition !== (-1);

    if (showBestPossibleLayout) {
      const { bestSolution } = savedCollisionSolutionsDictionary[key][currentPosition];

      console.log('FOUND LAYOUT: ', bestSolution);

      // Here I do not need to re-render if dataChromosomes and bestSolution are the same,
      // because I didn't modify the layout
      setTimeout(() => callSwapPositionsAnimation(dataChromosomes, bestSolution, false),
        DEFAULT_GENOME_TRANSITION_TIME * 2);
    }
  }

  // Save layout button
  d3.select(".save-layout > input")
    .on("click", function() {
      getBlockCollisions(dataChromosomes, dataChords).then((collisionCount) => {
        saveToCollisionsDictionary(dataChromosomes, collisionCount, dataChords);

        ReactDOM.unmountComponentAtNode(document.getElementById('alert-container'));
        ReactDOM.render(
          <AlertWithTimeout
            message={"The layout was successfully saved."}
          />,
          document.getElementById('alert-container')
        );
      });
    });

  // Reset layout button
  d3.select(".reset-layout > input")
    .on("click", function() {
      // Disable checkbox because resetting might lead to a worse solution
      d3.select('p.show-best-layout > input').property("checked", false);

      const localDataChromosomes = cloneDeep(dataChromosomes);
      const oldChromosomeOrder = toChromosomeOrder(localDataChromosomes);
      const currentChromosomeOrder = sortGffKeys(oldChromosomeOrder.slice()).slice();

      const orderedDataChromosomes = currentChromosomeOrder.map(function(currentChr) {
        const position = findIndex(localDataChromosomes, ['id', currentChr]);

        return cloneDeep(localDataChromosomes[position]);
      });

      myCircos.layout(localDataChromosomes, CIRCOS_CONF);
      myCircos.layout(orderedDataChromosomes, CIRCOS_CONF);

      console.log('OLD AND CURRENT: ', localDataChromosomes, orderedDataChromosomes);
      console.log('ORDERED DATA CHR: ', orderedDataChromosomes);

      setTimeout(() => callSwapPositionsAnimation(localDataChromosomes, orderedDataChromosomes),
        DEFAULT_GENOME_TRANSITION_TIME * 2);
    });
}

/**
 * Generates the genomeView using the current selected chromosomes
 * and the configuration
 *
 * @param  {boolean} shouldUpdateBlockCollisions True if should update block collisions
 *                                               in genome view, false otherwise
 * @param  {boolean} shouldUpdateLayout          True if Circos layout should be updated
 *                                               (i.e. chromosome order changed)
 * @param  {Object}  transition                  Current transition configuration
 * @return {undefined} undefined
 */
export default function generateGenomeView({
  shouldUpdateBlockCollisions,
  shouldUpdateLayout = true,
  transition
}) {
  // Default filtering select for block size
  const filterSelect = (d3.select('.filter-connections-div select') &&
    d3.select('.filter-connections-div select').property("value")) || 'At Least';

  // Default filtering value for block size
  const filterValue = (d3.select('.filter-connections-div #filter-block-size') &&
    d3.select('.filter-connections-div #filter-block-size').property("value")) || 1;

  // To keep track of the Show All input state
  const showAllChromosomes = d3.select("p.show-all > input").property("checked");

  const blockDictionary = getBlockDictionary();
  // Array that includes the keys from the blockDictionary
  const blockKeys = Object.keys(blockDictionary);

  const gffPositionDictionary = getGffDictionary();
  const selectedCheckbox = getSelectedCheckboxes();

  dataChords = []; // Emptying data chords array

  foundCurrentSelectedBlock = false;

  const oneToMany = selectedCheckbox.length === 1;
  const lookID = [];
  if (oneToMany) {
    // One to many relationships
    lookID.push(selectedCheckbox[0]);
  } else {
    // Many to many relationships
    for (let j = 0; j < selectedCheckbox.length; j++) {
      lookID.push(selectedCheckbox[j]);
    }
  }

  for (let i = 0; i < blockKeys.length; i++) {
    const currentBlock = blockKeys[i];

    // Only need to enter if current block is not currently removed
    if (currentRemovedBlocks.indexOf(currentBlock) === -1) {

      const IDs = fixSourceTargetCollinearity(blockDictionary[currentBlock][0]);
      const sourceID = IDs.source;
      const targetID = IDs.target;

      let shouldAddDataChord = false;
      if (oneToMany) {
        // For one to many
        // Either the source or the target needs to be currently selected
        // Unless Show All is not selected meaning that both source and target
        // need to be the same selected chromosome
        shouldAddDataChord = showAllChromosomes ?
          (lookID.indexOf(sourceID) > -1 || lookID.indexOf(targetID) > -1) :
          (lookID.indexOf(sourceID) > -1 && lookID.indexOf(targetID) > -1);
      } else {
        // For many to many all connections need to be between selected chromosomes
        shouldAddDataChord = lookID.indexOf(sourceID) > -1 && lookID.indexOf(targetID) > -1;
      }

      // Only add data chord if the filter condition is satisfied
      shouldAddDataChord = shouldAddDataChord && (
        (filterSelect === 'At Least' && blockDictionary[currentBlock].length >= filterValue) ||
        (filterSelect === 'At Most' && blockDictionary[currentBlock].length <= filterValue)
      );

      if (shouldAddDataChord) {
        const blockPositions = blockDictionary[currentBlock].blockPositions;

        const sourcePositions = {
          start: blockPositions.minSource,
          end: blockPositions.maxSource
        };
        const targetPositions = {
          start: blockPositions.minTarget,
          end: blockPositions.maxTarget
        };

        // Example for flipped chromosomes:
        // Positions -> 20-28, 1-13
        // newStart = lastChrPosition - (endBlock)
        // newEnd = lastChrPosition - (startBlock)
        // 28-28 = 0, 28-20 = 8
        // 28-13 = 15, 28-1 = 27

        // newStart = lastChrPosition - (endBlock)
        // newEnd = lastChrPosition - (startBlock)
        let tmpStart = 0;
        if (currentFlippedChromosomes.indexOf(sourceID) !== (-1)) {
          tmpStart = sourcePositions.start;

          sourcePositions.start = gffPositionDictionary[sourceID].end - sourcePositions.end;
          sourcePositions.end = gffPositionDictionary[sourceID].end - tmpStart;
        }

        if (currentFlippedChromosomes.indexOf(targetID) !== (-1)) {
          tmpStart = targetPositions.start;

          targetPositions.start = gffPositionDictionary[targetID].end - targetPositions.end;
          targetPositions.end = gffPositionDictionary[targetID].end - tmpStart;
        }

        dataChords.push({
          source: {
            id: sourceID,
            start: sourcePositions.start,
            end: sourcePositions.end,
            value: {
              id: currentBlock,
              length: blockPositions.blockLength,
              score: blockPositions.blockScore,
              eValue: blockPositions.blockEValue,
              isFlipped: blockPositions.isFlipped
            }
          },
          target: {
            id: targetID,
            start: targetPositions.start,
            end: targetPositions.end
          }
        });

        if (isEqual(dataChords[dataChords.length - 1], currentSelectedBlock)) {
          foundCurrentSelectedBlock = true;
        }
      }
    }
  }

  // Resetting currentSelectedBlock object back to default if no block is found
  if (!foundCurrentSelectedBlock && !isEmpty(currentSelectedBlock)) {
    console.log('HERE RESETTING!!!!');
    currentSelectedBlock = {};
  }

  // Updating the label showing the number of blocks
  updateBlockNumberHeadline(dataChords);

  d3.select(".best-guess > input")
    .on("click", function() {
      d3.select(this)
        .property("value", "Minimizing ...")
        .attr("disabled", true);

      // TODO: Workaround for this?
      setTimeout(() => {
        simulatedAnnealing(dataChromosomes, dataChords);

        d3.select(this)
          .property("value", "Minimize collisions")
          .attr("disabled", null);
      }, 50);
    });

  if (shouldUpdateLayout) {
    generateCircosLayout();
  }

  // Remove block view if user is filtering
  // and selected block is not present anymore
  // OR when the block is simply not present (because of view changes (e.g. flipping a chromosome))
  // NOTE: When filtering there is NO transition
  const condition = ((transition && !transition.shouldDo && !foundCurrentSelectedBlock) ||
      !foundCurrentSelectedBlock) &&
    !d3.select("body").select("#block-view-container").empty();

  const transitionRemove = (selectedCheckbox.length === 0 && !showAllChromosomes);

  transitionRemoveBlockView(condition,
    () => generatePathGenomeView({
      "shouldUpdateBlockCollisions": shouldUpdateBlockCollisions,
      "shouldUpdateLayout": shouldUpdateLayout,
      "transition": transition,
      "transitionRemove": transitionRemove
    }));
};
