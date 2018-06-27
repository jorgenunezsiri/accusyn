import {
  ribbon as d3Ribbon,
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';
import cloneDeep from 'lodash/cloneDeep';
import findIndex from 'lodash/findIndex';
import isEqual from 'lodash/isEqual';

import generateGenomeView from './generateGenomeView';
import { getChordAngles } from './dragging';
import { sortGffKeys } from './../helpers';
import { getCircosObject } from './../variables/myCircos';
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
} from './../constants';

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
 * Get the number of block collisions with the current chords and chromosome data
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @param  {number} maxNumberOfCollisions  Optional limit to check for
 * @return {number}        collisionCount  Total number of collisions
 */
export function getBlockCollisions(dataChromosomes, dataChords, maxNumberOfCollisions = 0) {
  let collisionCount = 0;
  let breakLoop = false;

  for (let i = 0; i < dataChords.length; i++) {
    for (let j = i + 1; j < dataChords.length; j++) {
      const R1 = getChordAngles(dataChromosomes, dataChords[i], 'source');
      const R2 = getChordAngles(dataChromosomes, dataChords[i], 'target');
      const R3 = getChordAngles(dataChromosomes, dataChords[j], 'source');
      const R4 = getChordAngles(dataChromosomes, dataChords[j], 'target');

      // TODO: Check this again !!!!
      if (intersects(R1.middle, R2.middle, R3.middle, R4.middle) ||
        intersects(R1.start, R2.start, R3.start, R4.start) ||
        intersects(R1.end, R2.end, R3.end, R4.end) ||

        intersects(R1.start, R2.start, R3.middle, R4.middle) ||
        intersects(R1.end, R2.end, R3.middle, R4.middle) ||
        intersects(R1.start, R2.start, R3.end, R4.end) ||

        intersects(R1.middle, R2.middle, R3.start, R4.start) ||
        intersects(R1.middle, R2.middle, R3.end, R4.end) ||
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
    }

    if (breakLoop) break;
  }

  return new Promise(resolve => {
    resolve(collisionCount);
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
  const collisionCount = await getBlockCollisions(dataChromosomes, dataChords);

  console.log("COLLISION COUNT: " + collisionCount);

  // Update block-collision-headline with current collision count
  d3Select(".block-collision-headline")
    .text(function() {
      let textToShow = "Showing ";
      textToShow += collisionCount.toString() === "1" ?
        `${collisionCount} block collision` : `${collisionCount} block collisions`;
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
      "first": arr[i],
      "second": i
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
    "answer": ans,
    "swapPositions": swapPositions
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
    const ribbon = d3Ribbon().radius(GENOME_INNER_RADIUS);

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
    "angle": angle,
    "hasMoved": true
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
    "currentPosition": currentPosition,
    "key": key
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
      "angle": 0,
      "hasMoved": false
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
      "transition": { shouldDo: false },
      "shouldUpdateBlockCollisions": true,
      "shouldUpdateLayout": true
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
    }
  } else if (updateWhenSame) {
    // If they are the same and I can update (the flag is true),
    // it means they have the same number of collisions.
    // Re-render to keep everything untouched.
    // NOTE: This is necessary when I'm using the myCircos.layout function
    // to modify the layout
    generateGenomeView({
      "transition": { shouldDo: false },
      "shouldUpdateBlockCollisions": false,
      "shouldUpdateLayout": true
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
  if (dataChords.length === 0) return;

  let howMany = 0;

  const myCircos = getCircosObject();

  let currentSolution = cloneDeep(dataChromosomes);
  myCircos.layout(currentSolution, CIRCOS_CONF);
  let currentEnergy = await getBlockCollisions(currentSolution, dataChords);
  console.log('CURRENT ENERGY: ', currentEnergy);

  if (currentEnergy === 0) return;

  let temperature = 5000; // TODO: Think about values
  let ratio = 0.05;

  // Update temperature to higher number if less than 100 collisions available
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
    let neighborEnergy = await getBlockCollisions(newSolution, dataChords, /*bestEnergy*/ );
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
      d3Select('div.show-best-layout > input').property("checked", false);
    }
  }

  callSwapPositionsAnimation(dataChromosomes, bestSolution);
};
