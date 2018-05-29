/*
University of Saskatchewan
GSB: A Web-based Genome Synteny Browser
Course: CMPT398 - Information Visualization

Name: Jorge Nunez Siri
E-mail: jdn766@mail.usask.ca
NSID: jdn766
Student ID: 11239727

Function file: generateGenomeView.js

@2018, Jorge Nunez Siri, All rights reserved
*/

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

  var oneToMany = selectedCheckbox.length == 1;
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

        //
        // 20-28, 1-13
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

          if (d3.selectAll(nodes).attr("opacity") != 0.35) {
            d3.selectAll(nodes).attr("opacity", 0.35);
            d3.select(nodes[i]).attr("opacity", 0.9);
          }

          // Showing block view for current block
          generateBlockView(d);
        }
      }
    });

    // Rendering circos plot with current configuration
    if (transition && transition.shouldDo) {
      myCircos.render(undefined, undefined, transition, (selectedCheckbox.length === 0 && !showAllChromosomes));
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
  var mouseX = 0;
  var mouseY = 0;
  var currentChromosomeMouseOver = "";

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

    var total = 0;
    for (var i = 0; i < gffKeys.length; i++) {
      var key = gffKeys[i];
      total += (gffPositionDictionary[key].end - gffPositionDictionary[key].start);
    }

    var dragScale = d3.scaleLinear().range([0, 360]).domain([0, total]);

    var firstTime = null;

    var offset = 0;

    function clone(selector) {
      var node = d3.select(selector).node();
      return d3.select(node.parentNode.insertBefore(node.cloneNode(true), node.nextSibling));
    }

    function overlap(aRect, bRect) {
      // return !(node1.right < node2.left ||
      //   node1.left > node2.right ||
      //   node1.bottom < node2.top ||
      //   node1.top > node2.bottom);
      return !(
        ((aRect.top + aRect.height) < (bRect.top)) ||
        (aRect.top > (bRect.top + bRect.height)) ||
        ((aRect.left + aRect.width) < bRect.left) ||
        (aRect.left > (bRect.left + bRect.width))
      );
    }

    /**
     * Helper function to determine whether there is an intersection between the two polygons described
     * by the lists of vertices. Uses the Separating Axis Theorem
     *
     * @param a an array of connected points [{x:, y:}, {x:, y:},...] that form a closed polygon
     * @param b an array of connected points [{x:, y:}, {x:, y:},...] that form a closed polygon
     * @return true if there is any intersection between the 2 polygons, false otherwise
     */
    function doPolygonsIntersect(a, b) {
      var polygons = [a, b];
      var minA, maxA, projected, i, i1, j, minB, maxB;

      for (i = 0; i < polygons.length; i++) {

        // for each polygon, look at each edge of the polygon, and determine if it separates
        // the two shapes
        var polygon = polygons[i];
        for (i1 = 0; i1 < polygon.length; i1++) {

          // grab 2 vertices to create an edge
          var i2 = (i1 + 1) % polygon.length;
          var p1 = polygon[i1];
          var p2 = polygon[i2];

          // find the line perpendicular to this edge
          var normal = {
            x: p2.y - p1.y,
            y: p1.x - p2.x
          };

          minA = maxA = undefined;
          // for each vertex in the first shape, project it onto the line perpendicular to the edge
          // and keep track of the min and max of these values
          for (j = 0; j < a.length; j++) {
            projected = normal.x * a[j].x + normal.y * a[j].y;
            if (_.isUndefined(minA) || projected < minA) {
              minA = projected;
            }
            if (_.isUndefined(maxA) || projected > maxA) {
              maxA = projected;
            }
          }

          // for each vertex in the second shape, project it onto the line perpendicular to the edge
          // and keep track of the min and max of these values
          minB = maxB = undefined;
          for (j = 0; j < b.length; j++) {
            projected = normal.x * b[j].x + normal.y * b[j].y;
            if (_.isUndefined(minB) || projected < minB) {
              minB = projected;
            }
            if (_.isUndefined(maxB) || projected > maxB) {
              maxB = projected;
            }
          }

          // if there is no overlap between the projects, the edge we are looking at separates the two
          // polygons, and we know there is no overlap
          if (maxA < minB || maxB < minA) {
            // console.log("polygons don't intersect!");
            return false;
          }
        }
      }
      return true;
    }

    function getBoundingBoxElement(element) {
      return [{
        x: element.left,
        y: element.top
      }, {
        x: element.left + element.width,
        y: element.top
      }, {
        x: element.left,
        y: element.top + element.height
      }, {
        x: element.left + element.width,
        y: element.top + element.height
      }];
    }

    var dragHandler = d3.drag()
      .on("start", function() {
        // var current = d3.select();
        //
        // mouseX = current.node().getBoundingClientRect().x;
        // mouseY = current.node().getBoundingClientRect().y;
        // console.log('START: ', mouseX, mouseY);

        firstTime = false;

        var x = d3.event.x - (width / 2);
        var y = d3.event.y - (height / 2);

        // 1 rad = 180 / Math.PI = 57.2957795;
        var angle = Math.atan2(y, x) * (180 / Math.PI);


        d3.selectAll("." + currentChromosomeMouseDown + "-clone").remove();
        var copy = clone("." + currentChromosomeMouseDown);
        copy
          .attr("class", currentChromosomeMouseDown + "-clone")
          .attr("opacity", 0.5);

        offset = angle;
        console.log('OFFSET: ', offset);



        // current
        //   .raise()
        //   .attr("transform", 'rotate(' + (angle) + ',' + (x) + ',' + (y) + ')');
        //
        // current
        //   .raise()
        //   .attr("transform", 'rotate(' + (-angle) + ')');

        // d3.select(".all").attr("transform", "translate(" + width / 2 + "," + height / 2 + ") rotate(" + (0) + ")");

        // d3.select("." + currentChromosomeMouseDown).attr("transform", "rotate(0)");
        // console.log('T: ', t);
        // return {x: t.translate[0], y: t.translate[1]};
        // return {x: mouseX, y: mouseY};
      })
      .on("drag", function(d) {
        // var mouse = d3.mouse(this.firstChild.firstChild);

        //var x = firstTime ? d3.event.x - (width / 2) : mouseX - (width / 2);
        //
        //var y = firstTime ? d3.event.y - (height / 2) : mouseY - (height / 2);

        firstTime = true;
        // var mouse = d3.mouse(d3.select("." + currentChromosomeMouseDown).node());
        var current = d3.select("." + currentChromosomeMouseDown);

        // var bbox = current.node().getBoundingClientRect();
        // mouseY = current.node().getBoundingClientRect().y;
        // console.log('Bbox: ', bbox);


        // console.log('MOUSE: ', mouse[0], mouse[1]);
        // current.node().getBoundingClientRect().x;
        // current.node().getBoundingClientRect().y;
        var x = d3.event.x - (width / 2);
        var y = d3.event.y - (height / 2);
        var r = (width / 2);

        // 1 rad = 180 / Math.PI = 57.2957795;
        var angle = Math.atan2(y, x) * (180 / Math.PI);

        /*angle = angle * Math.PI / 180;
        var cosAngle = Math.cos(angle);
        var sinAngle = Math.sin(angle);
        var relativeX = (d3.event.x * cosAngle) - (d3.event.y * sinAngle);
        var relativeY = (d3.event.x * sinAngle) + (d3.event.y * cosAngle);

        angle = Math.atan2(relativeY, relativeX) * (180 / Math.PI);*/

        // if (angle < 0) {
        //   angle = 360 + angle;
        // }

        // var absoluteValue = dragScale.invert(angle);
        // translate(" + width / 2 + "," + height / 2 + ")

        // Think in origin instead of 90 degrees ?

        // Also cloning current chromosome and decrease transparency
        // on start, on drag, on end



        // current = d3.select("." + currentChromosomeMouseDown);

        //var current = d3.select(this.firstChild)
        // current
        //   .attr("transform", "rotate(0)");
        //
        //d3.select(".all").attr("transform", "rotate(0) translate(" + width / 2 + "," + height / 2 + ")");
        // d3.select(".all g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ") rotate(0)");

        current
          .raise()
          .attr("transform", 'rotate(' + (angle - offset) + ')')
          .style("pointer-events", "none");;

        // mouseX = current.node().getBoundingClientRect().x;
        // mouseY = current.node().getBoundingClientRect().y;

        console.log('DRAGGING X, Y, ANGLE: ', x, y, (angle - offset));
      })
      .on("end", function() {
        var overlapChr = []; // Array of chromosomes that are currently overlapping
        for (var i = 0; i < dataChromosomes.length; i++) {
          var key = dataChromosomes[i].id;
          if (key === currentChromosomeMouseDown) continue;

          var node1 = d3.select("." + key).node().getBoundingClientRect();
          var node2 = d3.select("." + currentChromosomeMouseDown).node().getBoundingClientRect();

          if (doPolygonsIntersect(getBoundingBoxElement(node1), getBoundingBoxElement(node2))) {
            overlapChr[key] = true;
          }
        }


        var currentIndexToDelete = currentChromosomeOrder.indexOf(currentChromosomeMouseDown);
        //*
        var currentIndexToInsert = currentChromosomeOrder.indexOf(currentChromosomeMouseOver);
        console.log('CURRENT INDEX TO INSERT: ', currentIndexToInsert, currentChromosomeOrder);
        // */

        /*
        console.log('OVERLAP CHR: ', overlapChr);
        var getKeysOverlap = Object.keys(overlapChr);
        console.log('Get keys: ', getKeysOverlap);
        console.log('MOUSE DOWN AGAIN: ', currentChromosomeMouseDown);

        if (getKeysOverlap.length == 1 || getKeysOverlap.length == 2) {
          // Insert after first one

        }
        var currentIndexToInsert = currentChromosomeOrder.indexOf(getKeysOverlap[0]);
        // */

        currentChromosomeOrder.splice(currentIndexToDelete, 1);
        // if (currentIndexToInsert === 0) ++currentIndexToInsert; // CHECK THIS WITH N1 later
        currentChromosomeOrder.splice(currentIndexToInsert, 0, currentChromosomeMouseDown);

        console.log('NEW ORDER: ', currentChromosomeOrder);

        // Continue here (clean everything first)
        // Example to try when moving N1 to the left, then N2 and N3 move around

        /*
        d3.selectAll("." + currentChromosomeMouseOver, ".chord." + currentChromosomeMouseOver)
          .transition()
          .duration(500)
          .attr("opacity", 0);

        setTimeout(function() {
          d3.select(".N2")
            .raise()
            .transition()
            .duration(2000)
            .attr("transform", "rotate(" + (-11.820637012150584 - (0.04 * (180 / Math.PI))) + ")");
        }, 500);

        setTimeout(function() {
          d3.select(".N3")
            .raise()
            .transition()
            .duration(2000)
            .attr("transform", "rotate(" + (-11.820637012150584 - (0.04 * (180 / Math.PI))) + ")");
        }, 2500);

        setTimeout(function() {
          generateGenomeView();
        }, 4500);
        // */
      });

    var all = svg.select("svg").call(dragHandler);

    // dragHandler(all);

    dataChromosomes = [];

    // Using currentChromosomeOrder array to add selected chromosomes to the genome view
    for (var i = 0; i < currentChromosomeOrder.length; i++) {
      var key = currentChromosomeOrder[i];
      // console.log('LEN: ', key, (gffPositionDictionary[key].end-gffPositionDictionary[key].start));

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

    // Generating layout configuration for the circos plot
    myCircos.layout(dataChromosomes, {
      innerRadius: 300,
      outerRadius: 350,
      cornerRadius: 1,
      gap: dataChromosomes.length === 1 ? 0 : 0.04, // Value in radian
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
            time: 1750,
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
        // 'mousedown.chr': function(d, i, nodes, event) {
        //   console.log('MOUSE DOWN');
        //   setTimeout(function() {
        //     console.log('2 seconds');
        //     // You are now in a `hold` state, you can do whatever you like!
        //   }, 2000);
        // },
        'mousedown.chr': function(d, i, nodes, event) {
          console.log('EVENT: ', event, event.x, event.y);
          // mouseX = event.x;
          // mouseY = event.y;
          currentChromosomeMouseDown = d.id;
          console.log('MOUSE DOWN: ', currentChromosomeMouseDown);
          // var mouse = d3.mouse(nodes[i]);
          // var x = mouse[0] - (width / 2);
          // var y = mouse[1] - (height / 2);
          //
          // // 1 rad = 180 / Math.PI = 57.2957795;
          // var angle = Math.atan2(y, x) * (180 / Math.PI);
          // if (angle < 0) {
          //   angle = 360 + angle;
          // }
          //
          // // var absoluteValue = dragScale.invert(angle);
          // // translate(" + width / 2 + "," + height / 2 + ")
          //
          // svg.select("." + d.id).raise()
          //   .attr("transform", "rotate(" + (angle+90) + ")");
          //
          // console.log('DRAGGING: ', x, y, angle);
        },
        'mouseover.chr': function(d, i, nodes, event) {
          currentChromosomeMouseOver = d.id;
          console.log('MOUSE OVER: ', currentChromosomeMouseOver);
          // mouseX = nodes[i].getBoundingClientRect().x;
          // mouseY = nodes[i].getBoundingClientRect().y;
          // console.log('MOUSE OVER: ', d.id, nodes[i], nodes[i].getBoundingClientRect(), mouseX, mouseY);
        }
      }
    });

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
