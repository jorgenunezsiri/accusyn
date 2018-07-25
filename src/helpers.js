import * as d3 from 'd3';

import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import sortedUniq from 'lodash/sortedUniq';

import generateGenomeView from './genomeView/generateGenomeView';

import {
  getDefaultChromosomeOrder
} from './variables/currentChromosomeOrder';

// Contants
import {
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
    currentClassCheckboxes: currentClassCheckboxes,
    selectedCheckboxes: selectedCheckboxes
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
 * Get the value of a querystring
 *
 * @param  {String} field The field to get the value of
 * @param  {String} url   The URL to get the value from (optional)
 * @return {String}       The field value
 */
export function getQueryString(field, url) {
  const href = url ? url : window.location.href;
  const reg = new RegExp('[?&]' + field + '=([^&#]*)', 'i');
  const string = reg.exec(href);
  return string ? string[1] : null;
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

  } catch(error) {
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
  let minSource = 100000000;
  let maxTarget = 0;
  let minTarget = 100000000;
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
  const collator = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});

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

  // Rotate the genome view
  d3.select("g.all")
    .attr("transform", `translate(${WIDTH / 2},${HEIGHT / 2}) rotate(${((-1) * (nAngle + nDragging))})`);
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
