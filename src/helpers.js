import * as d3 from 'd3';

import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import sortedUniq from 'lodash/sortedUniq';

import generateGenomeView from './genomeView/generateGenomeView';

import { getDefaultChromosomeOrder } from './variables/currentChromosomeOrder';
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

  const visitedChr = {}; // Visited chromosomes dictionary
  for (let i = 0; i < chromosomeOrder.length; i++) {
    visitedChr[chromosomeOrder[i]] = false;
  }

  visitedChr[selectedChromosomes[0]] = true;
  for (let j = 0; j < chromosomeOrder.length; j++) {
    // If a connection is found, mark current chromosome as visited
    if (find(connectionDictionary[selectedChromosomes[0]], ['connection', chromosomeOrder[j]])) {
      visitedChr[chromosomeOrder[j]] = true;
    }
  }

  d3.selectAll(".chr-box").each(function(d) {
    d3.select(this.parentNode.parentNode).select("span.chr-box-extra").html(function() {
      // Finding the index of the connection in the dictionary
      const indexConnection = findIndex(connectionDictionary[selectedChromosomes[0]], ['connection', d]);
      let connectionAmount = 0;
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
      d3.select(this.parentNode).classed("disabled", false);
    } else {
      // Only disable not visited chromosomes
      d3.select(this).attr("disabled", true);
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
    d3.select(this).attr("disabled", null);
  });
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
    const selectedHeatmapTrack = d3.select("div.heatmap-track-input select") &&
    d3.select("div.heatmap-track-input select").property("value");
    const trackPlacementHeatmapTrack = d3.select("div.heatmap-track-placement select") &&
    d3.select("div.heatmap-track-placement select").property("value");

    const selectedHistogramTrack = d3.select("div.histogram-track-input select") &&
    d3.select("div.histogram-track-input select").property("value");
    const trackPlacementHistogramTrack = d3.select("div.histogram-track-placement select") &&
    d3.select("div.histogram-track-placement select").property("value");

    // TODO: Come back to this after generalizing the additional tracks
    // Need to include current position attribute inside each track object,
    // and update it accordingly
    let howManyOutside = 0;
    if (selectedHeatmapTrack !== 'None' && trackPlacementHeatmapTrack === 'Outside') howManyOutside++;
    if (selectedHistogramTrack !== 'None' && trackPlacementHistogramTrack === 'Outside') howManyOutside++;

    if (howManyOutside >= 1) {
      // Decreasing 6% of scale -> (100 - (6 * #ofTracksOutside) / 100
      scale = (100 - (SCALE_DECREASE * howManyOutside)) / 100;
      translate.width = translate.width + (TRANSLATE_INSCREASE * howManyOutside);
      translate.height = translate.height + (TRANSLATE_INSCREASE * howManyOutside);
    }
  }

  console.log('ROTATE, SCALE, AND TRANSLATE: ', rotate, scale, translate);

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
  const selectedHeatmapTrack = d3.select("div.heatmap-track-input select") &&
    d3.select("div.heatmap-track-input select").property("value");
  const trackPlacementHeatmapTrack = d3.select("div.heatmap-track-placement select") &&
    d3.select("div.heatmap-track-placement select").property("value");

  const selectedHistogramTrack = d3.select("div.histogram-track-input select") &&
    d3.select("div.histogram-track-input select").property("value");
  const trackPlacementHistogramTrack = d3.select("div.histogram-track-placement select") &&
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
    console.log('HEATMAP AND HISTOGRAM FOR CHORD RADIUS: ', heatmap, histogram);
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
 * Async function to check if an url is valid
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

  let maxSource = 0;
  let minSource = Number.MAX_SAFE_INTEGER;
  let maxTarget = 0;
  let minTarget = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < blockArray.length; i++) {
    const currentSource = geneDictionary[blockArray[i].connectionSource];
    const currentTarget = geneDictionary[blockArray[i].connectionTarget];

    minSource = Math.min(minSource, currentSource.start);
    maxSource = Math.max(maxSource, currentSource.end);

    minTarget = Math.min(minTarget, currentTarget.start);
    maxTarget = Math.max(maxTarget, currentTarget.end);
  }

  return {
    blockLength: blockArray.length,
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
      .style("opacity", 0)
      .remove();
  } else {
    d3.select("#block-view-container").remove();
  }
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
    return current.replace(/[^a-zA-Z]+/g, '');
  });

  // Creating a duplicate-free version of gffCopy array
  // sortedUniq function is optimized for sorted arrays
  // e.g. gffCopy = ["at"]
  gffCopy = sortedUniq(gffCopy);

  // Creating gffPartitionedDictionary to partition the gffKeys with their tags
  const gffPartitionedDictionary = {};
  for (let i = 0; i < gffCopy.length; i++) {
    if (!(gffCopy[i] in gffPartitionedDictionary)) {
      gffPartitionedDictionary[gffCopy[i]] = [];
    }

    for (let j = 0; j < gffKeys.length; j++) {
      if (gffKeys[j].includes(gffCopy[i])) {
        gffPartitionedDictionary[gffCopy[i]].push(gffKeys[j]);
      }
    }
  }

  // Sorting gffCopy keys in descending order when having more than 1 key,
  // meaning more than 1 species to visualize
  if (gffCopy.length > 1) {
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
 * Updating the label showing the number of blocks and flipped blocks
 *
 * @param  {Array<Object>} dataChords Plotting information for each block chord
 * @return {undefined}                undefined
 */
export function updateBlockNumberHeadline(dataChords) {
  // Update block-number-headline with current block size
  d3.select(".block-number-headline")
    .text(function() {
      const blockSize = dataChords.length.toString();
      let textToShow = "";
      textToShow += blockSize === "1" ? `${blockSize} block` :
        `${blockSize} blocks`;
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
      let textToShow = "";
      textToShow += blockSize === "1" ? `${blockSize} flipped block` :
        `${blockSize} flipped blocks`;
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
  d3.select("#filter-block-size-value").text(value === 1 ? `${value} connection` : `${value} connections`);
  d3.select("#filter-block-size").property("value", value);

  if (shouldUpdatePath) {
    generateGenomeView({
      transition: { shouldDo: false },
      shouldUpdateBlockCollisions: shouldUpdateBlockCollisions,
      shouldUpdateLayout: shouldUpdateLayout
    });
  }
};
