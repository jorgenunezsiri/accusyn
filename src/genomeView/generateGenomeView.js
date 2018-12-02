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

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import defaultsDeep from 'lodash/defaultsDeep';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import findIndex from 'lodash/findIndex';

import generateBlockView, { resetZoomBlockView } from './../generateBlockView';

import {
  assignFlippedChromosomeColors,
  calculateMiddleValue,
  flipGenesPosition,
  flipOrResetChromosomeOrder,
  flipValueAdditionalTrack,
  getChordsRadius,
  getInnerAndOuterRadiusAdditionalTracks,
  getFlippedGenesPosition,
  getSelectedCheckboxes,
  getTransformValuesAdditionalTracks,
  removeBlockView,
  removeNonLettersFromString,
  resetInputsAndSelectsOnAnimation,
  renderReactAlert,
  roundFloatNumber,
  updateBlockNumberHeadline
} from './../helpers';

import {
  addSvgDragHandler,
  generateDraggingAnglesDictionary
} from './dragging';

import {
  callSwapPositionsAnimation,
  disableShowSavedLayout,
  saveToCollisionsDictionary,
  simulatedAnnealing,
  transitionFlipChromosomeStroke,
  transitionFlipping,
  updateBlockCollisionHeadline
} from './blockCollisions';

// Variable getters and setters
import { getBlockDictionary } from './../variables/blockDictionary';
import {
  getCollisionCount,
  getCollisionCalculationTime,
  getTotalNumberOfIterations
} from './../variables/collisionCount';
import {
  getCurrentChromosomeMouseDown,
  setCurrentChromosomeMouseDown
} from './../variables/currentChromosomeMouseDown';
import {
  getCurrentChromosomeOrder,
  getDefaultChromosomeOrder,
  toChromosomeOrder
} from './../variables/currentChromosomeOrder';
import {
  getCurrentFlippedChromosomes,
  setCurrentFlippedChromosomes
} from './../variables/currentFlippedChromosomes';
import { generateUpdatedDataChromosomesFromOrder } from './../variables/dataChromosomes';
import {
  getGffDictionary,
  setGffDictionary
} from './../variables/gffDictionary';
import {
  getAdditionalTrackArray,
  isAdditionalTrackAdded
} from './../variables/additionalTrack';
import { getCircosObject } from './../variables/myCircos';

// Contants
import {
  CATEGORICAL_COLOR_SCALES,
  CIRCOS_CONF,
  CONNECTION_COLOR,
  DEFAULT_BLOCK_VIEW_ZOOM_STATE,
  DEFAULT_GENOME_TRANSITION_TIME,
  FLIPPING_CHROMOSOME_TIME,
  GENOME_INNER_RADIUS,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME,
  WIDTH,
  HEIGHT
} from './../variables/constants';

// Local variables
let currentSelectedBlock = null; // To store the block id of the current selected block
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
  const { selectedCheckboxes } = getSelectedCheckboxes();

  // To keep track of the Show All input state
  const showAllChromosomes = d3.select("p.show-all input").property("checked");

  const dataChromosomes = []; // Local data chromosomes array

  if (d3.select("div.chromosomes-palette select").property("value") === 'Flipped') {
    // Coloring flipped chromosomes
    setGffDictionary(assignFlippedChromosomeColors({
      colorScale: d3.scaleOrdinal(CATEGORICAL_COLOR_SCALES['Flipped']).domain([0, 1]),
      currentFlippedChromosomes: getCurrentFlippedChromosomes().slice(),
      gffKeys: getDefaultChromosomeOrder().slice(),
      gffPositionDictionary: cloneDeep(getGffDictionary())
    }));
  }

  const gffPositionDictionary = getGffDictionary();
  let currentChromosomeOrder = getCurrentChromosomeOrder();
  const currentChromosomeOrderLength = currentChromosomeOrder.length;

  // Using currentChromosomeOrder array to add selected chromosomes to the genome view
  for (let i = 0; i < currentChromosomeOrderLength; i++) {
    const key = currentChromosomeOrder[i].slice(0);

    const currentObj = {
      color: gffPositionDictionary[key].color,
      label: key,
      // Chromosome width / length.
      // Should be equal to the maximum end point, so that chords show accurately
      len: gffPositionDictionary[key].end,
      id: key
    };

    if (showAllChromosomes) {
      // All the chromosomes will show
      dataChromosomes.push(currentObj);
    } else {
      if (selectedCheckboxes.indexOf(key) > -1) {
        // If current chromosome is selected and showAllChromosomes is
        // not selected, then add it
        dataChromosomes.push(currentObj);
      }
    }
  }

  return cloneDeep(dataChromosomes);
}

/**
 * Get current track array and position by only selecting chromosomes from dataChromosomes
 *
 * @param  {string} selectedTrack Selected track name
 * @return {Object} Current track array and position
 */
function getCurrentTrack(selectedTrack) {
  const additionalTrackArray = getAdditionalTrackArray();
  console.log('ADDITIONAL TRACK ARRAY: ', additionalTrackArray);

  let selectedTrackPosition = findIndex(additionalTrackArray, ['name', selectedTrack]);
  console.log('selectedTrackPosition: ', selectedTrackPosition);
  if (selectedTrackPosition === (-1)) selectedTrackPosition = 0;

  // Adding current track by only selecting chromosomes from dataChromosomes
  const currentTrackDictionary = cloneDeep(additionalTrackArray[selectedTrackPosition].data).reduce(
    function(dataInside, currentChr) {
      const currentId = currentChr['block_id'];
      const position = findIndex(dataChromosomes, ['id', currentId]);
      if (position !== (-1)) {
        if (!(currentId in dataInside)) dataInside[currentId] = [];
        dataInside[currentId].push(currentChr);
      }

      return dataInside;
    }, {});

  const currentFlippedChromosomes = getCurrentFlippedChromosomes();
  let maxValue = 0, minValue = Number.MAX_SAFE_INTEGER;

  console.log('CURRENT TRACK Dictionary: ', currentTrackDictionary);
  const allKeysInDictionary = Object.keys(currentTrackDictionary);
  const allKeysInDictionaryLength = allKeysInDictionary.length;
  console.log('OBJECT KEYS DICT: ', allKeysInDictionary);
  const currentTrack = []; // To insert all the tracks for all the chromosomes
  for (let i = 0; i < allKeysInDictionaryLength; i++) {
    const currentKey = allKeysInDictionary[i];
    let currentKeyArray = cloneDeep(currentTrackDictionary[currentKey]);
    // Flipping the content of the track if necessary
    if (currentFlippedChromosomes.indexOf(currentKey) > (-1)) {
      currentKeyArray = flipValueAdditionalTrack(currentKeyArray);

      console.log('REVERSED: ', currentKey, currentKeyArray);
    }

    const currentKeyArrayLength = currentKeyArray.length;
    // Getting min and max values for current view only
    for (let j = 0; j < currentKeyArrayLength; j++) {
      currentTrack.push(currentKeyArray[j]);
      const value = currentKeyArray[j].value;

      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    }
  }

  console.log('CURRENT TRACK TOTAL: ', currentTrack);

  return {
    currentTrack,
    minValue,
    maxValue,
    selectedTrackPosition
  };
}

/**
 * Generates additional track from additional track array
 *
 * @param  {string}    trackName Current trackName
 * @return {undefined} undefined
 */
function generateAdditionalTrack(trackName) {
  const myCircos = getCircosObject();

  const selectedTrack = !d3.select(`div.${trackName}-track-input select`).empty() &&
    d3.select(`div.${trackName}-track-input select`).property("value");

  // Resetting heatmap or histogram by removing it first
  myCircos.removeTracks(trackName);

  if (selectedTrack !== 'None') {
    const trackColor = (!d3.select(`div.${trackName}-track-color select`).empty() &&
      d3.select(`div.${trackName}-track-color select`).property("value")) || 'YlOrRd';

    // Inner and outer radius
    const { innerRadius, outerRadius } = getInnerAndOuterRadiusAdditionalTracks()[trackName];
    // Current track array and position
    const { currentTrack, minValue, maxValue, selectedTrackPosition } = getCurrentTrack(selectedTrack);

    const configuration = {
      innerRadius: innerRadius,
      outerRadius: outerRadius,
      logScale: false,
      color: trackColor,
      tooltipContent: function(d) {
        // Activate if SA is not running
        if (d3.select(".best-guess > input").attr("disabled")) return;
        // Only show tooltip if the user is not dragging
        // Note: Still need this, because we don't want to view the tooltip when
        // holding a chromosome
        const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
        if (!isEmpty(currentChromosomeMouseDown)) return;

        const { block_id, start, end, value } = d;
        const { showStart: startPosition = start, showEnd: endPosition = end } = d;

        return `<h6><u>Bin information</u></h6>
          <h6>Chromosome: ${block_id}</h6>
          <h6>Start: ${d3.format(",")(startPosition)}</h6>
          <h6>End: ${d3.format(",")(endPosition)}</h6>
          <h6>Value: ${d3.format(",")(value)}</h6>`;
      }
    };

    if (trackName === 'heatmap') {
      // Loading heatmap
      myCircos.heatmap('heatmap', currentTrack, configuration);
    } else if (trackName === 'histogram') {
      // Middle value
      const middleValue = calculateMiddleValue(minValue, maxValue);

      const axes = []; // Always pushing 5 axes
      axes.push({ position: roundFloatNumber(minValue, 2), thickness: 2 });
      axes.push({ position: roundFloatNumber(calculateMiddleValue(minValue, middleValue), 2), thickness: 2 });
      axes.push({ position: roundFloatNumber(middleValue, 2), thickness: 2 });
      axes.push({ position: roundFloatNumber(calculateMiddleValue(middleValue, maxValue), 2), thickness: 2 });
      axes.push({ position: roundFloatNumber(maxValue, 2), thickness: 2 });

      console.log('AXES: ', axes);

      configuration.axes = axes;
      configuration.showAxesTooltip = true; // Showing axes tooltip by default

      // Loading histogram
      myCircos.histogram('histogram', currentTrack, configuration);
    }
  }
}

/**
 * Generates Circos layout from chromosome data
 *
 * @return {undefined} undefined
 */
function generateCircosLayout() {
  const myCircos = getCircosObject();

  dataChromosomes = getDataChromosomes();

  let extraLayoutConfiguration = {
    events: {
      'contextmenu.chr': function(d, i, nodes, event) {
        // To prevent default right click action
        event.preventDefault();

        // Activate if SA is not running
        if (d3.select(".best-guess > input").attr("disabled")) return;

        // Disabling inputs and selects before calling the animation
        resetInputsAndSelectsOnAnimation(true);

        // Disable checkbox if there is a saved layout for the current configuration
        disableShowSavedLayout(dataChromosomes, dataChords);

        // Before flipping, set all chords with the same opacity
        d3.selectAll("path.chord").attr("opacity", 0.7);

        let currentFlippedChromosomes = getCurrentFlippedChromosomes();

        const currentID = d.id; // Current chromosome ID

        const currentPosition = currentFlippedChromosomes.indexOf(currentID);

        // If chromosome id is present, then remove it
        if (currentPosition !== (-1)) {
          currentFlippedChromosomes.splice(currentPosition, 1);
        } else {
          currentFlippedChromosomes.push(currentID);
        }

        console.log('CURRENT FLIPPED CHR: ', currentFlippedChromosomes);

        setCurrentFlippedChromosomes(currentFlippedChromosomes);

        // Call flipping function emphasizing the flipped blocks only
        const affectedBlocks = transitionFlipping({
          currentChr: currentID,
          currentFlippedChromosomes: currentFlippedChromosomes,
          dataChromosomes: dataChromosomes
        });

        const affectedBlocksLength = affectedBlocks.length;
        // Resetting zoom state object for all affected chords
        for (let j = 0; j < affectedBlocksLength; j++) {
          resetZoomBlockView(affectedBlocks[j]);
        }

        let shouldUpdateLayout = false;
        if (isAdditionalTrackAdded() ||
          d3.select("div.chromosomes-palette select").property("value") === 'Flipped') {
          // To update the chromosome colors or flip the additional tracks
          shouldUpdateLayout = true;
        }

        // Resetting chr mouse down because of flipping (contextmenu is not mousedown)
        setCurrentChromosomeMouseDown("");

        setTimeout(() => {
          // Enabling inputs and selects after calling the animation
          resetInputsAndSelectsOnAnimation();

          generateGenomeView({
            transition: { shouldDo: false },
            shouldUpdateBlockCollisions: true,
            shouldUpdateLayout: shouldUpdateLayout
          });
        }, FLIPPING_CHROMOSOME_TIME);
      },
      'mousedown.chr': function(d) {
        // Activate if SA is not running
        if (d3.select(".best-guess > input").attr("disabled")) return;

        setCurrentChromosomeMouseDown(d.id);
      }
    }
  };

  const darkMode = d3.select("p.dark-mode input").property("checked");
  d3.select("svg#genome-view")
    .classed("border border-light rounded-circle dark-mode", darkMode);

  if (d3.select("#block-view-container")) {
    d3.select("#block-view-container")
      .classed("dark-mode", darkMode);
  }

  d3.select(".circos-tooltip")
    .classed("dark-mode", darkMode);

  if (darkMode) {
    extraLayoutConfiguration.labels = {
      color: '#ffffff'
    };
  }

  // Generating layout configuration for the Circos plot
  myCircos.layout(dataChromosomes, defaultsDeep(extraLayoutConfiguration, cloneDeep(CIRCOS_CONF)));

  // Adding additional tracks
  if (isAdditionalTrackAdded()) {
    generateAdditionalTrack('heatmap');
    generateAdditionalTrack('histogram');
  }

  // Adding the dragHandler to the svg after populating the dataChromosomes object
  addSvgDragHandler(cloneDeep(dataChromosomes), cloneDeep(dataChords));

  // Generating dragging angles dictionary for each chromosome
  generateDraggingAnglesDictionary(cloneDeep(dataChromosomes));
}

/**
 * Unhighlights current selected block
 *
 * @return {undefined} undefined
 */
function unhighlightCurrentSelectedBlock() {
  // Hide tooltip
  d3.select('.circos-tooltip')
    .transition()
    .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
    .ease(d3.easeLinear)
    .style("opacity", 0);

  // Setting opacity 0.7 to all chords
  d3.selectAll('path.chord')
    .transition()
    .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
    .ease(d3.easeLinear)
    .attr("opacity", 0.7);

  // Removing block view
  removeBlockView(REMOVE_BLOCK_VIEW_TRANSITION_TIME);

  // Resetting current selected block to null value
  currentSelectedBlock = null;
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
  const coloredBlocks = d3.select("p.color-blocks input").property("checked");
  const gffPositionDictionary = getGffDictionary();

  // To keep track of the value of highlight flipped blocks checkbox
  const highlightFlippedBlocks = d3.select("p.highlight-flipped-blocks input").property("checked");

  // To keep track of the value of highlight flipped chromosomes checkbox
  const highlightFlippedChromosomes = d3.select("p.highlight-flipped-chromosomes input").property("checked");

  const myCircos = getCircosObject();

  const darkMode = d3.select("p.dark-mode input").property("checked");

  // Setting transition to default object if not defined at this point
  // NOTE: Default object is used each time that the genome view is rendered
  if (transition == null) {
    transition = {
      shouldDo: true,
      from: darkMode ? '222222' : '#ffffff',
      time: DEFAULT_GENOME_TRANSITION_TIME
    };
  }

  // Updating the label showing the number of blocks and flipped blocks
  updateBlockNumberHeadline(dataChromosomes, dataChords);

  // TODO: Think more about this condition
  // Updating block collisions should happen if flag is true
  // (when filtering transitions are not happening and flag is true at the end of filtering)
  // It should also happen when transitions are true and flag is not defined
  if (shouldUpdateBlockCollisions ||
    shouldUpdateBlockCollisions == null && (transition && transition.shouldDo)) {
    updateBlockCollisionHeadline(dataChromosomes, dataChords, shouldUpdateLayout);
  }

  // Adding the configuration for the Circos chords using the generated array
  const radius = getChordsRadius();
  myCircos.chords('chords', dataChords, {
    radius: radius === GENOME_INNER_RADIUS ? null : radius,
    logScale: false,
    opacity: function(d) {
      if (foundCurrentSelectedBlock) {
        if (isEqual(d.source.value.id, currentSelectedBlock)) {
          d3.select(this).raise();
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
      // Activate if SA is not running
      if (d3.select(".best-guess > input").attr("disabled")) return;
      // Only show tooltip if the user is not dragging
      // Note: Still need this, because we don't want to view the tooltip when
      // holding a chromosome
      const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
      if (!isEmpty(currentChromosomeMouseDown)) return;

      const { id: sourceID } = d.source;
      const { id: targetID } = d.target;
      const { id: blockID, score, eValue, length, isFlipped } = d.source.value;
      return `<h6>${sourceID} ➤ ${targetID}</h6>
        <h6><u>Block information</u></h6>
        <h6>ID: ${d3.format(",")(blockID)}</h6>
        <h6>Score: ${d3.format(",")(score)}</h6>
        <h6>E-value: ${eValue}</h6>
        <h6>Size: ${d3.format(",")(length)}</h6>
        <h6>Flipped: ${(isFlipped ? "Yes" : "No")}</h6>`;
    },
    events: {
      'click.block': function() {
        // Activate if SA is not running
        if (d3.select(".best-guess > input").attr("disabled")) return;

        unhighlightCurrentSelectedBlock();
      },
      'mouseover.block': function(d, i, nodes) {
        // Activate if SA is not running
        if (d3.select(".best-guess > input").attr("disabled")) return;

        // Only update block view if the user is not dragging
        // Note: Still need this, because we don't want to mouseover and highlight
        // when holding a chromosome
        const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
        if (!isEmpty(currentChromosomeMouseDown)) return;

        currentSelectedBlock = d.source.value.id;

        d3.selectAll(nodes).attr("opacity", 0.7);

        if (d3.selectAll(nodes).attr("opacity") != 0.3) {
          d3.selectAll(nodes).attr("opacity", 0.3);
          d3.select(nodes[i]).raise().attr("opacity", 0.9);
        }

        // Showing block view for current block
        generateBlockView(d);
      },
      'contextmenu.block': function(d, i, nodes, event) {
        // To prevent default right click action
        event.preventDefault();

        // Activate if SA is not running
        if (d3.select(".best-guess > input").attr("disabled")) return;

        unhighlightCurrentSelectedBlock();

        // Hiding and removing node when right clicking block
        d3.select(nodes[i])
          .raise()
          .transition()
          .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
          .ease(d3.easeLinear)
          .style("opacity", 0)
          .remove();

        const { id: currentID } = d.source.value;
        const currentPosition = findIndex(dataChords, ['source.value.id', currentID]);

        console.log('REMOVING ID: ', currentID);

        if (currentPosition !== (-1)) {
          dataChords.splice(currentPosition, 1);
        }

        // Pushing block id to array to keep track
        currentRemovedBlocks.push(currentID);

        // Updating block number
        updateBlockNumberHeadline(dataChromosomes, dataChords);

        // Updating collision headline
        updateBlockCollisionHeadline(dataChromosomes, dataChords);
      }
    }
  });

  // Updating block view using current selected block if not empty
  if (!isEmpty(currentSelectedBlock)) {
    const currentPosition = findIndex(dataChords, ['source.value.id', currentSelectedBlock]);
    if (currentPosition !== (-1)) generateBlockView(dataChords[currentPosition]);
  }

  // Rendering Circos plot with current configuration
  if (transition && transition.shouldDo) {
    myCircos.render(undefined, undefined, transition, transitionRemove);
  } else {
    myCircos.render();
  }

  // Changing transform attribute based on the additional tracks
  const { rotate: currentRotate, scale: currentScale, translate: currentTranslate } =
    getTransformValuesAdditionalTracks();

  d3.select("g.all")
    .attr("transform", `scale(${currentScale})
      translate(${currentTranslate.width},${currentTranslate.height})
      rotate(${currentRotate})`);

  // Highlighting flipped blocks if checkbox is selected
  if (highlightFlippedBlocks) {
    d3.selectAll("path.chord.isFlipped")
      .style("stroke", "#ea4848")
      .style("stroke-width", "2px");
  }

  // Changing flipped chromosomes highlighting based on checkbox
  const currentFlippedChromosomes = getCurrentFlippedChromosomes();
  for (let i = currentFlippedChromosomes.length - 1; i >= 0; i--) {
    transitionFlipChromosomeStroke(currentFlippedChromosomes[i], highlightFlippedChromosomes);
  }

  // Save layout button
  d3.select(".save-layout > input")
    .on("click", function() {
      const collisionCount = getCollisionCount();
      const currentFlippedChromosomes = getCurrentFlippedChromosomes();

      saveToCollisionsDictionary({
        bestFlippedChromosomes: currentFlippedChromosomes,
        bestSolution: dataChromosomes,
        collisionCount: collisionCount,
        dataChords: dataChords
      });

      // Showing alert using react
      renderReactAlert("The layout was successfully saved.", "success");
    });

  // Reset layout button
  d3.select(".reset-layout > input")
    .on("click", function() {
      // Disable checkbox if there is a saved layout for the current configuration
      disableShowSavedLayout(dataChromosomes, dataChords);

      const localDataChromosomes = cloneDeep(dataChromosomes);
      const orderedDataChromosomes =
        generateUpdatedDataChromosomesFromOrder(getDefaultChromosomeOrder().slice(), localDataChromosomes);

      // To introduce start and end properties into dataChromosomes
      myCircos.layout(localDataChromosomes, CIRCOS_CONF);
      myCircos.layout(orderedDataChromosomes, CIRCOS_CONF);

      console.log('OLD AND CURRENT: ', localDataChromosomes, orderedDataChromosomes);
      console.log('ORDERED DATA CHR: ', orderedDataChromosomes);

      callSwapPositionsAnimation({
        dataChromosomes: localDataChromosomes,
        bestSolution: orderedDataChromosomes,
        bestFlippedChromosomes: [] // No flipped chromosomes in the default view
      });
    });

  // Change chromosome order
  d3.select("div.change-chromosome-positions p.apply-button > input")
    .on("click", function() {
      const action = d3.select('.change-chromosome-positions select.flip-reset').property("value");
      const genome = d3.select('.change-chromosome-positions select.all-genomes').property("value");

      // Check if genome is available in current layout
      let foundGenome = false;
      for (let i = dataChromosomes.length - 1; i >= 0; i--) {
        const key = dataChromosomes[i].id;
        if (removeNonLettersFromString(key) === genome) {
          foundGenome = true;
          break;
        }
      }

      // If not able to find genome, then show error
      if (!foundGenome) {
        // Showing alert using react
        renderReactAlert(`There are no chromosomes from genome ${genome} in the current layout.`);
        return;
      }

      const localDataChromosomes = cloneDeep(dataChromosomes);

      // Flipping or resetting genome chromosomes in the current layout
      const chromosomeOrder = flipOrResetChromosomeOrder({
        action: action,
        genome: genome,
        chromosomeOrder: toChromosomeOrder(localDataChromosomes).slice()
      });

      // Disable checkbox if there is a saved layout for the current configuration
      disableShowSavedLayout(dataChromosomes, dataChords);

      const updatedDataChromosomes =
        generateUpdatedDataChromosomesFromOrder(chromosomeOrder, localDataChromosomes);

      // To introduce start and end properties into dataChromosomes
      myCircos.layout(localDataChromosomes, CIRCOS_CONF);
      myCircos.layout(updatedDataChromosomes, CIRCOS_CONF);

      console.log('OLD AND CURRENT: ', localDataChromosomes, updatedDataChromosomes);
      console.log('UPDATED DATA CHR: ', updatedDataChromosomes);

      callSwapPositionsAnimation({
        dataChromosomes: localDataChromosomes,
        bestSolution: updatedDataChromosomes,
        bestFlippedChromosomes: getCurrentFlippedChromosomes().slice()
      });
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
  const filterSelect = (!d3.select('.filter-connections-div select').empty() &&
    d3.select('.filter-connections-div select').property("value")) || 'At Least';

  // Default filtering value for block size
  const filterValue = Number(!d3.select('.filter-connections-div #filter-block-size').empty() &&
    d3.select('.filter-connections-div #filter-block-size').property("value")) || 1;

  // To keep track of the Show all input state
  const showAllChromosomes = d3.select("p.show-all input").property("checked");

  // To keep track of the Show self connections input state for chromosomes
  const showSelfConnectionsChr = d3.select("p.show-self-connections-chr input").property("checked");

  // To keep track of the Show self connections input state for genomes
  const showingMultipleChromosomes = !d3.select("p.show-self-connections-genome input").empty();
  const showSelfConnectionsGenome =  showingMultipleChromosomes &&
    d3.select("p.show-self-connections-genome input").property("checked");

  console.log('SHOW SELF CONECTIONS: ', showSelfConnectionsChr, showSelfConnectionsGenome);

  const blockDictionary = getBlockDictionary();
  // Array that includes the keys from the blockDictionary
  const blockKeys = Object.keys(blockDictionary);

  const gffPositionDictionary = getGffDictionary();
  const { selectedCheckboxes } = getSelectedCheckboxes();

  dataChords = []; // Emptying data chords array

  foundCurrentSelectedBlock = false;

  const oneToMany = selectedCheckboxes.length === 1;
  const lookID = [];
  if (oneToMany) {
    // One to many relationships
    lookID.push(selectedCheckboxes[0]);
  } else {
    // Many to many relationships
    lookID.push(...selectedCheckboxes);
  }

  const currentFlippedChromosomes = getCurrentFlippedChromosomes();

  for (let i = 0, blockKeysLength = blockKeys.length; i < blockKeysLength; i++) {
    const currentBlock = blockKeys[i];

    // Only need to enter if current block is not currently removed
    if (currentRemovedBlocks.indexOf(currentBlock) > (-1)) continue;

    const sourceID = blockDictionary[currentBlock][0].sourceChromosome; // Source chromosome
    const targetID = blockDictionary[currentBlock][0].targetChromosome; // Target chromosome

    let shouldAddDataChord = false;
    if (oneToMany) {
      // For one to many
      // Either the source or the target needs to be currently selected
      // Unless Show all is not selected meaning that both source and target
      // need to be the same selected chromosome
      shouldAddDataChord = showAllChromosomes ?
        (lookID.indexOf(sourceID) > -1 || lookID.indexOf(targetID) > -1) :
        (lookID.indexOf(sourceID) > -1 && lookID.indexOf(targetID) > -1);
    } else {
      // For many to many all connections need to be between selected chromosomes
      shouldAddDataChord = lookID.indexOf(sourceID) > -1 && lookID.indexOf(targetID) > -1;
    }

    if (!showSelfConnectionsChr) {
      // If no self connections for chromosomes are allowed, only add current connection if source
      // and target are different chromosomes
      shouldAddDataChord = shouldAddDataChord && (sourceID !== targetID);
    }

    if (showingMultipleChromosomes && !showSelfConnectionsGenome) {
      // If no self connections for chromosomes are allowed, only add current connection if source
      // and target are chromosomes from different genomes
      const sourceIdentifier = removeNonLettersFromString(sourceID.slice(0));
      const targetIdentifier = removeNonLettersFromString(targetID.slice(0));

      shouldAddDataChord = shouldAddDataChord && ((sourceIdentifier !== targetIdentifier) ||
        (sourceIdentifier === targetIdentifier && sourceID === targetID));
    }

    // Only add data chord if the filter condition is satisfied
    shouldAddDataChord = shouldAddDataChord && (
      (filterSelect === 'At Least' && blockDictionary[currentBlock].length >= filterValue) ||
      (filterSelect === 'At Most' && blockDictionary[currentBlock].length <= filterValue)
    );

    if (shouldAddDataChord) {
      const blockPositions = blockDictionary[currentBlock].blockPositions;

      const { sourcePositions, targetPositions } = flipGenesPosition({
        blockPositions: blockPositions,
        currentFlippedChromosomes: currentFlippedChromosomes,
        sourceID: sourceID,
        targetID: targetID
      });

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

      // Only checking when variable is still false
      if (!foundCurrentSelectedBlock &&
          isEqual(dataChords[dataChords.length - 1].source.value.id, currentSelectedBlock)) {
        foundCurrentSelectedBlock = true;
      }
    }
  }

  console.log('DATA CHORDS: ', dataChords);

  // Sorting the chords according to the drawing order
  const filterDrawOrder = (!d3.select('div.draw-blocks-order select').empty() &&
    d3.select('div.draw-blocks-order select').property("value")) || 'Block ID (↑)';

  dataChords.sort(function compare(a, b) {
    let countA, countB;
    if (filterDrawOrder === 'Block ID (↑)' || filterDrawOrder === 'Block ID (↓)') {
      countA = Number(a.source.value.id);
      countB = Number(b.source.value.id);
    } else if (filterDrawOrder === 'Block length (↑)' || filterDrawOrder === 'Block length (↓)') {
      countA = Number(a.source.value.length);
      countB = Number(b.source.value.length);
    }

    if (filterDrawOrder === 'Block ID (↑)' || filterDrawOrder === 'Block length (↑)') {
      // Sorting in ascending order to draw the lengthy chords or the chords
      // with bigger ID at the end
      if (countA < countB) return -1;
      if (countA > countB) return 1;
    } else if (filterDrawOrder === 'Block ID (↓)' || filterDrawOrder === 'Block length (↓)') {
      // Sorting in descending order to draw the lengthy chords or the chords
      // with bigger ID at the beginning
      if (countA > countB) return -1;
      if (countA < countB) return 1;
    }

    return 0;
  });

  // Resetting currentSelectedBlock object back to default if no block is found
  if (!foundCurrentSelectedBlock && !isEmpty(currentSelectedBlock)) {
    console.log('HERE RESETTING!!!!');
    currentSelectedBlock = null;
  }

  d3.select(".best-guess > input")
    .on("click", function() {
      const totalTime = getCollisionCalculationTime();
      const totalNumberOfIterations = getTotalNumberOfIterations();
      const finalTime = roundFloatNumber(totalTime * totalNumberOfIterations, 2);

      let confirming = true;
      // Taking the calculated time string from the hint
      const timeString = d3.select(".filter-sa-hint").text().split("-")[0].trim();
      if (finalTime > 120) {
        confirming = confirm(`Are you willing to wait at least ${timeString} for the calculation to finish?`);
      }

      if (confirming) {
        d3.select(this)
          .property("value", "Minimizing ...")
          .attr("disabled", true);

        // TODO: Workaround for this 50 timeout?
        setTimeout(() => simulatedAnnealing(dataChromosomes, dataChords), 50);
      }
    });

  // Remove block view if user is filtering
  // and selected block is not present anymore
  // OR when the block is simply not present (because of view changes (e.g. going to multi-chromosome view))
  // NOTE: When filtering there is NO transition
  const condition = ((transition && !transition.shouldDo && !foundCurrentSelectedBlock) ||
      !foundCurrentSelectedBlock) &&
    !d3.select("#block-view-container").empty();

  const transitionRemove = (selectedCheckboxes.length === 0 && !showAllChromosomes);

  transitionRemoveBlockView(condition, function callBackAfterRemovingBlockView() {
    if (shouldUpdateLayout) {
      generateCircosLayout();
    }

    generatePathGenomeView({
      shouldUpdateBlockCollisions: shouldUpdateBlockCollisions,
      shouldUpdateLayout: shouldUpdateLayout,
      transition: transition,
      transitionRemove: transitionRemove
    });
  });
};
