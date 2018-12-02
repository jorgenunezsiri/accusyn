import * as d3 from 'd3';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import AlertWithTimeout from './reactComponents/Alert';

import UAParser from 'ua-parser-js';

import cloneDeep from 'lodash/cloneDeep';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import sortedUniq from 'lodash/sortedUniq';

import generateGenomeView from './genomeView/generateGenomeView';
import { calculateDeclutteringETA } from './genomeView/blockCollisions';

import { getDefaultChromosomeOrder } from './variables/currentChromosomeOrder';
import { getGffDictionary } from './variables/gffDictionary';
import { isAdditionalTrackAdded } from './variables/additionalTrack';
import {
  getCircosRotateValue,
  setCircosRotateValue
} from './variables/myCircos';

// Contants
import {
  GENOME_INNER_RADIUS,
  TRACK_INNER_RADIUS_INSIDE_TOP,
  TRACK_OUTER_RADIUS_INSIDE_TOP,
  TRACK_INNER_RADIUS_INSIDE_BOTTOM,
  TRACK_OUTER_RADIUS_INSIDE_BOTTOM,
  TRACK_INNER_RADIUS_OUTSIDE_TOP,
  TRACK_OUTER_RADIUS_OUTSIDE_TOP,
  TRACK_INNER_RADIUS_OUTSIDE_BOTTOM,
  TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM,
  SCALE_DECREASE,
  TRANSLATE_INSCREASE,
  WIDTH,
  HEIGHT
} from './variables/constants';

/**
 * Get the array of selected checkboxes
 *
 * @param  {string} optionalClass Optional class to check for
 * @return {Array<string>}        Array of selected checkboxes
 */
export function getSelectedCheckboxes(optionalClass = "") {
  // Array that stores the value of all the selected checkboxes
  const selectedCheckboxes = [];
  // Array that stores the value of only the selected checkboxes with the parameter class
  const currentClassCheckboxes = [];

  d3.selectAll(".chr-box").each(function() {
    const cb = d3.select(this);

    if (cb.property("checked")) {
      selectedCheckboxes.push(cb.property("value"));

      if (optionalClass !== "") {
        // The second class is the identifier in the chr-box input
        // `chr-box ${partitionedGffKeys[i]} ${chrKey}`
        const identifierClass = cb.attr("class").split(" ")[1];
        if (identifierClass === optionalClass) {
          currentClassCheckboxes.push(cb.property("value"));
        }
      }
    }
  });

  return {
    currentClassCheckboxes,
    selectedCheckboxes
  };
};

/**
 * Shows chromosome connection information
 * NOTE: This should be called for one to many connections
 *
 * @param  {Array<Object>} connectionDictionary Dictionary with the connection data
 * @param  {Array<string>} selectedChromosomes  List of selected chromosomes
 * @return {undefined}                          undefined
 */
export function showChromosomeConnectionInformation(connectionDictionary, selectedChromosomes) {
  // If only one chromosome is selected, the connection information will show
  // for each other chromosome

  const chromosomeOrder = getDefaultChromosomeOrder();
  const chromosomeOrderLength = chromosomeOrder.length;

  const visitedChr = {}; // Visited chromosomes dictionary
  for (let i = 0; i < chromosomeOrderLength; i++) {
    visitedChr[chromosomeOrder[i]] = false;
  }

  visitedChr[selectedChromosomes[0]] = true;
  for (let j = 0; j < chromosomeOrderLength; j++) {
    // If a connection is found, mark current chromosome as visited
    if (find(connectionDictionary[selectedChromosomes[0]], ['connection', chromosomeOrder[j]])) {
      visitedChr[chromosomeOrder[j]] = true;
    }
  }

  d3.selectAll(".chr-box").each(function(d) {
    d3.select(this.parentNode.parentNode).select("span.chr-box-extra").html(function() {
      // Finding the index of the connection in the dictionary
      const indexConnection = findIndex(connectionDictionary[selectedChromosomes[0]], ['connection', d]);
      let connectionAmount = 0; // Number of block connections
      let textToShow = "";
      if (indexConnection === (-1)) {
        textToShow += `<em class="disabled">0 blocks</em>`;
      } else {
        connectionAmount = connectionDictionary[selectedChromosomes[0]][indexConnection].blockIDs.length;
        textToShow += `<em>${connectionAmount.toString()} `;
        if (connectionAmount === 1) {
          textToShow += 'block';
        } else {
          textToShow += 'blocks';
        }
        textToShow += '</em>';
      }

      return textToShow;
    });

    // d is the current chromosome id (e.g. N1, N2, N10)
    if (visitedChr[d]) {
      d3.select(this).attr("disabled", null);
      d3.select(this).classed("disabled", false);
      d3.select(this.parentNode).classed("disabled", false);
    } else {
      // Only disable not visited chromosomes
      d3.select(this).attr("disabled", true);
      d3.select(this).classed("disabled", true);
      d3.select(this.parentNode).classed("disabled", true);
    }
  });
};

/**
 * Reset chromosome order checkboxes
 *
 * @return {undefined} undefined
 */
export function resetChromosomeCheckboxes() {
  d3.selectAll(".chr-box").each(function(d) {
    d3.select(this.parentNode).classed("disabled", false);
    d3.select(this.parentNode).select("span.chr-box-text").text(d);
    d3.select(this.parentNode.parentNode).select("span.chr-box-extra").text("");
    d3.select(this).classed("disabled", false);
    d3.select(this).attr("disabled", null);
  });
};

/**
 * Resets both inputs and selects on any animation: dragging, flipping, or swapping
 *
 * @param {boolean} [value=null] Disabling value
 */
export function resetInputsAndSelectsOnAnimation(value = null) {
  d3.selectAll("input:not(.disabled)")
    .attr("disabled", value);

  d3.selectAll("select")
    .attr("disabled", value);

  if (d3.select("p.calculate-temperature-ratio input").property("checked")) {
    d3.select("#filter-sa-temperature").attr("disabled", true);
    d3.select("#filter-sa-ratio").attr("disabled", true);
  }
};

/**
 * Renders alert using AlertWithTimeout React component
 *
 * @param  {string} alertMessage Alert message
 * @param  {string} color        Alert color
 * @param  {number} timeout      Alert timeout
 * @return {undefined}           undefined
 */
export function renderReactAlert(alertMessage = "", color = "danger", timeout = 5000) {
  const alertContainerElement = document.getElementById('alert-container');
  ReactDOM.unmountComponentAtNode(alertContainerElement);
  ReactDOM.render(
    <AlertWithTimeout
      alertTimeout = {timeout}
      color = {color}
      message = {alertMessage}
    />,
    alertContainerElement
  );
};

/**
 * Flips the additional track data for the current view
 *
 * @param  {Array<Object>} additionalTrack Current additional track array
 * @return {Array<Object>}                 Flipped additional track array
 */
export function flipValueAdditionalTrack(additionalTrack) {
  const tempArray = cloneDeep(additionalTrack);

  // Only need to swap until size / 2 to flip entirely.
  const length = tempArray.length;
  for (let i = 0; i < length / 2; i++) {
    [tempArray[i].value, tempArray[length - i - 1].value] =
      [tempArray[length - i - 1].value, tempArray[i].value];
  }

  // Keeping old start and end positions (to show them correctly in tooltip)
  for (let i = 0; i < length; i++) {
    tempArray[i].showStart = tempArray[length - i - 1].start;
    tempArray[i].showEnd = tempArray[length - i - 1].end;
  }

  return tempArray;
};

/**
 * Get flipped genes position
 *
 * @param  {number} chromosomeEnd Chromosome end position
 * @param  {Object} gene       Original gene start and end positions
 * @return {Object}            Flipped gene start and end positions
 */
export function getFlippedGenesPosition(chromosomeEnd, gene) {
  // Example for flipped chromosomes:
  // Positions -> 20-28, 1-13
  // newStart = lastChrPosition - (endBlock)
  // newEnd = lastChrPosition - (startBlock)
  // 28-28 = 0, 28-20 = 8
  // 28-13 = 15, 28-1 = 27

  // newStart = lastChrPosition - (endBlock)
  // newEnd = lastChrPosition - (startBlock)

  const start = chromosomeEnd - gene.end;
  const end = chromosomeEnd - gene.start;

  return {
    start,
    end
  };
};

/**
 * Flips the positions of the genes based on list of flipped chromosomes
 *
 * @param  {Object} blockPositions            Source and target positions for current block
 * @param  {Array<string>} currentFlippedChromosomes List of flipped chromosomes
 * @param  {string} sourceID                  Source ID
 * @param  {string} targetID                  Target ID
 * @return {Object}                           Source and Target final positions
 */
export function flipGenesPosition({
  blockPositions,
  currentFlippedChromosomes,
  sourceID,
  targetID
}) {
  const sourcePositions = {
    start: blockPositions.minSource,
    end: blockPositions.maxSource
  };
  const targetPositions = {
    start: blockPositions.minTarget,
    end: blockPositions.maxTarget
  };

  const gffPositionDictionary = getGffDictionary();

  if (currentFlippedChromosomes.indexOf(sourceID) !== (-1)) {
    const { start, end } = getFlippedGenesPosition(gffPositionDictionary[sourceID].end, sourcePositions);
    sourcePositions.start = start;
    sourcePositions.end = end;
  }

  if (currentFlippedChromosomes.indexOf(targetID) !== (-1)) {
    const { start, end } = getFlippedGenesPosition(gffPositionDictionary[targetID].end, targetPositions);
    targetPositions.start = start;
    targetPositions.end = end;
  }

  return {
    sourcePositions,
    targetPositions
  }
};

/**
 * Gets the transform values based on how many additional tracks are outside
 *
 * Note: For each outside track, scale will decrease 6% for each additional track
 * translate will increase 40px for each additional track
 *
 * @return {Object} Transform values
 */
export function getTransformValuesAdditionalTracks() {
  let scale = 1; // 100% by default

  let translate = {
    width: WIDTH / 2,
    height: HEIGHT / 2
  };

  const rotate = getCircosRotateValue();

  if (isAdditionalTrackAdded()) {
    const selectedHeatmapTrack = !d3.select("div.heatmap-track-input select").empty() &&
      d3.select("div.heatmap-track-input select").property("value");
    const trackPlacementHeatmapTrack = !d3.select("div.heatmap-track-placement select").empty() &&
      d3.select("div.heatmap-track-placement select").property("value");

    const selectedHistogramTrack = !d3.select("div.histogram-track-input select").empty() &&
      d3.select("div.histogram-track-input select").property("value");
    const trackPlacementHistogramTrack = !d3.select("div.histogram-track-placement select").empty() &&
      d3.select("div.histogram-track-placement select").property("value");

    // TODO: Come back to this after generalizing the additional tracks
    // Need to include current position attribute inside each track object,
    // and update it accordingly
    let howManyOutside = 0;
    if (selectedHeatmapTrack !== 'None' && trackPlacementHeatmapTrack === 'Outside') howManyOutside++;
    if (selectedHistogramTrack !== 'None' && trackPlacementHistogramTrack === 'Outside') howManyOutside++;

    if (howManyOutside >= 1) {
      // Decreasing 6% of scale -> (100 - (6 * #ofTracksOutside) / 100)
      scale = (100 - (SCALE_DECREASE * howManyOutside)) / 100;
      translate.width = translate.width + (TRANSLATE_INSCREASE * howManyOutside);
      translate.height = translate.height + (TRANSLATE_INSCREASE * howManyOutside);
    }
  }

  // console.log('ROTATE, SCALE, AND TRANSLATE: ', rotate, scale, translate);

  return {
    rotate,
    scale,
    translate
  }
};

/**
 * Gets the inner and outer radius for heatmap and histogram based on current placements
 * NOTE: This function is only called when there is a selected track
 *
 * TODO: Come back to this function after generalizing the additional tracks
 *
 * @return {Object} Inner and outer radius
 */
export function getInnerAndOuterRadiusAdditionalTracks() {
  const selectedHeatmapTrack = !d3.select("div.heatmap-track-input select").empty() &&
    d3.select("div.heatmap-track-input select").property("value");
  const trackPlacementHeatmapTrack = !d3.select("div.heatmap-track-placement select").empty() &&
    d3.select("div.heatmap-track-placement select").property("value");

  const selectedHistogramTrack = !d3.select("div.histogram-track-input select").empty() &&
    d3.select("div.histogram-track-input select").property("value");
  const trackPlacementHistogramTrack = !d3.select("div.histogram-track-placement select").empty() &&
    d3.select("div.histogram-track-placement select").property("value");

  // Placing both additionalTracks outside by default
  let innerRadiusHeatmap = TRACK_INNER_RADIUS_OUTSIDE_BOTTOM;
  let outerRadiusHeatmap = TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM;
  let innerRadiusHistogram = TRACK_INNER_RADIUS_OUTSIDE_TOP;
  let outerRadiusHistogram = TRACK_OUTER_RADIUS_OUTSIDE_TOP;

  if (selectedHeatmapTrack === 'None') {
    // If both tracks are outside and heatmap is empty, then histogram takes its placement
    innerRadiusHistogram = TRACK_INNER_RADIUS_OUTSIDE_BOTTOM;
    outerRadiusHistogram = TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM;
  }

  if (trackPlacementHeatmapTrack === 'Inside' && trackPlacementHistogramTrack === 'Inside') {
    // If boths are inside
    innerRadiusHeatmap = TRACK_INNER_RADIUS_INSIDE_BOTTOM;
    outerRadiusHeatmap = TRACK_OUTER_RADIUS_INSIDE_BOTTOM;
    innerRadiusHistogram = TRACK_INNER_RADIUS_INSIDE_TOP;
    outerRadiusHistogram = TRACK_OUTER_RADIUS_INSIDE_TOP;

    if (selectedHistogramTrack === 'None') {
      // If both tracks are inside and histogram is empty, then heatmap takes its placement
      innerRadiusHeatmap = TRACK_INNER_RADIUS_INSIDE_TOP;
      outerRadiusHeatmap = TRACK_OUTER_RADIUS_INSIDE_TOP;
    }

    if (selectedHeatmapTrack === 'None' && selectedHistogramTrack !== 'None') {
      // If only heatmap is empty, and both tracks are inside, then assign it to the top inside radius,
      // so chords are drawn accordingly
      innerRadiusHeatmap = TRACK_INNER_RADIUS_INSIDE_TOP;
      outerRadiusHeatmap = TRACK_OUTER_RADIUS_INSIDE_TOP;
    }

    if (selectedHeatmapTrack === 'None' && selectedHistogramTrack === 'None') {
      // If both tracks are inside and empty, then assign it to 1.0 radius, to chords are drawn accordingly
      innerRadiusHistogram = 1.0;
      outerRadiusHistogram = 1.0;
      innerRadiusHeatmap = 1.0;
      outerRadiusHeatmap = 1.0;
    }
  } else if (trackPlacementHeatmapTrack === 'Outside' && trackPlacementHistogramTrack === 'Inside') {
    // If heatmap is outside and histogram is inside
    innerRadiusHeatmap = TRACK_INNER_RADIUS_OUTSIDE_BOTTOM;
    outerRadiusHeatmap = TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM;
    innerRadiusHistogram = TRACK_INNER_RADIUS_INSIDE_TOP;
    outerRadiusHistogram = TRACK_OUTER_RADIUS_INSIDE_TOP;

    if (selectedHistogramTrack === 'None') {
      // For the purpose of getting the chord radius, since the histogram is inside
      // and no histogram track is selected, then reset the histogram radii
      innerRadiusHistogram = 1.0;
      outerRadiusHistogram = 1.0;
    }
  } else if (trackPlacementHeatmapTrack === 'Inside' && trackPlacementHistogramTrack === 'Outside') {
    // If heatmap is inside and histogram is outside
    innerRadiusHeatmap = TRACK_INNER_RADIUS_INSIDE_TOP;
    outerRadiusHeatmap = TRACK_OUTER_RADIUS_INSIDE_TOP;
    innerRadiusHistogram = TRACK_INNER_RADIUS_OUTSIDE_BOTTOM;
    outerRadiusHistogram = TRACK_OUTER_RADIUS_OUTSIDE_BOTTOM;

    if (selectedHeatmapTrack === 'None') {
      // For the purpose of getting the chord radius, since the heatmap is inside
      // and no heatmap track is selected, then reset the heatmap radii
      innerRadiusHeatmap = 1.0;
      outerRadiusHeatmap = 1.0;
    }
  }

  return {
    heatmap: {
      innerRadius: innerRadiusHeatmap,
      outerRadius: outerRadiusHeatmap
    },
    histogram: {
      innerRadius: innerRadiusHistogram,
      outerRadius: outerRadiusHistogram
    }
  };
};

/**
 * Gets the radius for plotting the chords accurately
 *
 * @return {number} Chords radius number
 */
export function getChordsRadius() {
  let radius = GENOME_INNER_RADIUS;
  if (isAdditionalTrackAdded()) {
    // Inner and outer radius
    const { heatmap, histogram } = getInnerAndOuterRadiusAdditionalTracks();

    // Take the minimum between both track innerRadius
    const innerRadius = Math.min(heatmap.innerRadius, histogram.innerRadius);
    if (innerRadius < 1.00) {
      // If minimum is below 1.00, then use proportion of genome inner radius
      radius = innerRadius * radius;
    }
  }

  return radius;
};

/**
 * Get the value of a querystring
 *
 * @param  {string} field  The field to get the value of
 * @param  {string} url    The URL to get the value from (optional)
 * @return {Array<string>} All the field values
 */
export function getQueryString(field, url) {
  const href = url ? url : window.location.href;
  const regex = new RegExp('[?&]' + field + '=([^&#]*)', 'ig');
  const matches = []; // Array of matches
  let match; // Variable for each match

  // Obtaining all the matches from the query strings with the exec function
  while ((match = regex.exec(href)) !== null) {
    matches.push(match[1]); // Pushing the result group (parenthesized substring)
  }

  console.log("MATCHES: ", matches);

  return (matches && matches.length > 0) ? matches : null;
};

/**
 * Calculates the middle value between two numbers
 * NOTE: Numeric helper
 *
 * @param  {number} low  First number
 * @param  {number} high Second number
 * @return {number}      Middle value result
 */
export function calculateMiddleValue(low, high) {
  return low + (high - low) / 2.0;
};

/**
 * Rounds float number using the decimalPlaces
 * NOTE: Numeric helper
 *
 * @param  {number} value         Current number value
 * @param  {number} decimalPlaces Number of digits after the decimal points
 * @return {number}               Rounded number
 */
export function roundFloatNumber(value, decimalPlaces = 0) {
  // Check if number is float using modulus
  // Integer % 1 will always be equal to zero
  // More info: https://stackoverflow.com/a/2304062
  return value % 1 !== 0 ? parseFloat(value.toFixed(decimalPlaces)) : value;
};

/**
 * Verifies if element is currently visible in the viewport
 * More info: https://gomakethings.com/how-to-test-if-an-element-is-in-the-viewport-with-vanilla-javascript/
 *
 * @param  {Object}  elem Current node element
 * @return {boolean}      True if element is in viewport, false otherwise
 */
export function isInViewport(elem) {
  const bounding = elem.getBoundingClientRect();
  const html = document.documentElement;
  return (
      bounding.top >= 0 &&
      bounding.left >= 0 &&
      bounding.bottom <= (window.innerHeight || html.clientHeight) &&
      bounding.right <= (window.innerWidth || html.clientWidth)
  );
};

/**
 * Moves the scroll of the page
 *
 * @param  {string} position  Start or end position
 * @param  {string} animation Animation type: smooth or instant
 * @return {undefined}        undefined
 */
export function movePageContainerScroll(position, animation = "smooth") {
  // Returning early if going to top but already in top
  if (position === "start" && window.scrollY === 0) return;

  // More info: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
  d3.select("#page-container").node().scrollIntoView({
    behavior: animation,
    block: position,
    inline: "nearest"
  });
};

/**
 * Detects device type based on user agent
 *
 * @param  {string} userAgent Current user agent
 * @return {Object}           Device type configurations
 */
export function detectDeviceType(userAgent) {
  var parser = new UAParser(userAgent);
  var device = parser.getDevice() || {};
  device.isMobile = device.type === 'mobile';
  device.isTablet = device.type === 'tablet';
  device.isDesktop = !device.isMobile && !device.isTablet;
  device.type = device.type || 'desktop';
  return device;
};

/**
 * Async function to check if an url is valid
 * More info: https://stackoverflow.com/a/42696480
 *
 * @param  {string}  url Complete url
 * @return {boolean}     True if valid url, false otherwise
 */
export async function isUrlFound(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-cache'
    });

    return response.status === 200; // Status should be OK if valid URL

  } catch (error) {
    return false;
  }
};

/**
 * Looks for minimum and maximum positions within the current block
 *
 * @param  {Object} blockDictionary Block dictionary
 * @param  {Object} geneDictionary  Gene dictionary
 * @param  {string} block           Current block
 * @return {Object}                 Resulting block min and max information
 */
export function lookForBlocksPositions(blockDictionary, geneDictionary, block) {
  const blockArray = blockDictionary[block];
  const blockArrayLength = blockArray.length;

  let maxSource = 0;
  let minSource = Number.MAX_SAFE_INTEGER;
  let maxTarget = 0;
  let minTarget = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < blockArrayLength; i++) {
    const currentSource = geneDictionary[blockArray[i].connectionSource];
    const currentTarget = geneDictionary[blockArray[i].connectionTarget];

    minSource = Math.min(minSource, currentSource.start);
    maxSource = Math.max(maxSource, currentSource.end);

    minTarget = Math.min(minTarget, currentTarget.start);
    maxTarget = Math.max(maxTarget, currentTarget.end);
  }

  return {
    blockLength: blockArrayLength,
    // Taking score, eValue, and isFlipped from first connection in the blockArray
    blockScore: blockArray[0].score,
    blockEValue: blockArray[0].eValue,
    isFlipped: blockArray[0].isFlipped === 'yes' ? true : false,
    minSource: minSource,
    maxSource: maxSource,
    minTarget: minTarget,
    maxTarget: maxTarget
  };
};

/**
 * Removes block view with transition
 *
 * @param  {number}    Transition time
 * @return {undefined} undefined
 */
export function removeBlockView(transitionTime = 0) {
  if (transitionTime > 0) {
    d3.select("#block-view-container")
      .style("opacity", 1)
      .transition()
      .duration(transitionTime)
      .ease(d3.easeLinear)
      .style("opacity", 0)
      .remove();
  } else {
    d3.select("#block-view-container").remove();
  }
};

/**
 * Assigns flipped colors to the genome chromosomes
 *
 * @param  {Function} colorScale                     Current flipped color scale (1 for flipped, 0 otherwise)
 * @param  {Array<string>} currentFlippedChromosomes Array of flipped chromosomes
 * @param  {Array<string} gffKeys                    Array of all the chromosomes
 * @param  {Array<Object>} gffPositionDictionary     Array of positions and colors for the chromosomes
 * @return {undefined}                               undefined
 */
export function assignFlippedChromosomeColors({
  colorScale,
  currentFlippedChromosomes,
  gffKeys,
  gffPositionDictionary
}) {
  const tmpGffDictionary = cloneDeep(gffPositionDictionary);

  const gffKeysLength = gffKeys.length;
  for (let i = 0; i < gffKeysLength; i++) {
    const isFlipped = currentFlippedChromosomes.indexOf(gffKeys[i]) !== (-1);
    tmpGffDictionary[gffKeys[i]].color = colorScale(!isFlipped ? 0 : 1);
  }

  return tmpGffDictionary;
};

/**
 * Removes all non-letters from string using regular expression
 *
 * @param  {string} str Current string
 * @return {string}     Modified string
 */
export function removeNonLettersFromString(str) {
  return str.replace(/[^a-zA-Z]+/g, '');
};

/**
 * Partition Gff keys for the ordering inside the checkboxes
 *
 * @param  {Array<string>} gffKeys Array that includes the keys from the gff dictionary
 * @return {Object}        Partitioned dictionary along with the ordered keys
 */
export function partitionGffKeys(gffKeys) {
  // Sorted input gffKeys
  let gffCopy = sortGffKeys(gffKeys.slice()).slice();

  // Removing all non-letters from string
  // e.g. from gffCopy = ["at1, at2, at3"]
  // to gffCopy = ["at", "at", "at"]
  gffCopy = gffCopy.map(function(current) {
    return removeNonLettersFromString(current);
  });

  // Creating a duplicate-free version of gffCopy array
  // sortedUniq function is optimized for sorted arrays
  // e.g. gffCopy = ["at"]
  gffCopy = sortedUniq(gffCopy);

  // Creating gffPartitionedDictionary to partition the gffKeys with their tags
  const gffPartitionedDictionary = {};
  const gffCopyLength = gffCopy.length;
  const gffKeysLength = gffKeys.length;

  for (let i = 0; i < gffCopyLength; i++) {
    if (!(gffCopy[i] in gffPartitionedDictionary)) {
      gffPartitionedDictionary[gffCopy[i]] = [];
    }

    for (let j = 0; j < gffKeysLength; j++) {
      if (gffKeys[j].includes(gffCopy[i])) {
        gffPartitionedDictionary[gffCopy[i]].push(gffKeys[j]);
      }
    }
  }

  // Sorting gffCopy keys in descending order when having more than 1 key,
  // meaning more than 1 species to visualize
  if (gffCopyLength > 1) {
    gffCopy.sort(function compare(a, b) {
      const countA = gffPartitionedDictionary[a].length;
      const countB = gffPartitionedDictionary[b].length;
      if (countA > countB) return -1;
      if (countA < countB) return 1;
      return 0;
    });
  }

  return {
    gffPartitionedDictionary: gffPartitionedDictionary,
    partitionedGffKeys: gffCopy
  };
};

/**
 * Sorts GFF keys
 *
 * @param  {Array<string>} gffKeys Array that includes the keys from the gff dictionary
 * @return {Array<string>}         Sorted gff keys
 */
export function sortGffKeys(gffKeys) {
  const gffCopy = gffKeys.slice();

  // Using localCompare collator to sort alphanumeric strings.
  // More info: https://stackoverflow.com/a/38641281
  // Using numeric collation
  // e.g. "1" < "2" < "10"
  // Using sensitivity: base
  // This means that only strings that differ in base letters compare as unequal.
  // e.g. a ≠ b, a = á, a = A.
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

  return gffCopy.sort(collator.compare);
};

/**
 * Flips or resets the chromosome order of the selected genome.
 *
 * @param {string} action          Action type: flip or reset
 * @param {string} genome          Current genome
 * @param {Array<string>} chromosomeOrder Current chromosome order with all the chromosomes
 * @return {Array<string>}         Updated chromosome order
 */
export function flipOrResetChromosomeOrder({
  action,
  genome,
  chromosomeOrder
}) {
  // Need to save each chromosome positions in case the chromosome are
  // not one after the other
  const chromosomePositions = []; // Saved positions for each chromosome
  console.log('ACTION AND GENOME: ', action, genome);
  console.log('CHR ORDER INSIDE F OR R: ', chromosomeOrder);

  const chromosomeOrderLength = chromosomeOrder.length;
  for (let i = 0; i < chromosomeOrderLength; i++) {
    // Getting all the positions of the chromosomes from `genome`
    const key = chromosomeOrder[i].slice(0);
    if (removeNonLettersFromString(key) === genome) {
      console.log('FOUND KEY: ', key, i);
      chromosomePositions.push({
        chr: chromosomeOrder[i],
        pos: i
      });
    }
  }

  const chromosomePositionsLength = chromosomePositions.length;
  if (action === "Flip") {
    // Return chromosomeOrder with the chromosomePositions inverted
    let temp = 0;
    for (let i = 0; i < chromosomePositionsLength / 2; i++) {
      [chromosomePositions[i].pos, chromosomePositions[chromosomePositionsLength - i - 1].pos] =
        [chromosomePositions[chromosomePositionsLength - i - 1].pos, chromosomePositions[i].pos];
    }
  } else if (action === "Reset") {
    // Return chromosomeOrder with the chromosomePositions in default order
    // by sorting chromosomePositions in ascending order

    // Using localCompare collator to sort alphanumeric strings.
    // Same as sortGffKeys function
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    chromosomePositions.sort(function compare(a, b) {
      return collator.compare(a.chr, b.chr);
    });

    let allNumericPositions = [];
    for (let i = 0; i < chromosomePositionsLength; i++) {
      allNumericPositions.push(Number(chromosomePositions[i].pos));
    }

    // Sorting positions in ascending order
    allNumericPositions.sort(function compare(a, b) {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    console.log('ALL NUMERIC POS: ', allNumericPositions);

    // Assigning sorted positions properties to sorted strings
    for (let i = 0; i < chromosomePositionsLength; i++) {
      chromosomePositions[i].pos = allNumericPositions[i];
    }
  }

  // Assigning new chromosome positions in chromosomeOrder
  for (let i = 0; i < chromosomePositionsLength; i++) {
    chromosomeOrder[chromosomePositions[i].pos] = chromosomePositions[i].chr.slice(0);
  }

  console.log('CHR ORDER: ', chromosomeOrder);

  return chromosomeOrder;
};

/**
 * Updates the angle of the genome view
 *
 * @param  {number} nAngle    Current angle between 0 and 360
 * @param  {number} nDragging Current dragging angle between 0 and 360
 * @return {undefined}        undefined
 */
export function updateAngle(nAngle = 0, nDragging = 0) {
  // Adjust the text on the rotating range slider
  d3.select("#nAngle-genome-view-value").text(nAngle + String.fromCharCode(176));
  d3.select("#nAngle-genome-view").property("value", nAngle);

  const { scale: currentScale, translate: currentTranslate } =
    getTransformValuesAdditionalTracks();

  const rotateValue = ((-1) * (nAngle + nDragging));
  setCircosRotateValue(rotateValue);

  // Rotate the genome view with current transforms
  d3.select("g.all")
    .attr("transform", `scale(${currentScale})
      translate(${currentTranslate.width},${currentTranslate.height})
      rotate(${rotateValue})`);
};

/**
 * Updates the temperature for the Simulated Annealing algorithm in the genome view
 *
 * @param  {number} temperature Current temperature between 100 and 200,000
 * @param  {boolean} updateETA Whether or not the decluttering ETA should be updated
 * @return {undefined}          undefined
 */
export function updateTemperature(temperature, updateETA = true) {
  // Adjust the text on the temperature range slider
  d3.select("#filter-sa-temperature-value").text(d3.format(",")(temperature));
  d3.select("#filter-sa-temperature").property("value", temperature);

  if (updateETA) calculateDeclutteringETA();
};

/**
 * Updates the ratio for the Simulated Annealing algorithm in the genome view
 *
 * @param  {number}  ratio     Current ratio between 0.001 and 0.2
 * @param  {boolean} updateETA Whether or not the decluttering ETA should be updated
 * @return {undefined}    undefined
 */
export function updateRatio(ratio, updateETA = true) {
  // Adjust the text on the ratio range slider
  d3.select("#filter-sa-ratio-value").text(ratio);
  d3.select("#filter-sa-ratio").property("value", ratio);

  if (updateETA) calculateDeclutteringETA();
};

/**
 * Updates the flipping frequency for the Simulated Annealing algorithm in the genome view
 *
 * @param  {number} frequency Current frequency between 0 and 100
 * @return {undefined}        undefined
 */
export function updateFlippingFrequency(frequency) {
  // Adjust the text on the flipping frequency range slider
  d3.select("#filter-sa-flipping-frequency-value").text(frequency + '%');
  d3.select("#filter-sa-flipping-frequency").property("value", frequency);
};

/**
 * Updating the label showing the number of blocks and flipped blocks
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords Plotting information for each block chord
 * @return {undefined}                undefined
 */
export function updateBlockNumberHeadline(dataChromosomes, dataChords) {
  // Update chromosome-number-headline with current chromosome length amount
  d3.select(".chromosome-number-headline")
    .text(function() {
      const chromosomeSize = (dataChromosomes.length || 0).toString();
      const chromosomeSizeString = d3.format(",")(chromosomeSize);
      let textToShow = "";
      textToShow += chromosomeSize === "1" ? `${chromosomeSizeString} chromosome` :
        `${chromosomeSizeString} chromosomes`;
      return textToShow;
    });

  // Update block-number-headline with current block size
  d3.select(".block-number-headline")
    .text(function() {
      const blockSize = dataChords.length.toString();
      const blockSizeString = d3.format(",")(blockSize);
      let textToShow = "";
      textToShow += blockSize === "1" ? `${blockSizeString} block` :
        `${blockSizeString} blocks`;
      return textToShow;
    });

  // Update flipped-blocks-headline with current flipped block size
  const flippedBlockSize = dataChords.reduce((total, current) => {
    const { isFlipped } = current.source.value;
    if (isFlipped) total++;
    return total;
  }, 0);

  d3.select(".flipped-blocks-headline")
    .text(function() {
      const blockSize = flippedBlockSize.toString();
      const blockSizeString = d3.format(",")(blockSize);
      let textToShow = "";
      textToShow += blockSize === "1" ? `${blockSizeString} flipped block` :
        `${blockSizeString} flipped blocks`;
      return textToShow;
    });
};

/**
 *  Updates the filter range value for block size
 *
 * @param  {boolean} shouldUpdateBlockCollisions True if should update block collisions
 *                                               in genome view, false otherwise
 * @param  {boolean} shouldUpdateLayout          True if Circos layout should be updated
 *                                               (i.e. chromosome order changed)
 * @param  {boolean} shouldUpdatePath            True if should update paths in genome
 *                                               view, false otherwise
 * @param  {number}  value                       Filtering value for connection block size
 * @return {undefined}                           undefined
 */
export function updateFilter({
  shouldUpdateBlockCollisions = false,
  shouldUpdateLayout = false,
  shouldUpdatePath = false,
  value = 1
}) {
  // Adjust the text on the filter range slider
  const valueString = d3.format(",")(value);
  d3.select("#filter-block-size-value").text(value === 1 ? `${valueString} connection` : `${valueString} connections`);
  d3.select("#filter-block-size").property("value", value);

  if (shouldUpdatePath) {
    generateGenomeView({
      transition: { shouldDo: false },
      shouldUpdateBlockCollisions: shouldUpdateBlockCollisions,
      // This is needed to be able to change layout if another one is saved
      shouldUpdateLayout: shouldUpdateLayout
    });
  }
};
