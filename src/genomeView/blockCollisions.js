import {
  ribbon as d3Ribbon,
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import AlertWithTimeout from './../reactComponents/Alert';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import findIndex from 'lodash/findIndex';
import isEqual from 'lodash/isEqual';

import generateGenomeView from './generateGenomeView';
import { getChordAngles } from './dragging';
import {
  getChordsRadius,
  sortGffKeys
} from './../helpers';
import { getCircosObject } from './../variables/myCircos';
import {
  getCollisionCount,
  getSuperimposedCollisionCount,
  setCollisionCount,
  setSuperimposedCollisionCount
} from './../variables/collisionCount';
import {
  setCurrentChromosomeOrder,
  toChromosomeOrder
} from './../variables/currentChromosomeOrder';
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
 * @param  {number} maxNumberOfCollisions  Optional limit to check for
 * @return {number} Number of collisions and superimposed collisions
 */
export function getBlockCollisions(dataChromosomes, dataChords, maxNumberOfCollisions = 0) {
  let collisionCount = 0;
  let superimposedCollisionCount = 0;
  let breakLoop = false;

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

        // If collisions are already worse, then break
        if (maxNumberOfCollisions > 0 &&
          collisionCount > maxNumberOfCollisions) {
          breakLoop = true;
          break;
        }

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

        // console.log("i j: ", dataChords[i].source.value.id, dataChords[j].source.value.id);
      }
    }

    if (breakLoop) break;
  }

  return new Promise(resolve => {
    resolve({
      collisionCount,
      superimposedCollisionCount
    });
  });
}

/**
 * Updating the label showing the number of block collisions
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @return {undefined}                     undefined
 */
export async function updateBlockCollisionHeadline(dataChromosomes, dataChords) {
  console.log('Updating block collision headline !!!');
  const {
    collisionCount,
    superimposedCollisionCount
  } = await getBlockCollisions(dataChromosomes, dataChords);

  // Saving up-to-date collision counts
  setCollisionCount(collisionCount);
  setSuperimposedCollisionCount(superimposedCollisionCount);

  console.log("COLLISION COUNT: " + collisionCount);

  // Update block-collisions-headline with current collision count
  d3Select(".block-collisions-headline")
    .text(function() {
      let textToShow = "";
      textToShow += collisionCount === 1 ?
        `${collisionCount} block collision` : `${collisionCount} block collisions`;
      return textToShow;
    });

  // Update block-collisions-headline with current collision count
  d3Select(".superimposed-block-collisions-headline")
    .text(function() {
      let textToShow = "";
      textToShow += superimposedCollisionCount === 1 ?
        `${superimposedCollisionCount} superimposed collision` :
        `${superimposedCollisionCount} superimposed collisions`;
      return textToShow;
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
  console.log('A and B: ', a, b);
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

  for (let i = 0; i < n; i++) {
    console.log("B[i]: ", modifiedB[i]);
  }
  console.log('\n');

  const ans = minSwapsToSort(modifiedB, n);

  console.log('SWAP POSITIONS BEFORE: ', b, ans.swapPositions);


  modifiedB = b.slice();
  console.log('modifiedB before: ', modifiedB.slice());
  const swapPositions = ans.swapPositions.map(function(x) {
    // console.log('X: ', x);
    const toReturn = [modifiedB[x[0]], modifiedB[x[1]]];
    // Doing the swap to return right swapped elements
    const temp = modifiedB[x[0]];
    modifiedB[x[0]] = modifiedB[x[1]];
    modifiedB[x[1]] = temp;

    return toReturn;
  });

  console.log('modifiedB after: ', modifiedB.slice());

  console.log('ANSWER: ', ans.answer,
    swapPositions);

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


  console.log(`ANGLE FOR ${currentChr}: ${angle}`);

  d3Select(`.cs-layout g.${currentChr}`)
    .raise()
    .transition()
    .duration(TRANSITION_SWAPPING_TIME)
    .attr("transform", `rotate(${angle})`);

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
    if (collisionCount < savedCollisionSolutionsDictionary[key][currentPosition].collisionCount) {
      // For this configuration, I found another combination that is better
      // (with less number of collisions)
      savedCollisionSolutionsDictionary[key][currentPosition].bestSolution = cloneDeep(bestSolution);
      savedCollisionSolutionsDictionary[key][currentPosition].collisionCount = collisionCount;
    }

    console.log('POSITION: ', currentPosition);
    console.log('SAVED SOLUTION: ', savedCollisionSolutionsDictionary[key][currentPosition]);

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

  console.log('SWAP POSITIONS: ', swapPositions);

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

  console.log('VISITED: ', visited);
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
  setTimeout(() => generateGenomeView({
      transition: { shouldDo: false },
      shouldUpdateBlockCollisions: true,
      shouldUpdateLayout: true
    }), TRANSITION_SWAPPING_TIME +
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

      // Calling the actual animation
      swapPositionsAnimation(dataChromosomes, bestSolution, swapPositions);

      ReactDOM.unmountComponentAtNode(document.getElementById('alert-container'));
      ReactDOM.render(
        <AlertWithTimeout
          message = {"The layout was successfully updated."}
        />,
        document.getElementById('alert-container')
      );
    }
  } else if (updateWhenSame) {
    ReactDOM.unmountComponentAtNode(document.getElementById('alert-container'));
    ReactDOM.render(
      <AlertWithTimeout
        color = "danger"
        message = {"No better layout was found at this time. Feel free to try again!"}
      />,
      document.getElementById('alert-container')
    );

    // If they are the same and I can update (the flag is true),
    // it means they have the same number of collisions.
    // Re-render to keep everything untouched.
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
  let howMany = 0;

  const myCircos = getCircosObject();

  let currentSolution = cloneDeep(dataChromosomes);
  myCircos.layout(currentSolution, CIRCOS_CONF);

  // I do not need to calculate block collisions the first time
  // because I can take the current collision count from the getters
  let currentEnergy = getCollisionCount();
  const superimposedCollisionCount = getSuperimposedCollisionCount();

  console.log('CURRENT ENERGY: ', currentEnergy);

  // Show notification and return if there are no collisions
  if (currentEnergy === 0 || dataChords.length === 0) {
    ReactDOM.unmountComponentAtNode(document.getElementById('alert-container'));
    ReactDOM.render(
      <AlertWithTimeout
        color = "danger"
        message = {"There are no collisions in the current layout."}
      />,
      document.getElementById('alert-container')
    );

    return;
  }

  // Do not run SA if having more than 25,000 block collisions
  // NOTE: For 25,000 block collisions, SA is taking less than 60 seconds approximately,
  // depending on the amount of chromosomes
  if (currentEnergy > 25000) {
    ReactDOM.unmountComponentAtNode(document.getElementById('alert-container'));
    ReactDOM.render(
      <AlertWithTimeout
        color = "danger"
        message = {"This feature does not work with more than 25,000 block collisions."}
      />,
      document.getElementById('alert-container')
    );

    return;
  }

  // Show notification and return if collisionCount equals superimposedCount
  if (currentEnergy === superimposedCollisionCount) {
    ReactDOM.unmountComponentAtNode(document.getElementById('alert-container'));
    ReactDOM.render(
      <AlertWithTimeout
        color = "danger"
        message = {"All the block collisions in the current layout are from superimposed blocks."}
      />,
      document.getElementById('alert-container')
    );

    return;
  }

  // Default temperature/ratio is 5,000/0.05
  // Entering loop around 150 times
  let temperature = 5000;
  let ratio = 0.05;

  // Update temperature/ratio to 5,000/0.006 if collision count is between 100 and 500
  // Entering loop around 1500 times
  if (currentEnergy > 100 && currentEnergy <= 500) {
    temperature = 6000;
    ratio = 0.006;
  }

  // Update temperature/ratio to 10,000/0.003 if less than 100 collisions available
  // Entering loop around 3000 times
  if (currentEnergy <= 100) {
    temperature = 10000;
    ratio = 0.003;
  }

  const complementRatio = (1 - ratio);
  let bestSolution = cloneDeep(currentSolution);
  let bestEnergy = currentEnergy;

  while (temperature > 1.0) {
    howMany++;

    let newSolution = cloneDeep(currentSolution);
    const pos1 = Math.trunc(newSolution.length * Math.random());
    const pos2 = Math.trunc(newSolution.length * Math.random());
    const val1 = newSolution[pos1];
    const val2 = newSolution[pos2];
    newSolution[pos2] = val1;
    newSolution[pos1] = val2;

    myCircos.layout(newSolution, CIRCOS_CONF);
    let { collisionCount: neighborEnergy } = await getBlockCollisions(newSolution, dataChords, /*bestEnergy*/ );
    const probability = acceptanceProbability(currentEnergy, neighborEnergy, temperature);

    if (probability === 1.0 || probability > Math.random()) {
      currentSolution = cloneDeep(newSolution);
      currentEnergy = neighborEnergy;

      if (neighborEnergy < bestEnergy) {
        bestSolution = cloneDeep(newSolution);
        bestEnergy = neighborEnergy;

        if (bestEnergy === 0) break;
      }
    }

    temperature *= complementRatio;
  }

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

  callSwapPositionsAnimation(dataChromosomes, bestSolution);
};
