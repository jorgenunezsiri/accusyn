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

// Local variables
var draggingAnglesDictionary = null; // Dragging angles dictionary based on start and end angles from Circos library
var currentChromosomeMouseDown = ""; // To store the current chromosome fired by the mousedown event

// Constants
var GAP_AMOUNT = 0.04; // Value in radians
var RADIAN_TO_DEGREES = (180 / Math.PI);

/**
 * Removes block view with transition
 *
 * @return {undefined} undefined
 */
function removeBlockViewWithTransition() {
  d3.select("body").select("#block-view-container")
    .style("opacity", 1)
    .transition()
    .duration(250)
    .style("opacity", 0)
    .remove();
}

/**
 * Generates all paths in the genomeView using the current selected
 * chromosomes and the configuration
 *
 * @param  {Object} transition Current transition configuration
 * @return {undefined} undefined
 */
function generatePathGenomeView(transition) {

  dataChords = []; // Emptying data chords array

  var foundCurrentSelectedBlock = false;

  var visited = {}; // Visited block dictionary
  for (var i = 0; i < blockKeys.length; i++) {
    visited[blockKeys[i]] = false;
  };

  var oneToMany = selectedCheckbox.length === 1;
  var lookID = [];
  if (oneToMany) {
    // One to many relationships
    lookID.push(selectedCheckbox[0]);
  } else {
    // Many to many relationships
    for (var j = 0; j < selectedCheckbox.length; j++) {
      lookID.push(selectedCheckbox[j]);
    }
  }

  for (var i = 0; i < blockKeys.length; i++) {
    var currentBlock = blockKeys[i];
    if (!visited[currentBlock]) {
      // Only need to enter the very first time each block is visited
      visited[currentBlock] = true;

      var IDs = fixSourceTargetCollinearity(blockDictionary[currentBlock][0]);
      var sourceID = IDs.source;
      var targetID = IDs.target;

      var shouldAddDataChord = false;
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
        var blockPositions = blockDictionary[currentBlock].blockPositions;

        var sourcePositions = {
          start: blockPositions.minSource,
          end: blockPositions.maxSource
        };
        var targetPositions = {
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
        var tmpStart = 0;
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
              length: blockPositions.blockLength
            }
          },
          target: {
            id: targetID,
            start: targetPositions.start,
            end: targetPositions.end
          }
        });

        if (_.isEqual(dataChords[dataChords.length - 1], currentSelectedBlock)) {
          foundCurrentSelectedBlock = true;
        }
      }
    }
  }

  // Update block-number-headline with current block size
  d3.select(".block-number-headline")
    .text(function() {
      var blockSize = dataChords.length.toString();
      var textToShow = "Showing ";
      textToShow += blockSize === "1" ? (blockSize + " block") : (blockSize + " blocks");
      return textToShow;
    });

  // Remove block view if user is filtering
  // and selected block is not present anymore
  // NOTE: When filtering there is NO transition
  removingBlockView = false;
  if (transition && !transition.shouldDo && !foundCurrentSelectedBlock &&
    !d3.select("body").select("#block-view-container").empty()) {
    removingBlockView = true;
    removeBlockViewWithTransition();
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
        to: connectionColor,
        time: 500
      };
    }

    // Adding the configuration for the circos chords using the generated array
    myCircos.chords('chords', dataChords, {
      radius: null,
      logScale: false,
      opacity: 0.7,
      color: connectionColor,
      tooltipContent: function(d) {
        return '<h4>' + d.source.id + ' ➤ ' + d.target.id + '</h4>' +
          '<h4><u>Block information</u></h4>' +
          '<h4>ID: ' + d.source.value.id + '</h4>' +
          '<h4>Size: ' + d.source.value.length + '</h4>';
      },
      events: {
        'mouseover.block': function(d, i, nodes) {
          currentSelectedBlock = d;

          d3.selectAll(nodes).attr("opacity", 0.7);

          if (d3.selectAll(nodes).attr("opacity") != 0.30) {
            d3.selectAll(nodes).attr("opacity", 0.30);
            d3.select(nodes[i]).attr("opacity", 0.9);
          }

          // Showing block view for current block
          generateBlockView(d);
        }
      }
    });

    var transitionRemove = (selectedCheckbox.length === 0 && !showAllChromosomes);

    // Rendering circos plot with current configuration
    if (transition && transition.shouldDo) {
      myCircos.render(undefined, undefined, transition, transitionRemove);
    } else {
      myCircos.render();
    }

    for (var i = 0; i < currentFlippedChromosomes.length; i++) {
      // d3.select("g." + currentFlippedChromosomes[i]).attr("opacity", 0.6);
      d3.select("g." + currentFlippedChromosomes[i] + " path#arc-label" + currentFlippedChromosomes[i]).attr("stroke", "#ea4848");
      // d3.select("g." + currentFlippedChromosomes[i]).attr("stroke", "#ea4848");
    }
  }

  if (removingBlockView) {
    setTimeout(function() {
      drawChordsAndExtraConfig();
    }, 250);
  } else {
    drawChordsAndExtraConfig();
  }
}

/**
 * Generates all genomes using the current selected chromosomes
 *
 * @return {undefined} undefined
 */
function generateGenomeView() {
  removingBlockView = false;
  // Remove block view if it is present
  if (!d3.select("body").select("#block-view-container").empty()) {
    removingBlockView = true;
    removeBlockViewWithTransition();
  }

  /**
   * Draws the chromosomes for the genome view
   *
   * @return {undefined} undefined
   */
  function drawGenomeView() {
    var offsetAngle = 0;
    var lastAngle = 0;

    /**
     * Clones and inserts any DOM selector
     *
     * @param  {string} selector Current selector to clone
     * @return {Object}          D3 selection object with cloned node
     */
    function clone(selector) {
      var node = d3.select(selector).node();
      return d3.select(node.parentNode.insertBefore(node.cloneNode(true), node.nextSibling));
    }

    var dragHandler = d3.drag()
      .on("start", function() {
        if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

        // Creating a clone of the current mouse down chromosome
        d3.selectAll("." + currentChromosomeMouseDown + "-clone").remove();
        var copy = clone("." + currentChromosomeMouseDown);
        copy
          .lower()
          .attr("class", currentChromosomeMouseDown + "-clone")
          .attr("opacity", 0.5)
          .style("pointer-events", "none"); // No events should point to it

        // Points are equal to current mouse coordinate minus 50 minus 350
        // width / 2 = 400 and height / 2 = 400
        // but svg object inside is 700,700
        // which means that center is in coordinate 350
        var x = d3.mouse(this)[0] - (width / 2);
        var y = d3.mouse(this)[1] - (height / 2);

        // 1 rad = 180 / Math.PI = 57.2957795;
        var angle = Math.atan2(y, x) * RADIAN_TO_DEGREES;

        // Offset angle for correct rotation
        offsetAngle = angle;
        // Initializing lastAngle variable
        lastAngle = 0;

        // Highlighting current mouse down chromosome
        d3.select("g." + currentChromosomeMouseDown).attr("stroke", "#ea4848");
      })
      .on("drag", function(d) {
        if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

        // Points are equal to current mouse coordinate minus 50 minus 350
        var x = d3.mouse(this)[0] - (width / 2);
        var y = d3.mouse(this)[1] - (height / 2);

        // 1 rad = (180 / Math.PI) = 57.2957795;
        var angle = Math.atan2(y, x) * RADIAN_TO_DEGREES;

        // Selecting current mouse down chromosome with its chords
        var current = d3.selectAll("." + currentChromosomeMouseDown, ".chord." + currentChromosomeMouseDown);
        var currentAngle = (angle - offsetAngle);

        current
          .raise()
          .attr("transform", 'rotate(' + currentAngle + ')')
          // While dragging no other events should point to it
          .style("pointer-events", "none");

        // Updating lastAngle with currentAngle to be used in the end drag event
        lastAngle = currentAngle;
      })
      .on("end", function() {
        if (dataChromosomes.length <= 1 || currentChromosomeMouseDown === "") return;

        // Turning off highlighting for current mouse down chromosome
        d3.select("g." + currentChromosomeMouseDown).attr("stroke", "none");

        var collidedChr = "";
        for (var i = 0; i < dataChromosomes.length; i++) {
          var key = dataChromosomes[i].id;
          var lastChrPosition = (draggingAnglesDictionary[currentChromosomeMouseDown].startAngle + lastAngle);

          if (lastChrPosition < 0) lastChrPosition = 360 + lastChrPosition;
          else if (lastChrPosition > 360) lastChrPosition = lastChrPosition - 360;

          console.log('INSIDE LOOP: ', currentChromosomeMouseDown, key, lastChrPosition, draggingAnglesDictionary[key].startAngle);

          if (lastChrPosition >= draggingAnglesDictionary[key].startAngle &&
            lastChrPosition <= draggingAnglesDictionary[key].endAngle) {
            collidedChr = key;
          }
        }

        console.log('COLLIDED CHR: ', collidedChr);

        var TRANSITION_DRAG_TIME = 250;
        var transitionDraggingBackTime = TRANSITION_DRAG_TIME;

        if (collidedChr === currentChromosomeMouseDown || collidedChr === "") {
          console.log("CURRENT INSIDE!!! ");
          d3.select("." + currentChromosomeMouseDown + "-clone")
            .transition()
            .duration(TRANSITION_DRAG_TIME)
            .attr("opacity", 0)
            .remove();

          setTimeout(function() {
            generateGenomeView();
          }, TRANSITION_DRAG_TIME);

          return;
        }

        var oldChrOrder = currentChromosomeOrder.slice();

        console.log('OLD ORDER: ', oldChrOrder);

        var currentIndexToDelete = currentChromosomeOrder.indexOf(currentChromosomeMouseDown);
        var currentIndexToInsert = currentChromosomeOrder.indexOf(collidedChr);

        var selectDrag = [];

        if (currentIndexToDelete >= 0) {
          currentChromosomeOrder.splice(currentIndexToDelete, 1);
          currentChromosomeOrder.splice(currentIndexToInsert, 0, currentChromosomeMouseDown);

          for (var i = currentIndexToDelete; currentChromosomeOrder[i] != currentChromosomeMouseDown; i--) {
            if (i == currentIndexToDelete && oldChrOrder[i + 1] == currentChromosomeOrder[i]) {
              // console.log('HERE FOR LOOP: ', oldChrOrder[i + 1], currentChromosomeOrder[i]);
              if (i - 1 === (-1)) i = 19;

              continue;
            }

            // If chromosome is present in current view, then add it
            if (_.find(dataChromosomes, ['id', currentChromosomeOrder[i]])) {
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
        var notAddingChromosomeMouseDown = false;
        var mouseDownChrLastPosition =
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
          lastAngle -= (GAP_AMOUNT * RADIAN_TO_DEGREES);

          selectDrag.push(currentChromosomeMouseDown);
        }

        console.log('SELECT DRAG: ', selectDrag);

        // Transitioning the remaining chromosomes, by removing the clone first
        d3.select("." + currentChromosomeMouseDown + "-clone")
          .transition()
          .duration(TRANSITION_DRAG_TIME)
          .attr("opacity", 0)
          .remove();

        var index = 0;
        var angleValue = (draggingAnglesDictionary[currentChromosomeMouseDown].totalAngle + (GAP_AMOUNT * RADIAN_TO_DEGREES));

        console.log('TIME: ', (TRANSITION_DRAG_TIME * selectDrag.length));

        while ((transitionDraggingBackTime - TRANSITION_DRAG_TIME) <= (TRANSITION_DRAG_TIME * selectDrag.length)) {
          (function(transitionDraggingBackTime, index) {

            setTimeout(function() {
              var selection = d3.selectAll("." + selectDrag[index], ".chord." + selectDrag[index]);

              if (selectDrag[index] === collidedChr) {
                selection
                  .transition()
                  .duration(TRANSITION_DRAG_TIME)
                  .attr("transform", "rotate(" + angleValue + ")");
              } else if (selectDrag[index] === currentChromosomeMouseDown) {
                console.log('HERE INSIDE MOUSE DOWN SELECT DRAG!!!!');
                selection
                  .transition()
                  .duration(TRANSITION_DRAG_TIME)
                  .attr("transform", "rotate(" + (angleValue + lastAngle) + ")");
              } else {
                selection
                  .raise()
                  .transition()
                  .duration(TRANSITION_DRAG_TIME)
                  .attr("transform", "rotate(" + angleValue + ")");
              }
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
            console.log('DRAGGED ANGLE: ', draggedAngle);
            updateAngle(chromosomeRotateAngle, 360 - draggedAngle);
          }
          generateGenomeView();

          // Resetting current mouse down chr
          currentChromosomeMouseDown = "";
        }, TRANSITION_DRAG_TIME * 2 + (TRANSITION_DRAG_TIME * selectDrag.length));

      });

    dataChromosomes = [];

    // Using currentChromosomeOrder array to add selected chromosomes to the genome view
    for (var i = 0; i < currentChromosomeOrder.length; i++) {
      var key = currentChromosomeOrder[i];

      var currentObj = {
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
    svg.select("svg").call(dragHandler);

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
          d3.selectAll("path.chord").attr("opacity", 0.7);

          var currentId = d.id;
          var currentPosition = currentFlippedChromosomes.indexOf(currentId);

          d3.selectAll("path.chord." + currentId)
            .raise()
            .transition()
            .duration(750)
            .ease(d3.easeLinear)
            .style("fill", "lightblue");

          // Setting flipping transition object
          // NOTE: When flipping chromosomes to emphasize the flipped blocks only
          var transition = {
            shouldDo: true,
            from: "lightblue",
            to: connectionColor,
            time: 750,
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
          }, 1250);
        },
        'mousedown.chr': function(d) {
          currentChromosomeMouseDown = d.id;
        }
      }
    });

    draggingAnglesDictionary = {};

    for (var i = 0; i < dataChromosomes.length; i++) {
      var currentId = dataChromosomes[i].id;
      if (!(dataChromosomes[i].id in draggingAnglesDictionary)) {
        draggingAnglesDictionary[currentId] = {};
      }
      draggingAnglesDictionary[currentId].startAngle = dataChromosomes[i].start * RADIAN_TO_DEGREES;
      draggingAnglesDictionary[currentId].endAngle = dataChromosomes[i].end * RADIAN_TO_DEGREES;
      draggingAnglesDictionary[currentId].totalAngle =
        (draggingAnglesDictionary[currentId].endAngle - draggingAnglesDictionary[currentId].startAngle);
    }

    generatePathGenomeView();
  }

  if (removingBlockView) {
    setTimeout(function() {
      drawGenomeView();
    }, 250);
  } else {
    drawGenomeView();
  }
}
