import * as d3 from 'd3';

import { generatePathGenomeView } from './generateGenomeView';

// Contants
import {
  WIDTH,
  HEIGHT
} from './constants';

/**
 * Fixes current IDs in collinearity file by removing 0 when
 * chromosome number is below 10 (e.g. (N09,N01) turns into (N9, N1))
 *
 * @param  {Object} currentCollinearity Current index with the similarity relationships
 * @return {Object}                  Object with sourceID and targetID fixed
 */
export function fixSourceTargetCollinearity(currentCollinearity) {
  let sourceID = currentCollinearity.source.split('g')[0].split('Bna')[1];
  let targetID = currentCollinearity.target.split('g')[0].split('Bna')[1];
  if (sourceID[1] == '0') {
    sourceID = sourceID.slice(0, 1) + sourceID.slice(2);
  }
  if (targetID[1] == '0') {
    targetID = targetID.slice(0, 1) + targetID.slice(2);
  }

  return {
    source: sourceID,
    target: targetID
  }
};

/**
 * Get the array of selected checkboxes
 *
 * @return {Array<string>} Array of selected checkboxes
 */
export function getSelectedCheckboxes() {
  const selectedCheckbox = []; // Array that stores the value of selected checkboxes
  d3.selectAll(".chr-box").each(function() {
    const cb = d3.select(this);
    if (cb.property("checked")) {
      selectedCheckbox.push(cb.property("value"));
    }
  });

  return selectedCheckbox;
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
    const currentSource = geneDictionary[blockArray[i].source];
    const currentTarget = geneDictionary[blockArray[i].target];

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
  }
};

/**
 * Removes block view with transition
 *
 * @param  {number}    Transition time
 * @return {undefined} undefined
 */
export function removeBlockView(transitionTime = 0) {
  if (transitionTime > 0) {
    d3.select("body").select("#block-view-container")
      .style("opacity", 1)
      .transition()
      .duration(transitionTime)
      .style("opacity", 0)
      .remove();
  } else {
    d3.select("body").select("#block-view-container").remove();
  }
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
 *  Updates the filter range value for block size
 *
 * @param  {number} value             Filtering value for connection block size
 * @param  {boolean} shouldUpdatePath True if should update paths in genome
 *                                    view, false otherwise
 * @return {undefined}                undefined
 */
export function updateFilter(value = 1, shouldUpdatePath = false) {
  // Adjust the text on the filter range slider
  d3.select("#filter-block-size-value").text(value === 1 ? `${value} connection` : `${value} connections`);
  d3.select("#filter-block-size").property("value", value);

  if (shouldUpdatePath) {
    generatePathGenomeView({
      shouldDo: false
    });
  }
};
