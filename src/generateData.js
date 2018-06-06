/*
University of Saskatchewan
GSB: A Web-based Genome Synteny Browser
Course: CMPT994 - Research

Name: Jorge Nunez Siri
E-mail: jdn766@mail.usask.ca
NSID: jdn766
Student ID: 11239727

Function file: generateData.js

@2018, Jorge Nunez Siri, All rights reserved
*/

var blockDictionary = {}; // Dictionary to store the data for all blocks
var blockKeys = []; // Array that includes the keys from the blockDictionary
var connectionDictionary = {}; // Dictionary to store the data for all the connections between any source and target
var dataChromosomes = []; // Array that stores the current chromosomes in the circos plot
var dataChords = []; // Array that stores the plotting information for each block chord
var geneDictionary = {}; // Dictionary that includes the start and end position data for each gene
var gffKeys = []; // Array that includes the sorted keys from the gff dictionary
var gffPositionDictionary = {}; // Dictionary that includes the start and end position data for each chromosome
var selectedCheckbox = []; // Array that stores the value of selected checkboxes

var myCircos; // Circos variable
var svg; // Circos svg
var width = 800; // Circos plot width
var height = 800; // Circos plot height

var chromosomeRotateAngle = 0; // Current rotating angle for the genome view (default to 0)
var colors = d3.scaleOrdinal(d3.schemeSet2); // Default color scheme
var connectionColor = "sandybrown"; // Default connection color
var currentSelectedBlock = {}; // To store the data of the current selected block
var currentFlippedChromosomes = []; // Array that stores the current set of chromosomes with flipped locations
var currentChromosomeOrder = []; // Array that stores the current order of chromosomes
var filterValue = 1; // Default filtering value
var filterSelect = 'At Least'; // Default filtering select
var showAllChromosomes = true; // To keep track of the Show All input state
var removingBlockView = false; // To keep track of when the block view is being removed
var coloredBlocks = false; // To keep track of the value of the color blocks checkbox

var draggedAngle = 0; // To keep track of the rotating angles of the genome view

/**
 * Fixes current IDs in collinearity file by removing 0 when
 * chromosome number is below 10 (e.g. (N09,N01) turns into (N9, N1))
 *
 * @param  {Object} currentCollinearity Current index with the similarity relationships
 * @return {Object}                  Object with sourceID and targetID fixed
 */
function fixSourceTargetCollinearity(currentCollinearity) {
  var sourceID = currentCollinearity.source.split('g')[0].split('Bna')[1];
  var targetID = currentCollinearity.target.split('g')[0].split('Bna')[1];
  if (sourceID[1] == '0') {
    sourceID = sourceID.slice(0, 1) + sourceID.slice(2);
  }
  if (targetID[1] == '0') {
    targetID = targetID.slice(0, 1) + targetID.slice(2);
  }

  return {
    source: sourceID,
    target: targetID
  }
}

/**
 * Uses the current connection dictionary to find a connection with the
 * source and target
 *
 * @param  {Object} dictionary Current dictionary
 * @param  {string} source     Current source
 * @param  {string} target     Current target
 * @return {Object}            Value of the first target that has a
 *                             connection with the source
 */
function findBlockConnection(dictionary, source, target) {
  return dictionary[source].find(function(element) {
    return element.connection == target;
  });
}

/**
 * Uses the current connection dictionary to find an index of a connection
 * between the source and target
 *
 * @param  {Object} dictionary Current dictionary
 * @param  {string} source     Current source
 * @param  {string} target     Current target
 * @return {number}            Array index of the first target that
 *                             has a connection with the source
 */
function findIndexConnection(dictionary, source, target) {
  return dictionary[source].findIndex(function(element) {
    return element.connection == target;
  });
}

/**
 * Updates the angle of the genome view
 *
 * @param  {number} nAngle    Current angle between 0 and 360
 * @param  {number} nDragging Current dragging angle between 0 and 360
 * @return {undefined}        undefined
 */
function updateAngle(nAngle, nDragging) {
  chromosomeRotateAngle = nAngle;

  // Adjust the text on the rotating range slider
  d3.select("#nAngle-value").text(nAngle + String.fromCharCode(176));
  d3.select("#nAngle").property("value", nAngle);

  // Rotate the genome view
  svg.select(".all")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ") rotate(" + ((-1) * (nAngle + nDragging)) + ")");
}

/**
 *  Updates the filter range value
 *
 * @param  {number} value             Filtering value
 * @param  {boolean} shouldUpdatePath True if should update paths in genome
 *                                    view, false otherwise
 * @return {undefined}                undefined
 */
function updateFilter(value, shouldUpdatePath) {
  filterValue = value;

  // Adjust the text on the filter range slider
  d3.select("#filter-value").text(value == 1 ? value + " connection" : value + " connections");
  d3.select("#filter").property("value", value);

  if (shouldUpdatePath) {
    generatePathGenomeView({
      shouldDo: false
    });
  }
}

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
 * Generates and preprocess data for the syteny browser
 *
 * @param  {Object} error               Error handler
 * @param  {Array<Object>} gff          Data from gff file
 * @param  {Array<Object>} collinearity Data from collinearity file
 * @return {undefined}                  undefined
 */
function generateData(error, gff, collinearity) {
  if (error) return console.error(error);
  var collinearityFile = collinearity; // To store the data from the collinearity file

  // For loop to update position dictionary with file data
  for (var i = 0; i < gff.length; i++) {
    // Not including Scaffold chromosomes
    if (gff[i].chrom.startsWith('Scaffold')) continue;
    var start = parseInt(gff[i].start);
    var end = parseInt(gff[i].end);

    if (!(gff[i].chrom in gffPositionDictionary)) {
      gffPositionDictionary[gff[i].chrom] = {};
      gffPositionDictionary[gff[i].chrom].start = start;
      gffPositionDictionary[gff[i].chrom].color = colors(i);
    }

    gffPositionDictionary[gff[i].chrom].end = end;
    geneDictionary[gff[i].gene] = {
      start: start,
      end: end
    }
  }

  // Obtaining keys from dictionary and sorting them in ascending order
  gffKeys = Object.keys(gffPositionDictionary);
  gffKeys.sort(function compare(a, b) {
    a = parseInt(a.split('N')[1]);
    b = parseInt(b.split('N')[1]);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });

  currentChromosomeOrder = gffKeys.slice();

  blockDictionary = {};
  connectionDictionary = {};
  for (var i = 0; i < collinearityFile.length; i++) {
    if (collinearityFile[i].source.includes('N') && collinearityFile[i].target.includes('N')) {
      var currentBlock = collinearityFile[i].block;

      if (!(currentBlock in blockDictionary)) {
        blockDictionary[currentBlock] = [];
      }

      // Adding all the block connections in the dictionary
      blockDictionary[currentBlock].push({
        blockPositions: {},
        connection: collinearityFile[i].connection,
        source: collinearityFile[i].source,
        target: collinearityFile[i].target
      });

      var IDs = fixSourceTargetCollinearity(collinearityFile[i]);
      var sourceID = IDs.source;
      var targetID = IDs.target;

      // If source is not in the dictionary, create new array for the source
      if (!(sourceID in connectionDictionary)) {
        connectionDictionary[sourceID] = [];
      }

      // If target is not in the dictionary, create new array for the target
      if (!(targetID in connectionDictionary)) {
        connectionDictionary[targetID] = [];
      }

      var indexConnection = 0;
      // If a connection is not found between source and target, then create it
      if (!findBlockConnection(connectionDictionary, sourceID, targetID)) {
        connectionDictionary[sourceID].push({
          blockIDs: [currentBlock],
          connection: targetID,
          connectionAmount: 1
        });
      } else {
        // If a connection is found, then find index, update connection amount,
        // and add new blockID if not present
        indexConnection = findIndexConnection(connectionDictionary, sourceID, targetID);
        connectionDictionary[sourceID][indexConnection].connectionAmount++;

        if (connectionDictionary[sourceID][indexConnection].blockIDs.indexOf(currentBlock) === (-1)) {
          connectionDictionary[sourceID][indexConnection].blockIDs.push(currentBlock);
        }
      }

      // If a connection is not found between target and source, then create it
      if (!findBlockConnection(connectionDictionary, targetID, sourceID)) {
        connectionDictionary[targetID].push({
          blockIDs: [currentBlock],
          connection: sourceID,
          connectionAmount: 1
        });
      } else {
        // If a connection is found, then find index,
        // update connection amount only if not same chromosome,
        // and add new blockID if not present
        var indexConnection = findIndexConnection(connectionDictionary, targetID, sourceID);

        if (targetID != connectionDictionary[targetID][indexConnection].connection) {
          connectionDictionary[targetID][indexConnection].connectionAmount++;
        }

        if (connectionDictionary[targetID][indexConnection].blockIDs.indexOf(currentBlock) === (-1)) {
          connectionDictionary[targetID][indexConnection].blockIDs.push(currentBlock);
        }
      }
    }
  }

  blockKeys = Object.keys(blockDictionary);

  console.log('CONNECTIONS: ', connectionDictionary);

  // Determining the block with maximum number of connections
  // (to be used in the filter input range)
  // N13 -> N3 has the max block size with 2295 connections
  // 2306 connections with top 5 BLAST hits
  // Also, adding all the minimum and maximum positions for each block
  var maxBlockSize = 0;
  for (var i = 0; i < blockKeys.length; i++) {
    var currentBlock = blockKeys[i];
    maxBlockSize = Math.max(maxBlockSize, blockDictionary[currentBlock].length);
    blockDictionary[currentBlock].blockPositions = lookForBlocksPositions(currentBlock);
  }

  // Updating the style of the configuration panel
  d3.select("#config")
    .style("display", "block")
    .style("margin-left", "10px")
    .style("width", width / 3 + "px");

  d3.select("#form-config")
    .append("p")
    .attr("class", "show-all")
    .attr("title", "If selected, all chromosomes will show.")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-all")
    .attr("value", "Show All")
    .property("checked", true); // Show All is checked by default

  d3.select("#form-config").select('p.show-all')
    .append("span")
    .text("Show All");

  d3.select("p.show-all > input")
    .on("change", function() {
      showAllChromosomes = d3.select(this).property("checked");

      // Calling genome view for updates
      generateGenomeView();
    });

  d3.select("#form-config")
    .append("h3")
    .text("Connections");

  d3.select("#form-config")
    .append("h4")
    .attr("class", "block-number-headline")
    .style("font-weight", "normal");

  d3.select("#form-config")
    .append("p")
    .attr("class", "color-blocks")
    .attr("title", "If selected, all connections will be colored.")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "color-blocks")
    .attr("value", "Color blocks")
    .property("checked", false); // Color block is not checked by default

  d3.select("#form-config").select('p.color-blocks')
    .append("span")
    .text("Color blocks");

  d3.select("p.color-blocks > input")
    .on("change", function() {
      coloredBlocks = d3.select(this).property("checked");

      // Calling path genome view for updates
      generatePathGenomeView();
    });

  d3.select("#form-config")
    .append("div")
    .attr("class", "filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .text("Filter:");

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .append("select")
    .html(function() {
      return '<option value="At Least">At Least</option><option value="At Most">At Most</option>';
    });

  d3.select(".filter-connections-div")
    .select("select")
    .on("change", function() {
      filterSelect = d3.select(this).property("value");

      // Calling path genome view for updates
      generatePathGenomeView({
        shouldDo: false
      });
    });

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .html(function() {
      return '<label for="filter" style="display: inline-block; text-align: left; width: 115px">' +
        '<span id="filter-value">...</span>' +
        '</label>';
    });

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .html(function() {
      return '<input style="margin-left: 45px; width: 195px" type="range" min="1" max=' +
        maxBlockSize.toString() + ' id="filter">';
    });

  d3.select("#form-config").selectAll("p:not(.show-all):not(.filter-connections):not(.color-blocks)")
    .data(gffKeys).enter()
    .append("p")
    .append("input")
    .attr("class", "chr-box")
    .attr("type", "checkbox")
    .attr("name", function(d) {
      return d;
    })
    .attr("value", function(d) {
      return d;
    });

  d3.select("#form-config").selectAll(".chr-box")
    .data(gffKeys)
    .on("change", function() {
      selectedCheckbox = [];
      var selectedChromosomes = [];
      var visitedChr = {}; // Visited chromosomes dictionary
      for (var i = 0; i < gffKeys.length; i++) {
        visitedChr[gffKeys[i]] = false;
      }

      d3.selectAll(".chr-box").each(function(d) {
        d3.select(this.parentNode).classed("disabled", false);
        d3.select(this.parentNode).select("span").text(d);

        var cb = d3.select(this);
        cb.attr("disabled", null);
        if (cb.property("checked")) {
          // If chromosome is already checked, then it is visited
          visitedChr[d] = true;
          selectedChromosomes.push(cb.property("value"));
          selectedCheckbox.push(cb.property("value"));
        }
      });

      // Changing Select/Deselect All button depending on the amount of selected chromosomes
      if (selectedChromosomes.length === 0) {
        d3.select(".select-all > input").property("value", "Select All");
        d3.select("p.select-all").attr("title", "Selects all the connections.");
      } else {
        d3.select(".select-all > input").property("value", "Deselect All");
        d3.select("p.select-all").attr("title", "Deselects all the connections.");
      }

      if (selectedChromosomes.length === 1) {
        // If only one chromosome is selected, the connection information will show
        // for each other chromosome

        for (var j = 0; j < gffKeys.length; j++) {
          // If a connection is found, mark current chromosome as visited
          if (findBlockConnection(connectionDictionary, selectedChromosomes[0], gffKeys[j])) {
            visitedChr[gffKeys[j]] = true;
          }
        }

        d3.selectAll(".chr-box").each(function(d) {
          d3.select(this.parentNode).select('span').html(function() {
            // Finding the index of the connection in the dictionary
            var indexConnection = findIndexConnection(connectionDictionary, selectedChromosomes[0], d);
            var connectionAmount = 0;
            var textToShow = d;
            var style = '<em style="display: inline-block; text-align: right; width: 65px; margin-left: 10px">';
            if (indexConnection === (-1)) {
              textToShow += style + '0 blocks' + ' </em>';
            } else {
              connectionAmount = connectionDictionary[selectedChromosomes[0]][indexConnection].blockIDs.length;
              if (connectionAmount === 1) {
                textToShow += style + connectionAmount.toString() + ' block' + ' </em>';
              } else {
                textToShow += style + connectionAmount.toString() + ' blocks' + ' </em>';
              }
            }

            return textToShow;
          });

          if (visitedChr[d]) {
            d3.select(this).attr("disabled", null);
            d3.select(this.parentNode).classed("disabled", false);
          } else {
            // Only disable not visited chromosomes
            d3.select(this).attr("disabled", "true");
            d3.select(this.parentNode).classed("disabled", true);
          }
        });
      }

      // Calling genome view for updates
      generateGenomeView();
    });

  d3.select("#form-config").selectAll("p:not(.show-all):not(.filter-connections)")
    .append("span")
    .text(function(d) {
      return d;
    });

  d3.select("#form-config")
    .append("p")
    .attr("class", "select-all")
    .attr("title", "Selects all the connections.")
    .append("input")
    .attr("type", "button")
    .attr("value", "Select All");

  d3.select("#form-config")
    .select(".select-all > input")
    .on("click", function() {
      if (d3.select(this).property("value") == "Select All") {
        // Changing the value and title to Deselect All
        d3.select(this).property("value", "Deselect All");
        d3.select("p.select-all").attr("title", "Deselects all the connections.");

        // Selecting all checkboxes
        d3.selectAll(".chr-box").each(function() {
          if (!d3.select(this).property("checked")) {
            d3.select(this).property("checked", true);
            selectedCheckbox.push(d3.select(this).property("value"));
          }
        });
      } else {
        // Changing the value and title to Select All
        d3.select(this).property("value", "Select All");
        d3.select("p.select-all").attr("title", "Selects all the connections.");

        // All checkboxes are returned to their original state
        d3.selectAll(".chr-box").each(function(d) {
          d3.select(this.parentNode).classed("disabled", false);
          d3.select(this.parentNode).select("span").text(d);

          var cb = d3.select(this);
          cb.attr("disabled", null);
          if (d3.select(this).property("checked")) {
            d3.select(this).property("checked", false);
          }
        });

        selectedCheckbox = [];
      }

      // When Select/Deselect All is clicked, all chromosomes will show by default
      showAllChromosomes = true;
      d3.select(".show-all > input").property("checked", true);

      // Calling genome view for updates
      generateGenomeView();
    });

  // SVG element that will include the circos plot
  svg = d3.select("body")
    .append("svg")
    .attr("id", "chart")
    .attr("width", width)
    .attr("height", height)
    .style("float", "left")
    .style("margin-top", "50px");

  // svg
  //   .call(d3.zoom().on("zoom", function() {
  //     svg.attr("transform", d3.event.transform)
  //   }));

  // Defining a clip-path so that the genome view always stay inside
  // its container when zooming in

  // svg.append("defs").append("svg:clipPath")
  //   .attr("id", "clip-svg")
  //   .append("svg:rect")
  //   .attr("id", "clip-rect-svg")
  //   .attr("x", "0")
  //   .attr("y", "0")
  //   .attr("width", width)
  //   .attr("height", height);
  //
  // svg.select(".all").append("g").attr("clip-path", "url(#clip-block)");


  // Loading the circos plot in the svg element
  myCircos = new Circos({
    container: '#chart',
    width: width,
    height: height
  });

  // Updating angle on input
  d3.select("#nAngle")
    .on("input", function() {
      updateAngle(+this.value, draggedAngle > 0 ? 360 - draggedAngle : 0);
    });

  // Initial starting angle of the text
  updateAngle(chromosomeRotateAngle, 0);

  // Updating filter on input
  d3.select("#filter")
    .on("input", function() {
      updateFilter(+this.value, true);
    });

  // Default filtering
  updateFilter(filterValue, false);

  generateGenomeView();
}
