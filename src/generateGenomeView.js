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
      myCircos.render(undefined, undefined, undefined, dataChromosomes.length === 0);
    }

    for (var i = 0; i < currentFlippedChromosomes.length; i++) {
      d3.select("g." + currentFlippedChromosomes[i]).attr("opacity", 0.6);
      // d3.select("g." + currentFlippedChromosomes[i] + " path#arc-label" + currentFlippedChromosomes[i]).attr("stroke", "#ea4848");
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
    dataChromosomes = [];

    // Using gffKeys array to add selected chromosomes to the genome view
    for (var i = 0; i < gffKeys.length; i++) {
      var key = gffKeys[i];
      var currentObj = {
        len: gffPositionDictionary[key].end,
        color: colors(i),
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
          event.preventDefault(); // To prevent default right click action
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
            time: 1500,
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
        'click.chr': function(d, i, nodes, event) {}
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
