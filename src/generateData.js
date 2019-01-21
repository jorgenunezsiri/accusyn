/*
University of Saskatchewan
GSB: A Web-based Genome Synteny Browser
Course: CMPT994 - Research

Name: Jorge Nunez Siri
E-mail: jdn766@mail.usask.ca

Function file: generateData.js

@2018-2019, Jorge Nunez Siri, All rights reserved
*/

import * as d3 from 'd3';
import cloneDeep from 'lodash/cloneDeep';
import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import isEmpty from 'lodash/isEmpty';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import DownloadFilesForm from './reactComponents/DownloadFilesForm';
import Modal from './reactComponents/Modal';
import SavedStamps from './reactComponents/SavedStamps';

import undoManager, { resetUndoRedoButtons, updateUndoRedoButtons } from './vendor/undoManager';

import generateBlockView from './generateBlockView';
import generateGenomeView from './genomeView/generateGenomeView';

import generateAdditionalTracks, {
  addAdditionalTracksMenu
} from './generateAdditionalTracks';

import {
  calculateDeclutteringETA,
  callSwapPositionsAnimation,
  saveToSolutionsDictionary,
  simulatedAnnealing,
  updateWaitingBlockCollisionHeadline
} from './genomeView/blockCollisions';

import {
  assignFlippedChromosomeColors,
  calculateMiddleValue,
  getSelectedCheckboxes,
  isInViewport,
  lookForBlocksPositions,
  movePageContainerScroll,
  partitionGffKeys,
  removeNonLettersFromString,
  renderReactAlert,
  renderSvgButton,
  resetChromosomeCheckboxes,
  roundFloatNumber,
  showChromosomeConnectionInformation,
  sortGffKeys,
  updateAngle,
  updateFilter,
  updateFlippingFrequency,
  updateRatio,
  updateTemperature
} from './helpers';

// Variables getters and setters
import { setBlockDictionary } from './variables/blockDictionary';
import {
  getCollisionCount,
  getCollisionCalculationTime,
  getTotalNumberOfIterations
} from './variables/collisionCount';
import {
  getDefaultChromosomeOrder,
  setCurrentChromosomeOrder,
  setDefaultChromosomeOrder
} from './variables/currentChromosomeOrder';
import { getCurrentFlippedChromosomes } from './variables/currentFlippedChromosomes';
import { getCurrentSelectedBlock } from './variables/currentSelectedBlock';
import { getDataChords } from './variables/dataChords';
import {
  generateUpdatedDataChromosomesFromOrder,
  getDataChromosomes
} from './variables/dataChromosomes';
import { setGeneDictionary } from './variables/geneDictionary';
import { setGffDictionary } from './variables/gffDictionary';
import {
  getAdditionalTrackArray,
  setAdditionalTrackArray
} from './variables/additionalTrack';
import {
  getCircosObject,
  setCircosObject
} from './variables/myCircos';
import resetAllVariables from './variables/resetAllVariables';

// Constants
import { loadFiles } from './variables/templates';
import {
  CATEGORICAL_COLOR_SCALES,
  CIRCOS_CONF,
  CONNECTION_COLORS,
  WIDTH,
  HEIGHT
} from './variables/constants';

/**
 * Generates and preprocess data for the synteny browser
 *
 * @param  {Array<Object>} gff                Data from gff file
 * @param  {Array<Object>} collinearity       Data from collinearity file
 * @param  {Array<Object>} additionalTrack    Data from additional track
 * @return {undefined}                        undefined
 */
export default function generateData(gff, collinearity, additionalTrack) {
  // Return if one of the main files is not defined
  if (gff == null || collinearity == null) return;

  // Resetting all stored variables
  resetAllVariables();

  console.log("DATA LOADED !!!");

  const colors = d3.scaleOrdinal(CATEGORICAL_COLOR_SCALES['Normal']); // Default color scheme
  const geneDictionary = {}; // Dictionary that includes the start and end position data for each gene
  let gffKeys = []; // Array that includes the sorted keys from the gff dictionary
  const gffPositionDictionary = {}; // Dictionary that includes the colors, start and end position data for each chromosome
  const minStartChromosomesDictionary = {}; // Dictionary to help calculating the min start position for each chromosome
  const maxEndChromosomesDictionary = {}; // Dictionary to help calculating the max end positon for each chromosome

  // For loop to update position dictionary with file data
  for (let i = 0, gffLength = gff.length; i < gffLength; i++) {
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
  const gffKeysLength = gffKeys.length;

  // Setting default color domain for chromosome palettes
  const defaultColorDomain = [...gffKeys.keys()];
  colors.domain(defaultColorDomain);

  let totalChrEnd = 0;
  // Setting the color for each chromosome after sorting the gffKeys
  for (let i = 0; i < gffKeysLength; i++) {
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
    setAdditionalTrackArray(generateAdditionalTracks(additionalTrack));
  }

  const blockDictionary = {}; // Dictionary to store the data for all blocks
  const connectionDictionary = {}; // Dictionary to store the data for all the connections between any source and target
  for (let i = 0, collinearityLength = collinearity.length; i < collinearityLength; i++) {
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
        connectionAmount: 1 // Total number of individual connections
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
        connectionAmount: 1 // Total number of individual connections
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
  for (let i = 0, blockKeysLength = blockKeys.length; i < blockKeysLength; i++) {
    const currentBlock = blockKeys[i];
    maxBlockSize = Math.max(maxBlockSize, blockDictionary[currentBlock].length);
    blockDictionary[currentBlock].blockPositions =
      lookForBlocksPositions(blockDictionary, geneDictionary, currentBlock);
  }

  // Setting blockDictionary with all the connections and the blockPositions
  setBlockDictionary(blockDictionary);

  // Information title
  d3.select("#form-config")
    .append("h5")
    .attr("class", "panel-title information-panel-title")
    .text("Information");

  d3.select("#form-config")
    .append("div")
    .attr("class", "panel information-panel")
    .append("h6")
    .attr("class", "chromosome-number-headline");

    // Block number headline
  d3.select("#form-config .information-panel")
    .append("h6")
    .attr("class", "block-number-headline");

  // Flipped blocks headline
  d3.select("#form-config .information-panel")
    .append("h6")
    .attr("class", "flipped-blocks-headline");

  // Block collisions headline
  d3.select("#form-config .information-panel")
    .append("h6")
    .attr("class", "block-collisions-headline");

  // Superimposed block collisions headline
  d3.select("#form-config .information-panel")
    .append("h6")
    .attr("class", "superimposed-block-collisions-headline");

  // Decluttering ETA
  d3.select("#form-config .information-panel")
    .append("h6")
    .attr("class", "filter-sa-hint-title");

  d3.select("#form-config .information-panel")
    .append("h6")
    .attr("class", "filter-sa-hint");

  // Connections title
  d3.select("#form-config")
    .append("h5")
    .attr("class", "panel-title connections-panel-title")
    .text("Connections");

  d3.select("#form-config")
    .append("div")
    .attr("class", "panel connections-panel");

  // Chromosome checkboxes
  d3.select("#form-config .connections-panel")
    .append("div")
    .attr("class", "container")
    .append("div")
    .attr("class", "row for-chr-boxes");

  // Layout title
  d3.select("#form-config")
    .append("h5")
    .attr("class", "panel-title layout-panel-title")
    .text("Layout");

  d3.select("#form-config")
    .append("div")
    .attr("class", "panel layout-panel");

  // Dark mode checkbox
  d3.select("#form-config .layout-panel")
    .append("p")
    .attr("class", "dark-mode")
    .attr("title", "If selected, both views will have black background.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "dark-mode")
    .attr("value", "Dark mode")
    .property("checked", false); // Dark mode is not checked by default

  d3.select("#form-config p.dark-mode > label")
    .append("span")
    .text("Dark mode");

  d3.select("p.dark-mode input")
    .on("change", function() {
      const isDarkMode = d3.select(this).property("checked");
      const currentSelectedBlock = getCurrentSelectedBlock();
      const dataChords = getDataChords();
      if (!isEmpty(currentSelectedBlock)) {
        const currentPosition = findIndex(dataChords, ['source.value.id', currentSelectedBlock]);
        if (currentPosition !== (-1)) {
          const currentChord = dataChords[currentPosition];
          // Calling block view if block is found
          generateBlockView(currentChord);
        }
      }

      // Calling genome view for updates
      generateGenomeView({
        // Transitioning only when entering dark mode
        shouldUpdateBlockCollisions: false
      });
    });

  // Highlight flipped blocks checkbox
  d3.select("#form-config .layout-panel")
    .append("p")
    .attr("class", "highlight-flipped-blocks")
    .attr("title", "If selected, all connections with flipped blocks will be highlighted.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "highlight-flipped-blocks")
    .attr("value", "Highlight flipped blocks")
    .property("checked", false); // Highligh flipped blocks is not checked by default

  d3.select("#form-config p.highlight-flipped-blocks > label")
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

  // Highlight flipped chromosomes checkbox
  d3.select("#form-config .layout-panel")
    .append("p")
    .attr("class", "highlight-flipped-chromosomes")
    .attr("title", "If selected, all flipped chromosomes will be highlighted.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "highlight-flipped-chromosomes")
    .attr("value", "Highlight flipped chromosomes")
    .property("checked", true); // Highligh flipped chromosomes is checked by default

  d3.select("#form-config p.highlight-flipped-chromosomes > label")
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

  // Show tooltip inside checkbox
  d3.select("#form-config .layout-panel")
    .append("p")
    .attr("class", "show-tooltip-inside")
    .attr("title", "If selected, the tooltip will be shown next to the cursor.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-tooltip-inside")
    .attr("value", "Show tooltip inside")
    .property("checked", true); // Show tooltip inside is checked by default

  d3.select("#form-config .show-tooltip-inside > label")
    .append("span")
    .text("Show tooltip inside");

  d3.select("p.show-tooltip-inside input")
    .on("change", function() {
      const showTooltipOutside = !d3.select(this).property("checked");

      d3.select(".circos-tooltip")
        .classed("outside", showTooltipOutside);
    });

  // Blocks color dropdown select
  d3.select("#form-config .layout-panel")
    .append("div")
    .attr("class", "blocks-color")
    .append("p")
    .text("Blocks color: ");

  d3.select("div.blocks-color")
    .append("p")
    .append("select")
    .attr("class", "form-control")
    .html(() =>
      Object.keys(CONNECTION_COLORS).map(function(current) {
        if (current === 'Disabled') return `<option disabled>─────</option>`;
        return `<option value="${current}">${current}</option>`;
      }).join(' ')
    );

  d3.select("div.blocks-color select")
    .on("change", function() {
      // Calling genome view for updates with default transition and no layout udpate
      generateGenomeView({
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: false
      });
    });

  // Genome palette
  d3.select("#form-config .layout-panel")
    .append("div")
    .attr("class", "chromosomes-palette")
    .append("p")
    .text("Genome palette: ");

  // Partitioning gff keys to get the checkboxes division
  const { gffPartitionedDictionary, partitionedGffKeys } = partitionGffKeys(gffKeys);
  const partitionedGffKeysLength = partitionedGffKeys.length;

  d3.select("div.chromosomes-palette")
    .append("p")
    .append("select")
    .attr("class", "form-control")
    .html(() =>
      Object.keys(CATEGORICAL_COLOR_SCALES).map(function(current) {
        if (current === 'Disabled') return '<option disabled>─────</option>';
        // Only adding Multiple key when visualizing multiple genomes
        else if (current === 'Multiple' && partitionedGffKeysLength === 1) return '';
        return `<option value="${current}">${current}</option>`;
      }).join(' ')
    );

  d3.select("div.chromosomes-palette select")
    .on("change", function() {
      const selected = d3.select(this).property("value");
      const colors = d3.scaleOrdinal(CATEGORICAL_COLOR_SCALES[selected]);
      colors.domain(defaultColorDomain);

      if (selected === 'Flipped') {
        setGffDictionary(assignFlippedChromosomeColors({
          colorScale: colors.domain([0, 1]),
          currentFlippedChromosomes: getCurrentFlippedChromosomes(),
          gffKeys: gffKeys,
          gffPositionDictionary: gffPositionDictionary
        }));
      } else if( selected === 'Multiple') {
        const uniqueDomain = [...partitionedGffKeys.keys()]; // Unique domain for multiple chromosomes
        const gffKeysHashDictionary = {}; // Hash dictionary between the identifiers and color domain

        // Assigning the domain and hash for each identifier
        for (let i = 0; i < partitionedGffKeysLength; i++) {
          gffKeysHashDictionary[partitionedGffKeys[i]] = i;
        }

        colors.domain(uniqueDomain);

        for (let i = 0; i < gffKeysLength; i++) {
          // Removing all non-letters from current chr id
          const currentIdentifier = removeNonLettersFromString(gffKeys[i]);
          gffPositionDictionary[gffKeys[i]].color = colors(gffKeysHashDictionary[currentIdentifier]);
        }
      } else {
        // Setting the color for each chromosome with new color scale
        for (let i = 0; i < gffKeysLength; i++) {
          gffPositionDictionary[gffKeys[i]].color = colors(i);
        }
      }

      // For 'Flipped' case the dictionary is already being set
      if (selected !== 'Flipped') setGffDictionary(gffPositionDictionary);

      let shouldUpdate = (d3.event.detail || {}).shouldUpdate;
      // shoulUpdate = null or undefined is true, meaning true by default
      shouldUpdate = shouldUpdate == null ? true : shouldUpdate;
      if (shouldUpdate) {
        // Calling genome view for updates with default transition
        generateGenomeView({
          shouldUpdateBlockCollisions: false
        });
      }
    });

  // Draw blocks ordered by: Block ID or Block length (ascending or descending)
  d3.select("#form-config .layout-panel")
    .append("div")
    .attr("class", "draw-blocks-order")
    .append("p")
    .text("Drawing order: ");

  d3.select("div.draw-blocks-order")
    .append("p")
    .append("select")
    .attr("class", "form-control")
    .html(`
      <option value="Block ID (↑)" selected="selected">Block ID (↑)</option>
      <option value="Block ID (↓)">Block ID (↓)</option>
      <option value="Block length (↑)">Block length (↑)</option>
      <option value="Block length (↓)">Block length (↓)</option>
    `);

  d3.select("div.draw-blocks-order select")
    .on("change", function() {
      // Calling genome view for updates with default transition
      generateGenomeView({
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: false
      });
    });

  // Save layout button
  d3.select("#form-config .layout-panel")
    .append("div")
    .attr("class", "layout-panel-buttons")
    .append("div")
    .attr("class", "save-layout")
    .attr("title", "Save layout");

  // Loading save layout button inside its container
  renderSvgButton({
    buttonContainer: d3.select("#form-config .layout-panel .layout-panel-buttons div.save-layout").node(),
    svgClassName: 'save-layout-svg',
    svgHref: './images/icons.svg#save-sprite_si-ant-save',
    onClickFunction: function() {
      const collisionCount = getCollisionCount();
      const currentFlippedChromosomes = getCurrentFlippedChromosomes();
      const dataChords = getDataChords();
      const dataChromosomes = getDataChromosomes();

      saveToSolutionsDictionary({
        bestFlippedChromosomes: currentFlippedChromosomes,
        bestSolution: dataChromosomes,
        collisionCount: collisionCount,
        dataChords: dataChords
      });
    }
  });

  // Stamps layout button
  d3.select("#form-config .layout-panel .layout-panel-buttons")
    .append("div")
    .attr("class", "stamps-layout")
    .attr("title", "Show saved stamps");

  // Loading stamps layout button and modal inside its container
  ReactDOM.render(
    <Modal
      buttonClassName="stamps-layout-button"
      buttonLabel={
        <svg className="stamps-layout-svg" pointerEvents="none">
          <use
            href="./images/icons.svg#thumbnails-sprite_si-flat-list-small-thumbnails"
            xlinkHref="./images/icons.svg#thumbnails-sprite_si-flat-list-small-thumbnails" />
        </svg>
      }
      modalHeader="Saved stamps">
      {<SavedStamps />}
    </Modal>,
    d3.select("#form-config .layout-panel .layout-panel-buttons div.stamps-layout").node()
  );

  // Reset layout button
  d3.select("#form-config .layout-panel .layout-panel-buttons")
    .append("div")
    .attr("class", "reset-layout")
    .attr("title", "Reset layout connections");

  // Loading reset layout button inside its container
  renderSvgButton({
    buttonContainer: d3.select("#form-config .layout-panel .layout-panel-buttons div.reset-layout").node(),
    svgClassName: 'reset-layout-svg',
    svgHref: './images/icons.svg#reset-sprite_si-bootstrap-refresh',
    onClickFunction: function() {
      const dataChords = getDataChords();
      const dataChromosomes = getDataChromosomes();
      const myCircos = getCircosObject();

      const localDataChromosomes = cloneDeep(dataChromosomes);
      const orderedDataChromosomes =
        generateUpdatedDataChromosomesFromOrder(getDefaultChromosomeOrder().slice(), localDataChromosomes);

      // To introduce start and end properties into dataChromosomes
      myCircos.layout(localDataChromosomes, CIRCOS_CONF);
      myCircos.layout(orderedDataChromosomes, CIRCOS_CONF);

      console.log('OLD AND CURRENT: ', localDataChromosomes, orderedDataChromosomes);

      callSwapPositionsAnimation({
        dataChromosomes: localDataChromosomes,
        bestSolution: orderedDataChromosomes,
        bestFlippedChromosomes: [] // No flipped chromosomes in the default view
      });
    }
  });

  // Decluttering title
  d3.select("#form-config")
    .append("h5")
    .attr("class", "panel-title decluttering-panel-title")
    .text("Decluttering");

  d3.select("#form-config")
    .append("div")
    .attr("class", "panel decluttering-panel");

  // Filter connections input range
  d3.select("#form-config .decluttering-panel")
    .append("div")
    .attr("class", "filter-connections-div")
    .append("div")
    .attr("class", "filter-connections-options")
    .append("p")
    .attr("class", "filter-connections")
    .text("Filter:");

  d3.select(".filter-connections-div .filter-connections-options")
    .append("p")
    .attr("class", "filter-connections")
    .append("select")
    .attr("class", "filter-connections form-control")
    .html(`
      <option value="At Least" selected="selected">At Least</option>
      <option value="At Most">At Most</option>
    `);

  d3.select(".filter-connections-div select.filter-connections")
    .on("change", function() {
      // Calling genome view for updates with default transition
      generateGenomeView({
        shouldUpdateBlockCollisions: true,
        shouldUpdateLayout: true
      });

      resetUndoRedoButtons();
    });

  d3.select(".filter-connections-div .filter-connections-options")
    .append("p")
    .attr("class", "filter-connections")
    .html(`
      <label for="filter-block-size">
        <span id="filter-block-size-value">...</span>
      </label>
    `);

  d3.select(".filter-connections-div")
    .append("p")
    .attr("class", "filter-connections-input")
    .html(`<input type="range" min="1" max=${maxBlockSize.toString()} id="filter-block-size">`);

  // Filter angle input range
  d3.select("#form-config .decluttering-panel")
    .append("div")
    .attr("class", "filter-angle-div")
    .html(`
      <label for="nAngle-genome-view">
        <span>Rotate = </span>
        <span id="nAngle-genome-view-value">…</span>
      </label>
      <p>
        <input type="range" min="0" max="360" id="nAngle-genome-view">
      </p>
    `);

  // Flip/Reset chromosome order (positions)
  d3.select("#form-config .decluttering-panel ")
    .append("div")
    .attr("class", "change-chromosome-positions")
    .append("p")
    .text("Order:");

  d3.select("#form-config .decluttering-panel .change-chromosome-positions")
    .append("p")
    .append("select")
    .attr("class", "flip-reset form-control")
    .html(`
      <option value="Flip">Flip</option>
      <option value="Reset">Reset</option>
    `);

  d3.select("#form-config .decluttering-panel .change-chromosome-positions")
    .append("p")
    .append("select")
    .attr("class", "all-genomes form-control")
    .html(() =>
      partitionedGffKeys.map((current) =>
        `<option value="${current}">${current}</option>`
      ).join(' ')
    );

  d3.select("#form-config .decluttering-panel .change-chromosome-positions")
    .append("p")
    .attr("class", "apply-button")
    .append("input")
    .attr("class", "btn btn-outline-primary")
    .attr("type", "button")
    .attr("value", "Apply")
    .attr("title", "Flips or resets the chromosome order of the selected genome.");

  d3.select("#form-config .decluttering-panel")
    .append("p")
    .attr("class","separator disabled")
    .html("────────────────────");

  // Parameters title inside decluttering panel
  d3.select("#form-config .decluttering-panel")
    .append("p")
    .attr("class", "panel-subtitle")
    .html("<strong>Algorithm parameters</strong>");

  // Keep chromosomes from same genome together checkbox
  if (partitionedGffKeysLength > 1) {
    d3.select("#form-config .decluttering-panel")
      .append("p")
      .attr("class", "keep-chr-together")
      .attr("title", "If selected, chromosomes from the same genome will be kept together when running the decluttering algorithm.")
      .append("label")
      .append("input")
      .attr("type", "checkbox")
      .attr("name", "keep-chr-together")
      .attr("value", "Keep chromosomes from same genome together")
      .property("checked", true); // This checkbox is checked by default

    d3.select("#form-config .keep-chr-together > label")
      .append("span")
      .text("Keep chromosomes from same genome together");
  }

  d3.select("#form-config .decluttering-panel")
    .append("p")
    .attr("class", "calculate-temperature-ratio")
    .attr("title", "If selected, temperature and ratio will be calculated based on the number of block collisions.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "calculate-temperature-ratio")
    .attr("value", "Calculate temperature and ratio based on block collisions")
    .property("checked", true); // This checkbox is checked by default

  d3.select("#form-config .calculate-temperature-ratio > label")
    .append("span")
    .text("Calculate temperature and ratio based on block collisions");

  d3.select("p.calculate-temperature-ratio input")
    .on("change", function() {
      const currentValue = d3.select(this).property("checked");
      const isDisabled = currentValue ? true : null;

      d3.select("#filter-sa-temperature").attr("disabled", isDisabled);
      d3.select("#filter-sa-ratio").attr("disabled", isDisabled);

      if (currentValue) calculateDeclutteringETA();
    });

  // Filter Simulated Annealing temperature
  d3.select("#form-config .decluttering-panel")
    .append("div")
    .attr("class", "filter-sa-temperature-div")
    .html(`
      <label for="filter-sa-temperature">
        <span>Temperature = </span>
        <span id="filter-sa-temperature-value">…</span>
      </label>
      <p>
        <input type="range" min="100" max="200000" step="100" id="filter-sa-temperature" disabled>
      </p>
    `);

  // Filter Simulated Annealing ratio
  d3.select("#form-config .decluttering-panel")
    .append("div")
    .attr("class", "filter-sa-ratio-div")
    .html(`
      <label for="filter-sa-ratio">
        <span>Ratio = </span>
        <span id="filter-sa-ratio-value">…</span>
      </label>
      <p>
        <input type="range" min="0.001" max="0.2" step="0.001" id="filter-sa-ratio" disabled>
      </p>
    `);

  // Filter Simulated Annealing Flipping frequency
  d3.select("#form-config .decluttering-panel")
    .append("div")
    .attr("class", "filter-sa-flipping-frequency-div")
    .html(`
      <label for="filter-sa-flipping-frequency">
        <span>Flipping frequency = </span>
        <span id="filter-sa-flipping-frequency-value">…</span>
      </label>
      <p>
        <input type="range" min="0" max="100" step="1" id="filter-sa-flipping-frequency">
      </p>
    `);

  // Minimize collisions button
  d3.select("#form-config .decluttering-panel")
    .append("div")
    .attr("class", "layout-panel-buttons")
    .append("div")
    .attr("class", "best-guess")
    .attr("title", "Minimize collisions");

  // Loading minimize collisions button inside its container
  renderSvgButton({
    buttonContainer: d3.select("#form-config .decluttering-panel .layout-panel-buttons div.best-guess").node(),
    svgClassName: 'best-guess-svg',
    svgHref: './images/icons.svg#magic-sprite_si-elusive-magic',
    onClickFunction: function() {
      const dataChords = getDataChords();
      const dataChromosomes = getDataChromosomes();

      const totalTime = getCollisionCalculationTime();
      const totalNumberOfIterations = getTotalNumberOfIterations();
      const finalTime = roundFloatNumber(totalTime * totalNumberOfIterations, 2);

      let confirming = true;
      // Taking the calculated time string from the hint
      const timeString = d3.select(".filter-sa-hint").text().split("-")[0].trim();
      if (finalTime >= 120) {
        confirming = confirm(`Are you willing to wait at least "${timeString}" for the calculation to finish?`);
      }

      if (confirming) {
        d3.select("#form-config .decluttering-panel .layout-panel-buttons div.best-guess button")
          .attr("disabled", true);
        simulatedAnnealing(dataChromosomes, dataChords);
      }
    }
  });

  // Undo layout button
  d3.select("#form-config .decluttering-panel .layout-panel-buttons")
    .append("div")
    .attr("class", "undo-layout")
    .attr("title", "Undo layout interactions");

  // Loading undo layout button inside its container
  renderSvgButton({
    buttonContainer: d3.select("#form-config .decluttering-panel .layout-panel-buttons div.undo-layout").node(),
    svgClassName: 'undo-layout-svg',
    svgHref: './images/icons.svg#undo-sprite_si-open-action-undo',
    onClickFunction: function() {
      if (!undoManager.hasUndo()) {
        renderReactAlert(`There are no layout interactions to undo. Only flipping, dragging, and minimizing are supported.
          Please, try again!`, 'danger', 10000);
        return;
      }

      updateUndoRedoButtons();
      undoManager.undo();
    }
  });

  // Redo layout button
  d3.select("#form-config .decluttering-panel .layout-panel-buttons")
    .append("div")
    .attr("class", "redo-layout")
    .attr("title", "Redo layout interactions");

  // Loading redo layout button inside its container
  renderSvgButton({
    buttonContainer: d3.select("#form-config .decluttering-panel .layout-panel-buttons div.redo-layout").node(),
    svgClassName: 'redo-layout-svg',
    svgHref: './images/icons.svg#redo-sprite_si-open-action-redo',
    onClickFunction: function() {
      if (!undoManager.hasRedo()) {
        renderReactAlert(`There are no layout interactions to redo. Only dragging, flipping, and minimizing are supported.
          Please, try again!`, 'danger', 10000);
        return;
      }

      updateUndoRedoButtons();
      undoManager.redo();
    }
  });

  // Additional tracks
  d3.select("#form-config")
  // Additional tracks panel title
    .append("h5")
    .attr("class", "panel-title additional-tracks-panel-title")
    .text("Additional tracks");

  // Additional tracks container
  d3.select("#form-config")
    .append("div")
    .attr("class", "panel additional-tracks-panel")
    .append("div")
    .attr("class", "additional-tracks-panel-container")
    .append("div")
    .attr("class", "tabs")
    .append("div")
    .attr("class", "draggable-tabs");

  // Adding the rest of the menu for the additional tracks
  addAdditionalTracksMenu(getAdditionalTrackArray());

  // Chromosome checkboxes
  d3.select("div.for-chr-boxes")
    .append("div")
    .attr("class", "chr-options col-lg-12");

  // Show all checkbox
  d3.select("#form-config div.chr-options")
    .append("p")
    .attr("class", "show-all")
    .attr("title", "If selected, all chromosomes will show.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-all")
    .attr("value", "Show all")
    .property("checked", true); // Show all is checked by default

  d3.select("#form-config p.show-all > label")
    .append("span")
    .text("Show all chromosomes");

  d3.select("p.show-all input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({});

      resetUndoRedoButtons();
    });

  // Show self connections checkbox
  if (partitionedGffKeysLength > 1) {
    d3.select("#form-config div.chr-options")
      .append("p")
      .attr("class", "panel-subtitle")
      .html("Show self connections within:");
  }

  d3.select("#form-config div.chr-options")
    .append("p")
    .attr("class", "show-self-connections show-self-connections-chr")
    .attr("title", "If selected, chromosomes will show connections with themselves.")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "show-self-connections-chr")
    .attr("value", "Show self connections")
    .property("checked", true); // Show self connections is checked by default

  d3.select("#form-config p.show-self-connections-chr > label")
    .append("span")
    .text(partitionedGffKeysLength > 1 ? "Chromosomes" :
      "Show self connections");

  if (partitionedGffKeysLength > 1) {
    d3.select("#form-config div.chr-options")
      .append("p")
      .attr("class", "show-self-connections show-self-connections-genome")
      .attr("title", "If selected, genomes will show connections with themselves.")
      .append("label")
      .append("input")
      .attr("type", "checkbox")
      .attr("name", "show-self-connections-genome")
      .attr("value", "Show self connections")
      .property("checked", true); // Show self connections is checked by default

    d3.select("#form-config p.show-self-connections-genome > label")
      .append("span")
      .text("Genomes");
  }

  d3.selectAll("p.show-self-connections input")
    .on("change", function() {
      // Calling genome view for updates
      generateGenomeView({});

      resetUndoRedoButtons();
    });

  // Chromosomes title inside connections panel
  d3.select("#form-config div.chr-options")
    .append("p")
    .attr("class","separator disabled")
    .html("────────────────────");

  // Adding the checkbox by using the partitionedGffKeys
  for (let i = 0; i < partitionedGffKeysLength; i++) {
    d3.select("div.for-chr-boxes")
      .append("div")
      .attr("class", `chr-boxes ${partitionedGffKeys[i]} col-lg-6`)
      .selectAll("div.chr-box-inner-content")
      .data(gffPartitionedDictionary[partitionedGffKeys[i]]).enter()
      .append("div")
      .attr("class", "chr-box-inner-content")
      .append("label")
      .append("input")
      .attr("class", (chrKey) => `chr-box ${partitionedGffKeys[i]} ${chrKey}`)
      .attr("type", "checkbox")
      .attr("name", (chrKey) => chrKey)
      .attr("value", (chrKey) => chrKey);

    // Select all button
    d3.select(`div.chr-boxes.${partitionedGffKeys[i]}`)
      .append("p")
      .attr("class", `select-all ${partitionedGffKeys[i]}`)
      .attr("title", "Selects all the connections.")
      .append("input")
      .attr("class", "btn btn-outline-primary")
      .attr("type", "button")
      .attr("value", "Select all");
  }

  d3.select("#form-config")
    .selectAll("div.chr-box-inner-content > label")
    .append("span")
    .attr("class", "chr-box-text")
    .text((chrKey) => chrKey);

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
        d3.select(this).attr("class").split(' ')[1];

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

      let shouldUpdate = (d3.event.detail || {}).shouldUpdate;
      // shoulUpdate = null or undefined is true, meaning true by default
      shouldUpdate = shouldUpdate == null ? true : shouldUpdate;
      if (shouldUpdate) {
        // Calling genome view for updates
        generateGenomeView({});
      }

      resetUndoRedoButtons();
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

      resetUndoRedoButtons();
    });

  // SVG element that will include the Circos plot
  const svg = d3.select("#page-container .row")
    .append("div")
    .attr("class", "col-lg-6 text-center")
    .append("div")
    .attr("class", "genome-view-container")
    .append("svg")
    .attr("id", "genome-view")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

  d3.select("div.genome-view-container")
    .append("div")
    .attr("class", "progress")
    .html(function() {
      return `
        <div class="progress-bar progress-bar-striped"
          role="progressbar"
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


  // More info about collapse: https://www.w3schools.com/howto/howto_js_accordion.asp
  d3.selectAll(".panel-title")
    .on("click", function() {
      const currentNode = d3.select(this).node();
      // Toggle between adding and removing the "active" class,
      // to highlight the title that controls the panel
      currentNode.classList.toggle('active');

      const panel = currentNode.nextElementSibling;

      // Hiding and showing the active panel by changing the max height
      if (panel.style.maxHeight) panel.style.maxHeight = null;
      else panel.style.maxHeight = `${panel.scrollHeight.toString()}px`;

      // Move scroll to the end of the page, if element is not in viewport and
      // maxHeight is defined i.e. the panel is opening
      if (panel.style.maxHeight) {
        setTimeout(() => {
          if (!isInViewport(panel)) {
            movePageContainerScroll("end");
          }
        }, 200);

        const panelText = d3.select(this).text();

        // If opening the decluttering panel, update the state of undo/redo buttons
        if (panelText.includes('Decluttering')) {
          updateUndoRedoButtons();
        }

        // If opening the tracks panel, then click the first tab by default when
        // tabs are available but no tabs are clicked
        if (panelText.includes('Additional tracks') &&
          !d3.select("#form-config .additional-tracks-panel div.tabs button.tab-link").empty() &&
          d3.select("#form-config .additional-tracks-panel div.tabs button.tab-link.active").empty()) {
          d3.select("#form-config .additional-tracks-panel div.tabs button.tab-link").node().click();
        }
      }
    });

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

  // Initial flipping frequency and input event
  updateFlippingFrequency(0);

  d3.select("#filter-sa-flipping-frequency")
    .on("input", function() {
      updateFlippingFrequency(+this.value);
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
      resetUndoRedoButtons();

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

  // Loading loadFiles modal inside its container
  ReactDOM.render(
    <Modal
      buttonLabel="Load files"
      modalHeader="Load files">
      {loadFiles}
    </Modal>,
    document.getElementById('load-files-container')
  );

  // Loading download button modal inside its container
  ReactDOM.render(
    <Modal
      buttonClassName="download-files"
      buttonLabel={
        <div title="Download files">
          <svg className="download-files-svg" pointerEvents="none">
            <use
              href="./images/icons.svg#download-sprite_si-ant-download"
              xlinkHref="./images/icons.svg#download-sprite_si-ant-download" />
          </svg>
        </div>
      }
      modalHeader="Download files"
      size="sm">
      {<DownloadFilesForm />}
    </Modal>,
    d3.select("#download-svg-container").node()
  );

  // Displaying all the content after everything is loaded
  d3.select("#loader")
    .style("display", "none");

  d3.select("#page-container")
    .style("display", "block");

  // Updating the style of the configuration panel
  d3.select("#config")
    .style("display", "block");

  setTimeout(() => {
    // Clicking informational and connections panel by default
    // after the loader spinner animation is done
    d3.select(".information-panel-title").node().click();
    d3.select(".connections-panel-title").node().click();
  }, 300);
};
