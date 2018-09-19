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

// React
import React from 'react';
import ReactDOM from 'react-dom';
import Modal from './reactComponents/Modal';

import generateGenomeView from './genomeView/generateGenomeView';

import { updateWaitingBlockCollisionHeadline } from './genomeView/blockCollisions';

import {
  getSelectedCheckboxes,
  lookForBlocksPositions,
  partitionGffKeys,
  resetChromosomeCheckboxes,
  roundFloatNumber,
  showChromosomeConnectionInformation,
  sortGffKeys,
  updateAngle,
  updateFilter,
  updateRatio,
  updateTemperature
} from './helpers';

// Variables getters and setters
import { setBlockDictionary } from './variables/blockDictionary';
import {
  setCurrentChromosomeOrder,
  setDefaultChromosomeOrder
} from './variables/currentChromosomeOrder';
import { setGeneDictionary } from './variables/geneDictionary';
import { setGffDictionary } from './variables/gffDictionary';
import {
  getAdditionalTrackArray,
  isAdditionalTrackAdded,
  pushAdditionalTrack
} from './variables/additionalTrack';
import { setCircosObject } from './variables/myCircos';

// Constants
import { sampleFiles } from './variables/templates';
import {
  CATEGORICAL_COLOR_SCALES,
  SEQUENTIAL_COLOR_SCALES,
  WIDTH,
  HEIGHT
} from './variables/constants';

/**
 * Generates and preprocess data for the syteny browser
 *
 * @param  {Object} error                     Error handler
 * @param  {Array<Object>} gff                Data from gff file
 * @param  {Array<Object>} collinearity       Data from collinearity file
 * @param  {Array<Object>} additionalTrack    Data from additional track
 * @return {undefined}                        undefined
 */
export default function generateData(error, gff, collinearity, additionalTrack) {
  if (error) return console.error(error);

  console.log("DATA LOADED !!!");

  const colors = d3.scaleOrdinal(CATEGORICAL_COLOR_SCALES['Normal']); // Default color scheme
  const geneDictionary = {}; // Dictionary that includes the start and end position data for each gene
  let gffKeys = []; // Array that includes the sorted keys from the gff dictionary
  const gffPositionDictionary = {}; // Dictionary that includes the colors, start and end position data for each chromosome
  const minStartChromosomesDictionary = {}; // Dictionary to help calculating the min start position for each chromosome
  const maxEndChromosomesDictionary = {}; // Dictionary to help calculating the max end positon for each chromosome

  // For loop to update position dictionary with file data
  for (let i = 0; i < gff.length; i++) {
    const currentChromosomeID = gff[i].chromosomeID;

    const start = parseInt(gff[i].start);
    const end = parseInt(gff[i].end);

    // Minimum start dictionary
    if (!(currentChromosomeID in minStartChromosomesDictionary)) {
      minStartChromosomesDictionary[currentChromosomeID] = Number.MAX_SAFE_INTEGER;
    }

    minStartChromosomesDictionary[currentChromosomeID] = Math.min(
      minStartChromosomesDictionary[currentChromosomeID],
      start
    );

    // Maximum end dictionary
    if (!(currentChromosomeID in maxEndChromosomesDictionary)) {
      maxEndChromosomesDictionary[currentChromosomeID] = 0;
    }

    maxEndChromosomesDictionary[currentChromosomeID] = Math.max(
      maxEndChromosomesDictionary[currentChromosomeID],
      end
    );

    // Gff dictionary
    if (!(currentChromosomeID in gffPositionDictionary)) {
      gffPositionDictionary[currentChromosomeID] = {};
    }

    gffPositionDictionary[currentChromosomeID].start =
      minStartChromosomesDictionary[currentChromosomeID];

    gffPositionDictionary[currentChromosomeID].end =
      maxEndChromosomesDictionary[currentChromosomeID];

    // Gene dictionary
    // currentGene checks gff3 (by default), gff otherwise
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

  // Obtaining keys from dictionary and sorting them in ascending order
  gffKeys = sortGffKeys(Object.keys(gffPositionDictionary)).slice();

  let totalChrEnd = 0;
  // Setting the color for each chromosome after sorting the gffKeys
  for (let i = 0; i < gffKeys.length; i++) {
    totalChrEnd += gffPositionDictionary[gffKeys[i]].end;
    gffPositionDictionary[gffKeys[i]].color = colors(i);
  }

  console.log('TOTAL CHR END: ', totalChrEnd);
  console.log('MAXIMUM WINDOW SIZE: ', Math.ceil(totalChrEnd / 2000) + 3000);

  // Setting gff dictionary with the start and end position for each chr
  setGffDictionary(gffPositionDictionary);

  // Setting the current order (default to ordered array of chromosomes)
  setCurrentChromosomeOrder(gffKeys.slice());
  setDefaultChromosomeOrder(gffKeys.slice());

  console.log('additionalTrack: ', additionalTrack);

  if (additionalTrack) {
    for (let i = 0; i < additionalTrack.length; i++) {
      const additionalTrackArray = []; // Array that includes the data from the additional tracks BedGraph file
      const { data: currentData, name } = additionalTrack[i];
      let maxValue = 0, minValue = Number.MAX_SAFE_INTEGER;

      for (let j = 0; j < currentData.length; j++) {
        let value = roundFloatNumber(parseFloat(currentData[j].value), 6);
        const additionalTrackObject = {
          block_id: currentData[j].chromosomeID,
          start: parseInt(currentData[j].start),
          end: parseInt(currentData[j].end),
          value: value
        };

        // Not adding values that are above the chromosome limit
        if (additionalTrackObject.start > gffPositionDictionary[currentData[j].chromosomeID].end &&
            additionalTrackObject.end > gffPositionDictionary[currentData[j].chromosomeID].end &&
            additionalTrackObject.value === 0) {
          continue;
        }

        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);

        additionalTrackArray.push(additionalTrackObject);
      }

      pushAdditionalTrack({
        data: additionalTrackArray,
        minValue: minValue,
        maxValue: maxValue,
        name: name
      });
    }
  }

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
      // connectionSource and connectionTarget are being used in the
      // blockView for complete reference
      connectionSource: collinearity[i].connectionSource,
      connectionTarget: collinearity[i].connectionTarget,
      sourceChromosome: collinearity[i].sourceChromosome,
      targetChromosome: collinearity[i].targetChromosome,
      score: collinearity[i].score,
      eValue: collinearity[i].eValueBlock,
      eValueConnection: collinearity[i].eValueConnection,
      isFlipped: collinearity[i].isFlipped
    });

    const sourceID = collinearity[i].sourceChromosome; // Source chromosome
    const targetID = collinearity[i].targetChromosome; // Target chromosome

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
    .style("display", "block");

  // Information title
  d3.select("#form-config")
    .append("h5")
    .text("Information");

  // Block number headline
  d3.select("#form-config")
    .append("h6")
    .attr("class", "block-number-headline");

  // Flipped blocks headline
  d3.select("#form-config")
    .append("h6")
    .attr("class", "flipped-blocks-headline");

  // Block collisions headline
  d3.select("#form-config")
    .append("h6")
    .attr("class", "block-collisions-headline");

  // Superimposed block collisions headline
  d3.select("#form-config")
    .append("h6")
    .attr("class", "superimposed-block-collisions-headline");

  // Decluttering ETA
  d3.select("#form-config")
    .append("h6")
    .attr("class", "filter-sa-hint-title");

  d3.select("#form-config")
    .append("h6")
    .attr("class", "filter-sa-hint");

  // Layout title
  d3.select("#form-config")
    .append("h5")
    .text("Layout");

  // Color blocks checkbox
  d3.select("#form-config")
    .append("p")
    .attr("class", "color-blocks")
    .attr("title", "If selected, all connections will be colored.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "color-blocks")
    .attr("value", "Color blocks")
    .property("checked", false); // Color blocks is not checked by default

  d3.select("#form-config").select("p.color-blocks > label")
    .append("span")
    .text("Color blocks");

  d3.select("p.color-blocks input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({
        shouldUpdateBlockCollisions: false
      });
    });

  // Dark mode checkbox
  d3.select("#form-config")
    .append("p")
    .attr("class", "dark-mode")
    .attr("title", "If selected, both views will have black background.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "dark-mode")
    .attr("value", "Dark mode")
    .property("checked", false); // Dark mode is not checked by default

  d3.select("#form-config").select("p.dark-mode > label")
    .append("span")
    .text("Dark mode");

  d3.select("p.dark-mode input")
    .on("change", function() {
      // Calling genome view for updates

      generateGenomeView({
        shouldUpdateBlockCollisions: false
      });
    });

  // Highlight flipped chromosomes checkbox
  d3.select("#form-config")
    .append("p")
    .attr("class", "highlight-flipped-chromosomes")
    .attr("title", "If selected, all flipped chromosomes will be highlighted.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "highlight-flipped-chromosomes")
    .attr("value", "Highlight flipped chromosomes")
    .property("checked", true); // Highligh flipped chromosomes is checked by default

  d3.select("#form-config").select("p.highlight-flipped-chromosomes > label")
    .append("span")
    .text("Highlight flipped chromosomes");

  d3.select("p.highlight-flipped-chromosomes input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({
        transition: { shouldDo: false },
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: false
      });
    });

  // Highlight flipped blocks checkbox
  d3.select("#form-config")
    .append("p")
    .attr("class", "highlight-flipped-blocks")
    .attr("title", "If selected, all connections with flipped blocks will be highlighted.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "highlight-flipped-blocks")
    .attr("value", "Highlight flipped blocks")
    .property("checked", false); // Highligh flipped blocks is not checked by default

  d3.select("#form-config").select("p.highlight-flipped-blocks > label")
    .append("span")
    .text("Highlight flipped blocks");

  d3.select("p.highlight-flipped-blocks input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: false
      });
    });

  // Show all checkbox
  d3.select("#form-config")
    .append("p")
    .attr("class", "show-all")
    .attr("title", "If selected, all chromosomes will show.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-all")
    .attr("value", "Show all")
    .property("checked", true); // Show All is checked by default

  d3.select("#form-config").select("p.show-all > label")
    .append("span")
    .text("Show all chromosomes");

  d3.select("p.show-all input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({});
    });

  // Show saved layout checkbox
  d3.select("#form-config")
    .append("p")
    .attr("class", "show-best-layout")
    .attr("title", "If selected, the last saved layout will be shown by default.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-best-layout")
    .attr("value", "Show saved layout")
    .property("checked", true); // Show best layout is checked by default

  d3.select("#form-config").select(".show-best-layout > label")
    .append("span")
    .text("Show saved layout");

  d3.select("p.show-best-layout input")
    .on("change", function() {
      if (d3.select(this).property("checked")) {
        // Calling genome view for updates without modifying block collision count
        // * If the layout is going to change, generateGenomeView is being called again,
        // and the count will be updated anyways after the animation
        // * If the layout is going to stay the same, there is no need to update the count
        generateGenomeView({
          transition: { shouldDo: false },
          shouldUpdateBlockCollisions: false,
          shouldUpdateLayout: true
        });
      }
    });

  // Chromosomes palette
  d3.select("#form-config")
    .append("div")
    .attr("class", "chromosomes-palette")
    .append("p")
    .text("Chromosomes palette: ");

  const allCategoricalColors = Object.keys(CATEGORICAL_COLOR_SCALES);
  let categoricalColorOptions = "";
  for (let i = 0; i < allCategoricalColors.length; i++) {
    const key = allCategoricalColors[i];
    categoricalColorOptions += `
      <option value="${key}">${key}</option>
      `;
  }

  d3.select("div.chromosomes-palette")
    .append("p")
    .append("select")
    .html(categoricalColorOptions);

  d3.select("div.chromosomes-palette select")
    .on("change", function() {
      const selected = d3.select(this).property("value");
      const colors = d3.scaleOrdinal(CATEGORICAL_COLOR_SCALES[selected]);

      // Setting the color for each chromosome with new color scale
      for (let i = 0; i < gffKeys.length; i++) {
        gffPositionDictionary[gffKeys[i]].color = colors(i);
      }

      setGffDictionary(gffPositionDictionary);

      // Calling genome view for updates with default transition
      generateGenomeView({
        shouldUpdateBlockCollisions: false
      });
    });

  // Draw blocks ordered by: Block ID or Block length (ascending or descending)
  d3.select("#form-config")
    .append("div")
    .attr("class", "draw-blocks-order")
    .append("p")
    .text("Drawing order: ");

  d3.select("div.draw-blocks-order")
    .append("p")
    .append("select")
    .html(function() {
      return `
        <option value="Block ID (↑)" selected="selected">Block ID (↑)</option>
        <option value="Block ID (↓)">Block ID (↓)</option>
        <option value="Block length (↑)">Block length (↑)</option>
        <option value="Block length (↓)">Block length (↓)</option>
        `;
    });

  d3.select("div.draw-blocks-order select")
    .on("change", function() {
      // Calling genome view for updates with default transition
      generateGenomeView({
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: false
      });
    });

  // Filter connections input range
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
    .attr("class", "filter-connections")
    .html(function() {
      return `
        <option value="At Least" selected="selected">At Least</option>
        <option value="At Most">At Most</option>
        `;
    });

  d3.select(".filter-connections-div")
    .select("select.filter-connections")
    .on("change", function() {
      // Calling genome view for updates with default transition
      generateGenomeView({
        shouldUpdateBlockCollisions: true,
        shouldUpdateLayout: true
      });
    });

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .html(function() {
      return `
        <label for="filter-block-size">
          <span id="filter-block-size-value">...</span>
        </label>
        `;
    });

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections")
    .html(function() {
      return `<input type="range" min="1" max=${maxBlockSize.toString()} id="filter-block-size">`;
    });

  // Filter angle input range
  d3.select("#form-config")
    .append("div")
    .attr("class", "filter-angle-div")
    .html(function() {
      return `
        <label for="nAngle-genome-view">
          <span>Rotate = </span>
          <span id="nAngle-genome-view-value">…</span>
        </label>
        <p>
          <input type="range" min="0" max="360" id="nAngle-genome-view">
        </p>
      `;
    });

  // Save layout button
  d3.select("#form-config")
    .append("p")
    .attr("class", "save-layout")
    .attr("title", "Save layout")
    .append("input")
    .attr("type", "button")
    .attr("value", "Save");

  // Reset layout button
  d3.select("#form-config")
    .append("p")
    .attr("class", "reset-layout")
    .attr("title", "Reset layout")
    .append("input")
    .attr("type", "button")
    .attr("value", "Reset");

  // Decluttering title
  d3.select("#form-config")
    .append("h5")
    .text("Decluttering");

  // Filter Simulated Annealing temperature
  d3.select("#form-config")
    .append("div")
    .attr("class", "filter-sa-temperature-div")
    .html(function() {
      return `
        <label for="filter-sa-temperature">
          <span>Temperature = </span>
          <span id="filter-sa-temperature-value">…</span>
        </label>
        <p>
          <input type="range" min="100" max="100000" step="100" id="filter-sa-temperature">
        </p>
      `;
    });

  // Filter Simulated Annealing ratio
  d3.select("#form-config")
    .append("div")
    .attr("class", "filter-sa-ratio-div")
    .html(function() {
      return `
        <label for="filter-sa-ratio">
          <span>Ratio = </span>
          <span id="filter-sa-ratio-value">…</span>
        </label>
        <p>
          <input type="range" min="0.001" max="0.2" step="0.001" id="filter-sa-ratio">
        </p>
      `;
    });

  // Minimize collisions button
  d3.select("#form-config")
    .append("p")
    .attr("class", "best-guess")
    .attr("title", "Minimize collisions")
    .append("input")
    .attr("type", "button")
    .attr("value", "Minimize collisions");

  if (isAdditionalTrackAdded()) {
    const currentAdditionalTracks = getAdditionalTrackArray();
    console.log('currentAdditionalTracks: ', currentAdditionalTracks);
    // Loading input option tags for select
    let inputOptions = '<option value="None" selected="selected">None</option>';
    for (let i = 0; i < currentAdditionalTracks.length; i++) {
      inputOptions += `
        <option value="${currentAdditionalTracks[i].name}">${currentAdditionalTracks[i].name}</option>
        `;
    }

    // Loading colors option tag for select
    const allColors = Object.keys(SEQUENTIAL_COLOR_SCALES);
    let colorOptions = "";
    for (let i = 0; i < allColors.length; i++) {
      const key = allColors[i];
      colorOptions += `
        <option value="${key}">${SEQUENTIAL_COLOR_SCALES[key]}</option>
        `;
    }

    // Additional tracks title
    d3.select("#form-config")
      .append("h5")
      .text("Additional tracks");

    // Heatmap track
    d3.select("#form-config")
      .append("div")
      .attr("class", "heatmap-track additional-track")
      .append("p")
      .html("<strong>Heatmap track</strong>");

    // Heatmap additional track select input
    d3.select(".heatmap-track")
      .append("div")
      .attr("class", "heatmap-track-input additional-track-block")
      .append("p")
      .text("Input: ");

    d3.select("div.heatmap-track-input")
      .append("p")
      .append("select")
      .html(inputOptions);

    // Heatmap color scale
    d3.select(".heatmap-track")
    .append("div")
    .attr("class", "heatmap-track-color additional-track-block")
    .append("p")
    .text("Palette: ");

    d3.select("div.heatmap-track-color")
    .append("p")
    .append("select")
    .html(colorOptions);

    // Heatmap placement
    d3.select(".heatmap-track")
      .append("div")
      .attr("class", "heatmap-track-placement additional-track-block")
      .append("p")
      .text("Placement: ");

    d3.select("div.heatmap-track-placement")
      .append("p")
      .append("select")
      .html(function() {
        return `
          <option value="Outside" selected="selected">Outside</option>
          <option value="Inside">Inside</option>
          `;
      });

    // Histogram track
    d3.select("#form-config")
      .append("div")
      .attr("class", "histogram-track additional-track")
      .append("p")
      .html("<strong>Histogram track</strong>");

    // Histogram additional track select input
    d3.select(".histogram-track")
      .append("div")
      .attr("class", "histogram-track-input additional-track-block")
      .append("p")
      .text("Input: ");

    d3.select("div.histogram-track-input")
      .append("p")
      .append("select")
      .html(inputOptions);

    // Histogram color scale
    d3.select(".histogram-track")
    .append("div")
    .attr("class", "histogram-track-color additional-track-block")
    .append("p")
    .text("Palette: ");

    d3.select("div.histogram-track-color")
    .append("p")
    .append("select")
    .html(colorOptions);

    // Histogram placement
    d3.select(".histogram-track")
      .append("div")
      .attr("class", "histogram-track-placement additional-track-block")
      .append("p")
      .text("Placement: ");

    d3.select("div.histogram-track-placement")
      .append("p")
      .append("select")
      .html(function() {
        return `
          <option value="Outside" selected="selected">Outside</option>
          <option value="Inside">Inside</option>
          `;
      });

    // Select on change for heatmap and histogram
    d3.selectAll("div.additional-track-block select")
      .on("change", function() {
        // Calling genome view for updates with default transition
        generateGenomeView({
          transition: { shouldDo: false },
          shouldUpdateBlockCollisions: false,
          shouldUpdateLayout: true
        });
      });
  }

  // Connections title
  d3.select("#form-config")
    .append("h5")
    .text("Connections");

  // Chromosome checkboxes
  d3.select("#form-config")
    .append("div")
    .attr("class", "container")
    .append("div")
    .attr("class", function() {
      return "row for-chr-boxes";
    });

  // Partitioning gff keys to get the checkboxes division
  const { gffPartitionedDictionary, partitionedGffKeys } = partitionGffKeys(gffKeys);

  for (let i = 0; i < partitionedGffKeys.length; i++) {
    d3.select("div.for-chr-boxes")
      .append("div")
      .attr("class", function() {
        return `chr-boxes ${partitionedGffKeys[i]} col-lg-6`;
      })
      .selectAll("div.chr-box-inner-content")
      .data(gffPartitionedDictionary[partitionedGffKeys[i]]).enter()
      .append("div")
      .attr("class", "chr-box-inner-content")
      .append("label")
      .append("input")
      .attr("class", function(chrKey) {
        return `chr-box ${partitionedGffKeys[i]} ${chrKey}`;
      })
      .attr("type", "checkbox")
      .attr("name", function(chrKey) {
        return chrKey;
      })
      .attr("value", function(chrKey) {
        return chrKey;
      });

    // Select all button
    d3.select(`div.chr-boxes.${partitionedGffKeys[i]}`)
      .append("p")
      .attr("class", function() {
        return `select-all ${partitionedGffKeys[i]}`;
      })
      .attr("title", "Selects all the connections.")
      .append("input")
      .attr("type", "button")
      .attr("value", "Select all");
  }

  d3.select("#form-config")
    .selectAll("div.chr-box-inner-content > label")
    .append("span")
    .attr("class", "chr-box-text")
    .text(function(chrKey) {
      return chrKey;
    });

  d3.select("#form-config")
    .selectAll("div.chr-box-inner-content")
    .append("span")
    .attr("class", "chr-box-extra");

  // Checkboxes on change event
  d3.select("#form-config").selectAll(".chr-box")
    .on("change", function() {
      // All checkboxes are returned to their original state
      resetChromosomeCheckboxes();

      // The second class is the identifier in the chr-box input
      // `chr-box ${partitionedGffKeys[i]} ${chrKey}`
      const identifierClass =
        d3.select(this).attr("class").split(" ")[1];

      const {
        currentClassCheckboxes,
        selectedCheckboxes
      } = getSelectedCheckboxes(identifierClass);

      // Changing Select/Deselect All button depending on the amount of
      // selected chromosomes with the current class
      if (currentClassCheckboxes.length === 0) {
        d3.selectAll(`.select-all.${identifierClass} > input`).property("value", "Select all");
        d3.selectAll(`p.select-all.${identifierClass}`).attr("title", "Selects all the connections.");
      } else {
        d3.select(`.select-all.${identifierClass} > input`).property("value", "Deselect all");
        d3.select(`p.select-all.${identifierClass}`).attr("title", "Deselects all the connections.");
      }

      if (selectedCheckboxes.length === 1) {
        showChromosomeConnectionInformation(connectionDictionary, selectedCheckboxes);
      }

      // Calling genome view for updates
      generateGenomeView({});
    });

  // Select all button click
  d3.select("#form-config").selectAll(".select-all > input")
    .on("click", function() {
      // The second class is the identifier in the select-all input
      // `select-all ${partitionedGffKeys[i]}`
      const identifierClass =
        d3.select(this.parentNode).attr("class").split(" ")[1];

      if (d3.select(this).property("value") === "Select all") {
        // Changing the value and title to Deselect all
        d3.select(this).property("value", "Deselect all");
        d3.select(this.parentNode).attr("title", "Deselects all the connections.");

        // Selecting all checkboxes
        d3.selectAll(`.chr-box.${identifierClass}`).each(function() {
          if (!d3.select(this).property("checked") &&
            !d3.select(this).attr("disabled")) {
            d3.select(this).property("checked", true);
          }
        });
      } else {
        // Changing the value and title to Select all
        d3.select(this).property("value", "Select all");
        d3.select(this.parentNode).attr("title", "Selects all the connections.");

        // Only the identified checkboxes are unchecked
        d3.selectAll(`.chr-box.${identifierClass}`).each(function(d) {
          if (d3.select(this).property("checked")) {
            d3.select(this).property("checked", false);
          }
        });
      }

      const { selectedCheckboxes } = getSelectedCheckboxes();
      if (selectedCheckboxes.length === 1) {
        showChromosomeConnectionInformation(connectionDictionary, selectedCheckboxes);
      } else {
        // All checkboxes are returned to their original state
        resetChromosomeCheckboxes();
      }

      /**
       * Show all checkbox should be selected by default:
       *
       * -> When all the possible checkboxes are selected.
       * -> When no checkboxes at all are selected, so that the user does not
       * have to select 'Show all chromosomes' again.
       */
      if (d3.selectAll(".chr-box").size() === selectedCheckboxes.length ||
        selectedCheckboxes.length === 0) {
        d3.select(".show-all input").property("checked", true);
      }

      // Calling genome view for updates
      generateGenomeView({});
    });

  // SVG element that will include the Circos plot
  const svg = d3.select("#page-container .row")
    .append("div")
    .attr("class", function() {
      return "genome-view-container col-lg-6 text-center";
    })
    .append("svg")
    .attr("id", "genome-view")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

  d3.select(".genome-view-container")
    .append("div")
    .attr("class", "progress")
    // .style("display", "none")
    .html(function() {
      return `
        <div class="progress-bar"
          role="progressbar"
          aria-valuenow="75"
          aria-valuemin="0"
          aria-valuemax="100"
          style="width: 0%">0%
        </div>
      `;
    });

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

  // Setting initial Circos object
  setCircosObject();

  // Initial starting angle of the genome view (0 degrees for default and dragging angle)
  updateAngle(0, 0);

  // Initial temperature and input event
  updateTemperature(5000);

  d3.select("#filter-sa-temperature")
    .on("input", function() {
      updateTemperature(+this.value);
    });

  // Initial ratio and input event
  updateRatio(0.05);

  d3.select("#filter-sa-ratio")
    .on("input", function() {
      updateRatio(+this.value);
    });

  /**
   * Calling updateFilter with all parameters
   *
   * @param  {number} value    Connection value from input range
   * @return {undefined}       undefined
   */
  const callFullUpdateFilter = (value) => updateFilter({
    shouldUpdateBlockCollisions: true,
    shouldUpdateLayout: true,
    shouldUpdatePath: true,
    value: value
  });

  // Updating filter on input
  d3.select("#filter-block-size")
    .on("input", function() {
      updateWaitingBlockCollisionHeadline();

      updateFilter({
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: false,
        shouldUpdatePath: true,
        value: +this.value
      });
    })
    .on("mouseup", function() { callFullUpdateFilter(+this.value); })
    .on("keyup", function() { callFullUpdateFilter(+this.value); });

  // Default filtering (1 is min value and shouldUpdatePath = false)
  updateFilter({ shouldUpdatePath: false, value: 1 });

  // First load of the genome view
  generateGenomeView({});

  // Loading sampleFiles modal inside its container
  ReactDOM.render(
    <Modal
      buttonLabel="Sample files"
      modalHeader="Sample files">
      {sampleFiles}
    </Modal>,
    document.getElementById('documentation-container')
  );

  // Displaying all the content after everything is loaded
  d3.select("#loader")
    .style("display", "none");

  d3.select("#page-container")
    .style("display", "block");
};
