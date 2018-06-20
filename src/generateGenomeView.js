/*
University of Saskatchewan
GSB: A Web-based Genome Synteny Browser
Course: CMPT994 - Research

Name: Jorge Nunez Siri
E-mail: jdn766@mail.usask.ca
NSID: jdn766
Student ID: 11239727

Function file: generateGenomeView.js

@2018, Jorge Nunez Siri, All rights reserved
*/

import * as d3 from 'd3';

import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import find from 'lodash/find';

import generateBlockView from './generateBlockView';

import {
  fixSourceTargetCollinearity,
  getSelectedCheckboxes,
  removeBlockView,
  updateAngle
} from './helpers';

// Variable getters and setters
import {
  getBlockDictionary,
  getCircosObject,
  getCurrentChromosomeOrder,
  getGffDictionary,
  setCurrentChromosomeOrder
} from './variables';

// Contants
import {
  CONNECTION_COLOR,
  DEGREES_TO_RADIANS,
  FLIPPING_CHROMOSOME_TIME,
  GAP_AMOUNT,
  RADIANS_TO_DEGREES,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME,
  TRANSITION_DRAG_TIME,
  WIDTH,
  HEIGHT
} from './constants';

// Local variables
let currentChromosomeMouseDown = ""; // To store the current chromosome fired by the mousedown event
const currentFlippedChromosomes = []; // Array that stores the current set of chromosomes with flipped locations
let currentSelectedBlock = {}; // To store the data of the current selected block
const currentRemovedBlocks = []; // Array that stores the current set of blocks that are removed
let dataChords = []; // Array that stores the plotting information for each block chord
let dataChromosomes = []; // Array that stores the current chromosomes in the circos plot
let draggedAngle = 0; // To keep track of the rotating angles of the genome view
let draggingAnglesDictionary = null; // Dragging angles dictionary based on start and end angles from Circos library

/**
 * Generates all paths in the genomeView using the current selected
 * chromosomes and the configuration
 *
 * @param  {Object} transition Current transition configuration
 * @return {undefined} undefined
 */
export function generatePathGenomeView(transition) {
  // Default filtering value for block size
  const filterValue = (d3.select('.filter-connections-div #filter-block-size') &&
    d3.select('.filter-connections-div #filter-block-size').property("value")) || 1;

  // Default filtering select for block size
  const filterSelect = (d3.select('.filter-connections-div select') &&
    d3.select('.filter-connections-div select').property("value")) || 'At Least';

  // To keep track of the value of the color blocks checkbox
  const coloredBlocks = d3.select("p.color-blocks > input").property("checked");

  // To keep track of the value of highlight flipped blocks checkbox
  const highlightFlippedBlocks = d3.select("p.highlight-flipped-blocks > input").property("checked");

  // To keep track of the Show All input state
  const showAllChromosomes = d3.select("p.show-all > input").property("checked");

  const blockDictionary = getBlockDictionary();
  // Array that includes the keys from the blockDictionary
  const blockKeys = Object.keys(blockDictionary);

  const gffPositionDictionary = getGffDictionary();
  const myCircos = getCircosObject();
  const selectedCheckbox = getSelectedCheckboxes();

  dataChords = []; // Emptying data chords array

  let foundCurrentSelectedBlock = false;

  const oneToMany = selectedCheckbox.length === 1;
  const lookID = [];
  if (oneToMany) {
    // One to many relationships
    lookID.push(selectedCheckbox[0]);
  } else {
    // Many to many relationships
    for (let j = 0; j < selectedCheckbox.length; j++) {
      lookID.push(selectedCheckbox[j]);
    }
  }

  for (let i = 0; i < blockKeys.length; i++) {
    const currentBlock = blockKeys[i];

    // Only need to enter if current block is not currently removed
    if (currentRemovedBlocks.indexOf(currentBlock) === -1) {

      const IDs = fixSourceTargetCollinearity(blockDictionary[currentBlock][0]);
      const sourceID = IDs.source;
      const targetID = IDs.target;

      let shouldAddDataChord = false;
      if (oneToMany) {
        // For one to many
        // Either the source or the target needs to be currently selected
        // Unless Show All is not selected meaning that both source and target
        // need to be the same selected chromosome
        shouldAddDataChord = showAllChromosomes ?
          (lookID.indexOf(sourceID) > -1 || lookID.indexOf(targetID) > -1) :
          (lookID.indexOf(sourceID) > -1 && lookID.indexOf(targetID) > -1);
      } else {
        // For many to many all connections need to be between selected chromosomes
        shouldAddDataChord = lookID.indexOf(sourceID) > -1 && lookID.indexOf(targetID) > -1;
      }

      // Only add data chord if the filter condition is satisfied
      shouldAddDataChord = shouldAddDataChord && (
        (filterSelect === 'At Least' && blockDictionary[currentBlock].length >= filterValue) ||
        (filterSelect === 'At Most' && blockDictionary[currentBlock].length <= filterValue)
      );

      if (shouldAddDataChord) {
        const blockPositions = blockDictionary[currentBlock].blockPositions;

        const sourcePositions = {
          start: blockPositions.minSource,
          end: blockPositions.maxSource
        };
        const targetPositions = {
          start: blockPositions.minTarget,
          end: blockPositions.maxTarget
        };

        // Example for flipped chromosomes:
        // Positions -> 20-28, 1-13
        // newStart = lastChrPosition - (endBlock)
        // newEnd = lastChrPosition - (startBlock)
        // 28-28 = 0, 28-20 = 8
        // 28-13 = 15, 28-1 = 27

        // newStart = lastChrPosition - (endBlock)
        // newEnd = lastChrPosition - (startBlock)
        let tmpStart = 0;
        if (currentFlippedChromosomes.indexOf(sourceID) !== (-1)) {
          tmpStart = sourcePositions.start;

          sourcePositions.start = gffPositionDictionary[sourceID].end - sourcePositions.end;
          sourcePositions.end = gffPositionDictionary[sourceID].end - tmpStart;
        }

        if (currentFlippedChromosomes.indexOf(targetID) !== (-1)) {
          tmpStart = targetPositions.start;

          targetPositions.start = gffPositionDictionary[targetID].end - targetPositions.end;
          targetPositions.end = gffPositionDictionary[targetID].end - tmpStart;
        }

        dataChords.push({
          source: {
            id: sourceID,
            start: sourcePositions.start,
            end: sourcePositions.end,
            value: {
              id: currentBlock,
              length: blockPositions.blockLength,
              score: blockPositions.blockScore,
              eValue: blockPositions.blockEValue,
              isFlipped: blockPositions.isFlipped
            }
          },
          target: {
            id: targetID,
            start: targetPositions.start,
            end: targetPositions.end
          }
        });

        if (isEqual(dataChords[dataChords.length - 1], currentSelectedBlock)) {
          foundCurrentSelectedBlock = true;
        }
      }
    }
  }

  // Resetting currentSelectedBlock object back to default if no block is found
  if (!foundCurrentSelectedBlock && !isEmpty(currentSelectedBlock)) {
    console.log('HERE RESETTING!!!!');
    currentSelectedBlock = {};
  }

  // Update block-number-headline with current block size
  d3.select(".block-number-headline")
    .text(function() {
      const blockSize = dataChords.length.toString();
      let textToShow = "Showing ";
      textToShow += blockSize === "1" ? `${blockSize} block` : `${blockSize} blocks`;
      return textToShow;
    });

  // Remove block view if user is filtering
  // and selected block is not present anymore
  // OR when the block is simply not present (because of view changes)
  // NOTE: When filtering there is NO transition
  let removingBlockView = false; // To keep track of when the block view is being removed
  if (((transition && !transition.shouldDo && !foundCurrentSelectedBlock) ||
      !foundCurrentSelectedBlock) &&
    !d3.select("body").select("#block-view-container").empty()) {
    removingBlockView = true;
    removeBlockView(REMOVE_BLOCK_VIEW_TRANSITION_TIME);
  }

  /**
   * Adds the chords configuration and render Circos plot
   *
   * @return {undefined} undefined
   */
  function drawChordsAndExtraConfig() {
    // Setting transition to default object if not defined
    // NOTE: Default object is used each time that the genome view is rendered
    if (transition == null) {
      transition = {
        shouldDo: true,
        from: "white",
        time: 500
      };
    }

    // Adding the configuration for the circos chords using the generated array
    myCircos.chords('chords', dataChords, {
      radius: null,
      logScale: false,
      opacity: function(d) {
        if (foundCurrentSelectedBlock) {
          if (isEqual(d, currentSelectedBlock)) {
            return 0.9;
          } else {
            return 0.3;
          }
        } else {
          return 0.7;
        }
      },
      color: function(d) {
        if (coloredBlocks) {
          return gffPositionDictionary[d.source.id].color;
        }

        return CONNECTION_COLOR;
      },
      tooltipContent: function(d) {
        // Only show tooltip if the user is not dragging
        if (currentChromosomeMouseDown === "") {
          const { id: sourceID } = d.source;
          const { id: targetID } = d.target;
          const { id: blockID, score, eValue, length, isFlipped } = d.source.value;
          return `<h4>${sourceID} ➤ ${targetID}</h4>
            <h4><u>Block information</u></h4>
            <h4>ID: ${blockID}</h4>
            <h4>Score: ${score}</h4>
            <h4>E-value: ${eValue}</h4>
            <h4>Size: ${length}</h4>
            <h4>Flipped: ${(isFlipped ? "Yes" : "No")}</h4>`;
        }

        return;
      },
      events: {
        'mouseover.block': function(d, i, nodes) {
          // Only update block view if the user is not dragging
          if (currentChromosomeMouseDown === "") {
            currentSelectedBlock = d;

            d3.selectAll(nodes).attr("opacity", 0.7);

            if (d3.selectAll(nodes).attr("opacity") != 0.3) {
              d3.selectAll(nodes).attr("opacity", 0.3);
              d3.select(nodes[i]).raise().attr("opacity", 0.9);
            }

            // Showing block view for current block
            generateBlockView(d);
          }
        },
        'contextmenu.block': function(d, i, nodes, event) {
          // To prevent default right click action
          event.preventDefault();

          // Hide tooltip and node when right clicking block
          d3.select('.circos-tooltip')
            .transition()
            .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
            .style("opacity", 0);

          // Setting opacity 0.7 to all chords, except current node with 0
          d3.selectAll('path.chord')
            .transition()
            .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
            .attr("opacity", 0.7);

          d3.select(nodes[i])
            .raise()
            .transition()
            .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
            .style("opacity", 0)
            .remove();

          // Removing block view
          removeBlockView(REMOVE_BLOCK_VIEW_TRANSITION_TIME);

          // Resetting current selected block object
          currentSelectedBlock = {};

          console.log('REMOVING ID: ', d.source.value.id);

          // Pushing block id to array to keep track
          currentRemovedBlocks.push(d.source.value.id);
        }
      }
    });

    const transitionRemove = (selectedCheckbox.length === 0 && !showAllChromosomes);

    // Rendering circos plot with current configuration
    if (transition && transition.shouldDo) {
      myCircos.render(undefined, undefined, transition, transitionRemove);
    } else {
      myCircos.render();
    }

    // Highlighting flipped blocks if checkbox is true
    if (highlightFlippedBlocks) {
      d3.selectAll("path.chord.isFlipped")
        .style("stroke", "#ea4848")
        .style("stroke-width", "1px");
    }

    // Highlighting flipped chromosomes by default
    for (let i = 0; i < currentFlippedChromosomes.length; i++) {
      // d3.select("g." + currentFlippedChromosomes[i]).attr("opacity", 0.6);
      d3.select(`g.${currentFlippedChromosomes[i]} path#arc-label${currentFlippedChromosomes[i]}`)
        .style("stroke", "#ea4848")
        .style("stroke-width", "1px");
      // d3.select("g." + currentFlippedChromosomes[i]).style("stroke", "#ea4848");
    }
  }

  if (removingBlockView) {
    setTimeout(function() {
      drawChordsAndExtraConfig();
    }, REMOVE_BLOCK_VIEW_TRANSITION_TIME);
  } else {
    drawChordsAndExtraConfig();
  }
};

/**
 * Generates all genomes using the current selected chromosomes
 *
 * @return {undefined} undefined
 */
export default function generateGenomeView() {
  const gffPositionDictionary = getGffDictionary();
  const myCircos = getCircosObject();
  const selectedCheckbox = getSelectedCheckboxes();

  // To keep track of the Show All input state
  const showAllChromosomes = d3.select("p.show-all > input").property("checked");

  // Updating angle on input
  d3.select("#nAngle-genome-view")
    .on("input", function() {
      updateAngle(+this.value, draggedAngle > 0 ? 360 - draggedAngle : 0);
    });

  let removingBlockView = false; // To keep track of when the block view is being removed

  // Remove block view if it is present and current select block is not empty
  if (isEmpty(currentSelectedBlock) &&
    !d3.select("body").select("#block-view-container").empty()) {
    removingBlockView = true;
    removeBlockView(REMOVE_BLOCK_VIEW_TRANSITION_TIME);
  }

  /**
   * Draws the chromosomes for the genome view
   *
   * @param  {Object} transition Current transition configuration
   * @return {undefined} undefined
   */
  function drawGenomeView(transition) {
    let offsetAngle = 0; // Offset dragging angle
    let lastAngle = 0; // Last angle that was captured in the drag event
    // This variable is modified to include more movements of the mouse down chr

    let trueLastAngle = 0; // Last angle from drag event without modification
    let selectDrag = []; // Array to keep track of the chr that will be moving in the dragging animation
    let hasMovedDragging = []; // Array to keep track of the chr that have moved in the dragging animation
    let angleValue = 0; // Stores the angle width of the current mouse down chr

    /**
     * Clones and inserts any DOM selector
     *
     * @param  {string} selector Current selector to clone
     * @return {Object}          D3 selection object with cloned node
     */
    function clone(selector) {
      const node = d3.select(selector).node();
      return d3.select(node.parentNode.insertBefore(node.cloneNode(true), node.nextSibling));
    }

    /**
     * Updates chords while the user is dragging or the animation is happening
     *
     * @param  {string}  chromosome          Source chromosome to update the chords
     * @param  {number}  angleFromChromosome Angle of rotation for source chromosome
     * @param  {number}  extraAngle          Angle of extra rotation for the chords
     * @param  {number}  transitionDuration  Time for transitioning
     * @param  {boolean} animation           True if updating chords for animation, false otherwise
     * @return {undefined}                   undefined
     */
    function updateChordsWhileDragging(chromosome, angleFromChromosome, extraAngle, transitionDuration, animation) {
      // Only update if chromosome (parameter) has chords
      // meaning that selection should not be empty
      if (!d3.selectAll('path.chord.' + chromosome).empty()) {
        const ribbon = d3.ribbon().radius(300);
        const isChrMouseDown = !animation && chromosome === currentChromosomeMouseDown;

        if (isChrMouseDown) {
          d3.selectAll('path.chord')
            .attr("opacity", 0.3);
        }

        d3.selectAll('path.chord.' + chromosome)
          .raise()
          .transition()
          .duration(transitionDuration)
          .attr("opacity", 0.9)
          .attr("d", function(d) {

            // For source
            const sourceObject = find(dataChromosomes, ['id', d.source.id]);
            let sourceStartAngle = sourceObject.start + (d.source.start /
              sourceObject.len) * (sourceObject.end - sourceObject.start);
            let sourceEndAngle = sourceObject.start + (d.source.end /
              sourceObject.len) * (sourceObject.end - sourceObject.start);

            if (isChrMouseDown) {
              if (d.source.id === chromosome) {
                sourceStartAngle += (extraAngle * DEGREES_TO_RADIANS);
                sourceEndAngle += (extraAngle * DEGREES_TO_RADIANS);
              }
            }

            // For target
            const targetObject = find(dataChromosomes, ['id', d.target.id]);
            let targetStartAngle = targetObject.start + (d.target.start /
              targetObject.len) * (targetObject.end - targetObject.start);
            let targetEndAngle = targetObject.start + (d.target.end /
              targetObject.len) * (targetObject.end - targetObject.start);

            if (isChrMouseDown) {
              if (d.target.id === chromosome) {
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
              }

              if (d.source.id === d.target.id) {
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

            // console.log('SOURCE ANGLES: ', sourceAngles);
            // console.log('TARGET ANGLES: ', targetAngles);

            return ribbon({
              source: sourceAngles,
              target: targetAngles
            });
          });
      }
    }

    const dragHandler = d3.drag()
      .on("start", function() {
        if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

        // Creating a clone of the current mouse down chromosome
        d3.selectAll(`g.${currentChromosomeMouseDown}-clone`).remove();
        const copy = clone("g." + currentChromosomeMouseDown);
        copy
          .lower()
          .attr("class", `${currentChromosomeMouseDown}-clone`)
          .attr("opacity", 0.5)
          .style("pointer-events", "none"); // No events should point to it

        // Points are equal to current mouse coordinate minus 50 minus 350
        // width / 2 = 400 and height / 2 = 400
        // but svg object inside is 700,700
        // which means that center is in coordinate 350
        const x = d3.mouse(this)[0] - (WIDTH / 2);
        const y = d3.mouse(this)[1] - (HEIGHT / 2);

        // 1 rad = 180 / Math.PI = 57.2957795;
        const angle = Math.atan2(y, x) * RADIANS_TO_DEGREES;

        // Offset angle for correct rotation
        offsetAngle = angle;
        // Initializing lastAngle variable
        lastAngle = 0;
        trueLastAngle = 0;

        // Highlighting current mouse down chromosome
        d3.select("g." + currentChromosomeMouseDown)
          .style("stroke", "#ea4848")
          .style("stroke-width", "1px");
      })
      .on("drag", function(d) {
        if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

        // Points are equal to current mouse coordinate minus 50 minus 350
        const x = d3.mouse(this)[0] - (WIDTH / 2);
        const y = d3.mouse(this)[1] - (HEIGHT / 2);

        // 1 rad = (180 / Math.PI) = 57.2957795;
        const angle = Math.atan2(y, x) * RADIANS_TO_DEGREES;

        // Selecting current mouse down chromosome
        const current = d3.select("g." + currentChromosomeMouseDown);
        const currentAngle = (angle - offsetAngle);

        current
          .raise()
          .attr("transform", 'rotate(' + currentAngle + ')')
          // While dragging no other events should point to it
          .style("pointer-events", "none");

        // Updating lastAngle with currentAngle to be used in the end drag event
        lastAngle = currentAngle;
        trueLastAngle = currentAngle;

        console.log('LAST ANGLE: ', lastAngle);

        // Updating chords while dragging
        updateChordsWhileDragging(currentChromosomeMouseDown, 0, lastAngle, 0, false);
      })
      .on("end", function() {
        if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

        let currentChromosomeOrder = getCurrentChromosomeOrder();

        // Turning off highlighting for current mouse down chromosome
        d3.select("g." + currentChromosomeMouseDown)
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
          console.log("CURRENT INSIDE!!! ");
          // Resetting current mouse down chr
          currentChromosomeMouseDown = "";

          // Removing cloned chromosome without transition
          d3.select(`g.${currentChromosomeMouseDown}-clone`)
            .attr("opacity", 0)
            .remove();

          drawGenomeView({
            shoulDo: false
          });

          return;
        }

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

          for (let i = currentIndexToDelete; currentChromosomeOrder[i] != currentChromosomeMouseDown; i--) {
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
        if (selectDrag.length === 0 || selectDrag[selectDrag.length - 1] != collidedChr) {
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

        while ((transitionDraggingBackTime - TRANSITION_DRAG_TIME) <= (TRANSITION_DRAG_TIME * selectDrag.length)) {
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

              updateChordsWhileDragging(
                selectDrag[index],
                trueLastAngle,
                rotatingAngle,
                TRANSITION_DRAG_TIME,
                true
              );

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
          drawGenomeView({
            shoulDo: false
          });

          // Resetting current mouse down chr
          currentChromosomeMouseDown = "";
        }, TRANSITION_DRAG_TIME * 2 + (TRANSITION_DRAG_TIME * selectDrag.length));

      });

    dataChromosomes = []; // Emptying data chromosomes array

    const currentChromosomeOrder = getCurrentChromosomeOrder();

    // Using currentChromosomeOrder array to add selected chromosomes to the genome view
    for (let i = 0; i < currentChromosomeOrder.length; i++) {
      const key = currentChromosomeOrder[i];

      const currentObj = {
        len: (gffPositionDictionary[key].end - gffPositionDictionary[key].start),
        color: gffPositionDictionary[key].color,
        label: key,
        id: key
      };

      if (showAllChromosomes) {
        // All the chromosomes will show
        dataChromosomes.push(currentObj);
      } else {
        if (selectedCheckbox.indexOf(key) > -1) {
          // If current chromosome is selected and showAllChromosomes is
          // not selected, then add it
          dataChromosomes.push(currentObj);
        }
      }
    }

    // Adding the dragHandler to the svg after populating the dataChromosomes object
    d3.select("svg#main-container").call(dragHandler);

    // Generating layout configuration for the circos plot
    myCircos.layout(dataChromosomes, {
      innerRadius: 300,
      outerRadius: 350,
      cornerRadius: 1,
      gap: GAP_AMOUNT,
      labels: {
        display: true,
        position: 'center',
        size: '16px',
        color: '#000000',
        radialOffset: 20
      },
      ticks: {
        display: false
      },
      events: {
        'contextmenu.chr': function(d, i, nodes, event) {
          // To prevent default right click action
          event.preventDefault();
          // Before flipping, set all chords with the same opacity
          d3.selectAll("path.chord").attr("opacity", 0.7);

          const currentId = d.id;
          const currentPosition = currentFlippedChromosomes.indexOf(currentId);

          d3.selectAll("path.chord." + currentId)
            .raise()
            .transition()
            .duration(FLIPPING_CHROMOSOME_TIME)
            .ease(d3.easeLinear)
            .style("fill", "lightblue");

          // Setting flipping transition object
          // NOTE: When flipping chromosomes to emphasize the flipped blocks only
          const transition = {
            shouldDo: true,
            from: "lightblue",
            time: FLIPPING_CHROMOSOME_TIME,
            chr: currentId
          };

          // If chromosome id is present, then remove it
          if (currentPosition !== (-1)) {
            currentFlippedChromosomes.splice(currentPosition, 1);
          } else {
            currentFlippedChromosomes.push(currentId);
          }

          console.log('CURRENT FLIPPED CHR: ', currentFlippedChromosomes);

          setTimeout(function() {
            generatePathGenomeView(transition);
          }, FLIPPING_CHROMOSOME_TIME + (FLIPPING_CHROMOSOME_TIME / 2));
        },
        'mousedown.chr': function(d) {
          currentChromosomeMouseDown = d.id;
        }
      }
    });

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

    console.log('DATA CHR: ', dataChromosomes);
    console.log('DRAGGING DICTIONARY: ', draggingAnglesDictionary);

    generatePathGenomeView(transition);
  }

  if (removingBlockView) {
    setTimeout(function() {
      drawGenomeView();
    }, REMOVE_BLOCK_VIEW_TRANSITION_TIME);
  } else {
    drawGenomeView();
  }
};
