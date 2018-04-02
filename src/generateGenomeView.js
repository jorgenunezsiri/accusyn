/*
University of Saskatchewan
Project: A web-based genome synteny browser
Course: CMPT398 - Information Visualization

Name: Jorge Nunez Siri
NSID: jdn766
Student ID: 11239727

Function file: generateGenomeView.js
*/

/**
 * Looks for minimum and maximum positions within the current block
 *
 * @param  {string} block Current block
 * @return {Object}       Resulting block min and max information
 */
function lookForBlocksPositions(block) {
  var blockArray = blockDictionary[block];

  var maxSource = 0;
  var minSource = 100000000;
  var maxTarget = 0;
  var minTarget = 100000000;
  for (var i = 0; i < blockArray.length; i++) {
    var currentSource = geneDictionary[blockArray[i].source];
    var currentTarget = geneDictionary[blockArray[i].target];

    minSource = Math.min(minSource, currentSource.start);
    maxSource = Math.max(maxSource, currentSource.end);

    minTarget = Math.min(minTarget, currentTarget.start);
    maxTarget = Math.max(maxTarget, currentTarget.end);
  }

  return {
    blockLength: blockArray.length,
    minSource: minSource,
    maxSource: maxSource,
    minTarget: minTarget,
    maxTarget: maxTarget
  }
}

/**
 * Generates all paths in the genomeView using the current selected
 * chromosomes and the configuration
 *
 * @return {undefined} undefined
 */
function generatePathGenomeView() {
  dataChords = []; // Emptying data chords array

  var foundCurrentSelectedBlock = false;

  var visited = {}; // Visited block dictionary
  Object.keys(blockDictionary).forEach(function(d) {
    visited[d] = false;
  });

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

  for (var i = 0; i < collinearityFile.length; i++) {
    if (collinearityFile[i].source.includes('N') && collinearityFile[i].target.includes('N')) {

      var IDs = fixSourceTargetCollinearity(collinearityFile, i);
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

      var currentBlock = collinearityFile[i].block;
      if (!visited[currentBlock]) {
        // Only need to enter the very first time each block is visited
        visited[currentBlock] = true;

        // Only add data chord if the filter condition is satisfied
        shouldAddDataChord = shouldAddDataChord && (
          (filterSelect === 'At Least' && blockDictionary[currentBlock].length >= filterValue) ||
          (filterSelect === 'At Most' && blockDictionary[currentBlock].length <= filterValue)
        );

        if (shouldAddDataChord) {
          var blockPositions = lookForBlocksPositions(currentBlock);
          dataChords.push({
            source: {
              id: sourceID,
              start: blockPositions.minSource,
              end: blockPositions.maxSource,
              value: {
                id: currentBlock,
                length: blockPositions.blockLength,
              }
            },
            target: {
              id: targetID,
              start: blockPositions.minTarget,
              end: blockPositions.maxTarget
            }
          });

          if (_.isEqual(dataChords[dataChords.length - 1], currentSelectedBlock)) {
            foundCurrentSelectedBlock = true;
          }
        }
      }
    }
  }

  // Remove block view if selected block is not present anymore
  if (!foundCurrentSelectedBlock &&
    !d3.select("body").select("#block-view-container").empty()) {
    d3.select("body").select("#block-view-container").remove();
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
        '<h4>Length: ' + d.source.value.length + '</h4>';
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
  myCircos.render();

  d3.select(".block-number-headline")
    .text(function() {
      var blockSize = dataChords.length.toString();
      var textToShow = "Showing ";
      textToShow += blockSize === "1" ? (blockSize + " block") : (blockSize + " blocks");
      return textToShow;
    });
}

/**
 * Generates all genomes using the current selected chromosomes
 *
 * @return {undefined} undefined
 */
function generateGenomeView() {
  // Remove block view if it is present
  if (!d3.select("body").select("#block-view-container").empty()) {
    d3.select("body").select("#block-view-container").remove();
  }

  dataChromosomes = [];

  // Using gffKeys array to add selected chromosomes to the genome view
  gffKeys.forEach(function(key, i) {
    if (gffPositionDictionary.hasOwnProperty(key)) {
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
  });

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
    }
  });

  generatePathGenomeView();
}
