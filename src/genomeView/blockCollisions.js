import {
  easeLinear as d3EaseLinear,
  format as d3Format,
  ribbon as d3Ribbon,
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';

// ParallelJS
import Parallel from 'paralleljs';

import undoManager, { updateUndoRedoButtons } from '../vendor/undoManager';

import { svgAsPngUri } from 'save-svg-as-png';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import difference from 'lodash/difference';
import findIndex from 'lodash/findIndex';
import flattenDeep from 'lodash/flattenDeep';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import union from 'lodash/union';

import generateGenomeView from './generateGenomeView';
import { resetZoomBlockView } from './../generateBlockView';
import { updateAdditionalTracksWhileDragging } from './dragging';
import {
  flipGenesPosition,
  getChordsRadius,
  getInnerAndOuterRadiusAdditionalTracks,
  getSelectedCheckboxes,
  partitionGffKeys,
  removeNonLettersFromString,
  renderReactAlert,
  resetInputsAndSelectsOnAnimation,
  roundFloatNumber,
  updateRatio,
  updateTemperature
} from './../helpers';
import { getCircosObject } from './../variables/myCircos';
import { getBlockDictionary } from './../variables/blockDictionary';
import {
  getCollisionCount,
  getCollisionCalculationTime,
  getSuperimposedCollisionCount,
  getTotalNumberOfIterations,
  setCollisionCount,
  setCollisionCalculationTime,
  setSuperimposedCollisionCount,
  setTotalNumberOfIterations
} from './../variables/collisionCount';
import {
  setCurrentChromosomeOrder,
  toChromosomeOrder
} from './../variables/currentChromosomeOrder';
import {
  getCurrentFlippedChromosomes,
  setCurrentFlippedChromosomes,
  setPreviousFlippedChromosomes
} from './../variables/currentFlippedChromosomes';
import { getCurrentSelectedBlock } from './../variables/currentSelectedBlock';
import {
  getDataChords,
  setDataChords
} from './../variables/dataChords';
import {
  getDataChromosomes,
  setDataChromosomes
} from './../variables/dataChromosomes';
import {
  getSavedSolutions,
  setSavedSolutions
} from './../variables/savedSolutions';

// Constants
import {
  CIRCOS_CONF,
  DEGREES_TO_RADIANS,
  FLIPPING_CHROMOSOME_TIME,
  RADIANS_TO_DEGREES,
  TRANSITION_SWAPPING_TIME
} from './../variables/constants';

/**
 * Generates the angles for the chord inside the chromosomes data
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Object} chord           Current chord
 * @param  {string} reference       Type of reference (i.e. source or target)
 * @return {Object}                 Chord angles
 */
export function getChordAngles(dataChromosomes, chord, reference) {
  const currentObject = dataChromosomes.find((element) => {
    return element.id === chord[reference].id;
  });

  const startAngle = currentObject.start + (chord[reference].start /
    currentObject.len) * (currentObject.end - currentObject.start);
  const endAngle = currentObject.start + (chord[reference].end /
    currentObject.len) * (currentObject.end - currentObject.start);

  return {
    start: startAngle,
    // The following is the same as (startAngle + endAngle) / 2.0
    middle: startAngle + (endAngle - startAngle) / 2.0,
    end: endAngle
  }
};

/**
 * Generates the transition to add a stroke to flipped chromosomes
 *
 * @param  {string} currentChr       Current chromosome
 * @param  {boolean} [flipping=true] Flag to determine whether or not to add the stroke
 * @return {undefined}               undefined
 */
export function transitionFlipChromosomeStroke(currentChr, flipping = true) {
  // To keep track of the value of highlight flipped chromosomes checkbox
  const highlightFlippedChromosomes = d3Select("p.highlight-flipped-chromosomes input").property("checked");
  const flippedPalette = d3Select("div.chromosomes-palette select").property("value") === 'Flipped';
  const stroke = flippedPalette ? 'gold' : '#ea4848';

  d3Select(`g.${currentChr} path#arc-label${currentChr}`)
    .transition()
    .duration(FLIPPING_CHROMOSOME_TIME - 25)
    .attr("stroke", (highlightFlippedChromosomes && flipping) ? stroke : "none")
    .attr("stroke-width", flipping ? "2px" : "0");
};

/**
 * Generates the flipping transition for the current chromosome
 *
 * @param  {string} currentChr                Current chromosome
 * @param  {Array<string>}  currentFlippedChromosomes List of flipped chromosomes
 * @param  {Array<Object>}  dataChromosomes   Current chromosomes in the Circos plot
 * @param  {Array<boolean>} [visitedBlock=[]] List of visited blocks
 * @return {Array<string>}                    List of affected chords in the transition
 */
export function transitionFlipping({
  currentChr,
  currentFlippedChromosomes,
  dataChromosomes,
  visitedBlock = []
}) {
  // Current fill dictionary
  const currentFill = {};

  if (!d3SelectAll(`path.chord.${currentChr}`).empty()) {
    const visitedBlockForFlipping = visitedBlock.slice();

    d3SelectAll("path.chord")
      .attr("opacity", 0.7);

    const blockDictionary = getBlockDictionary();
    const ribbon = d3Ribbon().radius(getChordsRadius());
    d3SelectAll(`path.chord.${currentChr}`)
      .transition()
      .duration(FLIPPING_CHROMOSOME_TIME - 25)
      .ease(d3EaseLinear)
      .attr("d", function(d) {
        const {
          source: { id: sourceID, value: { id: blockID } },
          target: { id: targetID }
        } = d;

        currentFill[blockID] = d3Select(this).style("fill");

        let raiseAndBlueColor = false;
        if (!isEmpty(visitedBlockForFlipping)) {
          if (visitedBlockForFlipping[blockID]) {
            d3Select(this).style("fill", currentFill[blockID]);
          } else {
            visitedBlockForFlipping[blockID] = true;
            raiseAndBlueColor = true;
          }
        } else raiseAndBlueColor = true; // visitedBlockForFlipping is not defined when manually flipping a chr

        if (raiseAndBlueColor) {
          d3Select(this).raise();
          d3Select(this).style("fill", "lightblue");
        }

        const { sourcePositions, targetPositions } = flipGenesPosition({
          blockPositions: blockDictionary[blockID].blockPositions,
          currentFlippedChromosomes: currentFlippedChromosomes,
          sourceID: sourceID,
          targetID: targetID
        });

        // (Un)Highlighting the flipped chromosomes with a stroke
        transitionFlipChromosomeStroke(sourceID, currentFlippedChromosomes.indexOf(sourceID) > (-1));
        transitionFlipChromosomeStroke(targetID, currentFlippedChromosomes.indexOf(targetID) > (-1));

        const positions = {
          source: {
            id: sourceID,
            start: sourcePositions.start,
            end: sourcePositions.end
          },
          target: {
            id: targetID,
            start: targetPositions.start,
            end: targetPositions.end
          }
        };

        // For source
        const sourceObject = getChordAngles(dataChromosomes, positions, 'source');
        let sourceStartAngle = sourceObject.start;
        let sourceEndAngle = sourceObject.end;

        // For target
        const targetObject = getChordAngles(dataChromosomes, positions, 'target');
        let targetStartAngle = targetObject.start;
        let targetEndAngle = targetObject.end;

        const sourceAngles = {
          startAngle: sourceStartAngle,
          endAngle: sourceEndAngle
        };

        const targetAngles = {
          startAngle: targetStartAngle,
          endAngle: targetEndAngle
        };

        return ribbon({
          source: sourceAngles,
          target: targetAngles
        });
      });

    setTimeout(() => {
      // Setting the fill style back
      d3SelectAll(`path.chord.${currentChr}`)
        .style("fill", (d) => currentFill[d.source.value.id]);
    }, FLIPPING_CHROMOSOME_TIME);
  }

  return Object.keys(currentFill);
};

/**
 * Determines if line from angle R1 to R2 intersects with line from angle R3 to R4
 *
 * @param  {number} R1 Angle to determine first set of points (a, b)
 * @param  {number} R2 Angle to determine second set of points (c, d)
 * @param  {number} R3 Angle to determine third set of points (p, q)
 * @param  {number} R4 Angle to determine fourth set of points (r, s)
 * @return {boolean}   True if there is collision, false otherwise
 *
 * Source: https://stackoverflow.com/a/24392281
 */
function intersects(R1, R2, R3, R4) {
  const a = Math.cos(R1),
    b = Math.sin(R1),
    c = Math.cos(R2),
    d = Math.sin(R2),
    p = Math.cos(R3),
    q = Math.sin(R3),
    r = Math.cos(R4),
    s = Math.sin(R4);
  const det = (c - a) * (s - q) - (r - p) * (d - b);

  if (det === 0) {
    return false;
  } else {
    const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  }
};

/**
 * Determines if chord is superimposed based on start and end angles
 *
 * @param  {number}  R1 First angle
 * @param  {number}  R2 Second angle
 * @return {boolean}    True if chord is superimposed based on angles
 */
function isSuperimposed(R1, R2) {
  return (
    (R1.start >= R2.start &&
      R1.start <= R2.end) ||
    (R1.end <= R2.end &&
      R1.end >= R2.start) ||

    (R2.start >= R1.start &&
      R2.start <= R1.end) ||
    (R2.end <= R1.end &&
      R2.end >= R1.start)
  );
};

/**
 * Get the number of block collisions using the source and target angles from current chords
 *
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @param  {boolean} shouldReturnPromise   True if should return JS Promise, false otherwise
 * @return {number} Number of collisions and superimposed collisions
 */
export function getBlockCollisions(dataChords, shouldReturnPromise = true) {
  const t0 = performance.now();
  let collisionCount = 0;
  let superimposedCollisionCount = 0;

  const dataChordsLength = dataChords.length;
  for (let i = 0; i < dataChordsLength; i++) {
    for (let j = i + 1; j < dataChordsLength; j++) {
      const R1 = dataChords[i].source.angle;
      const R2 = dataChords[i].target.angle;
      const R3 = dataChords[j].source.angle;
      const R4 = dataChords[j].target.angle;

      if (
        // Determining if same position lines are colliding
        intersects(R1.start, R2.start, R3.start, R4.start) ||
        intersects(R1.middle, R2.middle, R3.middle, R4.middle) ||
        intersects(R1.end, R2.end, R3.end, R4.end) ||

        // Determining if start and middle lines are colliding
        intersects(R1.start, R2.start, R3.middle, R4.middle) ||
        intersects(R1.middle, R2.middle, R3.start, R4.start) ||

        // Determining if middle and end lines are colliding
        intersects(R1.middle, R2.middle, R3.end, R4.end) ||
        intersects(R1.end, R2.end, R3.middle, R4.middle) ||

        // Determining if start and end lines are colliding
        intersects(R1.start, R2.start, R3.end, R4.end) ||
        intersects(R1.end, R2.end, R3.start, R4.start)
      ) {
        collisionCount++;

        // console.log("i j: ", dataChords[i].source.value.id, dataChords[j].source.value.id);
      }

      if (
        // dataChords[i]['source'] and dataChords[j]['target']
        isSuperimposed(R1, R4) ||

        // dataChords[i]['target'] and dataChords[j]['source']
        isSuperimposed(R2, R3) ||

        // dataChords[i]['target'] and dataChords[j]['target']
        isSuperimposed(R2, R4) ||

        // dataChords[i]['source'] and dataChords[j]['source']
        isSuperimposed(R1, R3)
      ) {
        superimposedCollisionCount++;
      }
    }
  }

  const t1 = performance.now();
  // Total time in seconds that getBlockCollisions function took to fully execute.
  const totalTime = (t1 - t0) / 1000;

  if (!shouldReturnPromise) {
    return {
      collisionCount,
      superimposedCollisionCount,
      totalTime
    };
  }

  return new Promise(resolve => {
    resolve({
      collisionCount,
      superimposedCollisionCount
    });
  });
};


/**
 * Assigns chord angles to dataChords before calling getBlockCollisions
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @return {undefined}                     undefined
 */
function assignChordAngles(dataChromosomes, dataChords) {
  const dataChordsLength = dataChords.length;

  for (let i = 0; i < dataChordsLength; i++) {
    dataChords[i].source.angle = getChordAngles(dataChromosomes, dataChords[i], 'source');
    dataChords[i].target.angle = getChordAngles(dataChromosomes, dataChords[i], 'target');
  }
}

/**
 * Updating the label of block collisions headline, so the user knows that
 * the calculation is in progress
 *
 * @return {undefined} undefined
 */
export function updateWaitingBlockCollisionHeadline() {
  d3Select(".block-collisions-headline")
    .html("<em>Updating block collisions ...</em>");

  d3Select(".filter-sa-hint")
    .style("color", "#000")
    .html("<em>Updating decluttering ETA ...</em>");

  d3Select(".superimposed-block-collisions-headline")
    .html("<em>Updating superimposed collisions ...</em>");
};

/**
 * Calculates decluttering ETA and updating the label with time and number of
 * iterations of the SA algorithm
 *
 * @return {undefined} undefined
 */
export function calculateDeclutteringETA() {
  const collisionCount = getCollisionCount();
  const totalTime = getCollisionCalculationTime();

  if (d3Select("p.calculate-temperature-ratio input").property("checked")) {
    // Update temperature and ratio based on block collisions
    // Default temperature/ratio is 40,000/0.02
    // Entering loop around 500 times
    let updatedTemperature = 111000, updatedRatio = 0.023;

    // Entering loop around 4000 times
    if (collisionCount <= 50) {
      updatedTemperature = 165500;
      updatedRatio = 0.003;
    }

    // Update temperature/ratio to 166,500/0.004 if collision count is between 50 and 100
    // Entering loop around 3000 times
    if (collisionCount > 50 && collisionCount <= 100) {
      updatedTemperature = 166500;
      updatedRatio = 0.004;
    }

    // Update temperature/ratio to 170,000/0.008 if collision count is between 100 and 500
    // Entering loop around 1500 times
    if (collisionCount > 100 && collisionCount <= 500) {
      updatedTemperature = 170000;
      updatedRatio = 0.008;
    }

    // Entering loop around 1000 times
    if (collisionCount > 500 && collisionCount <= 1000) {
      updatedTemperature = 174000;
      updatedRatio = 0.012;
    }

    // Entering loop around 150 times
    if (collisionCount >= 10000) {
      updatedTemperature = 119000;
      updatedRatio = 0.075;
    }

    // Entering loop around 100 times
    if (collisionCount >= 100000) {
      updatedTemperature = 105000;
      updatedRatio = 0.11;
    }

    updateTemperature(updatedTemperature, false);
    updateRatio(updatedRatio, false);
  }

  // Filtering value for temperature
  const filterTemperatureValue = Number(!d3Select('.filter-sa-temperature-div #filter-sa-temperature').empty() &&
    d3Select('.filter-sa-temperature-div #filter-sa-temperature').property("value")) || 5000;

  // Filtering value for ratio
  const filterRatioValue = Number(!d3Select('.filter-sa-ratio-div #filter-sa-ratio').empty() &&
    d3Select('.filter-sa-ratio-div #filter-sa-ratio').property("value")) || 0.05;

  console.log('FILTER TEMP AND RATIO: ', filterTemperatureValue, filterRatioValue);

  let temperature = filterTemperatureValue;
  let ratio = filterRatioValue;

  let howMany = 0;
  const complementRatio = (1 - ratio);

  while (temperature > 1.0) {
    howMany++;

    temperature *= complementRatio;
  }

  // This is the final time in seconds
  const finalTime = roundFloatNumber(totalTime * howMany, 2);
  setTotalNumberOfIterations(howMany);

  console.log('HOW MANY TIMES NEW: ', howMany);
  console.log('time and totalTime: ', totalTime, finalTime);

  let colorMessage = "green";
  if (finalTime > 60) colorMessage = "#ffb42f"; // yellow-ish
  if (finalTime > 120) colorMessage = "red";

  d3Select('.filter-sa-hint-title')
    .attr("display", "block")
    .text("Decluttering ETA:");

  d3Select(".filter-sa-hint")
    .attr("display", "block")
    .style("color", colorMessage)
    .text(function() {
      let textToShow = "";
      // More info: https://stackoverflow.com/a/6118983
      const hours = Math.trunc(finalTime / 3600).toString();
      const minutes = Math.trunc((finalTime % 3600) / 60).toString();
      const seconds = Math.trunc(finalTime % 60).toString();

      let finalTimeString = "";
      if (hours !== '0') {
        // If hours is not zero, then set it with at least two characters
        finalTimeString += `${hours.padStart(2, '0')}h `;
      }

      if (minutes !== '0') {
        // If minutes is not zero, then set it with at least two characters
        finalTimeString += `${minutes.padStart(2, '0')}m `;
      }

      if (seconds !== '0') {
        if (finalTimeString === '') {
          // If seconds is not zero, and finalTimeString is empty,
          // then set seconds without padding and the whole 'seconds' word
          // e.g. above zero case: 1, 2, 38 seconds ...
          finalTimeString += (seconds === '1') ? `${seconds} second` :
            `${seconds} seconds`;
        } else {
          // If seconds is not zero and finalTimeString is not empty,
          // then set seconds with padding and abbreviation
          finalTimeString += `${seconds.padStart(2, '0')}s`;
        }
      }

      if (seconds === '0' && finalTimeString === '') {
        // Note: This can happen because 'seconds' is an integer variable
        // If seconds is still zero, and finalTimeString is empty,
        // then set it with finalTime (which has the accurate float time
        // in seconds rounded to two decimals)
        // e.g. below zero case: 0.55, 0.32 seconds ...
        finalTimeString += `${finalTime} seconds`;
      }

      if (collisionCount === 0) textToShow += '0 seconds';
      else textToShow += `${finalTimeString}`;

      const howManyString = d3Format(",")(howMany);

      if (howMany === 1) textToShow += `, ${howManyString} iteration`;
      else textToShow += ` - ${howManyString} iterations`;

      return textToShow;
    });
};

/**
 * Updating the label showing the number of block collisions
 * NOTE: Using paralleljs to do the calculation asynchronously
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @return {undefined}                     undefined
 */
export function updateBlockCollisionHeadline(dataChromosomes, dataChords) {
  console.log('Updating block collision headline !!!');
  updateWaitingBlockCollisionHeadline();

  // Disabling minimize collisions and save layout buttons until collision counts
  // are calculated
  d3Select(".best-guess > button")
    .attr("disabled", true);

  d3Select(".save-layout > button")
    .attr("disabled", true);

  // I want to get the results from the last set of chromosomes that was called
  setDataChromosomes(dataChromosomes);
  setDataChords(dataChords);

  const p = new Parallel({
      dataChords: dataChords
    })
    .require(getBlockCollisions)
    .require(getChordAngles)
    .require(intersects)
    .require(isSuperimposed);

  p.spawn(function(data) {
    return getBlockCollisions(data.dataChords, false);
  }).then(function(data) {
    const {
      collisionCount,
      superimposedCollisionCount,
      totalTime
    } = data;

    const currentDataChromosomes = getDataChromosomes();
    const currentDataChords = getDataChords();

    // Only update the collision count of the latest layout (saved globally).
    // This is to update it once.
    const shouldUpdateCollisionCount = isEqual(currentDataChromosomes, dataChromosomes) &&
      isEqual(currentDataChords, dataChords);

    if (shouldUpdateCollisionCount) {
      // Saving up-to-date collision counts
      setCollisionCount(collisionCount);
      setCollisionCalculationTime(totalTime);
      setSuperimposedCollisionCount(superimposedCollisionCount);

      console.log("COLLISION COUNT: " + collisionCount);

      // Enabling minimize collisions, save layout, and show saved layout
      // after calculations are done
      d3Select(".best-guess > button")
        .attr("disabled", null);

      d3Select(".save-layout > button")
        .attr("disabled", null);

      // Update block-collisions-headline with current collision count
      d3Select(".block-collisions-headline")
        .text(function() {
          let textToShow = "";
          const collisionCountString = d3Format(",")(collisionCount);
          textToShow += collisionCount === 1 ?
            `${collisionCountString} block collision` : `${collisionCountString} block collisions`;
          return textToShow;
        });

      // Update block-collisions-headline with current collision count
      d3Select(".superimposed-block-collisions-headline")
        .text(function() {
          let textToShow = "";
          const superimposedCollisionCountString = d3Format(",")(superimposedCollisionCount);
          textToShow += superimposedCollisionCount === 1 ?
            `${superimposedCollisionCountString} superimposed collision` :
            `${superimposedCollisionCountString} superimposed collisions`;
          return textToShow;
        });

      // ETA info
      calculateDeclutteringETA();
    }
  });
};

/**
 * Computes the minimum swaps required to sort an array
 *
 * @param  {Array<number>} arr Data array
 * @return {Object} Minimum swaps number and swap positions
 */
function minSwapsToSort(arr) {
  const n = arr.length;

  const arrPos = [];
  for (let i = 0; i < n; i++) {
    arrPos.push({
      first: arr[i],
      second: i
    });
  }

  arrPos.sort(function compare(a, b) {
    if (a.first < b.first) return -1;
    if (a.first > b.first) return 1;
    return 0;
  });

  let visited = Array(n).fill(false);
  let ans = 0;
  let swapPositions = [];

  for (let i = 0; i < n; i++) {
    if (visited[i] || arrPos[i].second === i) {
      continue;
    }

    let cycleSize = 0;
    let j = i;

    while (!visited[j]) {
      visited[j] = true;

      j = arrPos[j].second;
      if (arrPos[i].second !== arrPos[j].second) {
        swapPositions.push([arrPos[i].second,
          arrPos[j].second
        ]);
      }

      cycleSize++;
    }

    ans += (cycleSize - 1);
  }

  return {
    answer: ans,
    swapPositions: swapPositions
  };
};

/**
 * Minimum number of swaps to make array B same as array A
 *
 * @param  {Array<string>} a First array of the order of chromosomes
 * @param  {Array<string>} b Second array of the order of chromosomes
 * @return {Array<Array<string>>} swapPositions
 *
 * Source: https://www.geeksforgeeks.org/minimum-swaps-to-make-two-array-identical/
 */
function minSwapToMakeArraySame(a, b) {
  if (a.length !== b.length) return [];

  const n = a.length;

  let mapDictionary = {};
  for (let i = 0; i < n; i++) {
    mapDictionary[b[i]] = i;
  }

  let modifiedB = [];
  for (let i = 0; i < n; i++) {
    modifiedB[i] = mapDictionary[a[i]];
  }

  const ans = minSwapsToSort(modifiedB, n);

  modifiedB = b.slice();
  const swapPositions = ans.swapPositions.map(function(x) {
    const toReturn = [modifiedB[x[0]], modifiedB[x[1]]];
    // Doing the swap to return right swapped elements
    const temp = modifiedB[x[0]];
    modifiedB[x[0]] = modifiedB[x[1]];
    modifiedB[x[1]] = temp;

    return toReturn;
  });

  return swapPositions;
};

/**
 * Calculates the angle for doing the swapping transition
 *
 * @param  {Array<Object>}  dataChromosomes Data for current chromosomes in the Circos plot
 * @param  {Array<Object>}  bestSolution    Data for best solution chromosomes
 * @param  {string}        currentChr       ID of current chromosome to do the transition
 * @return {undefined}                      undefined
 */
function calculateAngleTransitionSwap(dataChromosomes, bestSolution, currentChr) {
  let angle = 0;

  const firstPositionOld = findIndex(dataChromosomes, ['id', currentChr]);
  const firstPositionNew = findIndex(bestSolution, ['id', currentChr]);

  let finalStartPosition = bestSolution[firstPositionNew].start;
  let previousStartPosition = dataChromosomes[firstPositionOld].start;

  if (finalStartPosition > previousStartPosition) {
    angle = (finalStartPosition -
      previousStartPosition) * RADIANS_TO_DEGREES;
  } else if (finalStartPosition < previousStartPosition) {
    angle = (360.0 + (finalStartPosition * RADIANS_TO_DEGREES)) -
      (previousStartPosition * RADIANS_TO_DEGREES);
  }
  // else angle is 0 by default

  return angle;
};

/**
 * Generates the transition from old chromosome data to new one
 *
 * @param  {Array<Object>}  dataChromosomes  Data for current chromosomes in the Circos plot
 * @param  {Array<Object>}  bestSolution     Data for best solution chromosomes
 * @param  {number}         angle            Current swapping angle
 * @param  {string}         currentChr       ID of current chromosome to do the transition
 * @param  {Array<Object>}  hasMovedDragging Dictionary to know when each chromosome moves
 * @return {undefined}                       undefined
 */
function transitionSwapOldToNew({
  dataChromosomes,
  bestSolution,
  angle,
  currentChr,
  hasMovedDragging
}) {
  d3Select(`.cs-layout g.${currentChr}`)
    .raise()
    .transition()
    .duration(TRANSITION_SWAPPING_TIME)
    .ease(d3EaseLinear)
    .attr("transform", `rotate(${angle})`);

  updateAdditionalTracksWhileDragging({
    angleValue: angle,
    chromosome: currentChr,
    dataChromosomes: dataChromosomes,
    transitionDuration: TRANSITION_SWAPPING_TIME
  });

  if (!d3SelectAll(`path.chord.${currentChr}`).empty()) {
    const ribbon = d3Ribbon().radius(getChordsRadius());

    d3SelectAll("path.chord")
      .attr("opacity", 0.7);

    d3SelectAll(`path.chord.${currentChr}`)
      .raise()
      .transition()
      .duration(TRANSITION_SWAPPING_TIME)
      .ease(d3EaseLinear)
      .attr("d", function(d) {
        const {
          source: { id: sourceID },
          target: { id: targetID }
        } = d;

        // For source
        const sourceObject = d.source.angle;
        let sourceStartAngle = sourceObject.start;
        let sourceEndAngle = sourceObject.end;

        // For target
        const targetObject = d.target.angle;
        let targetStartAngle = targetObject.start;
        let targetEndAngle = targetObject.end;

        const angleToMove = angle * DEGREES_TO_RADIANS;

        if (sourceID !== targetID) {
          if (sourceID === currentChr) {
            sourceStartAngle += angleToMove;
            sourceEndAngle += angleToMove;

            if (hasMovedDragging[targetID].hasMoved) {
              const extraAngle = hasMovedDragging[targetID].angle * DEGREES_TO_RADIANS;
              targetStartAngle += extraAngle;
              targetEndAngle += extraAngle;
            }
          }

          if (targetID === currentChr) {
            targetStartAngle += angleToMove;
            targetEndAngle += angleToMove;

            if (hasMovedDragging[sourceID].hasMoved) {
              const extraAngle = hasMovedDragging[sourceID].angle * DEGREES_TO_RADIANS;
              sourceStartAngle += extraAngle;
              sourceEndAngle += extraAngle;
            }
          }
        } else {
          sourceStartAngle += angleToMove;
          sourceEndAngle += angleToMove;

          targetStartAngle += angleToMove;
          targetEndAngle += angleToMove;
        }

        const sourceAngles = {
          startAngle: sourceStartAngle,
          endAngle: sourceEndAngle
        };

        const targetAngles = {
          startAngle: targetStartAngle,
          endAngle: targetEndAngle
        };

        return ribbon({
          source: sourceAngles,
          target: targetAngles
        });
      });
  }
};

/**
 * Save configuration to saved solutions dictionary
 *
 * @param  {Array<string>} bestFlippedChromosomes Data for best flipped chromosomes
 * @param  {Array<Object>} bestSolution   Data for best solution chromosomes
 * @param  {number}        collisionCount Number of collisions
 * @param  {Array<Object>} dataChords     Plotting information for each block chord
 * @return {undefined}                    undefined
 */
export function saveToSolutionsDictionary({
  bestFlippedChromosomes,
  bestSolution,
  collisionCount,
  dataChords
}) {
  const darkMode = d3Select("p.dark-mode input").property("checked");
  const backgroundColor = darkMode ? '#222222' : '#ffffff';
  const genomeView = document.getElementById('main-container');

  // Saving current genome view as PNG uri
  svgAsPngUri(genomeView, {
    backgroundColor: backgroundColor,
    encoderOptions: 1, // 1 means top image quality
    encoderType: 'image/png'
  }, function(uri) {
    // Entering the callback function
    const currentObject = {
      availableTracks: getInnerAndOuterRadiusAdditionalTracks().availableTracks,
      bestFlippedChromosomes: cloneDeep(bestFlippedChromosomes),
      bestSolution: cloneDeep(bestSolution),
      blocksColor: d3Select("div.blocks-color select").property("value"),
      collisionCount: collisionCount,
      dataChords: cloneDeep(dataChords),
      darkMode: darkMode,
      drawingOrder: d3Select('div.draw-blocks-order select').property("value"),
      filter: {
        blockSize: d3Select('.filter-connections-div #filter-block-size').property("value"),
        connections: d3Select('.filter-connections-div select').property("value")
      },
      genomePalette: d3Select("div.chromosomes-palette select").property("value"),
      highlightFlippedBlocks: d3Select("p.highlight-flipped-blocks input").property("checked"),
      highlightFlippedChromosomes: d3Select("p.highlight-flipped-chromosomes input").property("checked"),
      imageSrc: uri,
      rotateValue: d3Select("#nAngle-genome-view").property("value"),
      selectedBlock: getCurrentSelectedBlock(),
      selectedCheckboxes: cloneDeep(getSelectedCheckboxes().selectedCheckboxes),
      showAllChromosomes: d3Select("p.show-all input").property("checked"),
      showSelfConnections: {
        chr: d3Select("p.show-self-connections-chr input").property("checked"),
        genome: !d3Select("p.show-self-connections-genome input").empty() &&
          d3Select("p.show-self-connections-genome input").property("checked")
      }
    };

    const savedSolutions = getSavedSolutions();
    savedSolutions.push(currentObject);
    setSavedSolutions(savedSolutions);

    // Showing alert using react
    renderReactAlert(`The layout was successfully saved as the stamp #${savedSolutions.length}.`, "success");
  });
};

/**
 * Produces the swapping animation of each chromosome positions
 *
 * @param  {Array<Object>} dataChromosomes Data for current chromosomes in the Circos plot
 * @param  {Array<Object>} bestSolution    Data for best solution chromosomes
 * @param  {Array<Array<string>>} swapPositions Swap positions array
 * @param  {Array<string>} bestFlippedChromosomes Data for best flipped chromosomes
 * @return {undefined}                     undefined
 */
export function swapPositionsAnimation({
  dataChromosomes,
  bestSolution,
  swapPositions,
  bestFlippedChromosomes
}) {
  const allFlippedChromosomes = getCurrentFlippedChromosomes();
  let transitionTime = 0, positionsNotSwappedTransitionTime = 0, flippedTransitionTime = 0;
  const swapPositionsLength = swapPositions.length;

  if (swapPositionsLength > 0 || !isEqual(allFlippedChromosomes, bestFlippedChromosomes)) {
    // Setting chromosome order with all the chromosomes
    // NOTE: Current chromosome order variable always includes all the chromosomes
    setCurrentChromosomeOrder(toChromosomeOrder(bestSolution, true));

    // Showing alert using react
    renderReactAlert("The layout was successfully updated.", "success");

    const chromosomeOrder = toChromosomeOrder(dataChromosomes);
    const chromosomeOrderLength = chromosomeOrder.length;

    let visited = [];
    let hasMovedDragging = [];
    for (let i = 0; i < chromosomeOrderLength; i++) {
      hasMovedDragging[chromosomeOrder[i]] = {
        angle: 0,
        hasMoved: false
      };
      visited[chromosomeOrder[i]] = false;
    }

    for (let i = 0; i < swapPositionsLength; i++) {
      visited[swapPositions[i][0]] = true;
      visited[swapPositions[i][1]] = true;
    }

    const positionsNotBeingSwapped = [];
    for (let i = 0; i < chromosomeOrderLength; i++) {
      if (visited[chromosomeOrder[i]] === false) {
        positionsNotBeingSwapped.push(chromosomeOrder[i]);
      }
    }
    const positionsNotBeingSwappedLength = positionsNotBeingSwapped.length;

    console.log('POSITIONS NOT SWAPPED: ', positionsNotBeingSwapped);

    transitionTime = 0;
    let index = 0;

    while (transitionTime < (TRANSITION_SWAPPING_TIME * swapPositionsLength) &&
      index < swapPositionsLength) {
      const firstAngle = calculateAngleTransitionSwap(dataChromosomes, bestSolution, swapPositions[index][0]);
      const secondAngle = calculateAngleTransitionSwap(dataChromosomes, bestSolution, swapPositions[index][1]);

      // Only do swap transition with chromosomes if one of the angles from the
      // swapPositions pair is not equal to zero
      if (firstAngle !== 0 || secondAngle !== 0) {
        (function(transitionTime, index) {
          setTimeout(function() {
            /*
             * The angle is only affecting each chromosome in their first rotation.
             * It should be the same to just traverse in order, and change each chromosome
             * (That would imply 19 swaps always)
             * Right now we are getting less than 19 (so it's better in theory)
             */
            transitionSwapOldToNew({
              dataChromosomes: dataChromosomes,
              bestSolution: bestSolution,
              angle: firstAngle,
              currentChr: swapPositions[index][0],
              hasMovedDragging: hasMovedDragging
            });
            hasMovedDragging[swapPositions[index][0]] = {
              angle: firstAngle,
              hasMoved: true
            };

            transitionSwapOldToNew({
              dataChromosomes: dataChromosomes,
              bestSolution: bestSolution,
              angle: secondAngle,
              currentChr: swapPositions[index][1],
              hasMovedDragging: hasMovedDragging
            });
            hasMovedDragging[swapPositions[index][1]] = {
              angle: secondAngle,
              hasMoved: true
            };

            console.log('SWAP POSITIONS i: ', index, swapPositions[index]);
          }, transitionTime);
        })(transitionTime, index);

        transitionTime += TRANSITION_SWAPPING_TIME;
      }

      index++;
    }

    positionsNotSwappedTransitionTime = transitionTime;
    index = 0;

    while ((positionsNotSwappedTransitionTime - transitionTime) <
      (TRANSITION_SWAPPING_TIME * positionsNotBeingSwappedLength) &&
      index < positionsNotBeingSwappedLength) {
      const angle = calculateAngleTransitionSwap(dataChromosomes, bestSolution, positionsNotBeingSwapped[index]);
      // Only do swap transition with remaining chromosomes if their angle is not equal to zero
      if (angle !== 0) {
        (function(positionsNotSwappedTransitionTime, index) {
          setTimeout(function() {
            transitionSwapOldToNew({
              dataChromosomes: dataChromosomes,
              bestSolution: bestSolution,
              angle: angle,
              currentChr: positionsNotBeingSwapped[index],
              hasMovedDragging: hasMovedDragging
            });
            hasMovedDragging[positionsNotBeingSwapped[index]] = {
              angle: angle,
              hasMoved: true
            };

            console.log('POSITIONS NOT SWAPPED i: ', index, positionsNotBeingSwapped[index]);
          }, positionsNotSwappedTransitionTime);
        })(positionsNotSwappedTransitionTime, index);

        positionsNotSwappedTransitionTime += TRANSITION_SWAPPING_TIME;
      }

      index++;
    }

    flippedTransitionTime = positionsNotSwappedTransitionTime;
    index = 0;

    console.log('FLIPPED TRANSITION TIME: ', flippedTransitionTime);

    if (!isEqual(allFlippedChromosomes, bestFlippedChromosomes)) {
      // NOTE: In SA, best flipped chromosomes starts with the other flipped chromosomes from the global array
      setCurrentFlippedChromosomes(bestFlippedChromosomes);

      // All affected chromosomes that need to be checked: the previously flipped and the current best ones
      const unionFlippedChromosomes = union(allFlippedChromosomes, bestFlippedChromosomes);
      const unionFlippedChromosomesLength = unionFlippedChromosomes.length;

      // Setting affected chromosomes
      setPreviousFlippedChromosomes(unionFlippedChromosomes);

      const chrBlockDictionary = {};
      const blockChrDictionary = {};
      const visitedChrForFlipping = [];
      const visitedBlockForFlipping = [];

      for (let i = 0; i < unionFlippedChromosomesLength; i++) {
        visitedChrForFlipping[unionFlippedChromosomes[i]] = false;
      }

      /**
       * Checks for chromosomes that have all blocks visited
       *
       * @param  {Array<string>} affectedChromosomes Pair of affected chromosomes from current block
       * @return {undefined}                         undefined
       */
      function checkChrForFlipping(affectedChromosomes) {
        // List of blocks from source chromosome
        const sourceList = chrBlockDictionary[affectedChromosomes[0]];
        // List of blocks from target chromosome
        const targetList = chrBlockDictionary[affectedChromosomes[1]];

        let allTrue = true;
        for (let j = sourceList.length - 1; j >= 0; j--) {
          if (!visitedBlockForFlipping[sourceList[j].blockID]) {
            allTrue = false;
            break;
          }
        }

        if (allTrue) {
          visitedChrForFlipping[affectedChromosomes[0]] = true;
        }

        allTrue = true;
        for (let j = targetList.length - 1; j >= 0; j--) {
          if (!visitedBlockForFlipping[targetList[j].blockID]) {
            allTrue = false;
            break;
          }
        }

        if (allTrue) {
          visitedChrForFlipping[affectedChromosomes[1]] = true;
        }

        return;
      };

      const blockDictionary = getBlockDictionary();

      d3SelectAll("path.chord")
        .each(function(d) {
          const {
            source: { id: sourceID, value: { id: blockID } },
            target: { id: targetID }
          } = d;

          visitedBlockForFlipping[blockID] = false;
          const blockPositions = blockDictionary[blockID].blockPositions;

          const { sourcePositions, targetPositions } = flipGenesPosition({
            blockPositions: blockPositions,
            currentFlippedChromosomes: allFlippedChromosomes,
            sourceID: sourceID,
            targetID: targetID
          });

          const {
            sourcePositions: finalSourcePositions,
            targetPositions: finalTargetPositions
          } = flipGenesPosition({
            blockPositions: blockPositions,
            currentFlippedChromosomes: bestFlippedChromosomes,
            sourceID: sourceID,
            targetID: targetID
          });

          if (!(sourceID in chrBlockDictionary)) {
            chrBlockDictionary[sourceID] = [];
          }

          if (!(targetID in chrBlockDictionary)) {
            chrBlockDictionary[targetID] = [];
          }

          const positionsObject = {
            current: {
              source: sourcePositions,
              target: targetPositions
            },
            final: {
              source: finalSourcePositions,
              target: finalTargetPositions
            }
          };

          chrBlockDictionary[sourceID].push({
            blockID: blockID,
            positions: positionsObject
          });
          chrBlockDictionary[targetID].push({
            blockID: blockID,
            positions: positionsObject
          });


          if (!(blockID in blockChrDictionary)) {
            blockChrDictionary[blockID] = [];
          }

          // Each block has a pair of affected chromosomes
          blockChrDictionary[blockID].push(sourceID);
          blockChrDictionary[blockID].push(targetID);
        });

      console.log('CHR BLOCK DICTIONARY: ', chrBlockDictionary);
      console.log('BLOCK CHR DICTIONARY: ', blockChrDictionary);

      // bestFlippedChromosomes is assuming that the previous flipped chromosomes are going to be included
      // meaning that it is never going to be empty if we are at this point
      // With the exception of resetting the layout and restoring the default view (if it was saved)
      // For those cases, I can't take the initial and final positions and visited decisions into account

      if (bestFlippedChromosomes.length > 0) {
        for (let i = 0; i < unionFlippedChromosomesLength; i++) {
          d3SelectAll(`path.chord.${unionFlippedChromosomes[i]}`)
            .each(function(d) {
              const {
                source: { id: sourceID, value: { id: blockID } },
                target: { id: targetID }
              } = d;

              const affectedChromosomes = blockChrDictionary[blockID];
              const sourceList = chrBlockDictionary[affectedChromosomes[0]];
              const targetList = chrBlockDictionary[affectedChromosomes[1]];

              let sourcePositionsObject = {};
              let targetPositionsObject = {};
              for (let j = sourceList.length - 1; j >= 0 ; j--) {
                if (sourceList[j].blockID === blockID) {
                  sourcePositionsObject = cloneDeep(sourceList[j].positions);
                  break;
                }
              }

              for (let j = targetList.length - 1; j >= 0; j--) {
                if (targetList[j].blockID === blockID) {
                  targetPositionsObject = cloneDeep(targetList[j].positions);
                  break;
                }
              }

              // If positions are the same, mark block as visited
              if (isEqual(sourcePositionsObject.current, sourcePositionsObject.final) &&
                isEqual(targetPositionsObject.current, targetPositionsObject.final)) {
                visitedBlockForFlipping[blockID] = true;
              }

              // Checking and marking chromosomes as visited
              checkChrForFlipping(affectedChromosomes);
            });
        }

        console.log('VISITED BLOCK FOR FLIPPING: ', visitedBlockForFlipping);
        console.log('VISITED CHR FOR FLIPPING BEFORE: ');

        for (let r = 0; r < unionFlippedChromosomesLength; r++) {
          console.log('chr visited: ', unionFlippedChromosomes[r], visitedChrForFlipping[unionFlippedChromosomes[r]]);
        }
      }

      while ((flippedTransitionTime - positionsNotSwappedTransitionTime) <
        ((FLIPPING_CHROMOSOME_TIME + 25) * unionFlippedChromosomesLength) &&
        index < unionFlippedChromosomesLength) {
        // If all the blocks are not visited for the current chromosome or
        // current chromosome has blocks visible i.e. is present in dictionary
        if (!visitedChrForFlipping[unionFlippedChromosomes[index]] &&
          (unionFlippedChromosomes[index] in chrBlockDictionary)) {
          (function(flippedTransitionTime, index) {
            setTimeout(function() {
              if (visitedChrForFlipping[unionFlippedChromosomes[index]]) return;

              const affectedBlocks = transitionFlipping({
                currentChr: unionFlippedChromosomes[index],
                currentFlippedChromosomes: bestFlippedChromosomes,
                dataChromosomes: bestSolution,
                visitedBlock: visitedBlockForFlipping
              });

              console.log('affectedBlocks: ', affectedBlocks);
              const affectedBlocksLength = affectedBlocks.length;
              for (let j = 0; j < affectedBlocksLength; j++) {
                // Resetting zoom state object for all affected chords
                // Only resetting the chords that WERE present in the flipping animation
                const blockID = affectedBlocks[j];
                resetZoomBlockView(blockID);
                // Marking block as visited
                visitedBlockForFlipping[blockID] = true;
              }

              for (let j = 0; j < affectedBlocksLength; j++) {
                const blockID = affectedBlocks[j];
                const affectedChromosomes = blockChrDictionary[blockID];

                // Checking and marking chromosomes as visited
                checkChrForFlipping(affectedChromosomes);
              }

              console.log('VISITED CHR FOR FLIPPING AT INDEX: ', index, visitedChrForFlipping);

              console.log('POSITIONS FLIPPING i: ', index, unionFlippedChromosomes[index]);
            }, flippedTransitionTime);
          })(flippedTransitionTime, index);

          flippedTransitionTime += (FLIPPING_CHROMOSOME_TIME + 25);
        }

        index++;
      }
    }

    // TODO: Think about performance when calling generateGenomeView again
    setTimeout(() => {
      // Enabling inputs and selects after calling the animation
      resetInputsAndSelectsOnAnimation();
      updateUndoRedoButtons();

      generateGenomeView({
        transition: { shouldDo: false },
        shouldUpdateBlockCollisions: true,
        shouldUpdateLayout: true
      });
    }, TRANSITION_SWAPPING_TIME +
    transitionTime +
    (positionsNotSwappedTransitionTime - transitionTime) +
    (flippedTransitionTime - positionsNotSwappedTransitionTime));
  }
}

/**
 * Calls swap positions animation
 *
 * @param  {Array<Object>} dataChromosomes  Data for current chromosomes in the Circos plot
 * @param  {Array<Object>} bestSolution     Data for best solution chromosomes
 * @param  {Array<string>} bestFlippedChromosomes Data for best flipped chromosomes
 * @param  {boolean} [updateWhenSame=true] Still call generateGenomeView to update if same solution
 * @return {undefined}                      undefined
 */
export function callSwapPositionsAnimation({
  dataChromosomes,
  bestSolution,
  bestFlippedChromosomes,
  updateWhenSame = true
}) {
  // Using slice() because I don't want to get a reference to the same array,
  // since I am modifying it when flipping a chromosome
  // More info: https://stackoverflow.com/a/6612405
  const allFlippedChromosomes = getCurrentFlippedChromosomes().slice();
  // The two chromosome order will always have the same amount of chromosomes, just in different order
  const currentChromosomeOrder = toChromosomeOrder(bestSolution);
  const oldChromosomeOrder = toChromosomeOrder(dataChromosomes);

  // bestSolution will always have same or less collisions than dataChromosomes
  // hence, only enter this condition if it has less (i.e. they are different in order)
  // OR
  // Enter condition if best flipped chromosomes is different from actual
  if (!isEqual(oldChromosomeOrder, currentChromosomeOrder) ||
    !isEqual(allFlippedChromosomes, bestFlippedChromosomes)) {
    const swapPositions = minSwapToMakeArraySame(currentChromosomeOrder,
      oldChromosomeOrder);

    // NOTE: If undo or redo functions are executing,
    // the same commands won't be added again to the stack
    undoManager.add({
      undo: function() {
        callSwapPositionsAnimation({
          dataChromosomes: bestSolution,
          bestSolution: dataChromosomes,
          bestFlippedChromosomes: allFlippedChromosomes
        });
      },
      redo: function() {
        callSwapPositionsAnimation({
          dataChromosomes: dataChromosomes,
          bestSolution: bestSolution,
          bestFlippedChromosomes: bestFlippedChromosomes
        });
      }
    });

    // Disabling inputs and selects before calling the animation
    resetInputsAndSelectsOnAnimation(true);

    // TODO: Workaround for this 50 timeout?
    // Calling the actual animation
    setTimeout(() => swapPositionsAnimation({
      dataChromosomes: dataChromosomes,
      bestSolution: bestSolution,
      swapPositions: swapPositions,
      bestFlippedChromosomes: bestFlippedChromosomes
    }), 50);
  } else if (updateWhenSame) {
    // Showing alert using react
    renderReactAlert("No better layout was found at this time. Feel free to try again!");

    // Enabling inputs and selects to reset everything
    resetInputsAndSelectsOnAnimation();

    // If they are the same and I can update (the flag is true),
    // it means they have the same number of collisions (if coming from SA).
    // Re-render to keep everything untouched, specially the layout
    // NOTE: This is necessary when I'm using the myCircos.layout function
    // to modify the layout
    generateGenomeView({
      transition: { shouldDo: false },
      shouldUpdateBlockCollisions: false,
      shouldUpdateLayout: true
    });
  }
};

/**
 * Applies flipping to data chords
 *
 * @param  {Array<Object>} dataChords  Plotting information for each block chord
 * @param  {Array<string>} flippedChromosomes Current flipped chromosomes
 * @return {undefined}                 undefined
 */
function applyFlippingDataChords(dataChords, flippedChromosomes) {
  const blockDictionary = getBlockDictionary();

  // Need to always go through all the chords, to reset the ones
  // that are not flipped anymore. For example: If it is the second
  // time the algorithm arrives at bn2, it won't be flipped, and I
  // can't limit the loop to only enter the chords that are flipped, because
  // in this case bn2 will never be unflipped.
  //
  // Another way, is to just reset dataChords each time
  for (let i = 0, length = dataChords.length; i < length; i++) {
    const blockID = dataChords[i].source.value.id;

    const { sourcePositions, targetPositions } = flipGenesPosition({
      blockPositions: blockDictionary[blockID].blockPositions,
      currentFlippedChromosomes: flippedChromosomes,
      sourceID: dataChords[i].source.id,
      targetID: dataChords[i].target.id
    });

    // Assigning flipped positions
    dataChords[i].source.start = sourcePositions.start;
    dataChords[i].source.end = sourcePositions.end;

    dataChords[i].target.start = targetPositions.start;
    dataChords[i].target.end = targetPositions.end;
  }
};

/**
 * Gives a head start to the current layout by shuffling the chromosome positions randomly
 * NOTE: After running the iterations, the best solution can still be the initial solution
 * This helps in improving the outcome of highly cluttered layouts
 * This function is meant to run under 10 seconds
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords  Plotting information for each block chord
 * @return {Object} Chromosomes solution and collision count after running the random restart process
 */
async function randomRestartHillClimbing(dataChromosomes, dataChords) {
  /**
   * Shuffles the given array in-place using Durstenfeld shuffle algorithm.
   * More info: https://stackoverflow.com/a/12646864
   *
   * @param  {Array<Object>} array Array of chromosome objects
   * @return {undefined} undefined
   * @private
   */
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  };

  const myCircos = getCircosObject();
  let bestEnergy = getCollisionCount();
  let currentSolution = cloneDeep(dataChromosomes);
  let bestSolution = cloneDeep(dataChromosomes);
  let savedCurrentSolution; // Used to return to the array of divided genomes
  let maxIterations = 100;
  if (bestEnergy <= 100) maxIterations = 500;
  else if (bestEnergy > 100 && bestEnergy <= 500) maxIterations = 200;
  else if (bestEnergy > 10000 && bestEnergy <= 50000) maxIterations = 50;
  else if (bestEnergy > 50000) maxIterations = 25;

  const shouldKeepChromosomesTogether = !d3Select("p.keep-chr-together").empty() &&
    d3Select("p.keep-chr-together input").property("checked");

  // If visualizing multiple genomes and the checkbox is checked
  // then I need to divide them, to shuffle the genomes separately
  if (shouldKeepChromosomesTogether) {
    const { gffPartitionedDictionary, partitionedGffKeys } =
      partitionGffKeys(toChromosomeOrder(dataChromosomes));

    currentSolution = [];
    for (let i = 0; i < partitionedGffKeys.length; i++) {
      currentSolution = currentSolution.concat(cloneDeep([gffPartitionedDictionary[partitionedGffKeys[i]]]));
    }

    // Assigning the whole chromosome object for each key inside currentSolution
    for (let i = 0; i < currentSolution.length; i++) {
      for (let j = 0; j < currentSolution[i].length; j++) {
        currentSolution[i][j] = dataChromosomes.find((element) => {
          return element.id === currentSolution[i][j];
        });
      }
    }

    savedCurrentSolution = cloneDeep(currentSolution);
  }

  let iterations = 1;
  while (iterations <= maxIterations) {
    if (shouldKeepChromosomesTogether) {
      // Returning to saved state, i.e. [[A1,A2],[B1,B2]]
      currentSolution = cloneDeep(savedCurrentSolution);

      // Need to shuffle each array inside currentSolution separately
      for (let i = 0; i < currentSolution.length; i++) {
        shuffleArray(currentSolution[i]);
      }

      // Going from [[A1,A2],[B1,B2]] to [A1,A2,B1,B2]
      currentSolution = flattenDeep(currentSolution);
    } else {
      shuffleArray(currentSolution);
    }

    // To introduce start and end properties into currentSolution
    myCircos.layout(currentSolution, CIRCOS_CONF);
    assignChordAngles(currentSolution, dataChords);
    const { collisionCount: neighborEnergy } = await getBlockCollisions(dataChords);

    // Saving the best solution if having less collisions
    if (neighborEnergy < bestEnergy) {
      bestSolution = cloneDeep(currentSolution);
      bestEnergy = neighborEnergy;
    }

    iterations++;
  }

  return {
    solution: bestSolution,
    energy: bestEnergy
  }
};

/**
 * Calculates the probability of accepting a neighbor solution for Simulated Annealing
 *
 * @param  {number} currentEnergy  Current number of collisions
 * @param  {number} neighborEnergy Number of collisions for the neighbor solution
 * @param  {number} temperature    Current algorithm temperature
 * @return {number}                Acceptance probability
 */
function acceptanceProbability(currentEnergy, neighborEnergy, temperature) {
  if (neighborEnergy < currentEnergy) return 1.0;

  /*
    The smaller the change in energy (the quality of the solution),
    and the higher the temperature, the more likely it is for the algorithm to accept the solution.
  */
  return Math.exp((currentEnergy - neighborEnergy) / temperature);
};

/**
 * Running Simulated Annealing algorithm with the current chords and chromosome data
 * to minimize the number of block collisions
 * NOTE: When running SA, the result can never be worse, it will be better or the same
 *
 * @param  {Array<Object>} dataChromosomes   Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChordsSA      Plotting information for each block chord
 * @return {undefined}                       undefined
 *
 * More info: http://www.theprojectspot.com/tutorial-post/simulated-annealing-algorithm-for-beginners/6
 */
export async function simulatedAnnealing(dataChromosomes, dataChordsSA) {
  let dataChords = cloneDeep(dataChordsSA);

  // I do not need to calculate block collisions the first time
  // because I can take the current collision count from the getters
  let currentEnergy = getCollisionCount();
  const superimposedCollisionCount = getSuperimposedCollisionCount();

  console.log('CURRENT ENERGY: ', currentEnergy);

  // Show notification and return if there are no collisions
  // or if collisionCount equals superimposedCount
  if (currentEnergy === 0 || dataChords.length === 0 ||
      currentEnergy === superimposedCollisionCount ||
      dataChromosomes.length === 1) {
    let messageToShow = "";

    if (currentEnergy === 0 || dataChords.length === 0) {
      messageToShow = "There are no collisions in the current layout.";
    } else if (currentEnergy === superimposedCollisionCount) {
      messageToShow = "All the block collisions in the current layout are from superimposed blocks.";
    } else if (dataChromosomes.length === 1) {
      messageToShow = "The algorithm needs more than one chromosome to minimize collisions.";
    }

    // Showing alert using react
    renderReactAlert(`${messageToShow} Please, try again!`);

    // Re-activating button
    d3Select(".best-guess > button").attr("disabled", null);

    return;
  }

  // Filtering value for temperature
  let temperature = Number(!d3Select('.filter-sa-temperature-div #filter-sa-temperature').empty() &&
    d3Select('.filter-sa-temperature-div #filter-sa-temperature').property("value")) || 5000;

  // Filtering value for ratio
  const ratio = Number(!d3Select('.filter-sa-ratio-div #filter-sa-ratio').empty() &&
    d3Select('.filter-sa-ratio-div #filter-sa-ratio').property("value")) || 0.05;

  // Filtering value for flipping frequency
  const flippingFrequency = Number(!d3Select('.filter-sa-flipping-frequency-div #filter-sa-flipping-frequency').empty() &&
    d3Select('.filter-sa-flipping-frequency-div #filter-sa-flipping-frequency').property("value")) || 0;

  console.log('FLIPPING FREQ: ', flippingFrequency);

  const complementRatio = (1 - ratio);
  const myCircos = getCircosObject();

  let howMany = 0;

  let currentSolution = cloneDeep(dataChromosomes);
  const allFlippedChromosomes = getCurrentFlippedChromosomes();

  let bestSolution = cloneDeep(currentSolution);
  let bestEnergy = currentEnergy;

  const totalNumberOfIterations = getTotalNumberOfIterations();
  const totalTime = Math.trunc(getCollisionCalculationTime() * 1000);

  const shouldKeepChromosomesTogether = !d3Select("p.keep-chr-together").empty() &&
    d3Select("p.keep-chr-together input").property("checked");

  console.log('SHOULD KEEP TOGETHER: ', shouldKeepChromosomesTogether);

  // Making both views look blurry, along with the track legend
  d3SelectAll("svg#genome-view,#block-view-container,#track-legend")
    .classed("blur-view", true);

  // Initializing the progress bar
  d3Select(".genome-view-container .progress-bar")
    .style("width", "0%")
    .text("0%");

  // Disabling inputs and selects before calling the algorithm
  resetInputsAndSelectsOnAnimation(true);

  let timeTransition = 0;
  let flippedChromosomesSimulatedAnnealing = allFlippedChromosomes.slice();
  let bestFlippedChromosomes = flippedChromosomesSimulatedAnnealing.slice();

  console.log('TOTAL TIME: ', totalTime);

  setTimeout(async function simulatedAnnealingLoop() {
    // Looking for a head start when the algorithm is not doing only flipping
    if (flippingFrequency !== 100) {
      console.log('\nrandomRestartHillClimbing BEFORE: \n', bestSolution.slice(), bestEnergy);

      // Running the Random-Restart phase of Stochastic Hill Climbing to give a head start
      const randomRestartResult = await randomRestartHillClimbing(bestSolution, dataChords);
      bestSolution = randomRestartResult.solution;
      bestEnergy = randomRestartResult.energy;

      console.log('\nrandomRestartHillClimbing AFTER: \n', bestSolution.slice(), bestEnergy);
    }

    while (temperature > 1.0) {
      howMany++;

      timeTransition += totalTime;

      (function(timeTransition, temperature, howMany) {
        setTimeout(async function() {
          let progressBarValue = (howMany / totalNumberOfIterations);
          if (flippingFrequency === 0) progressBarValue *= 100.0;
          else progressBarValue *= 95.0;

          const progressBarWidth = Math.trunc(progressBarValue);

          d3Select(".genome-view-container .progress-bar")
            .style("width", `${progressBarWidth}%`)
            .text(`${progressBarWidth}%`);

          // Return early if bestEnergy is already 0 (i.e. no collisions)
          if (bestEnergy === 0) return;

          let newSolution = cloneDeep(currentSolution);
          const newSolutionLength = newSolution.length;

          let pos1, pos2;
          const chooseRandomFlippingOrSwapping = Math.random();
          const doingFlipping = flippingFrequency > 0 && (
            flippingFrequency === 100 || chooseRandomFlippingOrSwapping < (flippingFrequency/100.0)
          );

          if (doingFlipping) {
            let currentID = null;

            do {
              // Choose non-empty position to do flipping
              pos1 = Math.trunc(newSolutionLength * Math.random());
              currentID = newSolution[pos1].id.slice(0);
            } while (d3SelectAll(`path.chord.${currentID}`).empty());

            const currentPosition = flippedChromosomesSimulatedAnnealing.indexOf(currentID);

            // If chromosome id is present, then remove it
            if (currentPosition !== (-1)) {
              flippedChromosomesSimulatedAnnealing.splice(currentPosition, 1);
            } else {
              flippedChromosomesSimulatedAnnealing.push(currentID);
            }

            applyFlippingDataChords(dataChords, flippedChromosomesSimulatedAnnealing);
          } else {
            let currentID = null;

            do {
              // First chromosome can never be empty, to make sure to never swap
              // two empty chromosomes
              pos1 = Math.trunc(newSolutionLength * Math.random());
              currentID = newSolution[pos1].id.slice(0);
            } while(d3SelectAll(`path.chord.${currentID}`).empty());

            const firstIdentifier = removeNonLettersFromString(newSolution[pos1].id.slice(0));
            // positionChecking - The chr should be selected from different positions
            // identifierChecking - The chr should be from same identifier when having
            // multiple genomes and when possible to do so
            let positionChecking = true, identifierChecking = false;
            let multipleChrFirstIdentifier = false;
            let countFirstIdentifier = 0;

            if (shouldKeepChromosomesTogether) {
              // Checking if there are multiple chr with same first identifier
              for (let i = 0; i < newSolutionLength; i++) {
                const currentIdentifier = removeNonLettersFromString(newSolution[i].id.slice(0));
                if (currentIdentifier === firstIdentifier) {
                  countFirstIdentifier++;
                  if (countFirstIdentifier === 2) {
                    multipleChrFirstIdentifier = true;
                    break;
                  }
                }
              }
            }

            pos2 = pos1; // Initializing second position as the first one

            do {
              // Getting random positions until both positions are different
              pos2 = Math.trunc(newSolutionLength * Math.random());

              positionChecking = pos1 === pos2;
              currentID = newSolution[pos2].id.slice(0);

              if (shouldKeepChromosomesTogether && multipleChrFirstIdentifier) {
                const secondIdentifier = removeNonLettersFromString(currentID);

                identifierChecking = firstIdentifier !== secondIdentifier;
              }

            } while (positionChecking || identifierChecking);

            // Swapping the chromosome content of the two positions
            [newSolution[pos1], newSolution[pos2]] = [newSolution[pos2], newSolution[pos1]];
          }

          // To introduce start and end properties into newSolution
          myCircos.layout(newSolution, CIRCOS_CONF);
          assignChordAngles(newSolution, dataChords);
          const { collisionCount: neighborEnergy } = await getBlockCollisions(dataChords);
          const probability = acceptanceProbability(currentEnergy, neighborEnergy, temperature);

          // Accept as current if probability equals one (meaning that I got a better solution)
          // Otherwise take the risk. Each time I take risk I'm going out of my comfort zone
          // by choosing a worse solution, hence increasing my search space
          if (probability === 1.0 || probability > Math.random()) {
            currentSolution = cloneDeep(newSolution);
            currentEnergy = neighborEnergy;

            // Keeping the first best solution generated by using <
            if (neighborEnergy < bestEnergy) {
              bestSolution = cloneDeep(newSolution);
              bestEnergy = neighborEnergy;
              bestFlippedChromosomes = flippedChromosomesSimulatedAnnealing.slice();
            }
          }
        }, timeTransition);
      })(timeTransition, temperature, howMany);

      temperature *= complementRatio;
    }

    setTimeout(function afterSimulatedAnnealingLoop() {
      console.log('TIME TRAN: ', timeTransition / 1000);

      console.log('HOW MANY TIMES ENTERING: ', howMany);

      console.log('BEST SOLUTION and ENERGY: ', bestSolution, bestEnergy);

      console.log('flippedChromosomesSimulatedAnnealing: ', flippedChromosomesSimulatedAnnealing);

      console.log('bestFlippedChromosomes: ', bestFlippedChromosomes);


      let afterCheckTime = 0;
      const excludeFlippedChromosomes = [];
      const bestFlippedChromosomesLength = bestFlippedChromosomes.length;

      if (flippingFrequency > 0) {
        if (bestFlippedChromosomesLength === 0) {
          // Finishing in 100%
          d3Select(".genome-view-container .progress-bar")
            .style("width", "100%")
            .text("100%");
          afterCheckTime += totalTime;
        } else {
          // To introduce start and end properties into bestSolution
          myCircos.layout(bestSolution, CIRCOS_CONF);
          // Omitting flipped chromosomes that make the final solution worse
          for (let i = 0; i < bestFlippedChromosomesLength; i++) {
            (function(afterCheckTime, howMany) {
              setTimeout(async function() {
                let progressBarValue = (howMany / bestFlippedChromosomesLength) * 5;

                const progressBarWidth = 95 + Math.trunc(progressBarValue);

                d3Select(".genome-view-container .progress-bar")
                  .style("width", `${progressBarWidth}%`)
                  .text(`${progressBarWidth}%`);

                  const afterCheckFlippedChromosomes = bestFlippedChromosomes.slice();
                  const positionCurrentChr = afterCheckFlippedChromosomes.indexOf(bestFlippedChromosomes[i]);
                  // Removing chromosome from list of flipped ones
                  afterCheckFlippedChromosomes.splice(positionCurrentChr, 1);

                  // Removing previously excluded chromosomes from list of flipped ones
                  const excludeFlippedChromosomesLength = excludeFlippedChromosomes.length;
                  for (let j = 0; j < excludeFlippedChromosomesLength; j++) {
                    const positionExcludeChr = afterCheckFlippedChromosomes.indexOf(excludeFlippedChromosomes[j]);
                    if (positionExcludeChr !== (-1)) {
                      afterCheckFlippedChromosomes.splice(positionExcludeChr, 1);
                    }
                  }

                  // Applying flipping again with the excluded flipped chromosome
                  applyFlippingDataChords(dataChords, afterCheckFlippedChromosomes);
                  assignChordAngles(bestSolution, dataChords);
                  const { collisionCount: neighborEnergy } = await getBlockCollisions(dataChords);

                  console.log('CURRENT CHR AND ENERGY: ', bestFlippedChromosomes[i], neighborEnergy);

                  // Using <= because if the solution is the same, then exclude it
                  // since there is no point in having it flipped
                  if (neighborEnergy <= bestEnergy) {
                    // Only keeping the flipped chromosomes that make my layout better
                    console.log('EXCLUDING CHR: ', bestFlippedChromosomes[i], neighborEnergy);
                    bestEnergy = neighborEnergy;
                    excludeFlippedChromosomes.push(bestFlippedChromosomes[i]);
                  }
              }, afterCheckTime);
            })(afterCheckTime, i + 1);

            afterCheckTime += totalTime;
          }
        }
      }

      setTimeout(() => {
        if (excludeFlippedChromosomes.length > 0) {
          console.log('EXCLUDE: ', excludeFlippedChromosomes);
          // Excluding chrs that make the final solution worse
          bestFlippedChromosomes = difference(bestFlippedChromosomes, excludeFlippedChromosomes);
        }

        // Getting rid of the blurred view
        d3SelectAll("svg#genome-view,#block-view-container,#track-legend")
          .classed("blur-view", false);

        setTimeout(() => {
          d3Select(".best-guess > button").attr("disabled", null);

          callSwapPositionsAnimation({
            dataChromosomes: dataChromosomes,
            bestSolution: bestSolution,
            bestFlippedChromosomes: bestFlippedChromosomes
          });
        }, 200);
      }, afterCheckTime + totalTime);

    }, timeTransition + totalTime);

  }, 100);
};
