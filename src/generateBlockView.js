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

import {
  getFlippedGenesPosition,
  removeBlockView,
  resetInputsAndSelectsOnAnimation
} from './helpers';

// Variables getters and setters
import { getBlockDictionary } from './variables/blockDictionary';
import { getGeneDictionary } from './variables/geneDictionary';
import { getGffDictionary } from './variables/gffDictionary';
import { getCurrentFlippedChromosomes } from './variables/currentFlippedChromosomes';

// Contants
import {
  CONNECTION_COLOR,
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

  const margin = {
    top: 50,
    right: 90,
    bottom: 15,
    left: 90
  };
  const widthBlock = 550 - margin.left - margin.right;
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

  let gY0, gY1, y0axis, y1axis, isFlipped = false,
    onInputChange = false;
  let dataBlock = [];

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
    .attr("class", "flip-hint")
    .style("opacity", 0)
    .html(function() {
      return '<em>Hint: This block is perfectly inverted.</em>';
    });

  d3.select("#block-view-container")
    .select("p.flip-orientation input")
    .on("change", function() {
      isFlipped = d3.select(this).property("checked");
      onInputChange = true;

      // Calling path block view for updates
      generatePathBlockView();
    });

  // Rectangle that has the block view size to catch any zoom event
  // This is needed outside the clip-path to cath the events easily
  const zoomView = svgBlock.append("rect")
    .attr("class", "rect-clip-block")
    .attr("width", widthBlock)
    .attr("height", heightBlock);

  // Defining a clip-path so that lines always stay inside the block view,
  // thus paths will be clipped when zooming
  const clip = svgBlock.append("defs svg:clipPath")
    .attr("id", "clip-block")
    .append("svg:rect")
    .attr("id", "clip-rect-block")
    .attr("width", widthBlock)
    .attr("height", heightBlock);

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.01, 1000])
    .on("zoom", function() {
      if (gY0 && gY1) {
        const zoomTransform = d3.event.transform;

        // Rescaling axes using current zoom transform
        gY0.call(y0axis.scale(zoomTransform.rescaleY(y[0])));
        gY1.call(y1axis.scale(zoomTransform.rescaleY(y[1])));

        // Creating new scales (y0, y1) that incorporate current zoom transform
        const newY = [zoomTransform.rescaleY(y[0]), zoomTransform.rescaleY(y[1])];

        // Plotting the lines path using the new scales
        svgBlock.selectAll("polygon.line")
          .data(dataBlock)
          .attr("points", function(data) {
            return path(data, newY);
          });
      }
    });

  const currentFlippedChromosomes = getCurrentFlippedChromosomes();

  // Data from current block
  const blockArray = blockDictionary[blockID];

  // Assuming source and target chromosomes are the same in all blocks
  // Thus, only need to check for the first one
  const { sourceChromosome, targetChromosome } = blockArray[0];
  const isFlippedSource = currentFlippedChromosomes.indexOf(sourceChromosome) !== (-1);
  const isFlippedTarget = currentFlippedChromosomes.indexOf(targetChromosome) !== (-1);

  for (let i = 0; i < blockArray.length; i++) {
    const blockSource = blockArray[i].connectionSource;
    const blockTarget = blockArray[i].connectionTarget;
    const connectionID = blockArray[i].connection;
    let { start: sourceStart, end: sourceEnd } = geneDictionary[blockSource];
    let { start: targetStart, end: targetEnd } = geneDictionary[blockTarget];
    const eValueConnection = blockArray[i].eValueConnection;
    const isFlipped = blockArray.blockPositions.isFlipped;

    if (isFlippedSource) {
      const { start, end } = getFlippedGenesPosition(gffPositionDictionary[sourceChromosome], {
        start: sourceStart,
        end: sourceEnd
      });
      sourceStart = start;
      sourceEnd = end;
    }

    if (isFlippedTarget) {
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
      isFlipped: isFlipped,
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

    // Hint label about perfectly inverted
    const d3HintElement = d3.select("#block-view-container .flip-hint");

    if (!isFlipped) {
      if (dataBlock[0].isFlipped) {
        // If flip orientation is not selected, and the data block is perfectly
        // flipped, then show hint (opacity 1)
        d3HintElement
          .style("opacity", 0)
          .transition()
          .duration(500)
          .ease(d3.easeLinear)
          .style("opacity", 1);
      }
    } else {
      if (d3HintElement.style("opacity") == 1) {
        d3HintElement
          .style("opacity", 1)
          .transition()
          .duration(500)
          .ease(d3.easeLinear)
          .style("opacity", 0);
      }
    }

    if (onInputChange) {
      // Disabling inputs and selects before calling the animation
      resetInputsAndSelectsOnAnimation(true);

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

            // Remove axisY1 if it is present
            if (!svgBlock.selectAll("g.axisY1").empty()) {
              svgBlock.selectAll("g.axisY1").remove();
            }

            gY1 = svgBlock.append("g")
              .attr("class", "axisY1")
              .attr("transform", `translate(${widthBlock},0)`)
              .call(d3.axisRight(newY[1]).tickSize(15).ticks(10))
              .attr("fill", function() {
                return gffPositionDictionary[sourceChromosomeID].color;
              });

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

      // Y scale domains using minimum, maximum and offsetDomain values
      y[0].domain([minData(0) - OFFSET_DOMAIN, maxData(0) + OFFSET_DOMAIN]);
      y[1].domain([minData(1) - OFFSET_DOMAIN, maxData(1) + OFFSET_DOMAIN]);

      // Add new paths inside the block
      svgBlock.append("g")
        .attr("class", "clip-block-group")
        .attr("clip-path", "url(#clip-block)")
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
          tooltipDiv.transition()
            .duration(500)
            .style("opacity", 0);

          if (d3.selectAll(nodes).attr("opacity") !== 0.7) {
            d3.selectAll(nodes).attr("opacity", 0.7);
          }
        });

      // Add the Y0 Axis
      y0axis = d3.axisLeft(y[0]).tickSize(15);

      // Remove axisY0 if it is present
      if (!svgBlock.selectAll("g.axisY0").empty()) {
        svgBlock.selectAll("g.axisY0").remove();
      }

      gY0 = svgBlock.append("g")
        .attr("class", "axisY0")
        .call(y0axis.ticks(10))
        .attr("fill", function() {
          return gffPositionDictionary[targetChromosomeID].color;
        });

      // Add the Y1 Axis
      y1axis = d3.axisRight(y[1]).tickSize(15);

      // Remove axisY1 if it is present
      if (!svgBlock.selectAll("g.axisY1").empty()) {
        svgBlock.selectAll("g.axisY1").remove();
      }

      gY1 = svgBlock.append("g")
        .attr("class", "axisY1")
        .attr("transform", `translate(${widthBlock},0)`)
        .call(y1axis.ticks(10))
        .attr("fill", function() {
          return gffPositionDictionary[sourceChromosomeID].color;
        });

      onInputChange = false;

      // Calling zoom for the block, so it works for every path
      // Changing zoom scale to default
      svgBlock
        .call(zoom)
        .call(zoom.transform, d3.zoomIdentity.scale(1));
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

  // Add the Y0 Axis label text
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (heightBlock / 2))
    .attr("dy", "1em")
    .text(targetChromosomeID);

  // Add the Y1 Axis label text
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(90)")
    .attr("y", 0 - widthBlock - margin.right)
    .attr("x", (heightBlock / 2))
    .attr("dy", "1em")
    .text(sourceChromosomeID);

  // Add the Chart title
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("x", (widthBlock / 2))
    .attr("y", 0 - (margin.top / 3))
    .text(`${sourceChromosomeID} vs. ${targetChromosomeID} - Block ${d3.format(",")(blockID)}`);
}
