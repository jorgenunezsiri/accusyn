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

import * as d3 from 'd3';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';

import generateGenomeView from './genomeView/generateGenomeView';
import { schemeSet2 } from 'd3-scale-chromatic';

import {
  fixSourceTargetCollinearity,
  lookForBlocksPositions,
  sortGffKeys,
  updateAngle,
  updateFilter
} from './helpers';

// Variables getters and setters
import { setBlockDictionary } from './variables/blockDictionary';
import { setCircosObject } from './variables/myCircos';
import {
  setCurrentChromosomeOrder,
  setDefaultChromosomeOrder
} from './variables/currentChromosomeOrder';
import { setGeneDictionary } from './variables/geneDictionary';
import { setGffDictionary } from './variables/gffDictionary';

// Constants
import { WIDTH, HEIGHT } from './constants';

/**
 * Generates and preprocess data for the syteny browser
 *
 * @param  {Object} error               Error handler
 * @param  {Array<Object>} gff          Data from gff file
 * @param  {Array<Object>} collinearity Data from collinearity file
 * @return {undefined}                  undefined
 */
export default function generateData(error, gff, collinearity) {
  if (error) return console.error(error);

  console.log("DATA LOADED !!!");

  const colors = d3.scaleOrdinal(schemeSet2); // Default color scheme
  const geneDictionary = {}; // Dictionary that includes the start and end position data for each gene
  let gffKeys = []; // Array that includes the sorted keys from the gff dictionary
  const gffPositionDictionary = {}; // Dictionary that includes the colors, start and end position data for each chromosome

  // For loop to update position dictionary with file data
  for (let i = 0; i < gff.length; i++) {
    const currentChromosomeID = gff[i].chromosomeID;
    const start = parseInt(gff[i].start);
    const end = parseInt(gff[i].end);

    if (!(currentChromosomeID in gffPositionDictionary)) {
      gffPositionDictionary[currentChromosomeID] = {};
      gffPositionDictionary[currentChromosomeID].start = start;
      gffPositionDictionary[currentChromosomeID].color = colors(i);
    }

    gffPositionDictionary[currentChromosomeID].end = end;
    const currentGene =
      gff[i].attributes ? gff[i].attributes.split(';')[0].split('=')[1] :
      (gff[i].geneID ? gff[i].geneID : currentChromosomeID);

    geneDictionary[currentGene] = {
      start: start,
      end: end
    }
  }

  // Setting gene dictionary with all the genes
  setGeneDictionary(geneDictionary);

  // Setting gff dictionary with the start and end position for each chr
  setGffDictionary(gffPositionDictionary);

  // Obtaining keys from dictionary and sorting them in ascending order
  gffKeys = sortGffKeys(Object.keys(gffPositionDictionary)).slice();

  // Setting the current order (default to ordered array of chromosomes)
  setCurrentChromosomeOrder(gffKeys.slice());
  setDefaultChromosomeOrder(gffKeys.slice());

  const blockDictionary = {}; // Dictionary to store the data for all blocks
  const connectionDictionary = {}; // Dictionary to store the data for all the connections between any source and target
  for (let i = 0; i < collinearity.length; i++) {
    const currentBlock = collinearity[i].block;

    if (!(currentBlock in blockDictionary)) {
      blockDictionary[currentBlock] = [];
    }

    // Adding all the block connections in the dictionary
    blockDictionary[currentBlock].push({
      connection: collinearity[i].connection,
      source: collinearity[i].source,
      target: collinearity[i].target,
      score: collinearity[i].score,
      eValue: collinearity[i].eValueBlock,
      eValueConnection: collinearity[i].eValueConnection,
      isFlipped: collinearity[i].isFlipped
    });

    const IDs = fixSourceTargetCollinearity(collinearity[i]);
    const sourceID = IDs.source;
    const targetID = IDs.target;

    // If source is not in the dictionary, create new array for the source
    if (!(sourceID in connectionDictionary)) {
      connectionDictionary[sourceID] = [];
    }

    // If target is not in the dictionary, create new array for the target
    if (!(targetID in connectionDictionary)) {
      connectionDictionary[targetID] = [];
    }

    let indexConnection = 0;
    // If a connection is not found between source and target, then create it
    if (!find(connectionDictionary[sourceID], ['connection', targetID])) {
      connectionDictionary[sourceID].push({
        blockIDs: [currentBlock],
        connection: targetID,
        connectionAmount: 1
      });
    } else {
      // If a connection is found, then find index, update connection amount,
      // and add new blockID if not present
      indexConnection = findIndex(connectionDictionary[sourceID], ['connection', targetID]);
      connectionDictionary[sourceID][indexConnection].connectionAmount++;

      if (connectionDictionary[sourceID][indexConnection].blockIDs.indexOf(currentBlock) === (-1)) {
        connectionDictionary[sourceID][indexConnection].blockIDs.push(currentBlock);
      }
    }

    // If a connection is not found between target and source, then create it
    if (!find(connectionDictionary[targetID], ['connection', sourceID])) {
      connectionDictionary[targetID].push({
        blockIDs: [currentBlock],
        connection: sourceID,
        connectionAmount: 1
      });
    } else {
      // If a connection is found, then find index,
      // update connection amount only if not same chromosome,
      // and add new blockID if not present
      indexConnection = findIndex(connectionDictionary[targetID], ['connection', sourceID]);

      if (targetID != connectionDictionary[targetID][indexConnection].connection) {
        connectionDictionary[targetID][indexConnection].connectionAmount++;
      }

      if (connectionDictionary[targetID][indexConnection].blockIDs.indexOf(currentBlock) === (-1)) {
        connectionDictionary[targetID][indexConnection].blockIDs.push(currentBlock);
      }
    }
  }

  // Array that includes the keys from the blockDictionary
  const blockKeys = Object.keys(blockDictionary);

  // Determining the block with maximum number of connections
  // (to be used in the filter input range)
  // N13 -> N3 has the max block size with 2295 connections
  // 2306 connections with top 5 BLAST hits
  // Also, adding all the minimum and maximum positions for each block
  let maxBlockSize = 0;
  for (let i = 0; i < blockKeys.length; i++) {
    const currentBlock = blockKeys[i];
    maxBlockSize = Math.max(maxBlockSize, blockDictionary[currentBlock].length);
    blockDictionary[currentBlock].blockPositions =
      lookForBlocksPositions(blockDictionary, geneDictionary, currentBlock);
  }

  // Setting blockDictionary with all the connections and the blockPositions
  setBlockDictionary(blockDictionary);

  // Updating the style of the configuration panel
  d3.select("#config")
    .style("display", "block")
    .style("margin-left", "20px")
    .style("margin-top", "20px")
    .style("width", `${WIDTH / 3}px`);

  d3.select("#form-config")
    .append("p")
    .attr("class", "show-all")
    .attr("title", "If selected, all chromosomes will show.")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-all")
    .attr("value", "Show all")
    .property("checked", true); // Show All is checked by default

  d3.select("#form-config").select('p.show-all')
    .append("span")
    .text("Show all");

  d3.select("p.show-all > input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({});
    });

  d3.select("#form-config")
    .append("h5")
    .text("Layout");

  d3.select("#form-config")
    .append("p")
    .attr("class", "show-best-layout")
    .attr("title", "If selected, the last saved layout will be shown by default.")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-best-layout")
    .attr("value", "Show saved layout")
    .property("checked", true); // Show best layout is checked by default

  d3.select("#form-config").select('.show-best-layout')
    .append("span")
    .text("Show saved layout");

  d3.select("p.show-best-layout > input")
    .on("change", function() {
      if (d3.select(this).property("checked")) {
        // Calling genome view for updates
        generateGenomeView({
          "transition": { shouldDo: false },
          "shouldUpdateBlockCollisions": true,
          "shouldUpdateLayout": true
        });
      }
    });

  d3.select("#form-config")
    .append("p")
    .attr("class", "save-layout")
    .attr("title", "Save layout")
    .append("input")
    .attr("type", "button")
    .attr("value", "Save layout");

  d3.select("#form-config")
    .append("p")
    .attr("class", "reset-layout")
    .attr("title", "Reset layout")
    .append("input")
    .attr("type", "button")
    .attr("value", "Reset layout");

  d3.select("#form-config")
    .append("h5")
    .text("Connections");

  d3.select("#form-config")
    .append("h6")
    .attr("class", "block-number-headline")
    .style("font-weight", "normal");

  d3.select("#form-config")
    .append("h6")
    .attr("class", "block-collision-headline")
    .style("font-weight", "normal");

  d3.select("#form-config")
    .append("p")
    .attr("class", "best-guess")
    .attr("title", "Minimize collisions")
    .style("margin-top", "15px")
    .append("input")
    .attr("type", "button")
    .attr("value", "Minimize collisions");

  d3.select("#form-config")
    .append("p")
    .attr("class", "color-blocks")
    .attr("title", "If selected, all connections will be colored.")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "color-blocks")
    .attr("value", "Color blocks")
    .property("checked", false); // Color blocks is not checked by default

  d3.select("#form-config").select('p.color-blocks')
    .append("span")
    .text("Color blocks");

  d3.select("p.color-blocks > input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({
        "shouldUpdateBlockCollisions": false,
        "shouldUpdateLayout": false
      });
    });

  d3.select("#form-config")
    .append("p")
    .attr("class", "highlight-flipped-blocks")
    .attr("title", "If selected, all connections will highlight flipped blocks.")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "highlight-flipped-blocks")
    .attr("value", "Highlight flipped blocks")
    .property("checked", false); // Highligh flipped blocks is not checked by default

  d3.select("#form-config").select('p.highlight-flipped-blocks')
    .append("span")
    .text("Highlight flipped blocks");

  d3.select("p.highlight-flipped-blocks > input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({
        "shouldUpdateBlockCollisions": false,
        "shouldUpdateLayout": false
      });
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
      return '<option value="At Least" selected="selected">At Least</option><option value="At Most">At Most</option>';
    });

  d3.select(".filter-connections-div")
    .select("select")
    .on("change", function() {
      // Calling genome view for updates with default transition
      generateGenomeView({
        "shouldUpdateBlockCollisions": true,
        "shouldUpdateLayout": true
      });
    });

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .html(function() {
      return `<label for="filter-block-size" style="display: inline-block; text-align: left; width: 125px">
        <span id="filter-block-size-value">...</span>
        </label>`;
    });

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .html(function() {
      return `<input style="margin-left: 45px; width: 195px" type="range" min="1" max=
        ${maxBlockSize.toString()} id="filter-block-size">`;
    });

  d3.select("#form-config")
    .append("div")
    .attr("class", "chr-boxes")
    .selectAll("div.chr-boxes > p")
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
      const selectedChromosomes = [];
      const visitedChr = {}; // Visited chromosomes dictionary
      for (let i = 0; i < gffKeys.length; i++) {
        visitedChr[gffKeys[i]] = false;
      }

      d3.selectAll(".chr-box").each(function(d) {
        d3.select(this.parentNode).classed("disabled", false);
        d3.select(this.parentNode).select("span").text(d);

        const cb = d3.select(this);
        cb.attr("disabled", null);
        if (cb.property("checked")) {
          // If chromosome is already checked, then it is visited
          visitedChr[d] = true;
          selectedChromosomes.push(cb.property("value"));
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

        for (let j = 0; j < gffKeys.length; j++) {
          // If a connection is found, mark current chromosome as visited
          if (find(connectionDictionary[selectedChromosomes[0]], ['connection', gffKeys[j]])) {
            visitedChr[gffKeys[j]] = true;
          }
        }

        d3.selectAll(".chr-box").each(function(d) {
          d3.select(this.parentNode).select('span').html(function() {
            // Finding the index of the connection in the dictionary
            const indexConnection = findIndex(connectionDictionary[selectedChromosomes[0]], ['connection', d]);
            let connectionAmount = 0;
            let textToShow = d.toString(); // Current chromosome id (e.g. N1, N2, N10)
            const style = '<em style="display: inline-block; text-align: right; width: 65px; margin-left: 10px">';
            if (indexConnection === (-1)) {
              textToShow += `${style}0 blocks</em>`;
            } else {
              connectionAmount = connectionDictionary[selectedChromosomes[0]][indexConnection].blockIDs.length;
              textToShow += `${style}${connectionAmount.toString()}`;
              if (connectionAmount === 1) {
                textToShow += ' block</em>';
              } else {
                textToShow += ' blocks</em>';
              }
            }

            return textToShow;
          });

          if (visitedChr[d]) {
            d3.select(this).attr("disabled", null);
            d3.select(this.parentNode).classed("disabled", false);
          } else {
            // Only disable not visited chromosomes
            d3.select(this).attr("disabled", true);
            d3.select(this.parentNode).classed("disabled", true);
          }
        });
      }

      // Calling genome view for updates
      generateGenomeView({});
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

          const cb = d3.select(this);
          cb.attr("disabled", null);
          if (d3.select(this).property("checked")) {
            d3.select(this).property("checked", false);
          }
        });
      }

      // When Select/Deselect All is clicked, all chromosomes will show by default
      d3.select(".show-all > input").property("checked", true);

      // Calling genome view for updates
      generateGenomeView({});
    });

  // SVG element that will include the Circos plot
  const svg = d3.select("body")
    .append("svg")
    .attr("id", "chart")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
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

  setCircosObject();

  // Initial starting angle of the genome view (0 degrees for default and dragging angle)
  updateAngle(0, 0);

  const callFullUpdateFilter = (value) => updateFilter({
    "value": value,
    "shouldUpdatePath": true,
    "shouldUpdateBlockCollisions": true,
    "shouldUpdateLayout": true
  });

  // Updating filter on input
  d3.select("#filter-block-size")
    .on("input", function() {
      d3.select(".block-collision-headline")
        .text("Updating block collisions ...");

      updateFilter({
        "value": +this.value,
        "shouldUpdatePath": true,
        "shouldUpdateBlockCollisions": false,
        "shouldUpdateLayout": false
      });
    })
    .on("mouseup", function() { callFullUpdateFilter(+this.value); })
    .on("keyup", function() { callFullUpdateFilter(+this.value); });

  // Default filtering (1 is min value and shouldUpdatePath = false)
  updateFilter({ "value": 1, "shouldUpdatePath": false });

  // First load of the genome view
  generateGenomeView({});

  // Displaying all the content after everything is loaded
  d3.select("#loader")
    .style("display", "none");

  d3.select("#pageContainer")
    .style("display", "block");
};
