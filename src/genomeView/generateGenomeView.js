/*
University of Saskatchewan
Course: CMPT994 - Research

AccuSyn: An Accurate Web-based Genome Synteny Browser
https://accusyn.usask.ca/

Name: Jorge Nunez Siri
E-mail: jorge.nunez@usask.ca

Function file: generateGenomeView.js

@2018-2019, Jorge Nunez Siri, All rights reserved
*/

import * as d3 from 'd3';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import defaultsDeep from 'lodash/defaultsDeep';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import forEach from 'lodash/forEach';
import findIndex from 'lodash/findIndex';

import { addActionToUndoManager, updateUndoRedoButtons } from './../vendor/undoManager';

import generateBlockView from './../generateBlockView';

import {
  assignFlippedChromosomeColors,
  calculateMiddleValue,
  flipGenesPosition,
  flipOrResetChromosomeOrder,
  flipValueAdditionalTrack,
  getChordsRadius,
  getInnerAndOuterRadiusAdditionalTracks,
  getSelectedCheckboxes,
  getTransformValuesAdditionalTracks,
  removeBlockView,
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
  getChordAngles,
  transitionFlipChromosomeStroke,
  transitionFlipping,
  updateBlockCollisionHeadline
} from './blockCollisions';

// Variable getters and setters
import { getBlockDictionary } from './../variables/blockDictionary';
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
import {
  getCurrentSelectedBlock,
  setCurrentSelectedBlock
} from './../variables/currentSelectedBlock';
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
  CONNECTION_COLORS,
  DEFAULT_GENOME_TRANSITION_TIME,
  FLIPPING_CHROMOSOME_TIME,
  GENOME_INNER_RADIUS,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME
} from './../variables/constants';

// Local variables
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
  // To keep track of when the block view is being removed
  let removingBlockView = false;

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
      gffKeys: getDefaultChromosomeOrder().slice()
    }));
  }

  const gffPositionDictionary = getGffDictionary();
  const currentChromosomeOrder = getCurrentChromosomeOrder();
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
export function getCurrentTrack(selectedTrack) {
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
    maxValue
  };
};

/**
 * Generates additional track from additional track array
 *
 * @param  {string}  trackName   Current custom name of the track
 * @param  {string}  trackRadius Radius to be used for the current track
 * @param  {string}  trackType   Type of track: heatmap, histogram, line, or scatter
 * @param  {string}  trackColor  Color of the track
 * @return {undefined} undefined
 */
function generateAdditionalTrack(trackName, trackRadius, trackType, trackColor) {
  const myCircos = getCircosObject();

  // Inner and outer radius
  const { inner: innerRadius, outer: outerRadius } = trackRadius;

  // Current track array and min/max values
  const { currentTrack, minValue, maxValue } = getCurrentTrack(trackName);

  const configuration = {
    innerRadius: innerRadius,
    outerRadius: outerRadius,
    logScale: false,
    color: trackColor,
    tooltipContent: function(d) {
      // Activate if SA is not running
      if (d3.select(".best-guess > button").attr("disabled")) return;
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

  const axes = [];
  if (trackType === 'histogram' || trackType === 'line' || trackType === 'scatter') {
    // Middle value
    const middleValue = calculateMiddleValue(minValue, maxValue);

    // Always pushing 5 axes
    axes.push({ position: roundFloatNumber(minValue, 2), thickness: 2 });
    axes.push({ position: roundFloatNumber(calculateMiddleValue(minValue, middleValue), 2), thickness: 2 });
    axes.push({ position: roundFloatNumber(middleValue, 2), thickness: 2 });
    axes.push({ position: roundFloatNumber(calculateMiddleValue(middleValue, maxValue), 2), thickness: 2 });
    axes.push({ position: roundFloatNumber(maxValue, 2), thickness: 2 });

    console.log('AXES: ', axes);

    configuration.axes = axes;
    // Showing axes tooltip by default
    configuration.showAxesTooltip = true;
  }

  if (trackType === 'scatter') {
    // Scatter points should have no stroke
    configuration.strokeColor = null;
    configuration.strokeWidth = 0;

    // Increasing the radius of the scatter points when having less than 6 chromosomes
    if (dataChromosomes.length < 6) configuration.size = 30;
  }

  // Adding an invisible scatter track in case of line track
  // To be able to use the tooltip
  if (trackType === 'line') {
    const configurationHidden = cloneDeep(configuration);
    // Using opacity 0 to hide the points and the axes
    configurationHidden.opacity = 0;
    // Removing tooltip from line track to only use it in scatter track
    configuration.tooltipContent = null;
    // Increasing strokeWidth
    configuration.thickness = 1.5;
    // Rendering hidden scatter track
    myCircos['scatter'](`${trackName}-scatter`, currentTrack, configurationHidden);
  }

  // Loading track
  myCircos[trackType](trackName, currentTrack, configuration);
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
        if (d3.select(".best-guess > button").attr("disabled")) return;

        // Disabling inputs and selects before calling the animation
        resetInputsAndSelectsOnAnimation(true);

        // Before flipping, set all chords with the same opacity
        d3.selectAll("path.chord").attr("opacity", 0.7);

        let currentFlippedChromosomes = getCurrentFlippedChromosomes().slice();

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
        transitionFlipping({
          currentChr: currentID,
          currentFlippedChromosomes: currentFlippedChromosomes,
          dataChromosomes: dataChromosomes
        });

        let shouldUpdateLayout = false;
        if (isAdditionalTrackAdded() ||
          d3.select("div.chromosomes-palette select").property("value") === 'Flipped') {
          // To update the chromosome colors or flip the additional tracks
          shouldUpdateLayout = true;
        }

        // Resetting chr mouse down because of flipping (contextmenu is not mousedown)
        setCurrentChromosomeMouseDown("");

        addActionToUndoManager(nodes[i], 'contextmenu');

        setTimeout(() => {
          // Enabling inputs and selects after calling the animation
          resetInputsAndSelectsOnAnimation();
          updateUndoRedoButtons();

          generateGenomeView({
            transition: { shouldDo: false },
            shouldUpdateBlockCollisions: true,
            shouldUpdateLayout: shouldUpdateLayout
          });
        }, FLIPPING_CHROMOSOME_TIME);
      },
      'mousedown.chr': function(d) {
        // Activate if SA is not running
        if (d3.select(".best-guess > button").attr("disabled")) return;

        setCurrentChromosomeMouseDown(d.id);
      }
    }
  };

  const darkMode = d3.select("p.dark-mode input").property("checked");
  d3.select("svg#genome-view")
    .classed("border border-light rounded-circle dark-mode", darkMode);

  if (!d3.select("#block-view-container").empty()) {
    d3.select("#block-view-container").classed("dark-mode", darkMode);
  }

  d3.select(".circos-tooltip").classed("dark-mode", darkMode);

  if (darkMode) {
    extraLayoutConfiguration.labels = {
      color: '#f3f3f3'
    };
  }

  // Generating layout configuration for the Circos plot
  myCircos.layout(dataChromosomes, defaultsDeep(extraLayoutConfiguration, cloneDeep(CIRCOS_CONF)));

  // Resetting tracks by removing all of them first by not sending
  // any trackID as parameter
  // Note: Anything except for the layout is a track on Circos, so this
  // also removes the chords track
  // Always calling the function, so when the last track gets deleted, it also
  // gets removed from genome view
  myCircos.removeTracks(); // This resets the tracks object inside Circos to empty object

  // Adding additional tracks
  if (isAdditionalTrackAdded()) {
    // Only adding the tracks that are available
    forEach(getInnerAndOuterRadiusAdditionalTracks().availableTracks, ({ name, radius, type, color }) =>
      generateAdditionalTrack(name, radius, type, color)
    );
  }

  // Adding the dragHandler to the svg after populating the dataChromosomes object
  addSvgDragHandler(cloneDeep(dataChromosomes));

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

  // Resetting current selected block to empty value
  setCurrentSelectedBlock("");
}

/**
 * Creates the unique id for each chord gradient
 * @param  {Object} d Current chord
 * @return {string}   Unique id
 */
function getGradID(d) {
  return `linkGrad-${d.source.id}-${d.target.id}-${d.source.value.id}`;
}

/**
 * Gets block color based on dropdown option
 *
 * @param  {string}  sourceID  Block source
 * @param  {string}  targetID  Block target
 * @param  {boolean} isFlipped Whether or not the block is flipped
 * @return {string}            Color value
 */
export function getBlockColor({
  sourceID,
  targetID,
  isFlipped
}) {
  // To keep track of the value of the selected block color
  const blocksColor = d3.select("div.blocks-color select").property("value");
  const gffPositionDictionary = getGffDictionary();

  let colorValue = CONNECTION_COLORS[blocksColor];
  if (blocksColor === 'Source') colorValue = gffPositionDictionary[sourceID].color;
  else if (blocksColor === 'Target') colorValue = gffPositionDictionary[targetID].color;
  // For flipped blocks, using deepskyblue and crimson colors (blue-ish and red-ish)
  else if (blocksColor === 'Flipped') colorValue = isFlipped ? '#dc143c' : '#00bfff';

  return colorValue;
};

/**
 * Generates all the chords and renders the Circos plot with the
 * current configuration
 *
 * @param  {boolean} shouldUpdateBlockCollisions True if should update block collisions
 *                                               in genome view, false otherwise
 * @param  {Object}  transition                  Current transition configuration
 * @param  {boolean} transitionRemove            True if Circos layout should be removed
 *                                               with transition
 * @return {undefined} undefined
 */
function generatePathGenomeView({
  shouldUpdateBlockCollisions,
  transition,
  transitionRemove
}) {
  // To keep track of the value of the selected block color
  const blocksColor = d3.select("div.blocks-color select").property("value");

  // To keep track of the value of highlight flipped blocks checkbox
  const highlightFlippedBlocks = d3.select("p.highlight-flipped-blocks input").property("checked");

  const myCircos = getCircosObject();

  const darkMode = d3.select("p.dark-mode input").property("checked");

  // Setting transition to default object if not defined at this point
  // NOTE: Default object is used each time that the genome view is rendered
  // Combined block color does not support transitions because of gradients
  if (transition == null && blocksColor !== 'Combined') {
    transition = {
      shouldDo: true,
      from: darkMode ? '#222222' : '#ffffff',
      time: DEFAULT_GENOME_TRANSITION_TIME
    };
  }

  // Updating the label showing the number of blocks and flipped blocks
  updateBlockNumberHeadline(dataChromosomes, dataChords);

  // Updating block collisions should happen if flag is true
  // (when filtering transitions are not happening and flag is true at the end of filtering)
  // It should also happen when transitions are true and flag is not defined
  // (it won't update if shouldDo is explicitly false)
  if (shouldUpdateBlockCollisions ||
    shouldUpdateBlockCollisions == null &&
      ((transition && transition.shouldDo) || blocksColor === 'Combined')) {
    updateBlockCollisionHeadline(dataChromosomes, dataChords);
  }

  const currentSelectedBlock = getCurrentSelectedBlock();

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
      let colorValue = getBlockColor({
        sourceID: d.source.id,
        targetID: d.target.id,
        isFlipped: d.source.value.isFlipped
      });

      if (colorValue === 'Combined') return `url(#${getGradID(d)})`;
      return colorValue;
    },
    tooltipContent: function(d) {
      // Activate if SA is not running
      if (d3.select(".best-guess > button").attr("disabled")) return;
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
        if (d3.select(".best-guess > button").attr("disabled")) return;

        unhighlightCurrentSelectedBlock();
      },
      'mouseover.block': function(d, i, nodes) {
        // Activate if SA is not running
        if (d3.select(".best-guess > button").attr("disabled")) return;

        // Only update block view if the user is not dragging
        // Note: Still need this, because we don't want to mouseover and highlight
        // when holding a chromosome
        const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
        if (!isEmpty(currentChromosomeMouseDown)) return;

        setCurrentSelectedBlock(d.source.value.id);

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
        if (d3.select(".best-guess > button").attr("disabled")) return;

        const blockToDelete = d.source.value.id;

        const confirming = confirm(`Are you sure you want to delete the block with ID "${blockToDelete}"?`);
        // Return if the user does not want to delete
        if (!confirming) return;

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

  // Adding a small delay to prevent blockView renders twice when
  // being called from dark mode input change function
  setTimeout(function() {
    // Updating block view using current selected block if block id is not empty
    if (!isEmpty(currentSelectedBlock)) {
      const currentPosition = findIndex(dataChords, ['source.value.id', currentSelectedBlock]);
      if (currentPosition !== (-1)) {
        const currentChord = dataChords[currentPosition];
        const gffPositionDictionary = getGffDictionary();

        // Checking if block view is empty (not present)
        // To avoid updating the block view when not necessary
        // i.e. when changing to multi-chr view and the currentSelectedBlock is still there
        let shouldUpdateBlockView = d3.select("#block-view-container").empty();
        if (!shouldUpdateBlockView) {
          const {
            source: { id: sourceID, value: { isFlipped } },
            target: { id: targetID }
          } = currentChord;

          const blockColor = getBlockColor({
            sourceID, targetID, isFlipped
          });

          console.log('BLOCK COLOR: ', blockColor);

          // If it is present, then checking if the block color is different from block view line color
          let currentBlockViewLineColor = d3.select("#block-view-container g.clip-block-group .line").attr("fill");
          console.log('currentBlockViewLineColor: ', currentBlockViewLineColor);
          let currentGenomeViewChordColor = blockColor;
          // If one of the colors is in gradient, then assume they are different and update the block view
          // NOTE: Gradient format is: url(#id)
          if (!currentBlockViewLineColor.startsWith('url') && currentGenomeViewChordColor !== 'Combined') {
            currentBlockViewLineColor = d3.color(currentBlockViewLineColor).hex();
            currentGenomeViewChordColor = d3.color(currentGenomeViewChordColor).hex();
          }

          // Checking if axis color are different from chromosomes color
          const currentAxisSourceColor =
            d3.color(d3.select("#block-view-container g.axisY0 path.domain").attr("fill")).hex();
          const currentAxisTargetColor =
            d3.color(d3.select("#block-view-container g.axisY1 path.domain").attr("fill")).hex();

          shouldUpdateBlockView = shouldUpdateBlockView ||
            currentBlockViewLineColor !== currentGenomeViewChordColor ||
            d3.color(gffPositionDictionary[sourceID].color).hex() !== currentAxisSourceColor ||
            d3.color(gffPositionDictionary[targetID].color).hex() !== currentAxisTargetColor;
        }

        if (shouldUpdateBlockView) generateBlockView(currentChord);
      }
    }
  }, 350);

  // Rendering Circos plot with current configuration
  if (transition && transition.shouldDo) {
    myCircos.render(undefined, undefined, transition, transitionRemove);

    if (transitionRemove) {
      // Removing the nodes inside genome view main-container if the view is being removed
      d3.select("#genome-view g.all").remove();
      // Turning off dark mode classes for the genome view
      d3.select("svg#genome-view")
        .classed("border border-light rounded-circle dark-mode", false);
    }
  } else {
    myCircos.render();
  }

  // Changing transform attribute based on the additional tracks
  const { rotate: currentRotate, scale: currentScale, translate: currentTranslate } =
    getTransformValuesAdditionalTracks();

  d3.select("svg#main-container g.all")
    .transition()
    .duration(200)
    .ease(d3.easeLinear)
    .attr("transform", `translate(${currentTranslate.width},${currentTranslate.height})
      scale(${currentScale})
      rotate(${currentRotate})`);

  // Making the last axis darker for each additional track block
  d3.selectAll('g.block').each(function() {
    // Choosing the path.axis inside each block
    const lastElement = d3.select(this).selectAll('path.axis').filter((d, i) => i === 4);
    if (lastElement) lastElement.attr("stroke", "#8c8c8c");
  });

  // Highlighting flipped blocks if checkbox is selected
  if (highlightFlippedBlocks) {
    const chromosomePalette = d3.select("div.chromosomes-palette select").property("value");
    const flippedColorBlock = d3.select("div.blocks-color select").property("value");
    const shouldChangeColor = (flippedColorBlock === 'Flipped' ||
      (flippedColorBlock === 'Combined' && chromosomePalette === 'Flipped') ||
      (flippedColorBlock === 'Source' && chromosomePalette === 'Flipped') ||
      (flippedColorBlock === 'Target' && chromosomePalette === 'Flipped'));

    const stroke = shouldChangeColor ? 'gold' : '#ea4848';

    d3.selectAll("path.chord.isFlipped")
      .attr("stroke", stroke)
      .attr("stroke-width", "2px");
  }

  // Changing flipped chromosomes highlighting based on checkbox
  const currentFlippedChromosomes = getCurrentFlippedChromosomes();
  for (let i = currentFlippedChromosomes.length - 1; i >= 0; i--) {
    transitionFlipChromosomeStroke(currentFlippedChromosomes[i]);
  }

  // Change chromosome order
  d3.select("div.change-chromosome-positions p.apply-button > input")
    .on("click", function() {
      const action = d3.select('.change-chromosome-positions select.flip-reset').property("value");
      const genome = d3.select('.change-chromosome-positions select.all-genomes').property("value");

      // Check if genome is available in current layout
      let foundGenome = false;
      for (let i = dataChromosomes.length - 1; i >= 0; i--) {
        const key = dataChromosomes[i].id.slice(0);
        if (getGffDictionary()[key].tag === genome) {
          foundGenome = true;
          break;
        }
      }

      // If not able to find genome, then show error
      if (!foundGenome) {
        // Showing alert using react
        renderReactAlert(`There are no chromosomes from genome "${genome}" in the current layout.`);
        return;
      }

      const localDataChromosomes = cloneDeep(dataChromosomes);

      // Flipping or resetting genome chromosomes in the current layout
      const chromosomeOrder = flipOrResetChromosomeOrder({
        action: action,
        genome: genome,
        chromosomeOrder: toChromosomeOrder(localDataChromosomes).slice()
      });

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

  // To keep track of the value of the selected block color
  const blocksColor = d3.select("div.blocks-color select").property("value");

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

  const { selectedCheckboxes } = getSelectedCheckboxes();

  if (shouldUpdateLayout) {
    generateCircosLayout();
  }

  const gffPositionDictionary = getGffDictionary();
  if (!d3.select("svg#main-container g.all defs").empty()) {
    d3.select("svg#main-container g.all defs").remove();
  }

  d3.select("svg#main-container g.all").append("defs");

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
  const currentSelectedBlock = getCurrentSelectedBlock();

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
      // If no self connections for genomes are allowed, only add current connection if source
      // and target are chromosomes from different genomes
      const sourceIdentifier = gffPositionDictionary[sourceID.slice(0)].tag;
      const targetIdentifier = gffPositionDictionary[targetID.slice(0)].tag;

      shouldAddDataChord = shouldAddDataChord && ((sourceIdentifier !== targetIdentifier) ||
        // Case for same chromosome that should be added
        // (unless no self connections for chromosomes are allowed)
        (sourceIdentifier === targetIdentifier && sourceID === targetID));
    }

    // Only add data chord if the filter condition is satisfied
    shouldAddDataChord = shouldAddDataChord && (
      (filterSelect === 'At Least' && blockDictionary[currentBlock].length >= filterValue) ||
      (filterSelect === 'At Most' && blockDictionary[currentBlock].length <= filterValue)
    );

    if (shouldAddDataChord) {
      const blockPositions = blockDictionary[currentBlock].blockPositions;
      const { blockLength, blockScore, blockEValue, isFlipped } = blockPositions;

      const { sourcePositions, targetPositions } = flipGenesPosition({
        blockPositions: blockPositions,
        currentFlippedChromosomes: currentFlippedChromosomes,
        sourceID: sourceID,
        targetID: targetID
      });

      const chordObject = {
        source: {
          id: sourceID,
          start: sourcePositions.start,
          end: sourcePositions.end,
          value: {
            id: currentBlock,
            length: blockLength,
            score: blockScore,
            eValue: blockEValue,
            isFlipped: isFlipped
          }
        },
        target: {
          id: targetID,
          start: targetPositions.start,
          end: targetPositions.end
        }
      };

      chordObject.source.angle = getChordAngles(dataChromosomes, chordObject, 'source');
      chordObject.target.angle = getChordAngles(dataChromosomes, chordObject, 'target');

      if (blocksColor === 'Combined') {
        // More info: https://www.visualcinnamon.com/2016/06/orientation-gradient-d3-chord-diagram
        // https://bl.ocks.org/nbremer/a23f7f85f30f5cd9e1e8602a5a4e6d75
        const sourceAngle = chordObject.source.angle.middle - Math.PI/2;
        const targetAngle = chordObject.target.angle.middle - Math.PI/2;
        const gradient = d3.select("svg#main-container g.all defs")
          .append("linearGradient")
          .attr("id", getGradID(chordObject))
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", function() {
            return GENOME_INNER_RADIUS * Math.cos(sourceAngle);
          })
          .attr("y1", function() {
            return GENOME_INNER_RADIUS * Math.sin(sourceAngle);
          })
          .attr("x2", function() {
            return GENOME_INNER_RADIUS * Math.cos(targetAngle);
          })
          .attr("y2", function() {
            return GENOME_INNER_RADIUS * Math.sin(targetAngle);
          });

        gradient.append("stop")
          .attr("offset", "5%")
          .attr("stop-color", function() {
            return gffPositionDictionary[chordObject.source.id].color;
          });

        gradient.append("stop")
          .attr("offset", "95%")
          .attr("stop-color", function() {
            return gffPositionDictionary[chordObject.target.id].color;
          });
      }

      dataChords.push(chordObject);

      // Only checking when variable is still false
      if (!foundCurrentSelectedBlock &&
          isEqual(chordObject.source.value.id, currentSelectedBlock)) {
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

  // Resetting currentSelectedBlock block id back to empty if no block is found
  if (!foundCurrentSelectedBlock && !isEmpty(currentSelectedBlock)) {
    console.log('HERE RESETTING!!!!');
    setCurrentSelectedBlock("");
  }

  // Remove block view if user is filtering
  // and selected block is not present anymore
  // OR when the block is simply not present (because of view changes (e.g. going to multi-chromosome view))
  // NOTE: When filtering there is NO transition
  const condition = ((transition && !transition.shouldDo && !foundCurrentSelectedBlock) ||
      !foundCurrentSelectedBlock) &&
    !d3.select("#block-view-container").empty();

  const transitionRemove = (selectedCheckboxes.length === 0 && !showAllChromosomes);

  transitionRemoveBlockView(condition, () => generatePathGenomeView({
    shouldUpdateBlockCollisions: shouldUpdateBlockCollisions,
    transition: transition,
    transitionRemove: transitionRemove
  }));
};
