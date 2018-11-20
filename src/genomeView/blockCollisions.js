import {
  easeLinear as d3EaseLinear,
  format as d3Format,
  ribbon as d3Ribbon,
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';

// ParallelJS
import Parallel from 'paralleljs';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import difference from 'lodash/difference';
import findIndex from 'lodash/findIndex';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import union from 'lodash/union';

import generateGenomeView from './generateGenomeView';
import { resetZoomBlockView } from './../generateBlockView';
import { updateAdditionalTracksWhileDragging } from './dragging';
import {
  flipGenesPosition,
  getChordsRadius,
  getFlippedGenesPosition,
  movePageContainerScroll,
  removeNonLettersFromString,
  renderReactAlert,
  resetInputsAndSelectsOnAnimation,
  roundFloatNumber,
  sortGffKeys,
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
  setCurrentFlippedChromosomes
} from './../variables/currentFlippedChromosomes';
import {
  getDataChords,
  setDataChords,
  toChordsOrder
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
  DEFAULT_BLOCK_VIEW_ZOOM_STATE,
  DEGREES_TO_RADIANS,
  FLIPPING_CHROMOSOME_TIME,
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
 * Generates the transition to add a stroke to flipped chromosomes
 *
 * @param  {string} currentChr       Current chromosome
 * @param  {boolean} [flipping=true] Flag to determine whether or not to add the stroke
 * @return {undefined}               undefined
 */
export function transitionFlipChromosomeStroke(currentChr, flipping = true) {
  d3Select(`g.${currentChr} path#arc-label${currentChr}`)
    .transition()
    .duration(FLIPPING_CHROMOSOME_TIME - 25)
    .style("stroke", flipping ? "#ea4848" : "none")
    .style("stroke-width", flipping ? "2px" : "0");
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
        const blockID = d.source.value.id;
        currentFill[blockID] = d3Select(this).style("fill");

        let raiseAndBlueColor = false;
        if (!isEmpty(visitedBlockForFlipping)) {
          if (visitedBlockForFlipping[blockID]) {
            d3Select(this).style("fill", currentFill[blockID]);
          } else {
            visitedBlockForFlipping[blockID] = true;
            raiseAndBlueColor = true;
          }
        } else raiseAndBlueColor = true;
        // visitedBlockForFlipping is not defined when manually flipping a chr

        if (raiseAndBlueColor) {
          d3Select(this).raise();
          d3Select(this).style("fill", "lightblue");
        }

        const { sourcePositions, targetPositions } = flipGenesPosition({
          blockPositions: blockDictionary[d.source.value.id].blockPositions,
          currentFlippedChromosomes: currentFlippedChromosomes,
          sourceID: d.source.id,
          targetID: d.target.id
        });

        // (Un)Highlighting the flipped chromosomes with a stroke
        transitionFlipChromosomeStroke(d.source.id, currentFlippedChromosomes.indexOf(d.source.id) > (-1));
        transitionFlipChromosomeStroke(d.target.id, currentFlippedChromosomes.indexOf(d.target.id) > (-1));

        const positions = {
          source: {
            id: d.source.id,
            start: sourcePositions.start,
            end: sourcePositions.end
          },
          target: {
            id: d.target.id,
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
        .style("fill", function(d) {
          return currentFill[d.source.value.id];
        });
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
    // Default temperature/ratio is 5,000/0.05
    // Entering loop around 150 times
    let updatedTemperature = 5000, updatedRatio = 0.05;

    // TODO: Create a hash table for this?

    // Update temperature/ratio to 10,000/0.003 if less than 100 collisions available
    // Entering loop around 3000 times
    if (collisionCount <= 100) {
      updatedTemperature = 10000;
      updatedRatio = 0.003;
    }

    // Entering loop around 4000 times
    if (collisionCount <= 10) {
      updatedTemperature = 200000;
      updatedRatio = 0.003;
    }

    // Update temperature/ratio to 5,000/0.006 if collision count is between 100 and 500
    // Entering loop around 1500 times
    if (collisionCount > 100 && collisionCount <= 500) {
      updatedTemperature = 6000;
      updatedRatio = 0.006;
    }

    // Entering loop around 500 times
    if (collisionCount > 500 && collisionCount <= 1500) {
      updatedTemperature = 40000;
      updatedRatio = 0.02;
    }

    // Entering loop around 100 times
    if (collisionCount >= 75000) {
      updatedTemperature = 10000;
      updatedRatio = 0.08;
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
 * Shows saved layout if conditions are met and a layout is saved
 * NOTE: This is called after block collisions are calculated or checkbox is clicked
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @param  {boolean} shouldUpdateLayout    True if Circos layout should be updated, otherwise false
 * @return {undefined}                     undefined
 */
export function showSavedLayout(dataChromosomes, dataChords, shouldUpdateLayout) {
  // Show best / saved layout checkbox
  let showBestPossibleLayout =
    d3Select("p.show-best-layout input").property("checked");

  if (shouldUpdateLayout && showBestPossibleLayout) {
    const { currentPosition, key } = lookUpPositionCollisionsDictionary(dataChromosomes, dataChords);
    const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();

    showBestPossibleLayout = showBestPossibleLayout && currentPosition !== (-1);

    if (showBestPossibleLayout) {
      const { bestFlippedChromosomes, bestSolution } = savedCollisionSolutionsDictionary[key][currentPosition];

      console.log('FOUND LAYOUT: ', bestFlippedChromosomes, bestSolution);

      // Here I do not need to re-render if dataChromosomes and bestSolution are the same,
      // because I didn't modify the layout
      callSwapPositionsAnimation({
        dataChromosomes: dataChromosomes,
        bestSolution: bestSolution,
        bestFlippedChromosomes: bestFlippedChromosomes,
        updateWhenSame: false
      });
    }
  }
};

/**
 * Disables show saved layout when operations lead to a worse solution
 * NOTE: This is called when resetting layout, flipping or dragging a chr,
 * and after running SA
 *
 * @param  {Array<Object>|Array<string>} dataChromosomes  Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChordsSA     Plotting information for each block chord
 * @param  {number} currentCollisionCount   Current collision count for the view
 * @return {undefined}                      undefined
 */
export function disableShowSavedLayout(dataChromosomes, dataChords, currentCollisionCount) {
  // Do not enter function if input is empty (not defined) or is already false
  if (d3Select("p.show-best-layout input").empty() ||
    !d3Select("p.show-best-layout input").property("checked")) return;

  const { currentPosition, key } = lookUpPositionCollisionsDictionary(dataChromosomes, dataChords);
  const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();
  if (currentPosition !== (-1)) {
    if (currentCollisionCount == null) {
      // Disable checkbox because operations might lead to a worse or better solution
      d3Select("p.show-best-layout input").property("checked", false);
      return;
    }

    const { collisionCount } = savedCollisionSolutionsDictionary[key][currentPosition];

    // This extra check is only done after running SA
    if (collisionCount > currentCollisionCount) {
      console.log('COLLISION COUNT: ', collisionCount, currentCollisionCount);

      // Disable checkbox because saved solution is worse than actual one
      d3Select("p.show-best-layout input").property("checked", false);
    }
  }

  return;
};

/**
 * Updating the label showing the number of block collisions
 * NOTE: Using paralleljs to do the calculation asynchronously
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Array<Object>} dataChords      Plotting information for each block chord
 * @param  {boolean} shouldUpdateLayout    True if Circos layout should be updated, otherwise false
 * @return {undefined}                     undefined
 */
export function updateBlockCollisionHeadline(dataChromosomes, dataChords, shouldUpdateLayout) {
  console.log('Updating block collision headline !!!');
  updateWaitingBlockCollisionHeadline();

  // Disabling minimize collisions and save layout buttons until collision counts
  // are calculated
  d3Select(".best-guess > input")
    .attr("disabled", true);

  d3Select(".save-layout > input")
    .attr("disabled", true);

  // Disabling show saved layout because I need the chromosomes and chords data
  d3Select("p.show-best-layout input")
    .attr("disabled", true);

  // I want to get the results from the last set of chromosomes that was called
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

      // Enabling minimize collisions, save layout, and show saved layout
      // after calculations are done
      d3Select(".best-guess > input")
        .attr("disabled", null);

      d3Select(".save-layout > input")
        .attr("disabled", null);

      d3Select("p.show-best-layout input")
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

      // Show updated layout if it is saved
      showSavedLayout(currentDataChromosomes, currentDataChords, shouldUpdateLayout);
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
}

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
      });
  }
}

/**
 * Looks up position in collisions dictionary
 * TODO: Move this to variable folder
 *
 * @param  {Array<Object>|Array<string>} bestSolution Data for best solution chromosomes
 * @param  {Array<Object>} dataChords   Plotting information for each block chord
 * @return {Object}                     Position and key in collisions dictionary
 */
export function lookUpPositionCollisionsDictionary(bestSolution, dataChords) {
  let bestSolutionChromosomeOrder = bestSolution;
  // If object inside has id, then generate chromosome order
  // If not, it means that it's already in chromosome order format (array of strings)
  if (bestSolution[0] && bestSolution[0].id) {
    bestSolutionChromosomeOrder = toChromosomeOrder(bestSolution);
  }

  // Look for current savedCollisionSolutionsDictionary
  const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();
  const key = sortGffKeys(bestSolutionChromosomeOrder).slice().toString();

  // Finding positions for the chromosomes in key with current dataChords
  const currentPosition = findIndex(savedCollisionSolutionsDictionary[key], function(d) {
    return isEqual(toChordsOrder(d.dataChords), toChordsOrder(dataChords));
  });

  return {
    currentPosition: currentPosition,
    key: key
  };
};

/**
 * Save configuration to collisions dictionary
 *
 * @param  {Array<string>} bestFlippedChromosomes Data for best flipped chromosomes
 * @param  {Array<Object>} bestSolution   Data for best solution chromosomes
 * @param  {number}        collisionCount Number of collisions
 * @param  {Array<Object>} dataChords     Plotting information for each block chord
 * @return {undefined}                    undefined
 */
export function saveToCollisionsDictionary({
  bestFlippedChromosomes,
  bestSolution,
  collisionCount,
  dataChords
}) {
  const { currentPosition, key } = lookUpPositionCollisionsDictionary(bestSolution, dataChords);
  const savedCollisionSolutionsDictionary = getSavedCollisionSolutionsDictionary();

  if (!(key in savedCollisionSolutionsDictionary)) {
    savedCollisionSolutionsDictionary[key] = [];
  }

  const currentObject = {
    bestFlippedChromosomes: cloneDeep(bestFlippedChromosomes),
    bestSolution: cloneDeep(bestSolution),
    collisionCount: collisionCount,
    dataChords: cloneDeep(dataChords)
  };

  if (currentPosition !== (-1)) {
    // For this configuration, I want to save another combination (could be better or not)
    savedCollisionSolutionsDictionary[key][currentPosition] = currentObject;
  } else {
    savedCollisionSolutionsDictionary[key].push(currentObject);
  }

  setSavedCollisionSolutionsDictionary(savedCollisionSolutionsDictionary);
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

  if (swapPositions.length > 0 || !isEqual(allFlippedChromosomes, bestFlippedChromosomes)) {
    // Setting chromosome order with all the chromosomes
    // NOTE: Current chromosome order variable always includes all the chromosomes
    setCurrentChromosomeOrder(toChromosomeOrder(bestSolution, true));

    // Showing alert using react
    renderReactAlert("The layout was successfully updated.", "success");

    // Move scroll to start when successfully running SA, resetting the layout, or
    // showing a saved layout
    movePageContainerScroll("start");

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

    transitionTime = 0;
    let index = 0;

    while (transitionTime < (TRANSITION_SWAPPING_TIME * swapPositions.length) &&
      index < swapPositions.length) {
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
      (TRANSITION_SWAPPING_TIME * positionsNotBeingSwapped.length) &&
      index < positionsNotBeingSwapped.length) {
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

      const unionFlippedChromosomes = union(allFlippedChromosomes, bestFlippedChromosomes);

      const chrBlockDictionary = {};
      const blockChrDictionary = {};
      const visitedChrForFlipping = [];
      const visitedBlockForFlipping = [];

      for (let i = 0; i < unionFlippedChromosomes.length; i++) {
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
        for (let j = 0; j < sourceList.length; j++) {
          if (!visitedBlockForFlipping[sourceList[j].blockID]) {
            allTrue = false;
            break;
          }
        }

        if (allTrue) {
          visitedChrForFlipping[affectedChromosomes[0]] = true;
        }

        allTrue = true;
        for (let j = 0; j < targetList.length; j++) {
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
          const blockID = d.source.value.id;
          visitedBlockForFlipping[blockID] = false;

          const sourceID = d.source.id;
          const targetID = d.target.id;
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
        for (let i = 0; i < unionFlippedChromosomes.length; i++) {
          d3SelectAll(`path.chord.${unionFlippedChromosomes[i]}`)
            .each(function(d) {
              const blockID = d.source.value.id;
              const sourceID = d.source.id;
              const targetID = d.target.id;

              const affectedChromosomes = blockChrDictionary[blockID];
              const sourceList = chrBlockDictionary[affectedChromosomes[0]];
              const targetList = chrBlockDictionary[affectedChromosomes[1]];

              let sourcePositionsObject = {};
              let targetPositionsObject = {};
              for (let j = 0; j < sourceList.length; j++) {
                if (sourceList[j].blockID === blockID) {
                  sourcePositionsObject = cloneDeep(sourceList[j].positions);
                  break;
                }
              }

              for (let j = 0; j < targetList.length; j++) {
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

        for (let r = 0; r < unionFlippedChromosomes.length; r++) {
          console.log('chr visited: ', unionFlippedChromosomes[r], visitedChrForFlipping[unionFlippedChromosomes[r]]);
        }
      }

      while ((flippedTransitionTime - positionsNotSwappedTransitionTime) <
        ((FLIPPING_CHROMOSOME_TIME + 25) * unionFlippedChromosomes.length) &&
        index < unionFlippedChromosomes.length) {
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

              for (let j = 0; j < affectedBlocks.length; j++) {
                // Resetting zoom state object for all affected chords
                // Only resetting the chords that WERE present in the flipping animation
                const blockID = affectedBlocks[j];
                resetZoomBlockView(blockID);
                // Marking block as visited
                visitedBlockForFlipping[blockID] = true;
              }

              for (let j = 0; j < affectedBlocks.length; j++) {
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
  // bestSolution will always have same or less collisions than dataChromosomes
  // hence, only enter this condition if it has less (i.e. they are different in order)
  // OR
  // Enter condition if best flipped chromosomes is different from actual
  const allFlippedChromosomes = getCurrentFlippedChromosomes();
  // The two chromosome order will always have the same amount of chromosomes, just in different order
  const currentChromosomeOrder = toChromosomeOrder(bestSolution);
  const oldChromosomeOrder = toChromosomeOrder(dataChromosomes);

  if (!isEqual(oldChromosomeOrder, currentChromosomeOrder) ||
    !isEqual(allFlippedChromosomes, bestFlippedChromosomes)) {
    const swapPositions = minSwapToMakeArraySame(currentChromosomeOrder,
      oldChromosomeOrder);

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
 * @return {Array<string>}             Final plotting information with blocks flipped
 */
function applyFlippingDataChords(dataChords, flippedChromosomes) {
  const blockDictionary = getBlockDictionary();
  const tempDataChords = cloneDeep(dataChords);
  const tempFlippedChromosomes = cloneDeep(flippedChromosomes);

  // Need to always go through all the chords, to reset the ones
  // that are not flipped anymore. For example: If it is the second
  // time the algorithm arrives at bn2, it won't be flipped, and I
  // can't limit the loop to only enter the chords that are flipped, because
  // in this case bn2 will never be unflipped.
  //
  // Another way, is to just reset dataChords each time
  for (let i = 0; i < tempDataChords.length; i++) {
    const blockID = tempDataChords[i].source.value.id;

    const { sourcePositions, targetPositions } = flipGenesPosition({
      blockPositions: blockDictionary[blockID].blockPositions,
      currentFlippedChromosomes: tempFlippedChromosomes,
      sourceID: tempDataChords[i].source.id,
      targetID: tempDataChords[i].target.id
    });

    tempDataChords[i].source.start = sourcePositions.start;
    tempDataChords[i].source.end = sourcePositions.end;

    tempDataChords[i].target.start = targetPositions.start;
    tempDataChords[i].target.end = targetPositions.end;
  }

  return tempDataChords;
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
    renderReactAlert(messageToShow);

    // Re-activating button
    d3Select(".best-guess > input")
      .property("value", "Minimize collisions")
      .attr("disabled", null);

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
  let flippedChromosomesSimulatedAnnealing = allFlippedChromosomes.slice();
  let bestFlippedChromosomes = flippedChromosomesSimulatedAnnealing.slice();

  console.log('TOTAL TIME: ', totalTime);

  setTimeout(async function simulatedAnnealingLoop() {
    // TODO: Create a new function
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
          let pos1, pos2;
          const chooseRandomFlippingOrSwapping = Math.random();
          const doingFlipping = flippingFrequency > 0 && (
            flippingFrequency === 100 || chooseRandomFlippingOrSwapping < (flippingFrequency/100.0)
          );

          if (doingFlipping) {
            let currentID = null;

            do {
              // Choose non-empty position to do flipping
              pos1 = Math.trunc(newSolution.length * Math.random());
              currentID = newSolution[pos1].id.slice(0);
            } while (d3SelectAll(`path.chord.${currentID}`).empty());

            const currentPosition = flippedChromosomesSimulatedAnnealing.indexOf(currentID);

            // If chromosome id is present, then remove it
            if (currentPosition !== (-1)) {
              flippedChromosomesSimulatedAnnealing.splice(currentPosition, 1);
            } else {
              flippedChromosomesSimulatedAnnealing.push(currentID);
            }

            dataChords = cloneDeep(applyFlippingDataChords(dataChords, flippedChromosomesSimulatedAnnealing));
          } else {
            let currentID = null;

            do {
              // First chromosome can never be empty, to make sure to never swap
              // two empty chromosomes
              pos1 = Math.trunc(newSolution.length * Math.random());
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
              for (let i = 0; i < newSolution.length; i++) {
                const currentIdentifier = removeNonLettersFromString(newSolution[i].id.slice(0));
                if (currentIdentifier === firstIdentifier) {
                  countFirstIdentifier++;
                  if (countFirstIdentifier === 2) {
                    multipleChrFirstIdentifier = true;
                    break;
                  }
                }
              }

              console.log('MULTIPLE CHR IDENTIFIER: ', multipleChrFirstIdentifier, currentID);
            }

            pos2 = pos1; // Initializing second position as the first one

            do {
              // Getting random positions until both positions are different
              pos2 = Math.trunc(newSolution.length * Math.random());

              positionChecking = pos1 === pos2;
              currentID = newSolution[pos2].id.slice(0);

              if (shouldKeepChromosomesTogether && multipleChrFirstIdentifier) {
                const secondIdentifier = removeNonLettersFromString(currentID);
                console.log('ENTERING IDENTIFIER HERE\n\n', currentID, secondIdentifier);

                identifierChecking = firstIdentifier !== secondIdentifier;
              }

            } while (positionChecking || identifierChecking);

            const val1 = newSolution[pos1];
            const val2 = newSolution[pos2];
            newSolution[pos2] = val1;
            newSolution[pos1] = val2;
          }

          myCircos.layout(newSolution, CIRCOS_CONF);
          const { collisionCount: neighborEnergy } = await getBlockCollisions(newSolution, dataChords);
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

      if (flippingFrequency > 0) {
        if (bestFlippedChromosomes.length === 0) {
          // Finishing in 100%
          d3Select(".genome-view-container .progress-bar")
            .style("width", "100%")
            .text("100%");
          afterCheckTime += totalTime;
        } else {
          // Omitting flipped chromosomes that make the final solution worse
          for (let i = 0; i < bestFlippedChromosomes.length; i++) {
            (function(afterCheckTime, howMany) {
              setTimeout(async function() {
                let progressBarValue = (howMany / bestFlippedChromosomes.length) * 5;

                const progressBarWidth = 95 + Math.trunc(progressBarValue);

                d3Select(".genome-view-container .progress-bar")
                  .style("width", `${progressBarWidth}%`)
                  .text(`${progressBarWidth}%`);

                  const afterCheckFlippedChromosomes = bestFlippedChromosomes.slice();
                  const positionCurrentChr = afterCheckFlippedChromosomes.indexOf(bestFlippedChromosomes[i]);
                  // Removing chromosome from list of flipped ones
                  afterCheckFlippedChromosomes.splice(positionCurrentChr, 1);

                  // Removing previously excluded chromosomes from list of flipped ones
                  for (let j = 0; j < excludeFlippedChromosomes.length; j++) {
                    const positionExcludeChr = afterCheckFlippedChromosomes.indexOf(excludeFlippedChromosomes[j]);
                    if (positionExcludeChr !== (-1)) {
                      afterCheckFlippedChromosomes.splice(positionExcludeChr, 1);
                    }
                  }

                  // Applying flipping again with the excluded flipped chromosome
                  dataChords = cloneDeep(applyFlippingDataChords(dataChords, afterCheckFlippedChromosomes));
                  const { collisionCount: neighborEnergy } = await getBlockCollisions(bestSolution, dataChords);

                  console.log('CURRENT CHR AND ENERGY: ', bestFlippedChromosomes[i], neighborEnergy);

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
        // Autosave functionality
        // saveToCollisionsDictionary(bestSolution, bestEnergy, dataChords);

        if (excludeFlippedChromosomes.length > 0) {
          console.log('EXCLUDE: ', excludeFlippedChromosomes);
          // Excluding chrs that make the final solution worse
          bestFlippedChromosomes = difference(bestFlippedChromosomes, excludeFlippedChromosomes);
        }

        // Checking if saved solution is worse than actual one, to disable saved input
        // NOTE: After running SA, the saved solution will never be better than the actual one,
        // because when running SA, the result can never be worse,
        // it will be better or the same
        disableShowSavedLayout(bestSolution, dataChords, bestEnergy);

        // Getting rid of the blurred view
        d3SelectAll("svg#genome-view,#block-view-container")
          .classed("blur-view", false);

        setTimeout(() => {
          d3Select(".best-guess > input")
            .property("value", "Minimize collisions")
            .attr("disabled", null);

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
