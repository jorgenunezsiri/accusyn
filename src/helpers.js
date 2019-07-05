// D3
import { easeLinear as d3EaseLinear } from 'd3-ease';
import { format as d3Format } from 'd3-format';

import {
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3-selection';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import Button from './reactComponents/Button';
import AlertWithTimeout from './reactComponents/Alert';

// UAParser
import UAParser from 'ua-parser-js';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import difference from 'lodash/difference';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';

// Helpers
import generateGenomeView from './genomeView/generateGenomeView';
import { calculateDeclutteringETA } from './genomeView/blockCollisions';

// Variable getters and setters
import { getDefaultChromosomeOrder } from './variables/currentChromosomeOrder';
import { getGffDictionary } from './variables/gffDictionary';
import {
  isAdditionalTrackAdded,
  getAdditionalTrackArray
} from './variables/additionalTrack';
import {
  getCircosRotateValue,
  setCircosRotateValue
} from './variables/myCircos';

// Contants
import {
  GENOME_INNER_RADIUS,
  TRACK_SEPARATION_INNER_OUTER,
  TRACK_SEPARATION_GENOME,
  SCALE_DECREASE,
  SCALE_INCREASE,
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

  d3SelectAll(".chr-box").each(function() {
    const cb = d3Select(this);

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
  // If only one chromosome is selected, the connection information will be shown
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

  d3SelectAll(".chr-box").each(function(d) {
    d3Select(this.parentNode.parentNode).select("span.chr-box-extra").html(function() {
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
      d3Select(this).attr("disabled", null);
      d3Select(this).classed("disabled", false);
      d3Select(this.parentNode).classed("disabled", false);
    } else {
      // Only disable not visited chromosomes
      d3Select(this).attr("disabled", true);
      d3Select(this).classed("disabled", true);
      d3Select(this.parentNode).classed("disabled", true);
    }
  });
};

/**
 * Reset chromosome order checkboxes
 * NOTE: This function does NOT uncheck the checkboxes
 *
 * @return {undefined} undefined
 */
export function resetChromosomeCheckboxes() {
  d3SelectAll(".chr-box").each(function(d) {
    d3Select(this.parentNode).classed("disabled", false);
    d3Select(this.parentNode).select("span.chr-box-text").text(d);
    d3Select(this.parentNode.parentNode).select("span.chr-box-extra").text("");
    d3Select(this).classed("disabled", false);
    d3Select(this).attr("disabled", null);
  });
};

/**
 * Resets both inputs and selects on any animation: dragging, flipping, or swapping
 *
 * @param {boolean} [value=null] Disabling value
 */
export function resetInputsAndSelectsOnAnimation(value = null) {
  d3SelectAll("input:not(.disabled),button")
    .attr("disabled", value);

  d3SelectAll("select")
    .attr("disabled", value);

  if (d3Select("p.calculate-temperature-ratio input").property("checked")) {
    d3Select("#filter-sa-temperature").attr("disabled", true);
    d3Select("#filter-sa-ratio").attr("disabled", true);
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
 * Renders SVG button using Button React component
 *
 * @param  {node} buttonContainer Container node
 * @param  {Function} onClickFunction Function to be called in the onClick event
 * @param  {string} svgClassName    Classname for the svg
 * @param  {string} svgHref         Href for the svg
 * @return {undefined}              undefined
 */
export function renderSvgButton({
  buttonContainer,
  onClickFunction,
  svgClassName,
  svgHref
}) {
  ReactDOM.unmountComponentAtNode(buttonContainer);
  ReactDOM.render(
    <Button
      color="link"
      onClick={() => onClickFunction()}>
      <svg className={svgClassName} pointerEvents="none">
        <use
          href={svgHref}
          xlinkHref={svgHref} />
      </svg>
    </Button>,
    buttonContainer
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
 * NOTE: For each outside track the scale will decrease 5%
 *       For each inside track the scale will increase 2% (only with less than 4 tracks inside)
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
    const {
      insideCount: howManyInside,
      outsideCount: howManyOutside
    } = getInnerAndOuterRadiusAdditionalTracks();

    if (howManyOutside >= 2) {
      scale -= (SCALE_DECREASE * howManyOutside); // Decreasing 5% of scale per track
    }

    if (howManyOutside <= 1 && howManyInside >= 1 && howManyInside <= 3) {
      scale += (SCALE_INCREASE * howManyInside); // Increasing 2% of scale per track
    }
  }

  return {
    rotate,
    scale,
    translate
  }
};

/**
 * Gets the inner and outer radius for the additional tracks based on current placements
 * This function is translating from order and placement to radius positions in the Circos plot
 * NOTE: This function is called when there is a selected track
 *
 * @return {Object} All available tracks (array), minimum radius, and the number of tracks inside and outside
 */
export function getInnerAndOuterRadiusAdditionalTracks() {
  let availableTracks = [];

  const additionalTrackArray = getAdditionalTrackArray();
  const additionalTrackArrayLength = additionalTrackArray.length;

  for (let i = 0; i < additionalTrackArrayLength; i++) {
    const key = additionalTrackArray[i].name;
    // Resetting the text for the tab-link
    d3Select(`#form-config .additional-tracks-panel div.tabs button.tab-link.${key} span.text`).html(`${key}`);

    const trackColor = !d3Select(`div.additional-track.${key} .track-color select`).empty() &&
      d3Select(`div.additional-track.${key} .track-color select`).property("value");
    const trackType = !d3Select(`div.additional-track.${key} .track-type select`).empty() &&
      d3Select(`div.additional-track.${key} .track-type select`).property("value");
    const trackPlacement = !d3Select(`div.additional-track.${key} .track-placement select`).empty() &&
      d3Select(`div.additional-track.${key} .track-placement select`).property("value");

    if (trackColor && trackPlacement && trackType && trackType !== 'None') {
      // Making the tab-link text bold for the visible tracks
      d3Select(`#form-config .additional-tracks-panel div.tabs button.tab-link.${key} span.text`)
        .html(`<strong>${key}</strong>`);

      // All available tracks by returning the ones that are currently selected
      availableTracks.push({
        color: trackColor,
        name: key,
        order: additionalTrackArray[i].order,
        placement: trackPlacement,
        type: trackType
      });
    }
  }

  const availableTracksLength = availableTracks.length;
  let tracksInside = [], tracksOutside = [];

  for (let i = 0; i < availableTracksLength; i++) {
    if (availableTracks[i].placement === 'Outside') tracksOutside.push(availableTracks[i]);
    if (availableTracks[i].placement === 'Inside') tracksInside.push(availableTracks[i]);
  }

  const tracksInsideLength = tracksInside.length;
  const tracksOutsideLength = tracksOutside.length;

  // Sorting the available tracks by order in ascending order
  tracksInside = sortBy(tracksInside, ['order']);
  tracksOutside = sortBy(tracksOutside, ['order']);

  /**
   * Generates the radius for the tracks
   *
   * @param  {Array<Object>}  tracks   Given tracks
   * @param  {boolean} [isInside=true] Whether the track is inside or outside
   * @return {number}                  Minimum radius that was found
   * @private
   */
  function getTrackRadius(tracks, isInside = true) {
    const tracksLength = tracks.length;
    const trackChange = (TRACK_SEPARATION_GENOME + TRACK_SEPARATION_INNER_OUTER);

    // Initial variables for inside placement
    let inner = 1.0 - trackChange;
    let outer = 1.0 - TRACK_SEPARATION_GENOME;

    if (!isInside) {
      // Initial variables for outside placement
      inner = 1.0 + TRACK_SEPARATION_GENOME;
      outer = 1.0 + trackChange;
    }

    let minimumInnerRadius = 1.0;

    for (let i = 0; i < tracksLength; i++) {
      tracks[i].radius = {
        inner: roundFloatNumber(inner, 2),
        outer: roundFloatNumber(outer, 2)
      }

      minimumInnerRadius = Math.min(minimumInnerRadius, inner);

      const change = isInside ? (-1) : 1;

      inner += (trackChange * change);
      outer += (trackChange * change);
    }

    return minimumInnerRadius;
  }

  // Dynamically adding the inner and outer radius for each outside and inside track
  const minimumInnerRadius = getTrackRadius(tracksInside);
  getTrackRadius(tracksOutside, false);

  // Concatenating the inside and outside tracks
  availableTracks = [...tracksInside, ...tracksOutside];

  return {
    availableTracks,
    minimumInnerRadius,
    insideCount: tracksInside.length,
    outsideCount: tracksOutside.length
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
    // Getting minimum inner radius
    const { minimumInnerRadius } = getInnerAndOuterRadiusAdditionalTracks();

    // If minimum is below 1.00, then use proportion of genome inner radius
    if (minimumInnerRadius < 1.00) {
      radius = minimumInnerRadius * radius;
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
    d3Select("#block-view-container")
      .style("opacity", 1)
      .transition()
      .duration(transitionTime)
      .ease(d3EaseLinear)
      .style("opacity", 0)
      .remove();
  } else {
    d3Select("#block-view-container").remove();
  }
};

/**
 * Assigns flipped colors to the genome chromosomes
 *
 * @param  {Function} colorScale                     Current flipped color scale (1 for flipped, 0 otherwise)
 * @param  {Array<string>} currentFlippedChromosomes Array of flipped chromosomes
 * @param  {Array<string} gffKeys                    Array of all the chromosomes
 * @return {undefined}                               undefined
 */
export function assignFlippedChromosomeColors({
  colorScale,
  currentFlippedChromosomes,
  gffKeys
}) {
  const tmpGffDictionary = cloneDeep(getGffDictionary());

  const gffKeysLength = gffKeys.length;
  for (let i = 0; i < gffKeysLength; i++) {
    const isFlipped = currentFlippedChromosomes.indexOf(gffKeys[i]) !== (-1);
    tmpGffDictionary[gffKeys[i]].color = colorScale(!isFlipped ? 0 : 1);
  }

  return tmpGffDictionary;
};

/**
 * Returns true if str1 is a subsequence of str2
 * More info: https://www.geeksforgeeks.org/given-two-strings-find-first-string-subsequence-second/
 *
 * @param  {string}  str1 First string
 * @param  {string}  str2 Second string
 * @return {boolean}      True if subsequence, false otherwise
 */
export function isSubSequence(str1, str2) {
   let j = 0; // For index of str1 (or subsequence)
   let m = str1.length, n = str2.length;

   // Traverse str2 and str1, and compare current character
   // of str2 with first unmatched char of str1, if matched
   // then move ahead in str1
   for (let i = 0; i < n && j < m; i++) {
     if (str1[j] === str2[i]) j++;
   }

   // If all characters of str1 were found in str2
   return j === m;
};

/**
 * Partition Gff keys for the ordering inside the checkboxes
 *
 * @param  {Array<string>} gffKeys Array that includes the keys from the gff dictionary
 * @return {Object}        Partitioned dictionary along with the ordered keys
 */
export function partitionGffKeys(gffKeys) {
  // Using localCompare collator to sort alphanumeric strings.
  // More info: https://stackoverflow.com/a/38641281
  // Using numeric collation
  // e.g. "1" < "2" < "10"
  // Using sensitivity: base
  // This means that only strings that differ in base letters compare as unequal.
  // e.g. a ≠ b, a = á, a = A.
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const sortedGffKeys = gffKeys.slice().sort(collator.compare); // Sorted input gff keys
  let gffCopy = sortedGffKeys.slice(); // Sorted gff keys copy

  // Removing all non-letters from string
  // e.g. from gffCopy = ["at1, at2, at3"]
  // to gffCopy = ["at", "at", "at"]
  gffCopy = gffCopy.map(function(current) {
    return current.replace(/[^a-zA-Z]+/g, '');
  });

  // Creating a duplicate-free version of gffCopy array
  // e.g. gffCopy = ["at"]
  gffCopy = uniq(gffCopy);

  let gffCopyLength = gffCopy.length;
  // GffCopy keys cannot be subSequence of one another
  // If they are, then delete those ones.
  // This is to not repeat the keys in multiple clusters (groups)
  // e.g.: ['hs', 'hsX', 'hsY'] -> ['hs']
  let removingTags = [];
  for (let i = 0; i < gffCopyLength; i++) {
    for (let j = 0; j < gffCopyLength; j++) {
      if (gffCopy[i] !== gffCopy[j]) {
        if (!removingTags.includes(gffCopy[j]) && isSubSequence(gffCopy[i], gffCopy[j])) {
          removingTags.push(gffCopy[j].slice(0));
        } else if (!removingTags.includes(gffCopy[i]) && isSubSequence(gffCopy[j], gffCopy[i])) {
          removingTags.push(gffCopy[i].slice(0));
        }
      }
    }
  }

  if (removingTags.length > 0) {
    gffCopy = difference(gffCopy, removingTags);
  }

  // Creating gffPartitionedDictionary to partition the sortedGffKeys with their tags
  const gffPartitionedDictionary = {};
  gffCopyLength = gffCopy.length;
  const gffKeysLength = sortedGffKeys.length;

  for (let i = 0; i < gffCopyLength; i++) {
    if (!(gffCopy[i] in gffPartitionedDictionary)) {
      gffPartitionedDictionary[gffCopy[i]] = [];
    }

    for (let j = 0; j < gffKeysLength; j++) {
      if (isSubSequence(gffCopy[i], sortedGffKeys[j])) {
        // NOTE: Pushing sorted gff keys
        gffPartitionedDictionary[gffCopy[i]].push(sortedGffKeys[j]);
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
    gffPartitionedDictionary,
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
  let sortedGffKeys = [];

  const { gffPartitionedDictionary, partitionedGffKeys } = partitionGffKeys(gffCopy);

  for (let i = 0; i < partitionedGffKeys.length; i++) {
    sortedGffKeys = [...sortedGffKeys, ...gffPartitionedDictionary[partitionedGffKeys[i]]];
  }

  return sortedGffKeys;
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

  const chromosomeOrderLength = chromosomeOrder.length;
  for (let i = 0; i < chromosomeOrderLength; i++) {
    // Getting all the positions of the chromosomes from `genome`
    const key = chromosomeOrder[i].slice(0);
    if (getGffDictionary()[key].tag === genome) {
      chromosomePositions.push({
        chr: chromosomeOrder[i],
        pos: i
      });
    }
  }

  const chromosomePositionsLength = chromosomePositions.length;
  if (action === 'Flip') {
    // Return chromosomeOrder with the chromosomePositions inverted
    let temp = 0;
    for (let i = 0; i < chromosomePositionsLength / 2; i++) {
      [chromosomePositions[i].pos, chromosomePositions[chromosomePositionsLength - i - 1].pos] =
        [chromosomePositions[chromosomePositionsLength - i - 1].pos, chromosomePositions[i].pos];
    }
  } else if (action === 'Reset') {
    // Return chromosomeOrder with the chromosomePositions in default order
    // by sorting chromosomePositions from current genome in ascending order

    // Using localCompare collator to sort alphanumeric strings.
    // Same as partitionGffKeys function.
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

    // Assigning sorted positions properties to sorted strings
    for (let i = 0; i < chromosomePositionsLength; i++) {
      chromosomePositions[i].pos = allNumericPositions[i];
    }
  }

  // Assigning new chromosome positions in chromosomeOrder
  for (let i = 0; i < chromosomePositionsLength; i++) {
    chromosomeOrder[chromosomePositions[i].pos] = chromosomePositions[i].chr.slice(0);
  }

  return chromosomeOrder;
};

/**
 * Updates the angle of the genome view
 *
 * @param  {number} nAngle    Current angle between 0 and 360
 * @param  {number} nDragging Current dragging angle between 0 and 360
 * @param  {boolean} shouldUpdateLayout          True if Circos layout should be updated
 *                                               (i.e. chromosome order changed)
 * @return {undefined}        undefined
 */
export function updateAngle(nAngle = 0, nDragging = 0, shouldUpdateLayout = true) {
  // Adjust the text on the rotating range slider
  d3Select("#nAngle-genome-view-value").text(nAngle + String.fromCharCode(176));
  d3Select("#nAngle-genome-view").property("value", nAngle);

  const { scale: currentScale, translate: currentTranslate } =
    getTransformValuesAdditionalTracks();

  const rotateValue = ((-1) * (nAngle + nDragging));
  setCircosRotateValue(rotateValue);

  if (shouldUpdateLayout) {
    // Rotate the genome view with current transforms
    d3Select("g.all")
      .attr("transform", `translate(${currentTranslate.width},${currentTranslate.height})
      scale(${currentScale})
      rotate(${rotateValue})`);
  }
};

/**
 * Updates the temperature for the Simulated Annealing algorithm in the genome view
 *
 * @param  {number} temperature Current temperature between 100 and 300,000
 * @param  {boolean} updateETA Whether or not the decluttering ETA should be updated
 * @return {undefined}          undefined
 */
export function updateTemperature(temperature, updateETA = true) {
  // Adjust the text on the temperature range slider
  d3Select("#filter-sa-temperature-value").text(d3Format(",")(temperature));
  d3Select("#filter-sa-temperature").property("value", temperature);

  if (updateETA) calculateDeclutteringETA();
};

/**
 * Updates the ratio for the Simulated Annealing algorithm in the genome view
 *
 * @param  {number}  ratio     Current ratio between 0.7 and 0.999
 * @param  {boolean} updateETA Whether or not the decluttering ETA should be updated
 * @return {undefined}    undefined
 */
export function updateRatio(ratio, updateETA = true) {
  // Adjust the text on the ratio range slider
  // Need maximum one decimal place e.g. in case of 99.5
  d3Select("#filter-sa-ratio-value").text(`${roundFloatNumber((ratio * 100), 1)}%`);
  d3Select("#filter-sa-ratio").property("value", ratio);

  if (updateETA) calculateDeclutteringETA();
};

/**
 * Updates the flipping frequency for the Simulated Annealing algorithm in the genome view
 *
 * @param  {number} frequency Current frequency between 0 and 100
 * @param  {boolean} updateETA Whether or not the decluttering ETA should be updated
 * @return {undefined}        undefined
 */
export function updateFlippingFrequency(frequency, updateETA = true) {
  // Adjust the text on the flipping frequency range slider
  d3Select("#filter-sa-flipping-frequency-value").text(frequency + '%');
  d3Select("#filter-sa-flipping-frequency").property("value", frequency);

  // Enabling/Disabling SA parameters based on frequency
  const onlyDoingFlipping = frequency === 100;
  d3SelectAll("#filter-sa-temperature,#filter-sa-ratio,p.calculate-temperature-ratio input")
    .attr("disabled", onlyDoingFlipping ? true : null);
  d3SelectAll("div.filter-sa-temperature-div span,div.filter-sa-ratio-div span,p.calculate-temperature-ratio span,p.calculate-temperature-ratio input")
    .classed("disabled", onlyDoingFlipping);

  if (!onlyDoingFlipping) {
    // Checking for checkbox value and disabling the temperature/ratio inputs if true
    // NOTE: This only happens when frequency !== 100 because the inputs are enabled above automatically
    const checkboxValue = d3Select("p.calculate-temperature-ratio input").property("checked");
    if (checkboxValue) d3SelectAll("#filter-sa-temperature,#filter-sa-ratio").attr("disabled", true);
  }

  if (updateETA) calculateDeclutteringETA();
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
  d3Select(".chromosome-number-headline")
    .text(function() {
      const chromosomeSize = (dataChromosomes.length || 0).toString();
      const chromosomeSizeString = d3Format(",")(chromosomeSize);
      let textToShow = "";
      textToShow += chromosomeSize === "1" ? `${chromosomeSizeString} chromosome` :
        `${chromosomeSizeString} chromosomes`;
      return textToShow;
    });

  // Update block-number-headline with current block size
  d3Select(".block-number-headline")
    .text(function() {
      const blockSize = dataChords.length.toString();
      const blockSizeString = d3Format(",")(blockSize);
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

  d3Select(".flipped-blocks-headline")
    .text(function() {
      const blockSize = flippedBlockSize.toString();
      const blockSizeString = d3Format(",")(blockSize);
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
 * @param  {boolean} shouldUpdatePath            True if should update paths in genome
 *                                               view, false otherwise
 * @param  {number}  value                       Filtering value for connection block size
 * @return {undefined}                           undefined
 */
export function updateFilter({
  shouldUpdateBlockCollisions = false,
  shouldUpdatePath = false,
  value = 1
}) {
  // Adjust the text on the filter range slider
  const valueString = d3Format(",")(value);
  d3Select("#filter-block-size-value").text(value === 1 ? `${valueString} connection` : `${valueString} connections`);
  d3Select("#filter-block-size").property("value", value);

  if (shouldUpdatePath) {
    generateGenomeView({
      transition: { shouldDo: false },
      shouldUpdateBlockCollisions: shouldUpdateBlockCollisions,
      shouldUpdateLayout: false
    });
  }
};
