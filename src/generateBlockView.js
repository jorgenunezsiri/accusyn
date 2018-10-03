/*
University of Saskatchewan
GSB: A Web-based Genome Synteny Browser
Course: CMPT994 - Research

Name: Jorge Nunez Siri
E-mail: jdn766@mail.usask.ca
NSID: jdn766
Student ID: 11239727

Function file: generateBlockView.js

@2018, Jorge Nunez Siri, All rights reserved
*/

import * as d3 from 'd3';
import cloneDeep from 'lodash/cloneDeep';
import defaultsDeep from 'lodash/defaultsDeep';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';

import {
  getFlippedGenesPosition,
  removeBlockView,
  resetInputsAndSelectsOnAnimation
} from './helpers';

// Variables getters and setters
import { getBlockDictionary } from './variables/blockDictionary';
import {
  getBlockViewZoomStateDictionary,
  setBlockViewZoomStateDictionary
} from './variables/blockViewZoomStateDictionary';
import { getGeneDictionary } from './variables/geneDictionary';
import { getGffDictionary } from './variables/gffDictionary';
import { getCurrentFlippedChromosomes } from './variables/currentFlippedChromosomes';

// Contants
import {
  CONNECTION_COLOR,
  DEFAULT_BLOCK_VIEW_ZOOM_STATE,
  OFFSET_DOMAIN,
  // Block view transition constants
  COLOR_CHANGE_TIME,
  MAX_INDEX_TRANSITION,
  TRANSITION_NORMAL_TIME,
  TRANSITION_FLIPPING_TIME,
  TRANSITION_HEIGHT_DIVISION_MULTIPLE
} from './variables/constants';

/**
 * Generates block view for the current highlighted block in the genome view
 *
 * @param  {Object} data Current data with all source and target chromosome
 *                       information
 * @return {undefined}   undefined
 */
export default function generateBlockView(data) {
  const blockDictionary = getBlockDictionary();
  const geneDictionary = getGeneDictionary();
  const gffPositionDictionary = getGffDictionary();

  const darkMode = d3.select("p.dark-mode input").property("checked");

  const sourceChromosomeID = data.source.id;
  const targetChromosomeID = data.target.id;

  const blockID = data.source.value.id;
  const blockZoomStateDictionary = getBlockViewZoomStateDictionary();
  if (!(blockID in blockZoomStateDictionary)) {
    // Initializing zoom state object
    blockZoomStateDictionary[blockID] = cloneDeep(DEFAULT_BLOCK_VIEW_ZOOM_STATE);
    console.log('\n\nENTERING\n\n', blockZoomStateDictionary, DEFAULT_BLOCK_VIEW_ZOOM_STATE);

    setBlockViewZoomStateDictionary(blockZoomStateDictionary);
  }

  let currentAxisMouseDown = "";
  let offsetYPosition = 0;
  let lastDraggingDistance = 0;

  const margin = {
    top: 50,
    right: 100,
    bottom: 15,
    left: 100
  };

  const widthBlock = 570 - margin.left - margin.right;
  const heightBlock = 900 - margin.top - margin.bottom;

  // Set the ranges for x and y
  const y = [d3.scaleLinear().range([heightBlock, 0]), d3.scaleLinear().range([heightBlock, 0])];
  const x = d3.scalePoint().rangeRound([0, widthBlock]);
  x.domain([0, 1]);

  /**
   * Defines the path for each data point in the block view
   *
   * d3 is looping through each data array
   * i can be either 0 or 1
   * y[i](currentData) is scaling the current value in the dimension
   *
   * @param  {Array<number>}   dataArray Current dataArray with [y0, y1] coordinates
   * @param  {Array<Function>} y         Current array of y scales
   * @return {Array<string>}             Current polygon points defined by the
   *                                     connection of all the start and end points
   */
  function path(dataArray, y) {
    const currentData = dataArray.data;
    return [
      [x(0), y[0](currentData.source.start)].join(","),
      [x(0), y[0](currentData.source.end)].join(","),
      [x(1), y[1](currentData.target.end)].join(","),
      [x(1), y[1](currentData.target.start)].join(",")
    ].join(" ");
  }

  // Remove block view if it is present
  if (!d3.select("#block-view-container").empty()) {
    removeBlockView();
  }

  let gY0, gY1, y0axis, y1axis, onInputChange = false;
  let dataBlock = [];

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.01, 10000])
    .on("zoom", function() {
      if (gY0 && gY1) {
        const blockZoomStateDictionary = getBlockViewZoomStateDictionary();

        blockZoomStateDictionary[blockID].zoom = d3.event.transform;

        // Rescaling axes using current zoom transform
        gY0.call(y0axis.scale(blockZoomStateDictionary[blockID].zoom.rescaleY(y[0])));
        gY1.call(y1axis.scale(blockZoomStateDictionary[blockID].zoom.rescaleY(y[1])));

        // Plotting the lines path using the new scales
        d3.select("svg.block-view g.clip-block-group g")
          .style("transform", `translate(0px,${blockZoomStateDictionary[blockID].zoom.y}px)
            scale(1,${blockZoomStateDictionary[blockID].zoom.k})`);

        console.log('GLOBAL ZOOM: ', blockZoomStateDictionary[blockID].zoom.k);

        setBlockViewZoomStateDictionary(blockZoomStateDictionary);
      }
    });

  /**
   * Resets zoom state and svg for block view
   *
   * @param  {number}    blockID Current block view to reset its state
   * @return {undefined} undefined
   */
  function resetZoomBlockView(blockID) {
    const blockZoomStateDictionary = getBlockViewZoomStateDictionary();
    blockZoomStateDictionary[blockID] = defaultsDeep({
      // Not modifying flipped state when resetting zoom
      flipped: !!(blockZoomStateDictionary[blockID] || {}).flipped
    }, cloneDeep(DEFAULT_BLOCK_VIEW_ZOOM_STATE));

    setBlockViewZoomStateDictionary(blockZoomStateDictionary);

    // Changing zoom scale to default
    d3.select("svg.block-view g.clip-block-group")
      .call(zoom.transform, d3.zoomIdentity.scale(1).translate(0, 0));
  };

  /**
   * Flips the data for the current block view
   *
   * @param  {Array<Object>} dataBlock Current block data array
   * @return {Array<Object>}           Flipped array
   */
  function flipTargetDataBlock(dataBlock) {
    const index = 'target'; // Flipping target by default
    let temp = 0;
    const tempArray = cloneDeep(dataBlock);

    // Only need to swap until size / 2 to flip entirely.
    for (let i = 0; i < tempArray.length / 2; i++) {
      temp = tempArray[i].data[index];
      tempArray[i].data[index] = tempArray[tempArray.length - i - 1].data[index];
      tempArray[tempArray.length - i - 1].data[index] = temp;
    }

    return tempArray;
  }

  // Append block view container to the body of the page
  d3.select("#page-container .row")
    .append("div")
    .attr("id", "block-view-container")
    .attr("class", function() {
      let classes = 'col-lg-4 text-center';
      return darkMode ? 'dark-mode ' + classes : classes;
    })
    .append("div")
    .attr("class", "block-view-content");

  const svgBlock = d3.select("#block-view-container .block-view-content")
    .append("svg")
    .attr("class", "block-view")
    .attr("width", widthBlock + margin.left + margin.right)
    .attr("height", heightBlock + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Outer content with reset button
  d3.select("#block-view-container .block-view-content")
    .append("div")
    .attr("class", "outer-content")
    .append("div")
    .attr("class", "outer-clickable-content")
    .append("p")
    .attr("class", "reset-button")
    .append("input")
    .attr("type", "button")
    .attr("value", "Reset")
    .attr("title", "Resets the block view to its original scale.")
    .on("click", function() {
      // Changing zoom scale to default
      resetZoomBlockView(blockID);

      // Resetting by calling path block view
      generatePathBlockView();
    });

  // Flip orientation checkbox
  d3.select("#block-view-container .outer-clickable-content")
    .append("p")
    .attr("class", "flip-orientation")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "flip-orientation")
    .attr("value", "flip-orientation")
    .property("checked", false);

  d3.select("#block-view-container")
    .select("p.flip-orientation > label")
    .append("span")
    .text("Flip Orientation");

  // Flip hint
  d3.select("#block-view-container .outer-content")
    .append("p")
    .attr("class", "zoom-state-hint")
    .style("opacity", 0)
    .html(function() {
      return '<em>Hint: The scales in this block were changed before.</em>';
    });

  d3.select("#block-view-container")
    .select("p.flip-orientation input")
    .on("change", function() {
      onInputChange = true;

      // Changing zoom scale to default
      resetZoomBlockView(blockID);

      // Calling path block view for updates
      generatePathBlockView();
    });

  if (!isEqual(blockZoomStateDictionary[blockID], DEFAULT_BLOCK_VIEW_ZOOM_STATE)) {
    // If the zoom state is not default, then show hint (opacity 1)
    d3.select("#block-view-container .zoom-state-hint")
      .style("opacity", 0)
      .transition()
      .duration(500)
      .ease(d3.easeLinear)
      .style("opacity", 1);
  }

  // Defining a clip-path so that lines always stay inside the block view,
  // thus paths will be clipped when zooming
  const clip = svgBlock.append("defs svg:clipPath")
    .attr("id", "clip-block")
    .append("svg:rect")
    .attr("id", "clip-rect-block")
    .attr("width", widthBlock)
    .attr("height", heightBlock);

  // Data from current block
  const blockArray = blockDictionary[blockID];

  // Assuming source and target chromosomes are the same in all blocks
  // Thus, only need to check for the first one
  const { sourceChromosome, targetChromosome } = blockArray[0];
  const currentFlippedChromosomes = getCurrentFlippedChromosomes();
  const isFlippedSource = currentFlippedChromosomes.indexOf(sourceChromosome) !== (-1);
  const isFlippedTarget = currentFlippedChromosomes.indexOf(targetChromosome) !== (-1);

  for (let i = 0; i < blockArray.length; i++) {
    const blockSource = blockArray[i].connectionSource;
    const blockTarget = blockArray[i].connectionTarget;
    const connectionID = blockArray[i].connection;
    let { start: sourceStart, end: sourceEnd } = geneDictionary[blockSource];
    let { start: targetStart, end: targetEnd } = geneDictionary[blockTarget];
    const eValueConnection = blockArray[i].eValueConnection;

    if (isFlippedSource) {
      // Flipping the connections and changing the scales of the source axis
      const { start, end } = getFlippedGenesPosition(gffPositionDictionary[sourceChromosome], {
        start: sourceStart,
        end: sourceEnd
      });
      sourceStart = start;
      sourceEnd = end;
    }

    if (isFlippedTarget) {
      // Flipping the connections and changing the scales of the target axis
      const { start, end } = getFlippedGenesPosition(gffPositionDictionary[targetChromosome], {
        start: targetStart,
        end: targetEnd
      });
      targetStart = start;
      targetEnd = end;
    }

    // Points are the determined using a polygon from the start to the end
    // Dividing into matrix for source and target, so flipping can work by only flipping target
    const currentData = {
      source: {
        start: sourceStart,
        end: sourceEnd
      },
      target: {
        start: targetStart,
        end: targetEnd
      }
    };

    dataBlock.push({
      source: {
        id: blockSource,
        start: sourceStart,
        end: sourceEnd
      },
      target: {
        id: blockTarget,
        start: targetStart,
        end: targetEnd
      },
      data: currentData,
      connection: connectionID,
      eValue: eValueConnection
    });
  }

  /**
   * Generates all paths in the blockView using the current selected
   * block in the genomeView
   *
   * @return {undefined} undefined
   */
  function generatePathBlockView() {
    /**
     * Determines the minimum value in the current block scale
     *
     * @param  {number} d The number of the scale: y0 or y1
     * @return {number}   Minimum value
     */
    function minData(d) {
      const reference = d === 0 ? 'source' : 'target';
      let minValue = Number.MAX_SAFE_INTEGER;
      for (let i = 0; i < dataBlock.length; i++) {
        minValue = Math.min(minValue, dataBlock[i].data[reference].start,
          dataBlock[i].data[reference].end);
      }

      return minValue;
    }

    /**
     * Determines the maximum value in the current block scale
     *
     * @param  {number} d The number of the scale: y0 or y1
     * @return {number}   Maximum value
     */
    function maxData(d) {
      const reference = d === 0 ? 'source' : 'target';
      let maxValue = 0;
      for (let i = 0; i < dataBlock.length; i++) {
        maxValue = Math.max(maxValue, dataBlock[i].data[reference].start,
          dataBlock[i].data[reference].end);
      }

      return maxValue;
    }

    if (onInputChange) {
      // Disabling inputs and selects before calling the animation
      resetInputsAndSelectsOnAnimation(true);

      // Assigning flipped state to true if checkbox is selected, otherwise false
      const blockZoomStateDictionary = getBlockViewZoomStateDictionary();
      blockZoomStateDictionary[blockID].flipped = d3.select("p.flip-orientation input").property("checked");
      setBlockViewZoomStateDictionary(blockZoomStateDictionary);

      // Change paths color to lightblue
      svgBlock.selectAll("polygon.line")
        .transition()
        .duration(COLOR_CHANGE_TIME)
        .ease(d3.easeLinear)
        .attr("fill", "lightblue");

      // Flipping transition
      let transitionTime = COLOR_CHANGE_TIME;
      let transitionHeightDivision = 1;
      let summing = true;

      // 2 - 4 - 8 - 16 - 32 - 64
      // Flip here and sum flipping time
      // 64 - 32 - 16 - 8 - 4 - 2

      // Only break loop when summing is false && transitionHeightDivision == 1
      // summing || transitionHeightDivision != 1
      // Or when indexTransition == 14
      for (let indexTransition = 1; indexTransition <= MAX_INDEX_TRANSITION; indexTransition++) {
        if (indexTransition == 7) {
          summing = false;
          transitionHeightDivision = 128;
          transitionTime += TRANSITION_FLIPPING_TIME;
        } else {
          transitionTime += TRANSITION_NORMAL_TIME;
        }

        if (summing) {
          transitionHeightDivision *= TRANSITION_HEIGHT_DIVISION_MULTIPLE;
        } else {
          transitionHeightDivision /= TRANSITION_HEIGHT_DIVISION_MULTIPLE;
        }

        console.log('TRANSITION TIME: ', transitionTime);
        console.log('TRANSITION HEIGHT DIVISION: ', transitionHeightDivision);
        console.log('INDEX TRANSITION: ', indexTransition);
        console.log('SUMMING: ', summing);
        console.log('\n');

        // More info: https://stackoverflow.com/a/37728255
        (function(indexTransition, transitionTime, transitionHeightDivision) {
          setTimeout(function() {
            let offsetTransition = 0;
            /*
             * 1 -> 2
             * 2 -> 4
             * 3 -> 8
             * 4 -> 16
             * 5 -> 32
             * 6 -> 64
             * 7 -> 128 -> 64
             * 8 -> 32
             * 9 -> 16
             * 10 -> 8
             * 11 -> 4
             * 12 -> 2
             * 13 -> 1
             */

            if (transitionHeightDivision >= 2) {
              offsetTransition = (heightBlock - (heightBlock / transitionHeightDivision)) / 2;
            }

            console.log('HEIGHT BLOCK: ', heightBlock, offsetTransition, transitionHeightDivision);

            // Creating new scales for y1 to improve the flipping transition
            const minimumRange = offsetTransition + ((heightBlock - offsetTransition) / transitionHeightDivision);
            const maximumRange = offsetTransition;
            const newY = [y[0], d3.scaleLinear().range([minimumRange, maximumRange])];
            newY[0].domain([minData(0) - OFFSET_DOMAIN, maxData(0) + OFFSET_DOMAIN]);
            newY[1].domain([minData(1) - OFFSET_DOMAIN, maxData(1) + OFFSET_DOMAIN]);

            gY1 = gY1.call(d3.axisRight(newY[1]).tickSize(20).ticks(10));

            // Plotting the lines path using the new scales
            svgBlock.selectAll("polygon.line")
              .data(dataBlock)
              .attr("points", function(data) {
                return path(data, newY);
              });

            if (indexTransition == 7) {
              dataBlock = flipTargetDataBlock(dataBlock);
            }
          }, transitionTime);
        })(indexTransition, transitionTime, transitionHeightDivision);
      }
    }

    /**
     * Draws all the paths for the block view
     *
     * @return {undefined} undefined
     */
    function drawPathBlockView() {

      // Remove old paths if they are present
      if (!svgBlock.selectAll("polygon.line").empty()) {
        svgBlock.select("g.clip-block-group").remove(); // Removing complete clip block group
      }

      const blockZoomStateDictionary = getBlockViewZoomStateDictionary();

      if (isEqual(blockZoomStateDictionary[blockID], DEFAULT_BLOCK_VIEW_ZOOM_STATE)) {
        // If the zoom state is default and the hint is showing, then hide it (opacity 0)
        if (d3.select("#block-view-container .zoom-state-hint").style("opacity") == 1) {
          d3.select("#block-view-container .zoom-state-hint")
            .style("opacity", 1)
            .transition()
            .duration(500)
            .ease(d3.easeLinear)
            .style("opacity", 0);
        }
      }

      // Y scale domains using minimum, maximum and offsetDomain values
      if (!isEmpty(blockZoomStateDictionary) && !isEmpty(blockZoomStateDictionary[blockID]) &&
        !isEmpty(blockZoomStateDictionary[blockID].y0) && !isEmpty(blockZoomStateDictionary[blockID].y1)) {
        y[0].domain(blockZoomStateDictionary[blockID].y0.domain());
        y[1].domain(blockZoomStateDictionary[blockID].y1.domain());
      } else {
        y[0].domain([minData(0) - OFFSET_DOMAIN, maxData(0) + OFFSET_DOMAIN]);
        y[1].domain([minData(1) - OFFSET_DOMAIN, maxData(1) + OFFSET_DOMAIN]);
      }

      // If block is flipped and checkbox is not checked, then flip it
      if (blockZoomStateDictionary[blockID].flipped &&
          !d3.select("p.flip-orientation input").property("checked")) {
        dataBlock = flipTargetDataBlock(dataBlock);
        d3.select("p.flip-orientation input").property("checked", true);
      }

      // Rectangle that has the block view size to catch any zoom event
      // This is needed outside the clip-path to cath the events easily
      const zoomView = svgBlock.append("g")
        .attr("class", "clip-block-group")
        .attr("clip-path", "url(#clip-block)")
        .append("rect")
        .attr("class", "rect-clip-block")
        .attr("width", widthBlock)
        .attr("height", heightBlock);

      // Add new paths inside the block
      svgBlock.select("g.clip-block-group")
        .append("g")
        .selectAll("polygon")
        .data(dataBlock).enter()
        .append("polygon")
        .attr("class", "line")
        .attr("points", function(data) {
          return path(data, y);
        })
        .attr("opacity", "0.7");

      // To keep track of the value of the color blocks checkbox
      const coloredBlocks = d3.select("p.color-blocks input").property("checked");

      const pathLineColor = coloredBlocks ? gffPositionDictionary[sourceChromosomeID].color : CONNECTION_COLOR;

      if (!onInputChange) {
        svgBlock.selectAll("polygon.line")
          .attr("fill", darkMode ? "#222222" : "#ffffff")
          .transition()
          .duration(500)
          .ease(d3.easeLinear)
          .attr("fill", pathLineColor);
      } else {
        svgBlock.selectAll("polygon.line")
          .attr("fill", "lightblue")
          .transition()
          .duration(COLOR_CHANGE_TIME)
          .ease(d3.easeLinear)
          .attr("fill", pathLineColor);

        // Enabling inputs and selects after calling the animation
        resetInputsAndSelectsOnAnimation();
      }

      // Add the Circos tooltip
      const tooltipDiv = d3.select("div.circos-tooltip")
        .style("opacity", 0);

      svgBlock.selectAll("polygon.line")
        .on("mouseover", function(d, i, nodes) {
          // Only activate if axis mouse down is not set
          if (currentAxisMouseDown !== "") return;

          tooltipDiv.transition().style("opacity", 0.9);

          tooltipDiv.html(function() {
              return `<h6 style="margin-bottom: 0;">${d.source.id}</h6>
                      ➤
                      <h6 style="margin-top: 0;">${d.target.id}</h6>
                      <h6><u>Connection information</u></h6>
                      <h6>ID: ${d.connection}</h6>
                      <h6>E-value: ${d.eValue}</h6>`;
            })
            .style("left", `${(d3.event.pageX)}px`)
            .style("top", `${(d3.event.pageY - 28)}px`);

          if (d3.selectAll(nodes).attr("opacity") !== 0.3) {
            d3.selectAll(nodes).attr("opacity", 0.3);
            d3.select(nodes[i]).attr("opacity", 0.9);
          }
        })
        .on("mouseout", function(d, i, nodes) {
          // Only activate if axis mouse down is not set
          if (currentAxisMouseDown !== "") return;

          tooltipDiv.transition()
            .duration(500)
            .style("opacity", 0);

          if (d3.selectAll(nodes).attr("opacity") !== 0.7) {
            d3.selectAll(nodes).attr("opacity", 0.7);
          }
        });

      // Add the Y0 Axis
      y0axis = d3.axisLeft(y[0]).tickSize(20);

      // Remove axisY0 if it is present
      if (!svgBlock.selectAll("g.axisY0").empty()) {
        svgBlock.selectAll("g.axisY0").remove();
      }

      gY0 = svgBlock.append("g")
        .attr("class", "axisY0")
        .call(y0axis.ticks(10))
        .attr("fill", function() {
          return gffPositionDictionary[sourceChromosomeID].color;
        });

      // Add the Y1 Axis
      y1axis = d3.axisRight(y[1]).tickSize(20);

      // Remove axisY1 if it is present
      if (!svgBlock.selectAll("g.axisY1").empty()) {
        svgBlock.selectAll("g.axisY1").remove();
      }

      gY1 = svgBlock.append("g")
        .attr("class", "axisY1")
        .attr("transform", `translate(${widthBlock},0)`)
        .call(y1axis.ticks(10))
        .attr("fill", function() {
          return gffPositionDictionary[targetChromosomeID].color;
        });

      // Use these rectangles to be able to select anywhere inside the scales,
      // in order to drag them
      const zoomViewY0 = svgBlock.select("g.axisY0")
        .append("rect")
        .attr("class", "rect-clip-block axisY0")
        .attr("width", margin.left)
        .attr("height", heightBlock)
        .attr("transform", `translate(${-margin.left},0)`);

      const zoomViewY1 = svgBlock.select("g.axisY1")
        .append("rect")
        .attr("class", "rect-clip-block axisY1")
        .attr("width", margin.right)
        .attr("height", heightBlock);

      // On mousedown inside the axis rectangles, assign axis ID
      d3.selectAll("rect.axisY0,rect.axisY1")
        .on("mousedown", function() {
          currentAxisMouseDown = d3.select(this).attr("class").split(" ")[1];
        });

      // Axis drag handler
      const dragHandler = d3.drag()
        .on("start", function() {
          // If axis mouse down is not set, then return because I'm not selecting any axis
          if (currentAxisMouseDown === "") return;
          // Getting mouse position
          const positionY = d3.mouse(d3.select("div#block-view-container svg.block-view").node())[1];
          offsetYPosition = positionY;

          // Highlighting current axis
          d3.select(`g.${currentAxisMouseDown}`)
            .style("stroke", "#ea4848")
            .style("stroke-width", "1px");
        })
        .on("drag", function() {
          // If axis mouse down is not set, then return because I'm not selecting any axis
          if (currentAxisMouseDown === "") return;

          // Getting mouse position
          const positionY = d3.mouse(d3.select("div#block-view-container svg.block-view").node())[1];

          // Dragging distance is the difference between current and starting position
          let draggingDistance = positionY - offsetYPosition;

          // Assign new starting position if I'm currently dragging and I decide to change direction
          if (draggingDistance > 0 && draggingDistance < lastDraggingDistance ||
            draggingDistance < 0 && draggingDistance > lastDraggingDistance) {
              offsetYPosition = positionY;
              draggingDistance = 0;
          }

          console.log('POSITION: ', positionY, offsetYPosition);
          console.log('DRAGGING DISTANCE: ', draggingDistance);
          console.log('DRAGGING', currentAxisMouseDown);

          const blockZoomStateDictionary = getBlockViewZoomStateDictionary();

          let actualDistance = 0;
          // Dividing factor is given by the current zoom scale
          let dividingFactor = blockZoomStateDictionary[blockID].zoom.k * 20;
          console.log('DIVIDING FACTOR: ', dividingFactor);

          if (currentAxisMouseDown === 'axisY0') {
            /**
             * Using "invert()" to get the domain values associated with the
             * current and the starting Y position,
             * meaning that the difference between those two values will give me
             * by how much the domain scale needs to change
             */
            const draggingDistanceInverted = (y[0].invert(Math.abs(positionY / dividingFactor)) - y[0].invert(Math.abs(offsetYPosition / dividingFactor))) * (-1);
            console.log('ACTUAL DISTANCE Y0: ', draggingDistanceInverted);

            // Getting current domain
            const currentDomain = y[0].domain();
            // Adding the difference to current domain minimum and maximum values
            y[0] = y[0].domain([currentDomain[0] + draggingDistanceInverted, currentDomain[1] + draggingDistanceInverted]);
            // Re-defining axis with new domain
            y0axis = d3.axisLeft(y[0]).tickSize(20);
            // Scaling the axis in the block view
            gY0.call(y0axis.scale(blockZoomStateDictionary[blockID].zoom.rescaleY(y[0])));
          } else if (currentAxisMouseDown === 'axisY1') {
            const draggingDistanceInverted = (y[1].invert(Math.abs(positionY / dividingFactor)) - y[1].invert(Math.abs(offsetYPosition / dividingFactor))) * (-1);

            const currentDomain = y[1].domain();
            y[1] = y[1].domain([currentDomain[0] + draggingDistanceInverted, currentDomain[1] + draggingDistanceInverted]);
            y1axis = d3.axisRight(y[1]).tickSize(20);
            gY1.call(y1axis.scale(blockZoomStateDictionary[blockID].zoom.rescaleY(y[1])));
          }

          // Saving the axis state in the dictionary
          blockZoomStateDictionary[blockID].y0 = cloneDeep(y[0]);
          blockZoomStateDictionary[blockID].y1 = cloneDeep(y[1]);

          setBlockViewZoomStateDictionary(blockZoomStateDictionary);

          d3.selectAll("polygon.line")
            .attr('points', function (d) {
              let currentPoints = d3.select(this).attr('points').split(" "),
              first_pair = currentPoints[0].split(","),
              second_pair = currentPoints[1].split(","),
              third_pair = currentPoints[2].split(","),
              fourth_pair = currentPoints[3].split(",");

              actualDistance = draggingDistance / dividingFactor;

              // Adding dragging distance to the polygon points
              if (currentAxisMouseDown === 'axisY0') {
                first_pair[1] = Number(first_pair[1]) + actualDistance;
                second_pair[1] = Number(second_pair[1]) + actualDistance;
              } else if (currentAxisMouseDown === 'axisY1') {
                third_pair[1] = Number(third_pair[1]) + actualDistance;
                fourth_pair[1] = Number(fourth_pair[1]) + actualDistance;
              }

              return [
                first_pair.join(","),
                second_pair.join(","),
                third_pair.join(","),
                fourth_pair.join(",")
              ].join(" ");
            });

            // Saving dragging distance to know dragging direction (up or down)
            lastDraggingDistance = draggingDistance;
        })
        .on("end", function() {
          // If axis mouse down is not set, then return because I'm not selecting any axis
          if (currentAxisMouseDown === "") return;
          console.log('END', currentAxisMouseDown);

          // Remove stroke highlight from axis
          d3.select(`g.${currentAxisMouseDown}`)
            .style("stroke", "none");

          // Resetting current axis mouse down
          currentAxisMouseDown = "";
        });

      // Attaching drag handler to block view
      d3.select("div#block-view-container svg.block-view").call(dragHandler);

      // Resetting variable
      onInputChange = false;

      // Calling zoom for the block group, so it works for every path
      // Changing zoom to saved state
      d3.select("svg.block-view g.clip-block-group")
        .call(zoom)
        .call(zoom.transform, getBlockViewZoomStateDictionary()[blockID].zoom);
    }

    console.log('TOTAL TIME: ', COLOR_CHANGE_TIME + (TRANSITION_NORMAL_TIME * MAX_INDEX_TRANSITION) + TRANSITION_FLIPPING_TIME);
    if (onInputChange) {
      setTimeout(drawPathBlockView,
        (COLOR_CHANGE_TIME + (TRANSITION_NORMAL_TIME * MAX_INDEX_TRANSITION) + TRANSITION_FLIPPING_TIME));
    } else {
      drawPathBlockView();
    }
  }

  generatePathBlockView();

  // Add the Y0 Axis label text with source chromosome ID
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (heightBlock / 2))
    .attr("dy", "1em")
    .text(sourceChromosomeID);

  // Add the Y1 Axis label text with target chromosome ID
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(90)")
    .attr("y", 0 - widthBlock - margin.right)
    .attr("x", (heightBlock / 2))
    .attr("dy", "1em")
    .text(targetChromosomeID);

  // Add the Chart title
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("x", (widthBlock / 2))
    .attr("y", 0 - (margin.top / 3))
    .text(`${sourceChromosomeID} vs. ${targetChromosomeID} - Block ${d3.format(",")(blockID)}`);
}
