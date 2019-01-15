import * as d3 from 'd3';

import cloneDeep from 'lodash/cloneDeep';
import sortBy from 'lodash/sortBy';

// Shopify sortable. Using ES5 bundle to make it work correctly with UglifyJS
// Note: https://github.com/Shopify/draggable/issues/269
import { Sortable } from '@shopify/draggable/lib/es5/draggable.bundle';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import Modal from './reactComponents/Modal';
import SubmitAdditionalTracksForm from './reactComponents/SubmitAdditionalTracksForm';

import generateGenomeView from './genomeView/generateGenomeView';

import {
  getAdditionalTrackArray,
  getAdditionalTrackNames,
  setAdditionalTrackArray
} from './variables/additionalTrack';

import { getGffDictionary } from './variables/gffDictionary';

import {
  calculateMiddleValue,
  roundFloatNumber
} from './helpers';

import {
  ADDITIONAL_TRACK_TYPES,
  CONNECTION_COLORS,
  SEQUENTIAL_COLOR_SCALES
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
  for (let i = 0; i < additionalTrackLength; i++) {
    const additionalTrackDataArray = []; // Array that includes the data from the additional tracks BedGraph file
    const { data: currentData, name } = additionalTracks[i];
    const currentDataLength = currentData.length;

    for (let j = 0; j < currentDataLength; j++) {
      let value = roundFloatNumber(parseFloat(currentData[j].value), 6);
      const start = parseInt(currentData[j].start);
      const end = parseInt(currentData[j].end);
      const { chromosomeID } = currentData[j];

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

    additionalTrackArray.push({
      data: additionalTrackDataArray,
      name: name,
      order: ++order
    });
  }

  return additionalTrackArray;
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

  // Loading colors option tag for select
  const allColors = Object.keys(SEQUENTIAL_COLOR_SCALES);
  const allColorsLength = allColors.length;
  let colorOptions = "";
  for (let i = 0; i < allColorsLength; i++) {
    const key = allColors[i];
    colorOptions += `
      <option value="${key}">${SEQUENTIAL_COLOR_SCALES[key]}</option>
      `;
  }

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
      .attr("class", `track-type additional-track-block ${name}`)
      .append("p")
      .text("Type: ");

    d3.select(`div.additional-track.${name} .track-type`)
      .append("p")
      .append("select")
      .html(() =>
        Object.keys(ADDITIONAL_TRACK_TYPES).map((current) =>
          `<option value="${ADDITIONAL_TRACK_TYPES[current]}">${current}</option>`
        ).join(' ')
      );

    // Track color scale
    d3.select(`div.additional-track.${name}`)
      .append("div")
      .attr("class", "track-color additional-track-block")
      .append("p")
      .text("Palette: ");

    d3.select(`div.additional-track.${name} .track-color`)
      .append("p")
      .append("select")
      .html(colorOptions);

    // Track placement
    d3.select(`div.additional-track.${name}`)
      .append("div")
      .attr("class", "track-placement additional-track-block")
      .append("p")
      .text("Placement: ");

    d3.select(`div.additional-track.${name} .track-placement`)
      .append("p")
      .append("select")
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
    });

  // Select on change for any track block on any track
  d3.selectAll("div.additional-track-block p select")
    .on("change", function() {
      // The grandfather node will always be the additional-track-block
      const grandfatherNode = d3.select(this.parentNode.parentNode);
      // Update track type for the special case of line type
      if (grandfatherNode.node().classList.contains('track-type')) {
        const trackClass = grandfatherNode.attr("class").split(' ')[2];

        // Adding options based on type
        if (d3.select(this).property("value") === 'line') {
          // Add line colors
          d3.select(`div.additional-track.${trackClass} .track-color p`)
            .text("Color: ");
          d3.select(`div.additional-track.${trackClass} .track-color select`)
            .html(() =>
              // slice(4) because I only want to use the SOLID colors
              Object.keys(CONNECTION_COLORS).slice(4).map((current) =>
                `<option value="${CONNECTION_COLORS[current]}">${current}</option>`
              ).join(' ')
            );
        } else {
          // Add color palette
          d3.select(`div.additional-track.${trackClass} .track-color p`)
            .text("Palette: ");
          d3.select(`div.additional-track.${trackClass} .track-color select`)
            .html(colorOptions);
        }
      }

      // Calling genome view for updates with no transition
      generateGenomeView({
        transition: { shouldDo: false },
        shouldUpdateBlockCollisions: false,
        shouldUpdateLayout: true
      });
    });
};
