import React from 'react';

import isString from 'lodash/isString';

import { select as d3Select } from 'd3';

import { pushAdditionalTrack } from './../variables/additionalTrack';

import generateAdditionalTracks, {
  addAdditionalTracksMenu
} from './../generateAdditionalTracks';

import { renderReactAlert } from './../helpers';
import {
  processBedGraph,
  readFileAsText
} from './../processFiles';

/**
 * SubmitAdditionalTracksForm component
 *
 * @param  {Object} props - Component props
 * @return {ReactElement} React element
 * @extends React.Component
 * @public
 */
class SubmitAdditionalTracksForm extends React.Component {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  async handleClick() {
    try {
      const nameTextField = d3Select("#name-additional-track").property("value");
      const file = document.getElementById('additional-track-file-upload').files[0];
      const fileDotIndex = file.name.indexOf('.');
      // By default, the name will be equal to the custom given name (textfield)
      // If null, then check if the file name has a dot and assign the name without dot
      const fileName = nameTextField || (fileDotIndex === (-1) ? file.name : file.name.substring(0, fileDotIndex));

      // Showing loader
      d3Select("#loader").style("display", "block");
      // Dismissing alert if it is showing
      if (!d3Select(".alert-dismissible button.close").empty()) {
        d3Select(".alert-dismissible button.close").node().click();
      }

      const bedGraph = await processBedGraph(['additional-track-file-upload'], [fileName], readFileAsText);

      const parsedBedGraph = generateAdditionalTracks(bedGraph);

      // Spreading array content to be pushed, beacause parsedBedGraph and bedGraph are both arrays
      pushAdditionalTrack(...parsedBedGraph);

      // Adding new track to the additional track menu
      addAdditionalTracksMenu(parsedBedGraph);

      // Making the new added tab active and making sure the panel resizes by clicking it
      d3Select(`#form-config .additional-tracks-panel div.tabs button.tab-link.${fileName}`).node().click();
      // Selecting the track automatically as a heatmap
      d3Select(`div.additional-track.${fileName} .track-type select`).property("value", "heatmap");
      d3Select(`div.additional-track.${fileName} .track-type select`).dispatch('change');

      // Dismissing modal
      if (!d3Select(".modal-reactstrap button.close").empty()) {
        d3Select(".modal-reactstrap button.close").node().click();
      }

      // Adding a delay so the modal can get closed
      setTimeout(function() {
        d3Select("#loader").style("display", "none");
      }, 200);
    } catch (error) {
      d3Select("#loader").style("display", "none");
      console.log('ERROR: ', error);

      // If error is defined and it is a string
      if (error && isString(error)) {
        // Showing custom alert using react
        renderReactAlert(error, 'danger', 15000);
      } else {
        // Showing error alert using react
        renderReactAlert(
          'There was an error while submitting the file. Please, try again!',
          'danger',
          15000
        );
      }
    }
  }

  render() {
    return (
      <div className="submit-additional-tracks-form-container">
        <p>
          <label>
            <span>Track file: </span>
            <input type="file" name="additional-track-file-upload" id="additional-track-file-upload" />
          </label>
        </p>
        <p className="additional-track-name-field">
          <label>
            <span>Name: </span>
            <input
              id="name-additional-track"
              title="Custom name to be assigned to the additional track."
              type="text"
              placeholder="Optional track name" />
          </label>
        </p>
        <p>
          <input
            className="btn btn-outline-primary"
            id="submit-additional-track-file-upload"
            onClick={this.handleClick}
            title="Submits additional track files to be loaded with the application."
            type="button"
            value="Submit" />
        </p>
      </div>
    );
  }
};

export default SubmitAdditionalTracksForm;
