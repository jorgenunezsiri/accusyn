import * as d3 from 'd3';
import find from 'lodash/find';

import generateGenomeView  from './generateGenomeView';
import { updateAngle } from './../helpers';
import {
  getCurrentChromosomeMouseDown,
  setCurrentChromosomeMouseDown
} from './../variables/currentChromosomeMouseDown';
import {
  getCurrentChromosomeOrder,
  setCurrentChromosomeOrder
} from './../variables/currentChromosomeOrder';

// Constants
import {
  DEGREES_TO_RADIANS,
  GAP_AMOUNT,
  GENOME_INNER_RADIUS,
  RADIANS_TO_DEGREES,
  TRANSITION_DRAG_TIME,
  WIDTH,
  HEIGHT
} from './../constants';

// Dragging variables
let angleValue = 0; // Stores the angle width of the current mouse down chr
let draggedAngle = 0; // To keep track of the rotating angles of the genome view
let draggingAnglesDictionary = {}; // Dragging angles dictionary based on start and end angles from Circos library
let hasMovedDragging = []; // Array to keep track of the chr that have moved in the dragging animation

// This variable is modified to include more movements of the mouse down chr
let lastAngle = 0; // Last angle that was captured in the drag event
let offsetAngle = 0; // Offset dragging angle
let selectDrag = []; // Array to keep track of the chr that will be moving in the dragging animation
let trueLastAngle = 0; // Last angle from drag event without modification


/**
 * Generates the angles for the chord inside the chromosomes data
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @param  {Object} chord           Current chord
 * @param  {string} reference       Type of reference (i.e. source or target)
 * @return {Object}                 Chord angles
 */
export function getChordAngles(dataChromosomes, chord, reference) {
  const currentObject = find(dataChromosomes, ['id', chord[reference].id]);
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
 * Generates dragging angles dictionary from current chromosome data
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @return {undefined}                     undefined
 */
export function generateDraggingAnglesDictionary(dataChromosomes) {
  draggingAnglesDictionary = {};

  for (let i = 0; i < dataChromosomes.length; i++) {
    const currentID = dataChromosomes[i].id;

    if (!(dataChromosomes[i].id in draggingAnglesDictionary)) {
      draggingAnglesDictionary[currentID] = {};
    }

    draggingAnglesDictionary[currentID].startAngle = dataChromosomes[i].start * RADIANS_TO_DEGREES;
    draggingAnglesDictionary[currentID].endAngle = dataChromosomes[i].end * RADIANS_TO_DEGREES;
    draggingAnglesDictionary[currentID].totalAngle =
      (draggingAnglesDictionary[currentID].endAngle - draggingAnglesDictionary[currentID].startAngle);
  }
};

/**
 * Updates chords while the user is dragging or the animation is happening
 *
 * @param  {number} angleValue                 Total angle of mouse down chromosome plus gap amount
 * @param  {number} angleFromChromosome        Angle of rotation for source chromosome
 * @param  {string} chromosome                 Source chromosome to update the chords
 * @param  {string} currentChromosomeMouseDown The chromosome that the user is dragging
 * @param  {Array<Object>} dataChromosomes     Current chromosomes in the Circos plot
 * @param  {number} extraAngle                 Angle of extra rotation for the chords
 * @param  {Array<Object>} hasMovedDragging    Dictionary to know when each chromosome moves
 * @param  {Array<string>} selectDrag          List of chromosomes that are going to be moved
 * @param  {number} transitionDuration         Time for transitioning
 * @return {undefined}                         undefined
 */
export function updateChordsWhileDragging({
  angleValue,
  angleFromChromosome,
  chromosome,
  currentChromosomeMouseDown,
  dataChromosomes,
  extraAngle,
  hasMovedDragging,
  selectDrag,
  transitionDuration
}) {
  // Only update if chromosome (parameter) has chords
  // meaning that selection should not be empty
  if (!d3.selectAll(`path.chord.${chromosome}`).empty()) {
    const ribbon = d3.ribbon().radius(GENOME_INNER_RADIUS);
    const isChrMouseDown = transitionDuration === 0 &&
      chromosome === currentChromosomeMouseDown;

    if (isChrMouseDown) {
      d3.selectAll('path.chord')
        .attr("opacity", 0.3);
    }

    d3.selectAll(`path.chord.${chromosome}`)
      .raise()
      .transition()
      .duration(transitionDuration)
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

        if (isChrMouseDown) {
          if (d.source.id === chromosome) {
            sourceStartAngle += (extraAngle * DEGREES_TO_RADIANS);
            sourceEndAngle += (extraAngle * DEGREES_TO_RADIANS);
          } else if (d.target.id === chromosome) {
            targetStartAngle += (extraAngle * DEGREES_TO_RADIANS);
            targetEndAngle += (extraAngle * DEGREES_TO_RADIANS);
          }
        } else {

          // angleFromChromosome is trueLastAngle,
          // extraAngle is rotatingAngle

          //
          // Main idea:
          // If I'm the one moving (I'm source):
          // -> All my targets will not move
          // -> I (source) will move extraAngle which is rotatingAngle
          //
          // If others are moving (They are source):
          // -> They (source) move extraAngle which is rotatingAngle
          // -> I (target) will move trueLastAngle (which is angleFromChromosome)
          //

          if (d.source.id !== d.target.id) {
            if (d.source.id === chromosome) {

              if (d.source.id === currentChromosomeMouseDown) {
                // console.log('-> 1');
                sourceStartAngle += (extraAngle * DEGREES_TO_RADIANS);
                sourceEndAngle += (extraAngle * DEGREES_TO_RADIANS);

                // TODO: Refactor this - it can also be hasMovedDragging

                if (selectDrag.indexOf(d.target.id) > -1) {
                  // console.log('-> 1.1');
                  targetStartAngle += (angleValue * DEGREES_TO_RADIANS);
                  targetEndAngle += (angleValue * DEGREES_TO_RADIANS);
                }

              } else {
                // console.log('-> 2');
                sourceStartAngle += (extraAngle * DEGREES_TO_RADIANS);
                sourceEndAngle += (extraAngle * DEGREES_TO_RADIANS);

                if (selectDrag.indexOf(d.target.id) > -1) {
                  // console.log('-> 2.1');
                  if (d.target.id === currentChromosomeMouseDown) {
                    targetStartAngle += (angleFromChromosome * DEGREES_TO_RADIANS);
                    targetEndAngle += (angleFromChromosome * DEGREES_TO_RADIANS);
                  } else if (hasMovedDragging[d.target.id]) {
                    // Can also be extraAngle here ...
                    targetStartAngle += (angleValue * DEGREES_TO_RADIANS);
                    targetEndAngle += (angleValue * DEGREES_TO_RADIANS);
                  }
                }
              }
            } else if (d.target.id === chromosome) {

              if (d.target.id === currentChromosomeMouseDown) {
                // console.log('-> 3');
                targetStartAngle += (extraAngle * DEGREES_TO_RADIANS);
                targetEndAngle += (extraAngle * DEGREES_TO_RADIANS);

                if (selectDrag.indexOf(d.source.id) > -1) {
                  // console.log('-> 3.1');
                  sourceStartAngle += (angleValue * DEGREES_TO_RADIANS);
                  sourceEndAngle += (angleValue * DEGREES_TO_RADIANS);
                }

              } else {
                // console.log('-> 4');
                targetStartAngle += (extraAngle * DEGREES_TO_RADIANS);
                targetEndAngle += (extraAngle * DEGREES_TO_RADIANS);

                if (selectDrag.indexOf(d.source.id) > -1) {
                  // console.log('-> 4.1');
                  if (d.source.id === currentChromosomeMouseDown) {
                    sourceStartAngle += (angleFromChromosome * DEGREES_TO_RADIANS);
                    sourceEndAngle += (angleFromChromosome * DEGREES_TO_RADIANS);
                  } else if (hasMovedDragging[d.source.id]) {
                    // Can also be extraAngle here ...
                    sourceStartAngle += (angleValue * DEGREES_TO_RADIANS);
                    sourceEndAngle += (angleValue * DEGREES_TO_RADIANS);
                  }
                }

              }

            }
          } else {
            // if (d.source.id === d.target.id)
            sourceStartAngle += (extraAngle * DEGREES_TO_RADIANS);
            sourceEndAngle += (extraAngle * DEGREES_TO_RADIANS);

            targetStartAngle += (extraAngle * DEGREES_TO_RADIANS);
            targetEndAngle += (extraAngle * DEGREES_TO_RADIANS);
          }
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
 * Generates the angle from (x, y) coordinates. Using the main container as
 * reference
 *
 * @return {number} Angle in degrees from current coordinates
 */
function getAngleFromCoordinates() {
  const containerNode = d3.select("svg#main-container").node();

  // Points are equal to current mouse coordinate minus 50 minus 350
  // width / 2 = 400 and height / 2 = 400
  // but svg object inside is 700,700
  // which means that center is in coordinate 350
  const x = d3.mouse(containerNode)[0] - (WIDTH / 2);
  const y = d3.mouse(containerNode)[1] - (HEIGHT / 2);

  // 1 rad = 180 / Math.PI = 57.2957795;
  return Math.atan2(y, x) * RADIANS_TO_DEGREES;
}

/**
 * Start dragging function
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @return {undefined}                     undefined
 */
function onStartDragging(dataChromosomes) {
  const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
  console.log('CURRENT MOUSE DOWN: ', currentChromosomeMouseDown);

  if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

  // Creating a clone of the current mouse down chromosome
  d3.selectAll(`g.${currentChromosomeMouseDown}-clone`).remove();
  // Creating clone of mouse down chr using selection.clone(deep = true)
  const copy = d3.select(`g.${currentChromosomeMouseDown}`).clone(true);
  copy.lower()
    .attr("class", `${currentChromosomeMouseDown}-clone`)
    .attr("opacity", 0.5)
    .style("pointer-events", "none"); // No events should point to it

  // Offset angle for correct rotation
  offsetAngle = getAngleFromCoordinates();
  // Initializing lastAngle variable
  lastAngle = 0;
  trueLastAngle = 0;

  // Highlighting current mouse down chromosome and its chords
  d3.select(`g.${currentChromosomeMouseDown}`)
    .style("stroke", "#ea4848")
    .style("stroke-width", "1px");

  d3.selectAll('path.chord')
    .attr("opacity", 0.3);

  d3.selectAll(`path.chord.${currentChromosomeMouseDown}`)
    .raise()
    .attr("opacity", 0.9);

  // TODO: CREATE FUNCTION FOR THIS !!!
  d3.select(".block-collision-headline")
    .text("Updating block collisions ...");
}

/**
 * On dragging function
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @return {undefined}                     undefined
 */
function onDragging(dataChromosomes) {
  const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
  console.log('CURRENT MOUSE DOWN: ', currentChromosomeMouseDown);

  if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

  // Selecting current mouse down chromosome
  const current = d3.select(`g.${currentChromosomeMouseDown}`);
  const currentAngle = (getAngleFromCoordinates() - offsetAngle);

  current
    .raise()
    .attr("transform", `rotate(${currentAngle})`)
    // While dragging no other events should point to it
    .style("pointer-events", "none");

  // Updating lastAngle with currentAngle to be used in the end drag event
  lastAngle = currentAngle;
  trueLastAngle = currentAngle;

  console.log('LAST ANGLE: ', lastAngle);

  // Updating chords while dragging
  updateChordsWhileDragging({
    "chromosome": currentChromosomeMouseDown,
    "currentChromosomeMouseDown": currentChromosomeMouseDown,
    "dataChromosomes": dataChromosomes,
    "extraAngle": lastAngle,
    "transitionDuration": 0
  });
}

/**
 * End dragging function
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @return {undefined}                     undefined
 */
function onEndDragging(dataChromosomes) {
  const currentChromosomeMouseDown = getCurrentChromosomeMouseDown();
  console.log('CURRENT MOUSE DOWN: ', currentChromosomeMouseDown);

  if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

  let currentChromosomeOrder = getCurrentChromosomeOrder();

  // Turning off highlighting for current mouse down chromosome
  d3.select(`g.${currentChromosomeMouseDown}`)
    .style("stroke", "none");

  let collidedChr = "";
  for (let i = 0; i < dataChromosomes.length; i++) {
    const key = dataChromosomes[i].id;
    let lastChrPosition = (draggingAnglesDictionary[currentChromosomeMouseDown].startAngle + lastAngle);

    if (lastChrPosition < 0) lastChrPosition = 360 + lastChrPosition;
    else if (lastChrPosition > 360) lastChrPosition = lastChrPosition - 360;

    console.log('INSIDE LOOP: ', currentChromosomeMouseDown, key, lastChrPosition, draggingAnglesDictionary[key].startAngle);

    if (lastChrPosition >= draggingAnglesDictionary[key].startAngle &&
      lastChrPosition <= draggingAnglesDictionary[key].endAngle) {
      collidedChr = key;
    }
  }

  console.log('COLLIDED CHR: ', collidedChr);

  if (collidedChr === currentChromosomeMouseDown || collidedChr === "") {
    // Resetting current mouse down chr
    setCurrentChromosomeMouseDown("");

    // Removing cloned chromosome without transition
    d3.select(`g.${currentChromosomeMouseDown}-clone`)
      .attr("opacity", 0)
      .remove();

    // Drawing genome view without removing block view
    // and updating block collisions
    generateGenomeView({
      "transition": { shoulDo: false },
      "shouldUpdateBlockCollisions": true
    });

    return;
  }

  // Disable checkbox because dragging might lead to a worse solution
  d3.select('p.show-best-layout > input').property("checked", false);

  const oldChrOrder = currentChromosomeOrder.slice();

  console.log('OLD ORDER: ', oldChrOrder);

  const currentIndexToDelete = currentChromosomeOrder.indexOf(currentChromosomeMouseDown);
  const currentIndexToInsert = currentChromosomeOrder.indexOf(collidedChr);

  selectDrag = [];
  hasMovedDragging = [];

  if (currentIndexToDelete >= 0) {
    currentChromosomeOrder.splice(currentIndexToDelete, 1);
    currentChromosomeOrder.splice(currentIndexToInsert, 0, currentChromosomeMouseDown);

    setCurrentChromosomeOrder(currentChromosomeOrder);

    for (let i = currentIndexToDelete; currentChromosomeOrder[i] !== currentChromosomeMouseDown; i--) {
      if (i == currentIndexToDelete && oldChrOrder[i + 1] == currentChromosomeOrder[i]) {
        // console.log('HERE FOR LOOP: ', oldChrOrder[i + 1], currentChromosomeOrder[i]);
        if (i - 1 === (-1)) i = 19;

        continue;
      }

      // If chromosome is present in current view, then add it
      if (find(dataChromosomes, ['id', currentChromosomeOrder[i]])) {
        // console.log('INSERTING CURRENT CHROMOSOME ORDER: ', currentChromosomeOrder[i]);
        selectDrag.push(currentChromosomeOrder[i]);
      }

      if (i - 1 === (-1)) i = 19;
    }
  }

  console.log('NEW ORDER: ', currentChromosomeOrder);

  /**
   * Chromosome MouseDown is not being added when dragging chromosomes
   * in clockwise direction (dragging N1 to N14) when no passing through
   * first added chromosome, and also when dragging in counter clockwise
   * direction (dragging N5 to N16) and passing through first added chromosome.
   *
   * Does not happen:
   *  - When dragging in clockwise and passing through first chr
   *  - When dragging in counter clockwise and not passing
   * @type {boolean}
   */
  let notAddingChromosomeMouseDown = false;
  const mouseDownChrLastPosition =
    draggingAnglesDictionary[currentChromosomeMouseDown].endAngle + lastAngle;

  // Updating lastAngle and pushing chrMouseDown so it can move at the end (and no jump shows)
  if (selectDrag.length === 0 || selectDrag[selectDrag.length - 1] !== collidedChr) {
    // console.log('PROBLEM HERE!!!');

    notAddingChromosomeMouseDown = true;

    lastAngle += (draggingAnglesDictionary[collidedChr].endAngle - mouseDownChrLastPosition);

    selectDrag.push(currentChromosomeMouseDown);
  } else {
    // Adding mouse down chr also here to drag it back
    lastAngle += (draggingAnglesDictionary[collidedChr].startAngle - mouseDownChrLastPosition);
    lastAngle -= (GAP_AMOUNT * RADIANS_TO_DEGREES);

    selectDrag.push(currentChromosomeMouseDown);
  }

  console.log('SELECT DRAG: ', selectDrag);

  for (let i = 0; i < selectDrag.length; i++) {
    hasMovedDragging[selectDrag[i]] = false;
  }

  let transitionDraggingBackTime = TRANSITION_DRAG_TIME;

  // Transitioning the remaining chromosomes, by removing the clone first
  d3.select(`g.${currentChromosomeMouseDown}-clone`)
    .transition()
    .duration(TRANSITION_DRAG_TIME)
    .attr("opacity", 0)
    .remove();

  let index = 0;
  angleValue = (draggingAnglesDictionary[currentChromosomeMouseDown].totalAngle + (GAP_AMOUNT * RADIANS_TO_DEGREES));

  console.log('TIME: ', (TRANSITION_DRAG_TIME * selectDrag.length));

  while ((transitionDraggingBackTime - TRANSITION_DRAG_TIME) < (TRANSITION_DRAG_TIME * selectDrag.length)) {
    (function(transitionDraggingBackTime, index) {

      setTimeout(function() {
        const selection = d3.select(`.cs-layout g.${selectDrag[index]}`);
        let rotatingAngle = angleValue;

        if (selectDrag[index] === collidedChr) {
          selection
            .transition()
            .duration(TRANSITION_DRAG_TIME)
            .attr("transform", `rotate(${rotatingAngle})`);
        } else if (selectDrag[index] === currentChromosomeMouseDown) {
          rotatingAngle = (angleValue + lastAngle);

          selection
            .transition()
            .duration(TRANSITION_DRAG_TIME)
            .attr("transform", `rotate(${rotatingAngle})`);
        } else {
          selection
            .raise()
            .transition()
            .duration(TRANSITION_DRAG_TIME)
            .attr("transform", `rotate(${rotatingAngle})`);
        }

        console.log('ROTATING ANGLE: ', rotatingAngle);
        console.log('TRUE LAST ANGLE: ', trueLastAngle);

        updateChordsWhileDragging({
          "angleValue": angleValue,
          "angleFromChromosome": trueLastAngle,
          "chromosome": selectDrag[index],
          "currentChromosomeMouseDown": currentChromosomeMouseDown,
          "dataChromosomes": dataChromosomes,
          "extraAngle": rotatingAngle,
          "hasMovedDragging": hasMovedDragging,
          "selectDrag": selectDrag,
          "transitionDuration": TRANSITION_DRAG_TIME
        });

        hasMovedDragging[selectDrag[index]] = true;
      }, transitionDraggingBackTime);
    })(transitionDraggingBackTime, index);

    transitionDraggingBackTime += TRANSITION_DRAG_TIME;
    index++;
  }

  console.log('TOTAL TIME: ', TRANSITION_DRAG_TIME * 2 + (TRANSITION_DRAG_TIME * selectDrag.length));
  setTimeout(function() {
    if (notAddingChromosomeMouseDown) {
      draggedAngle += angleValue;
      if ((360 - draggedAngle) < 0) draggedAngle = draggedAngle - 360;

      // Current rotating angle for the genome view (default to 0)
      const chromosomeRotateAngle = d3.select("#nAngle-genome-view").property("value");
      updateAngle(+chromosomeRotateAngle, 360 - draggedAngle);
    }

    // Drawing genome view without removing block view
    // and updating block collisions
    generateGenomeView({
      "transition": { shoulDo: false },
      "shouldUpdateBlockCollisions": true
    });

    // Resetting current mouse down chr
    setCurrentChromosomeMouseDown("");
  }, TRANSITION_DRAG_TIME * 2 + (TRANSITION_DRAG_TIME * selectDrag.length));
}

/**
 * Adding drag handler to SVG main container
 *
 * @param  {Array<Object>} dataChromosomes Current chromosomes in the Circos plot
 * @return {undefined}                     undefined
 */
export function addSvgDragHandler(dataChromosomes) {
  // Updating genome view rotating angle on input
  d3.select("#nAngle-genome-view")
    .on("input", function() {
      updateAngle(+this.value, draggedAngle > 0 ? 360 - draggedAngle : 0);
    });

  const dragHandler = d3.drag()
    .on("start", () => onStartDragging(dataChromosomes))
    .on("drag", () => onDragging(dataChromosomes))
    .on("end", () => onEndDragging(dataChromosomes));

  d3.select("svg#main-container").call(dragHandler);
};
