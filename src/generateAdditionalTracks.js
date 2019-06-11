import * as d3 from 'd3';

import cloneDeep from 'lodash/cloneDeep';
import forEach from 'lodash/forEach';
import sortBy from 'lodash/sortBy';

// Shopify sortable. Using ES5 bundle to make it work correctly with UglifyJS
// Note: https://github.com/Shopify/draggable/issues/269
import { Sortable } from '@shopify/draggable/lib/es5/draggable.bundle';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import Modal from './reactComponents/Modal';
import SubmitAdditionalTracksForm from './reactComponents/SubmitAdditionalTracksForm';

import generateGenomeView, { getCurrentTrack } from './genomeView/generateGenomeView';

import {
  convertToMinimumWindowSize,
  getAdditionalTrackArray,
  getAdditionalTrackNames,
  getGenomeWindowSize,
  setAdditionalTrackArray
} from './variables/additionalTrack';

import { getGffDictionary } from './variables/gffDictionary';
import { getSavedSolutions } from './variables/savedSolutions';
import {
  calculateMiddleValue,
  renderReactAlert,
  roundFloatNumber
} from './helpers';

// Contants
import {
  ADDITIONAL_TRACK_TYPES,
  CONNECTION_COLORS,
  SEQUENTIAL_COLOR_SCALES,
  SEQUENTIAL_SCALES_INTERPOLATORS,
  WIDTH
} from './variables/constants';

/**
 * Generates and parses additional tracks
 *
 * @param  {Array<Object>} additionalTracks Data from additional tracks
 * @return {Array<Object>} Parsed additional tracks
 */
export default function generateAdditionalTracks(additionalTracks) {
  let order = getAdditionalTrackArray().length;
  const additionalTrackLength = additionalTracks.length;
  const gffPositionDictionary = getGffDictionary();
  const additionalTrackArray = []; // Array with all the tracks formatted (data, name, and order)
  const recommendedWindowSize = getGenomeWindowSize();
  for (let i = 0; i < additionalTrackLength; i++) {
    const additionalTrackDataArray = []; // Array that includes the data from the additional tracks BedGraph file
    const { data: currentData, name } = additionalTracks[i];
    const currentDataLength = currentData.length;

    for (let j = 0; j < currentDataLength; j++) {
      let value = roundFloatNumber(parseFloat(currentData[j].value), 6);
      const start = parseInt(currentData[j].start);
      const end = parseInt(currentData[j].end);

      const { chromosomeID } = currentData[j];
      // Only adding additional track data for existing and valid chromosomeID
      if (!(chromosomeID in gffPositionDictionary)) continue;

      // Not adding null values that are above the chromosome size limit
      if (start > gffPositionDictionary[chromosomeID].end &&
        end > gffPositionDictionary[chromosomeID].end &&
        value === 0) {
        continue;
      }

      const additionalTrackObject = {
        block_id: chromosomeID,
        start: start,
        end: end,
        position: calculateMiddleValue(start, end),
        value: value
      };

      additionalTrackDataArray.push(additionalTrackObject);
    }

    const currentWindowSize = additionalTrackDataArray[0].end - additionalTrackDataArray[0].start + 1;
    console.log('CURRENT WINDOW SIZE: ', currentWindowSize);
    console.log('recommendedWindowSize: ', recommendedWindowSize);
    // Comparison with (recommendedWindowSize - currentWindowSize) is done to have
    // a little bit of extra window size range
    if (currentWindowSize < (recommendedWindowSize - currentWindowSize)) {
      console.log('CALCULATION: ', currentWindowSize, (recommendedWindowSize - currentWindowSize));
      const formattedCurrentWindowSize = convertToMinimumWindowSize(currentWindowSize, 1, true);
      const formattedRecommendedWindowSize = convertToMinimumWindowSize(recommendedWindowSize, 1, true);
      renderReactAlert(`Warning: The additional track "${name}" is using a window size of ${formattedCurrentWindowSize} bases.
        For this genome, we recommend using a window size of minimum ${formattedRecommendedWindowSize} bases for the best app experience.`,
        'warning',
        10000);
    }

    additionalTrackArray.push({
      data: additionalTrackDataArray,
      name: name,
      order: ++order
    });
  }

  return additionalTrackArray;
};

/**
 * Shows legend for the track that has the active tab
 * More info: https://beta.observablehq.com/@tmcw/d3-scalesequential-continuous-color-legend-example
 * @return {undefined} undefined
 */
export function showLegendActiveAdditionalTrack(trackName) {
  const trackLegend = d3.select("svg#track-legend");
  // Removing everything inside trackLegend
  trackLegend.selectAll("*").remove();
  trackLegend.classed("dark-mode", false); // Resetting dark-mode class

  const trackType = !d3.select(`div.additional-track.${trackName} .track-type select`).empty() &&
    d3.select(`div.additional-track.${trackName} .track-type select`).property("value");
  const trackColor = !d3.select(`div.additional-track.${trackName} .track-color select`).empty() &&
    d3.select(`div.additional-track.${trackName} .track-color select`).property("value");
  const colorInterpolator = SEQUENTIAL_SCALES_INTERPOLATORS[trackColor];

  console.log('\n\n\nTRACK NAME: ', trackName);
  console.log('trackType', trackType);
  console.log('TRACK COLOR: ', trackColor);

  // Only show legend if Type !== 'None' and it is not Type 'Line'
  // Also, return if the interpolator is not defined
  // Or if track type or color are not defined (the track has been deleted)
  if (!trackType || trackType === 'None' || trackType === 'line' ||
    !trackColor || colorInterpolator == null) return;

  const width = WIDTH * 0.75;
  const height = 50;
  const barHeight = 15;

  const margin = {
    right: 40,
    bottom: 20,
    left: 40
  };

  // Current track min and max values
  const { minValue, maxValue } = getCurrentTrack(trackName);
  console.log('MIN AND MAX: ', minValue, maxValue);

  const colorScale = d3.scaleSequential(colorInterpolator)
    .domain([minValue, maxValue]);

  const axisScale = d3.scaleLinear()
    .domain(colorScale.domain())
    .range([margin.left, width - margin.right]);

  const axisBottom = g => g
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(axisScale)
      .ticks(width / 70)
      .tickSize(-barHeight));

  const defs = trackLegend.append("defs");

  const linearGradient = defs.append("linearGradient")
      .attr("id", "linear-gradient-legend");

  linearGradient.selectAll("stop")
    .data(colorScale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: colorScale(t) })))
    .enter().append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);

  trackLegend.append('g')
    .attr("class", `${trackName}`)
    .attr("transform", `translate(0,${height - margin.bottom - barHeight})`)
    .append("rect")
    .attr('transform', `translate(${margin.left}, 0)`)
  	.attr("width", width - margin.right - margin.left)
  	.attr("height", barHeight)
  	.style("fill", "url(#linear-gradient-legend)");

  trackLegend.append('g')
    .call(axisBottom);

  trackLegend.selectAll(".x-axis path")
    .attr("stroke", "#ffffff");

  trackLegend.selectAll(".x-axis line")
    .attr("stroke-width", "2px");

  trackLegend.selectAll(".x-axis text")
    .attr("font-size", "11");

  const darkMode = d3.select("p.dark-mode input").property("checked");
  trackLegend.classed("dark-mode", darkMode);

  if (darkMode) {
    trackLegend.selectAll(".x-axis line")
      .attr("stroke", "#f3f3f3");
    trackLegend.selectAll(".x-axis path")
      .attr("stroke", "#222222");
    trackLegend.selectAll(".x-axis text")
      .attr("fill", "#f3f3f3");
  }
};

/**
 * Generates a list of select options based on the list of sequential color scales
 * @return {Array<string>} List of select options
 */
function getSequentialScaleOptions() {
  return Object.keys(SEQUENTIAL_COLOR_SCALES).map((current) =>
    `<option value="${current}">${SEQUENTIAL_COLOR_SCALES[current]}</option>`
  );
};

/**
 * Adds the additional tracks to the panel menu
 *
 * @param {Array<Object>} [additionalTracks=[]] Parsed additional tracks
 * @return {undefined} undefined
 */
export function addAdditionalTracksMenu(additionalTracks = []) {
  const currentAdditionalTracks = cloneDeep(additionalTracks);
  const currentAdditionalTracksLength = currentAdditionalTracks.length;
  console.log('currentAdditionalTracks: ', currentAdditionalTracks);

  for (let i = 0; i < currentAdditionalTracksLength; i++) {
    const name = currentAdditionalTracks[i].name;

    // Additional tracks tabs
    d3.select("#form-config .additional-tracks-panel-container div.draggable-tabs")
      .append("button")
      .attr("class", `tab-link is-dragabble ${name}`)
      .html(`
        <span class="hamburger-icon">&#9776;</span>
        <span class="text">${name}</span>
        <span class="delete">&#10005;</span>
      `);

    // Tab content
    d3.select("#form-config .additional-tracks-panel-container")
      .append("div")
      .attr("id", `${name}`)
      .attr("class", `tab-content additional-track ${name}`)
    // Track type select
      .append("div")
    // NOTE: ${name} class below is being used in the select on change for any track
      .attr("class", `track-type additional-track-block ${name}`)
      .append("p")
      .text("Type: ");

    d3.select(`div.additional-track.${name} .track-type`)
      .append("p")
      .append("select")
      .attr("class", "form-control")
      .html(() =>
        Object.keys(ADDITIONAL_TRACK_TYPES).map((current) =>
          `<option value="${ADDITIONAL_TRACK_TYPES[current]}">${current}</option>`
        ).join(' ')
      );

    // Track color scale
    d3.select(`div.additional-track.${name}`)
      .append("div")
      .attr("class", `track-color additional-track-block ${name}`)
      .append("p")
      .text("Palette: ");

    d3.select(`div.additional-track.${name} .track-color`)
      .append("p")
      .append("select")
      .attr("class", "form-control")
      .html(getSequentialScaleOptions());

    // Track placement
    d3.select(`div.additional-track.${name}`)
      .append("div")
      .attr("class", "track-placement additional-track-block")
      .append("p")
      .text("Placement: ");

    d3.select(`div.additional-track.${name} .track-placement`)
      .append("p")
      .append("select")
      .attr("class", "form-control")
      .html(`
        <option value="Outside" selected="selected">Outside</option>
        <option value="Inside">Inside</option>
      `);
  }

  // Only add the add-track button if it has not been added yet (add it only once)
  if (d3.select("#form-config .additional-tracks-panel-container div.tabs div.add-track").empty()) {
    d3.select("#form-config .additional-tracks-panel-container div.tabs")
      .append("div")
      .attr("class", "add-track");

    // Loading add track modal inside its container
    ReactDOM.render(
      <Modal
        buttonClassName="add-track"
        buttonLabel={
          <div>
            <span className="text">Add track</span>
            <span className="add-track">&#10133;</span>
          </div>
        }
        modalHeader="Add track"
        size="sm">
        {<SubmitAdditionalTracksForm />}
      </Modal>,
      d3.select("#form-config .additional-tracks-panel-container div.tabs div.add-track").node()
    );

    // Adding drag functionality only once to only have one dragging listener
    const sortable = new Sortable(document.querySelectorAll('div.tabs div.draggable-tabs'), {
      delay: 0,
      draggable: 'button.tab-link.is-dragabble',
      handle: '.hamburger-icon',
      mirror: {
        appendTo: 'div.tabs',
        constrainDimensions: true,
        xAxis: false
      }
    });

    // Sortable start event
    sortable.on('sortable:start', (e) => {
      const additionalTrackArray = getAdditionalTrackArray();
      // Not letting the user drag with only one tab
      if (additionalTrackArray.length <= 1) e.cancel();
    });

    // Sortable stop event
    sortable.on('sortable:stop', () => {
      // Using set to obtain all the tabs to make sure no duplicates are added
      const newOrderSet = new Set();

      d3.selectAll("#form-config .additional-tracks-panel-container div.draggable-tabs button.tab-link span.text")
        .each(function eachTab() {
          const parentNode = d3.select(this.parentNode);
          const classList = parentNode.node().classList;

          if (classList.contains('draggable--original') ||
            classList.contains('draggable-mirror')) return;

          const node = d3.select(this);
          newOrderSet.add(node.text());
        });

      const additionalTrackArray = getAdditionalTrackArray();
      const newOrderArray = Array.from(newOrderSet);

      if (additionalTrackArray.length <= 1 || newOrderArray.length <= 1) return;

      // Hash for track names and their new order
      const newOrderHash = {};
      const newOrderArrayLength = newOrderArray.length;

      for (let i = 0; i < newOrderArrayLength; i++) {
        newOrderHash[newOrderArray[i]] = i + 1;
      }

      // Assigning new order based on the hash dictionary
      // NOTE: additionalTrackArray has the same tracks as newOrderArray,
      // meaning that only the orders are changing
      for (let i = 0; i < newOrderArrayLength; i++) {
        additionalTrackArray[i].order = newOrderHash[additionalTrackArray[i].name];
      }

      console.log('ADDITIONAL TRACKS:::\n', additionalTrackArray);

      setAdditionalTrackArray(additionalTrackArray);

      // Calling genome view for updates with no transition
      generateGenomeView({
        transition: { shouldDo: false },
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: true
      });
    });
  }

  // Tab delete click handler
  d3.selectAll("#form-config .additional-tracks-panel-container div.draggable-tabs button.tab-link span.delete")
    .on("click", function() {
      // Prevent form submission and page refresh
      d3.event.preventDefault();

      const name = d3.select(this.parentNode).select("span.text").text();

      const savedSolutions = getSavedSolutions();
      let foundSavedTrack = false;
      let stampIndex = -1;
      forEach(savedSolutions, ({ availableTracks }, index) => {
        forEach(availableTracks, ({ name: trackName }) => {
          if (name === trackName) {
            foundSavedTrack = true;
            stampIndex = index + 1;
            return false; // equivalent of break inside forEach
          }
        });
        if (foundSavedTrack) return false; // equivalent of break inside forEach
      });

      // Return because I cannot delete the track if there is a saved layout using it
      if (foundSavedTrack) {
        renderReactAlert(`The track "${name}" can't be deleted because it is being used in the saved stamp #${stampIndex}.`);
        return;
      }

      const confirming = confirm(`Are you sure you want to delete the track "${name}"?`);

      // Return if the user does not want to delete
      if (!confirming) return;

      let currentAdditionalTracks = cloneDeep(getAdditionalTrackArray());
      const currentAdditionalTrackNames = cloneDeep(getAdditionalTrackNames());

      // Looking for track name to be deleted
      const namePosition = currentAdditionalTrackNames.indexOf(name);
      currentAdditionalTracks.splice(namePosition, 1);

      // Sorting by order and re-assigning the order in ascending order after deleting (1, 2, 3 ...)
      currentAdditionalTracks = sortBy(currentAdditionalTracks, ['order']);
      for (let i = 0; i < currentAdditionalTracks.length; i++) {
        currentAdditionalTracks[i].order = i + 1;
      }

      console.log('CURRENT TRACKS AFTER DELETION: ', cloneDeep(currentAdditionalTracks));

      // Setting data with new tracks
      setAdditionalTrackArray(currentAdditionalTracks);

      // Updating the menu by removing the current element and its tab-content only
      d3.select(this.parentNode).remove();
      d3.select(`div.tab-content#${name}`).remove();

      // Calling genome view for updates with no transition
      generateGenomeView({
        transition: { shouldDo: false },
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: true
      });
    });

  // Tab click handler
  // More info here: https://www.w3schools.com/howto/howto_js_tabs.asp
  d3.selectAll("#form-config .additional-tracks-panel-container div.draggable-tabs button.tab-link")
    .on("click", function() {
      // Prevent form submission and page refresh
      d3.event.preventDefault();

      // Get all elements with class="tabcontent" and hide them
      let tabcontent = document.getElementsByClassName("tab-content");
      for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = 'none';
      }

      // Get all elements with class="tablinks" and remove the class "active"
      let tablinks = document.getElementsByClassName("tab-link");
      for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(' active', '');
      }

      // Show the current tab, and add an "active" class to the button that opened the tab
      const currentNode = d3.select(this);
      const nodeText = currentNode.select("span.text").text();
      const element = document.getElementById(nodeText);

      if (element && getAdditionalTrackNames().indexOf(nodeText) !== (-1)) {
        // Show current tab only if it exists in the DOM and in the tracks array
        element.style.display = 'block';
        currentNode.node().classList.add('active');
      } else {
        // Making the first tab active (if available) when current tab is deleted
        const firstChildElement = d3.select("#form-config .additional-tracks-panel-container div.draggable-tabs button:first-child");

        if (!firstChildElement.empty()) {
          const firstElementNode = document.getElementById(firstChildElement.select("span.text").text());

          firstElementNode.style.display = 'block';
          firstChildElement.node().classList.add('active');
        }
      }

      // Update panel scrollHeight
      const panel = d3.select("#form-config .additional-tracks-panel").node();
      panel.style.maxHeight = `${panel.scrollHeight.toString()}px`;

      // Adding legend for the active (current) tab
      showLegendActiveAdditionalTrack(nodeText);
    });

  // Select on change for any track block on any track
  d3.selectAll("div.additional-track-block p select")
    .on("change", function() {
      // The grandfather node will always be the additional-track-block
      const grandfatherNode = d3.select(this.parentNode.parentNode);
      const includesType = (type) => grandfatherNode.node().classList.contains(type);
      const getTrackName = () => grandfatherNode.attr("class").split(' ')[2];

      // Update track type for the special case of line type
      if (includesType('track-type')) {
        const trackClass = getTrackName();

        // Adding options based on type
        if (d3.select(this).property("value") === 'line') {
          // Add line colors
          d3.select(`div.additional-track.${trackClass} .track-color p`)
            .text("Color: ");
          d3.select(`div.additional-track.${trackClass} .track-color select`)
            .html(() =>
              // slice(5) because I only want to use the SOLID colors
              Object.keys(CONNECTION_COLORS).slice(5).map((current) =>
                `<option value="${CONNECTION_COLORS[current]}">${current}</option>`
              ).join(' ')
            );
        } else if (d3.select(`div.additional-track.${trackClass} .track-color p`).text() !== 'Palette: ') {
          // Add default color palette only if needed (i.e. when coming from line type)
          d3.select(`div.additional-track.${trackClass} .track-color p`)
            .text("Palette: ");
          d3.select(`div.additional-track.${trackClass} .track-color select`)
            .html(getSequentialScaleOptions());
        }
      }

      let shouldUpdate = (d3.event.detail || {}).shouldUpdate;
      // shoulUpdate = null or undefined is true, meaning true by default
      shouldUpdate = shouldUpdate == null ? true : shouldUpdate;
      if (shouldUpdate) {
        // Adding legend when modifying type or color
        // NOTE: This is being done after modifying the color palette above
        if (includesType('track-type') || includesType('track-color')) {
          showLegendActiveAdditionalTrack(getTrackName());
        }

        // Calling genome view for updates with no transition
        generateGenomeView({
          transition: { shouldDo: false },
          shouldUpdateBlockCollisions: false,
          shouldUpdateLayout: true
        });
      }
    });
};
