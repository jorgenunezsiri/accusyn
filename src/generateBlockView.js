// D3
import {
  axisLeft as d3AxisLeft,
  axisRight as d3AxisRight,
} from 'd3-axis';

import { drag as d3Drag } from 'd3-drag';
import { easeLinear as d3EaseLinear } from 'd3-ease';
import { format as d3Format } from 'd3-format';

import {
  scalePoint as d3ScalePoint,
  scaleLinear as d3ScaleLinear
} from 'd3-scale';

import {
  event as d3Event,
  mouse as d3Mouse,
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3-selection';

import {
  zoom as d3Zoom,
  zoomIdentity as d3ZoomIdentity
} from 'd3-zoom';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import defaultsDeep from 'lodash/defaultsDeep';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';

// Helpers
import { getBlockColor } from './genomeView/generateGenomeView';
import {
  renderSvgButton,
  removeBlockView,
  resetInputsAndSelectsOnAnimation
} from './helpers';

// Variable getters and setters
import { getBlockDictionary } from './variables/blockDictionary';
import {
  getBlockViewStateDictionary,
  setBlockViewStateDictionary
} from './variables/blockViewStateDictionary';
import { getGeneDictionary } from './variables/geneDictionary';
import { getGffDictionary } from './variables/gffDictionary';

// Contants
import {
  DEFAULT_BLOCK_VIEW_STATE,
  DEFAULT_GENOME_TRANSITION_TIME,
  OFFSET_DOMAIN,
  // Block view transition constants
  COLOR_CHANGE_TIME,
  MAX_INDEX_TRANSITION,
  REMOVE_BLOCK_VIEW_TRANSITION_TIME,
  TRANSITION_NORMAL_TIME,
  TRANSITION_FLIPPING_TIME,
  TRANSITION_HEIGHT_DIVISION_MULTIPLE
} from './variables/constants';

/**
 * Resets state for block view
 *
 * @param  {number}    blockID Current block view to reset its state
 * @return {undefined} undefined
 */
function resetBlockViewState(blockID) {
  const blockStateDictionary = getBlockViewStateDictionary();

  if (isEqual(blockStateDictionary[blockID], DEFAULT_BLOCK_VIEW_STATE)) return;

  // Resetting block state object
  blockStateDictionary[blockID] = defaultsDeep({
    // Not modifying default axes domain and flipped state when resetting zoom
    defaultY0Domain: (blockStateDictionary[blockID] || {}).defaultY0Domain,
    defaultY1Domain: (blockStateDictionary[blockID] || {}).defaultY1Domain,
    flipped: !!(blockStateDictionary[blockID] || {}).flipped
  }, cloneDeep(DEFAULT_BLOCK_VIEW_STATE));

  setBlockViewStateDictionary(blockStateDictionary);
};

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

  const darkMode = d3Select("p.dark-mode input").property("checked");

  const {
    source: { id: sourceChromosomeID, value: { id: blockID, isFlipped } },
    target: { id: targetChromosomeID }
  } = data;

  let blockColor = getBlockColor({
    sourceID: sourceChromosomeID,
    targetID: targetChromosomeID,
    isFlipped
  });

  const sourceChromosomeColor = gffPositionDictionary[sourceChromosomeID].color;
  const targetChromosomeColor = gffPositionDictionary[targetChromosomeID].color;

  const blockStateDictionary = getBlockViewStateDictionary();
  if (!(blockID in blockStateDictionary)) {
    // Initializing block state object
    blockStateDictionary[blockID] = cloneDeep(DEFAULT_BLOCK_VIEW_STATE);
    setBlockViewStateDictionary(blockStateDictionary);
  }

  let currentAxisMouseDown = "";
  let offsetYPosition = 0;
  let lastDraggingDistance = 0;

  const margin = {
    top: 35,
    right: 90,
    bottom: 10,
    left: 90
  };

  const widthBlock = 420 - margin.left - margin.right;
  const heightBlock = 600 - margin.top - margin.bottom;

  // Set the ranges for x and y
  const y = [d3ScaleLinear().range([heightBlock, 0]), d3ScaleLinear().range([heightBlock, 0])];
  const x = d3ScalePoint().rangeRound([0, widthBlock]);
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
   * @param  {boolean}         flipped   Whether or not the block is flipped
   * @return {Array<string>}             Current polygon points defined by the
   *                                     connection of all the start and end points
   */
  function path(dataArray, y, flipped = false) {
    const currentData = dataArray.data;
    const firstPair = [x(0), y[0](currentData.source.start)].join(','),
      secondPair = [x(0), y[0](currentData.source.end)].join(','),
      thirdPair = [x(1), y[1](currentData.target.end)].join(','),
      fourthPair = [x(1), y[1](currentData.target.start)].join(',');

    if (flipped) return [firstPair, secondPair, fourthPair, thirdPair].join(' ');

    return [firstPair, secondPair, thirdPair, fourthPair].join(' ');
  };

  // Remove block view if it is present
  if (!d3Select("#block-view-container").empty()) {
    removeBlockView();
  }

  let gY0, gY1, y0axis, y1axis, onInputChange = false, isZooming = false;
  let dataBlock = [];

  /**
   * Determines if block view state is the default state
   *
   * @param  {Object}  dictionary   Dictionary object in current block position
   * @param  {Object}  defaultState Default state object
   * @return {boolean}              True if same as default, false otherwise
   */
  function isBlockStateDefault(dictionary, defaultState) {
    let isDefault = isEqual(dictionary.zoom, defaultState.zoom) &&
      isEqual(dictionary.flipped, defaultState.flipped);

    // If the axes domain is not defined, then do not take it into account
    if (isEmpty(dictionary.y0Domain) || isEmpty(dictionary.y1Domain)) {
      return isDefault && isEqual(y[0].domain(), dictionary.defaultY0Domain) &&
        isEqual(y[1].domain(), dictionary.defaultY1Domain);;
    }

    return isDefault && isEqual(dictionary.y0Domain, dictionary.defaultY0Domain) &&
      isEqual(dictionary.y1Domain, dictionary.defaultY1Domain);
  };

  /**
   * Shows block state hint to let the user know that the scales have been changed
   *
   * @return {undefined} undefined
   */
  function showBlockStateHint() {
    const blockStateDictionary = getBlockViewStateDictionary();

    if (!isBlockStateDefault(blockStateDictionary[blockID], DEFAULT_BLOCK_VIEW_STATE)) {
      // If the block state is not default, then show hint (opacity 1)
      d3Select("#block-view-container .block-state-hint")
        .style("opacity", function() {
          if (d3Select(this).style("opacity") == 0) return 0;
          return 1; // If hint is already set, don't show transition
        })
        .transition()
        .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
        .ease(d3EaseLinear)
        .style("opacity", 1);
    } else {
      // If the block state is default and the hint is showing, then hide it (opacity 0)
      d3Select("#block-view-container .block-state-hint")
        .style("opacity", function() {
          if (d3Select(this).style("opacity") == 1) return 1;
          return 0; // If hint is already not set, don't show transition
        })
        .transition()
        .duration(REMOVE_BLOCK_VIEW_TRANSITION_TIME)
        .ease(d3EaseLinear)
        .style("opacity", 0);
    }
  };

  /**
   * Applies style to block view axes based on dark mode
   * NOTE: This should be called each time the axes are generated or modified
   *
   * @return {undefined} undefined
   */
  function applyStyleToAxes() {
    const darkMode = d3Select("p.dark-mode input").property("checked");

    d3SelectAll("svg.block-view .axisY0 g.tick text,svg.block-view .axisY1 g.tick text")
      .attr("fill", darkMode ? "#f3f3f3" : "#000000");

    d3SelectAll("svg.block-view .axisY0 g.tick line,svg.block-view .axisY1 g.tick line")
      .attr("stroke", darkMode ? "#f3f3f3" : "#000000");

    d3SelectAll("svg.block-view .axisY0 g.tick line,svg.block-view .axisY1 g.tick line")
      .attr("stroke-width", "2px");

    d3SelectAll("svg.block-view g.tick text")
      .attr("font-size", "10");
  };

  // Zoom behavior
  const zoom = d3Zoom()
    .scaleExtent([0.01, 10000])
    .on("start", function() {
      // Activate if SA is not running
      if (d3Select(".best-guess > button").attr("disabled")) return;

      isZooming = true;
    })
    .on("zoom", function() {
      // Activate if SA is not running and both group axis are defined
      if (d3Select(".best-guess > button").attr("disabled") || !gY0 || !gY1) return;

      const blockStateDictionary = getBlockViewStateDictionary();

      blockStateDictionary[blockID].zoom = d3Event.transform;

      // Rescaling axes using current zoom transform
      gY0.call(y0axis.scale(blockStateDictionary[blockID].zoom.rescaleY(y[0])));
      gY1.call(y1axis.scale(blockStateDictionary[blockID].zoom.rescaleY(y[1])));

      // Plotting the lines path using the new scales
      d3Select("svg.block-view g.clip-block-group g")
        .style("transform", `translate(0px,${blockStateDictionary[blockID].zoom.y}px)
          scale(1,${blockStateDictionary[blockID].zoom.k})`);

      applyStyleToAxes();

      setBlockViewStateDictionary(blockStateDictionary);
    })
    .on("end", function() {
      // Activate if SA is not running
      if (d3Select(".best-guess > button").attr("disabled")) return;

      isZooming = false;
      showBlockStateHint();
    });

  // Append block view container to the body of the page
  d3Select("#page-container .row")
    .append("div")
    .attr("id", "block-view-container")
    .attr("class", function() {
      let classes = 'col-lg-4 text-center';
      return darkMode ? 'dark-mode ' + classes : classes;
    })
    .append("div")
    .attr("class", "block-view-content");

  d3Select("#block-view-container .block-view-content")
    .append("svg")
    .attr("class", "block-view")
    .attr("width", widthBlock + margin.left + margin.right)
    .attr("height", heightBlock + margin.top + margin.bottom);

  if (blockColor === 'Combined') {
    d3Select("#block-view-container .block-view-content svg")
      .append("defs")
      .append("linearGradient")
      .attr("id", 'block-view-gradient')
      .html(`
        <stop offset="5%" stop-color="${sourceChromosomeColor}" />
        <stop offset="95%" stop-color="${targetChromosomeColor}" />
      `);
    blockColor = 'url(#block-view-gradient)';
  }

  const svgBlock = d3Select("#block-view-container .block-view-content svg")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Outer content with reset button
  d3Select("#block-view-container .block-view-content")
    .append("div")
    .attr("class", "outer-content")
    .append("div")
    .attr("class", "outer-clickable-content")
    .append("div")
    .attr("class", "reset-button")
    .attr("title", "Resets the block view to its original scale.");

  // Loading reset layout button inside its container
  renderSvgButton({
    buttonContainer: d3Select("#block-view-container .outer-clickable-content div.reset-button").node(),
    svgClassName: 'reset-layout-svg',
    svgHref: './images/icons.svg#reset-sprite_si-bootstrap-refresh',
    onClickFunction: function() {
      // Changing block view state and svg scale to default
      resetBlockViewState(blockID);
      d3Select("svg.block-view g.clip-block-group")
        .call(zoom.transform, d3ZoomIdentity.scale(1).translate(0, 0));

      // Resetting by calling path block view
      generatePathBlockView();
    }
  });

  // Flip orientation checkbox
  d3Select("#block-view-container .outer-clickable-content")
    .append("p")
    .attr("class", "flip-orientation")
    .append("label")
    .append("input")
    .attr("type", "checkbox")
    .attr("name", "flip-orientation")
    .attr("value", "flip-orientation")
    .property("checked", false);

  d3Select("#block-view-container")
    .select("p.flip-orientation > label")
    .append("span")
    .text("Flip Orientation");

  // Flip hint
  d3Select("#block-view-container .outer-content")
    .append("p")
    .attr("class", "block-state-hint")
    .style("opacity", 0)
    .html(function() {
      return '<em>Note: The scales in this block were changed before.</em>';
    });

  d3Select("#block-view-container")
    .select("p.flip-orientation input")
    .on("change", function() {
      onInputChange = true;

      // Changing block view state and svg scale to default
      resetBlockViewState(blockID);
      d3Select("svg.block-view g.clip-block-group")
        .call(zoom.transform, d3ZoomIdentity.scale(1).translate(0, 0));

      // Calling path block view for updates
      generatePathBlockView();
    });

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
  const blockArrayLength = blockArray.length;

  const domainSourceValues = { min: Number.MAX_SAFE_INTEGER, max: 0 };
  const domainTargetValues = { min: Number.MAX_SAFE_INTEGER, max: 0 };

  for (let i = 0; i < blockArrayLength; i++) {
    const blockSource = blockArray[i].connectionSource;
    const blockTarget = blockArray[i].connectionTarget;
    const connectionID = blockArray[i].connection;
    let { start: sourceStart, end: sourceEnd } = geneDictionary[blockSource];
    let { start: targetStart, end: targetEnd } = geneDictionary[blockTarget];
    const eValueConnection = blockArray[i].eValueConnection;

    domainSourceValues.min = Math.min(domainSourceValues.min, sourceStart, sourceEnd);
    domainSourceValues.max = Math.max(domainSourceValues.max, sourceStart, sourceEnd);

    domainTargetValues.min = Math.min(domainTargetValues.min, targetStart, targetEnd);
    domainTargetValues.max = Math.max(domainTargetValues.max, targetStart, targetEnd);

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

  domainSourceValues.min -= OFFSET_DOMAIN;
  domainSourceValues.max += OFFSET_DOMAIN;
  domainTargetValues.min -= OFFSET_DOMAIN;
  domainTargetValues.max += OFFSET_DOMAIN;

  /**
   * Generates all paths in the blockView using the current selected
   * block in the genomeView
   *
   * @return {undefined} undefined
   * @private
   */
  function generatePathBlockView() {
    const domainY0 = {
      min: domainSourceValues.min,
      max: domainSourceValues.max
    };

    const domainY1 = {
      min: domainTargetValues.min,
      max: domainTargetValues.max
    };

    if (onInputChange) {
      // Disabling inputs and selects before calling the animation
      resetInputsAndSelectsOnAnimation(true);

      const blockStateDictionary = getBlockViewStateDictionary();

      // Reset both domains to default state
      // NOTE: This is before changing flipped state
      y[0].domain([domainY0.min, domainY0.max]);
      if (blockStateDictionary[blockID].flipped) {
        y[1].domain([domainY1.max, domainY1.min]);
      } else {
        y[1].domain([domainY1.min, domainY1.max]);
      }

      // Reset only y0 ticks to default state, because the animation happens on y1
      y0axis = d3AxisLeft(y[0]).tickSize(12).ticks(10);
      gY0.call(y0axis.scale(blockStateDictionary[blockID].zoom.rescaleY(y[0])));

      // Saving the axis state in the dictionary
      blockStateDictionary[blockID].y0Domain = cloneDeep(y[0].domain());
      blockStateDictionary[blockID].y1Domain = cloneDeep(y[1].domain());

      // Change paths color to lightblue
      svgBlock.selectAll("polygon.line")
        .transition()
        .duration(COLOR_CHANGE_TIME)
        .ease(d3EaseLinear)
        .attr("fill", "lightblue");

      // Flipping transition
      let transitionTime = COLOR_CHANGE_TIME;
      let transitionHeightDivision = 1;
      let summing = true;

      // 2 - 4 - 8 - 16 - 32
      // Flip here and sum flipping time
      // 32 - 16 - 8 - 4 - 2

      // Only break loop when summing is false && transitionHeightDivision == 1
      // summing || transitionHeightDivision != 1
      // Or when indexTransition == 12
      for (let indexTransition = 1; indexTransition <= MAX_INDEX_TRANSITION; indexTransition++) {
        if (indexTransition == 6) {
          summing = false;
          transitionHeightDivision = 64;
          transitionTime += TRANSITION_FLIPPING_TIME;
        } else {
          transitionTime += TRANSITION_NORMAL_TIME;
        }

        if (summing) {
          transitionHeightDivision *= TRANSITION_HEIGHT_DIVISION_MULTIPLE;
        } else {
          transitionHeightDivision /= TRANSITION_HEIGHT_DIVISION_MULTIPLE;
        }

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
             * 6 -> 64 -> 32
             * 7 -> 16
             * 8 -> 8
             * 9 -> 4
             * 10 -> 2
             * 11 -> 1
             */

            if (transitionHeightDivision >= 2) {
              offsetTransition = (heightBlock - (heightBlock / transitionHeightDivision)) / 2;
            }

            // Creating new scales for y1 to improve the flipping transition
            const minimumRange = offsetTransition + ((heightBlock - offsetTransition) / transitionHeightDivision);
            const maximumRange = offsetTransition;
            const newY = [y[0], d3ScaleLinear().range([minimumRange, maximumRange])];
            newY[0].domain(blockStateDictionary[blockID].y0Domain);
            newY[1].domain(blockStateDictionary[blockID].y1Domain);

            y1axis = d3AxisRight(newY[1]).tickSize(12).ticks(10);
            gY1.call(y1axis.scale(blockStateDictionary[blockID].zoom.rescaleY(newY[1])));

            applyStyleToAxes();

            // Plotting the lines path using the new scales
            svgBlock.selectAll("polygon.line")
              .data(dataBlock)
              .attr("points", function(data) {
                return path(data, newY, blockStateDictionary[blockID].flipped);
              });

            if (indexTransition === 6) {
              // Assigning flipped state to true if checkbox is selected, otherwise false
              // Updating flipped state to draw updated paths from now on
              blockStateDictionary[blockID].flipped = d3Select("p.flip-orientation input").property("checked");

              if (blockStateDictionary[blockID].flipped) {
                newY[1].domain([domainY1.max, domainY1.min]);
              } else {
                newY[1].domain([domainY1.min, domainY1.max]);
              }

              // Saving the axis state in the dictionary
              blockStateDictionary[blockID].y0Domain = cloneDeep(newY[0].domain());
              blockStateDictionary[blockID].y1Domain = cloneDeep(newY[1].domain());

              setBlockViewStateDictionary(blockStateDictionary);
            }
          }, transitionTime);
        })(indexTransition, transitionTime, transitionHeightDivision);
      }
    }

    /**
     * Draws all the paths for the block view
     *
     * @return {undefined} undefined
     * @private
     */
    function drawPathBlockView() {

      // Remove old paths if they are present
      if (!svgBlock.selectAll("polygon.line").empty()) {
        svgBlock.select("g.clip-block-group").remove(); // Removing complete clip block group
      }

      const blockStateDictionary = getBlockViewStateDictionary();

      // Y scale domains using minimum, maximum and offsetDomain values
      if (!isEmpty(blockStateDictionary[blockID].y0Domain) &&
        !isEmpty(blockStateDictionary[blockID].y1Domain)) {
        y[0].domain(blockStateDictionary[blockID].y0Domain);
        y[1].domain(blockStateDictionary[blockID].y1Domain);
      } else {
        y[0].domain([domainY0.min, domainY0.max]);
        y[1].domain([domainY1.min, domainY1.max]);

        // Assigning default scales
        if (isEmpty(blockStateDictionary[blockID].defaultY0Domain) &&
          isEmpty(blockStateDictionary[blockID].defaultY1Domain)) {
          // Domain values will always be correct, since by default the block view
          // is not flipping when chromosomes are flipped
          blockStateDictionary[blockID].defaultY0Domain =
            cloneDeep([domainSourceValues.min, domainSourceValues.max]);
          blockStateDictionary[blockID].defaultY1Domain =
            cloneDeep([domainTargetValues.min, domainTargetValues.max]);
          setBlockViewStateDictionary(blockStateDictionary);
        }
      }

      showBlockStateHint();

      // If block state is flipped then change the y[1] axis to be flipped
      if (blockStateDictionary[blockID].flipped) {

        // Need to enter if state is flipped, because if the user resets the view
        // The domains won't be saved anymore
        d3Select("p.flip-orientation input").property("checked", true);

        // Getting domain
        const currentY1Domain = y[1].domain();
        if (currentY1Domain[0] < currentY1Domain[1]) {
          // If minimum domain is less than maximum domain, indicates it is not flipped yet
          // Change the axis domain, so polygons are drawn flipped below
          y[1].domain([domainY1.max, domainY1.min]);
        }
      }

      // Rectangle that has the block view size to catch any zoom event
      // This is needed outside the clip-path to cath the events easily
      const zoomView = svgBlock.append("g")
        .attr("class", "clip-block-group")
        .attr("clip-path", "url(#clip-block)")
        .append("rect")
        .attr("class", "rect-clip-block")
        .attr("fill", "none")
        .attr("width", widthBlock)
        .attr("height", heightBlock);

      // For the Circos tooltip
      const tooltipDiv = d3Select("div.circos-tooltip")
        .style("opacity", 0);

      // Add new paths inside the block
      svgBlock.select("g.clip-block-group")
        .append("g")
        .selectAll("polygon")
        .data(dataBlock).enter()
        .append("polygon")
        .attr("class", "line")
        .attr("points", function(data) {
          return path(data, y, blockStateDictionary[blockID].flipped);
        })
        .attr("opacity", 0.7)
        .on("mouseover", function(d, i, nodes) {
          // Only activate if the user is not zooming, axis mouse down is not set,
          // and SA is not running
          if (isZooming || currentAxisMouseDown !== "" ||
            d3Select(".best-guess > button").attr("disabled")) return;

          tooltipDiv.transition().style("opacity", 0.9);

          tooltipDiv.html(function() {
              return `<h6 style="margin-bottom: 0;">${d.source.id}</h6>
                    ➤
                    <h6 style="margin-top: 0;">${d.target.id}</h6>
                    <h6><u>Connection information</u></h6>
                    <h6>ID: ${d.connection}</h6>
                    <h6>E-value: ${d.eValue}</h6>`;
            })
            .style("left", `${(d3Event.pageX)}px`)
            .style("top", `${(d3Event.pageY - 28)}px`);

          if (d3SelectAll(nodes).attr("opacity") !== 0.3) {
            d3SelectAll(nodes).attr("opacity", 0.3);
            d3Select(nodes[i]).attr("opacity", 0.9);
          }
        })
        .on("mouseout", function(d, i, nodes) {
          // Always activate since this will remove the tooltip,
          // preventing it from blocking (obstructing) the view from the user when
          // doing other operations such as dragging or zooming

          tooltipDiv.transition()
            .duration(500)
            .ease(d3EaseLinear)
            .style("opacity", 0);

          if (d3SelectAll(nodes).attr("opacity") !== 0.7) {
            d3SelectAll(nodes).attr("opacity", 0.7);
          }
        });

      if (!onInputChange) {
        svgBlock.selectAll("polygon.line")
          .attr("fill", darkMode ? "#222222" : "#ffffff")
          .transition()
          .duration(DEFAULT_GENOME_TRANSITION_TIME)
          .ease(d3EaseLinear)
          .attr("fill", blockColor);
      } else {
        svgBlock.selectAll("polygon.line")
          .attr("fill", "lightblue")
          .transition()
          .duration(COLOR_CHANGE_TIME)
          .ease(d3EaseLinear)
          .attr("fill", blockColor);

        // Enabling inputs and selects after calling the animation
        resetInputsAndSelectsOnAnimation();
      }

      // Add the Y0 Axis
      y0axis = d3AxisLeft(y[0]).tickSize(12);

      // Remove axisY0 if it is present
      if (!svgBlock.selectAll("g.axisY0").empty()) {
        svgBlock.selectAll("g.axisY0").remove();
      }

      gY0 = svgBlock.append("g")
        .attr("class", "axisY0")
        .call(y0axis.ticks(10));

      gY0.select("path.domain")
        .attr("fill", function() {
          return sourceChromosomeColor;
        });

      // Add the Y1 Axis
      y1axis = d3AxisRight(y[1]).tickSize(12);

      // Remove axisY1 if it is present
      if (!svgBlock.selectAll("g.axisY1").empty()) {
        svgBlock.selectAll("g.axisY1").remove();
      }

      gY1 = svgBlock.append("g")
        .attr("class", "axisY1")
        .attr("transform", `translate(${widthBlock},0)`)
        .call(y1axis.ticks(10));

      gY1.select("path.domain")
        .attr("fill", function() {
          return targetChromosomeColor;
        });

      applyStyleToAxes();

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
      d3SelectAll("rect.axisY0,rect.axisY1")
        .on("mousedown", function() {
          currentAxisMouseDown = d3Select(this).attr("class").split(" ")[1];
        });

      // Axis drag handler
      const dragHandler = d3Drag()
        .on("start", function() {
          // If axis mouse down is not set, then return because I'm not selecting any axis
          // Activate only if SA is not running
          if (currentAxisMouseDown === "" || d3Select(".best-guess > button").attr("disabled")) return;

          // Getting mouse position
          const positionY = d3Mouse(d3Select("div#block-view-container svg.block-view").node())[1];
          offsetYPosition = positionY;

          // Highlighting current axis
          d3Select(`g.${currentAxisMouseDown}`)
            .style("stroke", "#ea4848")
            .style("stroke-width", "1px");
        })
        .on("drag", function() {
          // If axis mouse down is not set, then return because I'm not selecting any axis
          // Activate only if SA is not running
          if (currentAxisMouseDown === "" || d3Select(".best-guess > button").attr("disabled")) return;

          // Getting mouse position
          const positionY = d3Mouse(d3Select("div#block-view-container svg.block-view").node())[1];

          // Dragging distance is the difference between current and starting position
          let draggingDistance = positionY - offsetYPosition;

          // Assign new starting position if I'm currently dragging and I decide to change direction
          if (draggingDistance > 0 && draggingDistance < lastDraggingDistance ||
            draggingDistance < 0 && draggingDistance > lastDraggingDistance) {
            offsetYPosition = positionY;
            draggingDistance = 0;
          }

          const blockStateDictionary = getBlockViewStateDictionary();

          let actualDistance = 0;
          // Dividing factor is given by the current zoom scale
          let dividingFactor = blockStateDictionary[blockID].zoom.k * 20;

          if (currentAxisMouseDown === 'axisY0') {
            /**
             * Using "invert()" to get the domain values associated with the
             * current and the starting Y position,
             * meaning that the difference between those two values will give me
             * by how much the domain scale needs to change
             */
            const draggingDistanceInverted = (y[0].invert(Math.abs(positionY / dividingFactor)) - y[0].invert(Math.abs(offsetYPosition / dividingFactor))) * (-1);

            // Getting current domain
            const currentDomain = y[0].domain();
            // Adding the difference to current domain minimum and maximum values
            y[0] = y[0].domain([currentDomain[0] + draggingDistanceInverted, currentDomain[1] + draggingDistanceInverted]);
            // Re-defining axis with new domain
            y0axis = d3AxisLeft(y[0]).tickSize(12);
            // Scaling the axis in the block view
            gY0.call(y0axis.scale(blockStateDictionary[blockID].zoom.rescaleY(y[0])));
          } else if (currentAxisMouseDown === 'axisY1') {
            const draggingDistanceInverted = (y[1].invert(Math.abs(positionY / dividingFactor)) - y[1].invert(Math.abs(offsetYPosition / dividingFactor))) * (-1);

            const currentDomain = y[1].domain();
            y[1] = y[1].domain([currentDomain[0] + draggingDistanceInverted, currentDomain[1] + draggingDistanceInverted]);
            y1axis = d3AxisRight(y[1]).tickSize(12);
            gY1.call(y1axis.scale(blockStateDictionary[blockID].zoom.rescaleY(y[1])));
          }

          applyStyleToAxes();

          // Saving the axis state in the dictionary
          blockStateDictionary[blockID].y0Domain = cloneDeep(y[0].domain());
          blockStateDictionary[blockID].y1Domain = cloneDeep(y[1].domain());

          setBlockViewStateDictionary(blockStateDictionary);

          d3SelectAll("polygon.line")
            .attr('points', function(d) {
              const currentPoints = d3Select(this).attr('points').split(' ');
              let firstPair = currentPoints[0].split(','),
                secondPair = currentPoints[1].split(','),
                thirdPair = currentPoints[2].split(','),
                fourthPair = currentPoints[3].split(',');

              actualDistance = draggingDistance / dividingFactor;

              // Adding dragging distance to the polygon points
              if (currentAxisMouseDown === 'axisY0') {
                firstPair[1] = Number(firstPair[1]) + actualDistance;
                secondPair[1] = Number(secondPair[1]) + actualDistance;
              } else if (currentAxisMouseDown === 'axisY1') {
                thirdPair[1] = Number(thirdPair[1]) + actualDistance;
                fourthPair[1] = Number(fourthPair[1]) + actualDistance;
              }

              return [
                firstPair.join(','),
                secondPair.join(','),
                thirdPair.join(','),
                fourthPair.join(',')
              ].join(' ');
            });

          // Saving dragging distance to know dragging direction (up or down)
          lastDraggingDistance = draggingDistance;
        })
        .on("end", function() {
          // If axis mouse down is not set, then return because I'm not selecting any axis
          // Activate only if SA is not running
          if (currentAxisMouseDown === "" || d3Select(".best-guess > button").attr("disabled")) return;

          // Remove stroke highlight from axis
          d3Select(`g.${currentAxisMouseDown}`)
            .style("stroke", "none");

          // Resetting current axis mouse down
          currentAxisMouseDown = "";

          showBlockStateHint();
        });

      // Attaching drag handler to block view
      d3Select("div#block-view-container svg.block-view").call(dragHandler);

      // Resetting variable
      onInputChange = false;

      // Calling zoom for the block group, so it works for every path
      // Changing zoom to saved state
      d3Select("svg.block-view g.clip-block-group")
        .call(zoom)
        .call(zoom.transform, getBlockViewStateDictionary()[blockID].zoom);
    };

    if (onInputChange) {
      setTimeout(drawPathBlockView,
        (COLOR_CHANGE_TIME + (TRANSITION_NORMAL_TIME * MAX_INDEX_TRANSITION) + TRANSITION_FLIPPING_TIME));
    } else {
      drawPathBlockView();
    }
  };

  generatePathBlockView();

  // Add the Y0 Axis label text with source chromosome ID
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (heightBlock / 2))
    .attr("dy", "1em")
    .attr("fill", darkMode ? "#f3f3f3" : "#000000")
    .attr("font-size", "12")
    .attr("text-anchor", "middle")
    .text(sourceChromosomeID);

  // Add the Y1 Axis label text with target chromosome ID
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(90)")
    .attr("y", 0 - widthBlock - margin.right)
    .attr("x", (heightBlock / 2))
    .attr("dy", "1em")
    .attr("fill", darkMode ? "#f3f3f3" : "#000000")
    .attr("font-size", "12")
    .attr("text-anchor", "middle")
    .text(targetChromosomeID);

  // Add the Chart title
  svgBlock.append("text")
    .attr("class", "axis-label")
    .attr("x", (widthBlock / 2))
    .attr("y", 0 - (margin.top / 3))
    .attr("fill", darkMode ? "#f3f3f3" : "#000000")
    .attr("font-size", "12")
    .attr("text-anchor", "middle")
    .text(`${sourceChromosomeID} vs. ${targetChromosomeID} - Block ${d3Format(",")(blockID)}`);
}
