import {
  format as d3Format,
  ribbon as d3Ribbon,
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';

// ParallelJS
import Parallel from 'paralleljs';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import findIndex from 'lodash/findIndex';
import isEqual from 'lodash/isEqual';

import generateGenomeView from './generateGenomeView';
import { updateAdditionalTracksWhileDragging } from './dragging';
import {
  getChordsRadius,
  renderReactAlert,
  resetInputsAndSelectsOnAnimation,
  roundFloatNumber,
  sortGffKeys
} from './../helpers';
import { getCircosObject } from './../variables/myCircos';
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
  getDataChords,
  setDataChords
} from './../variables/dataChords';
import {
  getDataChromosomes,
  setDataChromosomes
} from './../variables/dataChromosomes';
import {
  getSavedCollisionSolutionsDictionary,
  setSavedCollisionSolutionsDictionary
} from './../variables/savedCollisionSolutionsDictionary';

// Constants
import {
  CIRCOS_CONF,
  DEGREES_TO_RADIANS,
  GENOME_INNER_RADIUS,
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
    middle: (startAngle + endAngle) / 2,
    end: endAngle
  }
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
 * Get the number of block collisions with the current chords and chromosome data
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @param  {boolean} shouldReturnPromise   True if should return JS Promise, false otherwise
 * @return {number} Number of collisions and superimposed collisions
 */
export function getBlockCollisions(dataChromosomes, dataChords, shouldReturnPromise = true) {
  const t0 = performance.now();
  let collisionCount = 0;
  let superimposedCollisionCount = 0;

  for (let i = 0; i < dataChords.length; i++) {
    for (let j = i + 1; j < dataChords.length; j++) {
      const R1 = getChordAngles(dataChromosomes, dataChords[i], 'source');
      const R2 = getChordAngles(dataChromosomes, dataChords[i], 'target');
      const R3 = getChordAngles(dataChromosomes, dataChords[j], 'source');
      const R4 = getChordAngles(dataChromosomes, dataChords[j], 'target');

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
 * Updating the label of block collisions headline, so the user knows that
 * the calculation is in progress
 *
 * @return {undefined} undefined
 */
export function updateWaitingBlockCollisionHeadline() {
  d3Select(".block-collisions-headline")
    .text("Updating block collisions ...");

  d3Select(".filter-sa-hint")
    .style("color", "#000")
    .text("Updating decluttering ETA ...");

  d3Select(".superimposed-block-collisions-headline")
    .text("Updating superimposed collisions ...");
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

  // Filtering value for temperature
  const filterTemperatureValue = (d3Select('.filter-sa-temperature-div #filter-sa-temperature') &&
    d3Select('.filter-sa-temperature-div #filter-sa-temperature').property("value")) || 5000;

  // Filtering value for ratio
  const filterRatioValue = (d3Select('.filter-sa-ratio-div #filter-sa-ratio') &&
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

  const oneRunTime = roundFloatNumber(totalTime, 6);
  // This is the final time in seconds
  const finalTime = roundFloatNumber(oneRunTime * howMany, 2);

  console.log('HOW MANY TIMES NEW: ', howMany);
  console.log('time and totalTime: ', oneRunTime, finalTime);

  setTotalNumberOfIterations(howMany);

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

  // Default temperature/ratio is 5,000/0.05
  // Entering loop around 150 times
  // temperature = 5000;
  // ratio = 0.05;

  // Update temperature/ratio to 5,000/0.006 if collision count is between 100 and 500
  // Entering loop around 1500 times
  // if (collisionCount > 100 && collisionCount <= 500) {
  //   temperature = 6000;
  //   ratio = 0.006;
  // }

  // Update temperature/ratio to 10,000/0.003 if less than 100 collisions available
  // Entering loop around 3000 times
  // if (collisionCount <= 100) {
  //   temperature = 10000;
  //   ratio = 0.003;
  // }
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
  d3Select(".best-guess > input")
    .attr("disabled", true);

  d3Select(".save-layout > input")
    .attr("disabled", true);

  setDataChromosomes(dataChromosomes);
  setDataChords(dataChords);

  const p = new Parallel({
      dataChromosomes: dataChromosomes,
      dataChords: dataChords
    })
    .require(getBlockCollisions)
    .require(getChordAngles)
    .require(intersects)
    .require(isSuperimposed);

  p.spawn(function (data) {
    return getBlockCollisions(data.dataChromosomes, data.dataChords, false);
  }).then(function (data) {
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

      // Enabling minimize collisions and save layout buttons after calculations are done
      d3Select(".best-guess > input")
        .attr("disabled", null);

      d3Select(".save-layout > input")
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

  let visited = [];
  for (let i = 0; i < n; i++) {
    visited.push(false);
  }

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
}

/**
 * Minimum number of swaps to make array B same as array A
 *
 * @param  {Array<string>} a First array of the order of chromosomes
 * @param  {Array<string>} b Second array of the order of chromosomes
 * @return {Array<Array<string>>} swapPositions
 *
 * Source: https://www.geeksforgeeks.org/minimum-swaps-to-make-two-array-identical/
 */
export function minSwapToMakeArraySame(a, b) {
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
}

/**
 * Generates the transition from old chromosome data to new one
 *
 * @param  {Array<Object>}  dataChromosomes Data for current chromosomes in the Circos plot
 * @param  {Array<Object>}  bestSolution    Data for best solution chromosomes
 * @param  {string}        currentChr       ID of current chromosome to do the transition
 * @param  {Array<Object>} hasMovedDragging Dictionary to know when each chromosome moves
 * @return {undefined}                      undefined
 */
function transitionSwapOldToNew(dataChromosomes, bestSolution, currentChr, hasMovedDragging) {
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

  d3Select(`.cs-layout g.${currentChr}`)
    .raise()
    .transition()
    .duration(TRANSITION_SWAPPING_TIME)
    .attr("transform", `rotate(${angle})`);

  updateAdditionalTracksWhileDragging({
    angleValue: angle,
    chromosome: currentChr,
    dataChromosomes: dataChromosomes,
    transitionDuration: TRANSITION_SWAPPING_TIME
  });

  if (!d3SelectAll(`path.chord.${currentChr}`).empty()) {
    const ribbon = d3Ribbon().radius(getChordsRadius());

    d3SelectAll(`path.chord.${currentChr}`)
      .raise()
      .transition()
      .duration(TRANSITION_SWAPPING_TIME)
      .attr("opacity", 0.9)
      .attr("d", function(d) {

        // For source
        const sourceObject = getChordAngles(dataChromosomes, d, 'source');
        let sourceStartAngle = sourceObject.start;
        let sourceEndAngle = sourceObject.end;

        // For target
        const targetObject = getChordAngles(dataChromosomes, d, 'target');
        let targetStartAngle = targetObject.start;
        let targetEndAngle = targetObject.end;

        const angleToMove = angle * DEGREES_TO_RADIANS;

        if (d.source.id !== d.target.id) {
          if (d.source.id === currentChr) {
            sourceStartAngle += angleToMove;
            sourceEndAngle += angleToMove;

            if (hasMovedDragging[d.target.id].hasMoved) {
              const extraAngle = hasMovedDragging[d.target.id].angle * DEGREES_TO_RADIANS;
              targetStartAngle += extraAngle;
              targetEndAngle += extraAngle;
            }
          }

          if (d.target.id === currentChr) {
            targetStartAngle += angleToMove;
            targetEndAngle += angleToMove;

            if (hasMovedDragging[d.source.id].hasMoved) {
              const extraAngle = hasMovedDragging[d.source.id].angle * DEGREES_TO_RADIANS;
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

      })
  }

  hasMovedDragging[currentChr] = {
    angle: angle,
    hasMoved: true
  };
}

/**
 * Looks up position in collisions dictionary
 * TODO: Move this to variable folder
 *
 * @param  {Array<Object>} bestSolution Data for best solution chromosomes
 * @param  {Array<Object>} dataChords   Plotting information for each block chord
 * @return {Object}                     Position and key in collisions dictionary
 */
export function loopUpPositionCollisionsDictionary(bestSolution, dataChords) {
  const bestSolutionChromosomeOrder = toChromosomeOrder(bestSolution);

  // Look for current savedCollisionSolutionsDictionary
  const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();
  const key = sortGffKeys(bestSolutionChromosomeOrder).slice().toString();

  // Finding positions for the chromosomes in key with current dataChords
  const currentPosition = findIndex(savedCollisionSolutionsDictionary[key], function(d) {
    return isEqual(d.dataChords, dataChords);
  });

  return {
    currentPosition: currentPosition,
    key: key
  };
};

/**
 * Save configuration to collisions dictionary
 *
 * @param  {Array<Object>} bestSolution   Data for best solution chromosomes
 * @param  {number}        collisionCount Number of collisions
 * @param  {Array<Object>} dataChords     Plotting information for each block chord
 * @return {undefined}                    undefined
 */
export function saveToCollisionsDictionary(bestSolution, collisionCount, dataChords) {
  const { currentPosition, key } = loopUpPositionCollisionsDictionary(bestSolution, dataChords);
  const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();

  if (!(key in savedCollisionSolutionsDictionary)) {
    savedCollisionSolutionsDictionary[key] = [];
  }

  if (currentPosition !== (-1)) {
    // For this configuration, I want to save another combination (could be better or not)
    savedCollisionSolutionsDictionary[key][currentPosition].bestSolution = cloneDeep(bestSolution);
    savedCollisionSolutionsDictionary[key][currentPosition].collisionCount = collisionCount;
  } else {
    savedCollisionSolutionsDictionary[key].push({
      bestSolution: cloneDeep(bestSolution),
      collisionCount: collisionCount,
      dataChords: cloneDeep(dataChords)
    });
  }

  setSavedCollisionSolutionsDictionary(savedCollisionSolutionsDictionary);
};

/**
 * Produces the swapping animation of each chromosome positions
 *
 * @param  {Array<Object>} dataChromosomes Data for current chromosomes in the Circos plot
 * @param  {Array<Object>} bestSolution    Data for best solution chromosomes
 * @param  {Array<Array<string>>} swapPositions Swap positions array
 * @return {undefined}                     undefined
 */
export function swapPositionsAnimation(dataChromosomes, bestSolution, swapPositions) {
  const chromosomeOrder = toChromosomeOrder(dataChromosomes);

  let visited = [];
  let hasMovedDragging = [];
  for (let i = 0; i < chromosomeOrder.length; i++) {
    hasMovedDragging[chromosomeOrder[i]] = {
      angle: 0,
      hasMoved: false
    };
    visited[chromosomeOrder[i]] = false;
  }

  for (let i = 0; i < swapPositions.length; i++) {
    visited[swapPositions[i][0]] = true;
    visited[swapPositions[i][1]] = true;
  }

  const positionsNotBeingSwapped = [];
  for (let i = 0; i < chromosomeOrder.length; i++) {
    if (visited[chromosomeOrder[i]] === false) {
      positionsNotBeingSwapped.push(chromosomeOrder[i]);
    }
  }

  console.log('POSITIONS NOT SWAPPED: ', positionsNotBeingSwapped);

  let transitionTime = 0;
  let index = 0;

  while (transitionTime < (TRANSITION_SWAPPING_TIME * swapPositions.length)) {

    (function(transitionTime, index) {
      setTimeout(function() {
        /*
          The angle is only affecting each chromosome in their first rotation.
          It should be the same to just traverse in order, and change each chromosome
          (That would imply 19 swaps always)
          Right now we are getting less than 19 (so it's better in theory)
        */
        transitionSwapOldToNew(dataChromosomes, bestSolution, swapPositions[index][0], hasMovedDragging);
        transitionSwapOldToNew(dataChromosomes, bestSolution, swapPositions[index][1], hasMovedDragging);

        console.log('SWAP POSITIONS i: ', index, swapPositions[index]);
      }, transitionTime);
    })(transitionTime, index);


    transitionTime += TRANSITION_SWAPPING_TIME;
    index++;
  }

  console.log('transition time: ', transitionTime);

  let newTransitionTime = transitionTime;
  index = 0;

  while ((newTransitionTime - transitionTime) < (TRANSITION_SWAPPING_TIME * positionsNotBeingSwapped.length)) {

    (function(newTransitionTime, index) {
      setTimeout(function() {
        transitionSwapOldToNew(dataChromosomes, bestSolution, positionsNotBeingSwapped[index], hasMovedDragging);

        console.log('POSITIONS NOT SWAPPED i: ', index, positionsNotBeingSwapped[index]);
      }, newTransitionTime);
    })(newTransitionTime, index);

    newTransitionTime += TRANSITION_SWAPPING_TIME;
    index++;
  }

  // TODO: Think about performance when calling generateGenomeView again
  setTimeout(() => {
      // Enabling inputs and selects after calling the animation
      resetInputsAndSelectsOnAnimation();

      generateGenomeView({
        transition: { shouldDo: false },
        shouldUpdateBlockCollisions: true,
        shouldUpdateLayout: true
      });
    }, TRANSITION_SWAPPING_TIME +
    (TRANSITION_SWAPPING_TIME * swapPositions.length) +
    (TRANSITION_SWAPPING_TIME * positionsNotBeingSwapped.length));
}

/**
 * Calls swap positions animation
 *
 * @param  {Array<Object>} dataChromosomes  Data for current chromosomes in the Circos plot
 * @param  {Array<Object>} bestSolution     Data for best solution chromosomes
 * @param  {boolean} [updateWhenSame=true] Still call generateGenomeView to update if same solution
 * @return {undefined}                      undefined
 */
export function callSwapPositionsAnimation(dataChromosomes, bestSolution, updateWhenSame = true) {
  // bestSolution will always have same or less collisions than dataChromosomes
  // hence, only enter this condition if it has less (i.e. they are different)
  if (!isEqual(dataChromosomes, bestSolution)) {
    const currentChromosomeOrder = toChromosomeOrder(bestSolution);
    const oldChromosomeOrder = toChromosomeOrder(dataChromosomes);

    const swapPositions = minSwapToMakeArraySame(currentChromosomeOrder,
      oldChromosomeOrder);

    if (swapPositions.length > 0) {
      // Setting chromosome order with all the chromosomes
      // NOTE: Current chromosome order variable always includes all the chromosomes
      setCurrentChromosomeOrder(toChromosomeOrder(bestSolution, true));

      // Disabling inputs and selects before calling the animation
      resetInputsAndSelectsOnAnimation(true);

      // TODO: Workaround for this?
      // Calling the actual animation
      setTimeout(() => swapPositionsAnimation(dataChromosomes, bestSolution, swapPositions), 50);

      // Showing alert using react
      renderReactAlert("The layout was successfully updated.", "success");
    }
  } else if (updateWhenSame) {
    // Showing alert using react
    renderReactAlert("No better layout was found at this time. Feel free to try again!");

    // Enabling inputs and selects to reset everything
    resetInputsAndSelectsOnAnimation();

    // If they are the same and I can update (the flag is true),
    // it means they have the same number of collisions.
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
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @return {undefined}                     undefined
 *
 * More info: http://www.theprojectspot.com/tutorial-post/simulated-annealing-algorithm-for-beginners/6
 */
export async function simulatedAnnealing(dataChromosomes, dataChords) {
  // I do not need to calculate block collisions the first time
  // because I can take the current collision count from the getters
  let currentEnergy = getCollisionCount();
  const superimposedCollisionCount = getSuperimposedCollisionCount();

  console.log('CURRENT ENERGY: ', currentEnergy);

  // Show notification and return if there are no collisions
  // or if collisionCount equals superimposedCount
  if (currentEnergy === 0 || dataChords.length === 0 ||
      currentEnergy === superimposedCollisionCount) {
    let messageToShow = "";

    if (currentEnergy === 0 || dataChords.length === 0) {
      messageToShow = "There are no collisions in the current layout.";
    } else if (currentEnergy === superimposedCollisionCount) {
      messageToShow = "All the block collisions in the current layout are from superimposed blocks.";
    }

    // Showing alert using react
    renderReactAlert(messageToShow);

    // Re-activating button
    d3Select(".best-guess > input")
      .property("value", "Minimize collisions")
      .attr("disabled", null);

    return;
  }

  // Filtering value for temperature
  let temperature = (d3Select('.filter-sa-temperature-div #filter-sa-temperature') &&
    d3Select('.filter-sa-temperature-div #filter-sa-temperature').property("value")) || 5000;

  // Filtering value for ratio
  const ratio = (d3Select('.filter-sa-ratio-div #filter-sa-ratio') &&
    d3Select('.filter-sa-ratio-div #filter-sa-ratio').property("value")) || 0.05;

  const complementRatio = (1 - ratio);
  const myCircos = getCircosObject();

  let howMany = 0;

  let currentSolution = cloneDeep(dataChromosomes);

  let bestSolution = cloneDeep(currentSolution);
  let bestEnergy = currentEnergy;

  const totalNumberOfIterations = getTotalNumberOfIterations();
  const totalTime = Math.trunc(getCollisionCalculationTime() * 1000);

  // Making both views look blurry
  d3SelectAll("svg#genome-view,#block-view-container")
    .classed("blur-view", true);

  // Initializing the progress bar
  d3Select(".genome-view-container .progress-bar")
    .style("width", "0%")
    .text("0%");

  // Disabling inputs and selects before calling the algorithm
  resetInputsAndSelectsOnAnimation(true);

  let timeTransition = 0;

  console.log('TOTAL TIME: ', totalTime);

  setTimeout(async function simulatedAnnealingLoop() {
    // TODO: Create a new function
    while (temperature > 1.0) {
      howMany++;

      timeTransition += totalTime;

      (function(timeTransition, temperature, howMany) {
        setTimeout(async function() {
          if (bestEnergy === 0) return;

          const progressBarWidth = Math.trunc((howMany / totalNumberOfIterations) * 100);

          d3Select(".genome-view-container .progress-bar")
            .style("width", `${progressBarWidth}%`)
            .text(`${progressBarWidth}%`);

          let newSolution = cloneDeep(currentSolution);
          const pos1 = Math.trunc(newSolution.length * Math.random());
          const pos2 = Math.trunc(newSolution.length * Math.random());
          const val1 = newSolution[pos1];
          const val2 = newSolution[pos2];
          newSolution[pos2] = val1;
          newSolution[pos1] = val2;

          myCircos.layout(newSolution, CIRCOS_CONF);
          const { collisionCount: neighborEnergy } = await getBlockCollisions(newSolution, dataChords);
          const probability = acceptanceProbability(currentEnergy, neighborEnergy, temperature);

          if (probability === 1.0 || probability > Math.random()) {
            currentSolution = cloneDeep(newSolution);
            currentEnergy = neighborEnergy;

            // Keeping the first best solution generated by using <
            if (neighborEnergy < bestEnergy) {
              bestSolution = cloneDeep(newSolution);
              bestEnergy = neighborEnergy;
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

      // Autosave functionality
      // saveToCollisionsDictionary(bestSolution, bestEnergy, dataChords);

      const { currentPosition, key } = loopUpPositionCollisionsDictionary(bestSolution, dataChords);
      const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();
      if (currentPosition !== (-1)) {
        const { collisionCount } = savedCollisionSolutionsDictionary[key][currentPosition];

        if (collisionCount > bestEnergy) {
          // Disable checkbox because saved solution is worse than actual one
          d3Select('p.show-best-layout input').property("checked", false);
        }
      }

      // Getting rid of the blurred view
      d3SelectAll("svg#genome-view,#block-view-container")
        .classed("blur-view", false);

      setTimeout(() => {
        d3Select(".best-guess > input")
          .property("value", "Minimize collisions")
          .attr("disabled", null);

        callSwapPositionsAnimation(dataChromosomes, bestSolution);
      }, 200);
    }, timeTransition);

  }, 100);
};
