import React from 'react';

import cloneDeep from 'lodash/cloneDeep';
import isString from 'lodash/isString';

import generateData from './../generateData';
import {
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';

import { renderReactAlert } from './../helpers';
import {
  processCollinearity,
  processGFF,
  processGFF3,
  readFileAsText
} from './../processFiles';

/**
 * SubmitMainFilesForm component
 *
 * @param  {Object} props - Component props
 * @return {ReactElement} React element
 * @extends React.Component
 * @public
 */
class SubmitMainFilesForm extends React.Component {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    const gffType = d3Select("div.submit-main-files-form-container select").property("value");
    console.log('GFF TYPE inside submit component: ', gffType);
    const gffProcessFunction = gffType === 'GFF3' ? processGFF3 : processGFF;

    // Showing loader
    d3Select("#loader").style("display", "block");
    // Dismissing alert if it is showing
    if (!d3Select(".alert-dismissible button.close").empty()) {
      d3Select(".alert-dismissible button.close").node().click();
    }

    let gffData, collinearityData;
    gffProcessFunction("gff-file-upload", readFileAsText)
      .then((gff) => {
        console.log('GFF VALUE: ', gff);
        gffData = cloneDeep(gff);
        return processCollinearity("collinearity-file-upload", readFileAsText);
      })
      .then((collinearity) => {
        console.log('Collinearity VALUE: ', collinearity);
        collinearityData = cloneDeep(collinearity);

        // Hiding the page information until the new one is loaded
        d3Select("#page-container").style("display", "none");
        d3Select("#config").style("display", "none");
        if (!d3Select("#form-config").empty()) {
          // Removing everything inside configuration panel
          d3SelectAll("#form-config > *").remove();
        }

        if (!d3Select("div.genome-view-container").empty()) {
          // Removing the complete genome view
          d3Select("div.genome-view-container").node().parentNode.remove();
        }

        // Dismissing modal
        d3Select(".modal-reactstrap button.close").node().click();

        // Adding a delay so the modal can get closed
        setTimeout(function() {
          // Removing url parameters without refreshing page
          // More info here: https://stackoverflow.com/a/45012889
          const newURL = window.location.href.split("?")[0];
          window.history.pushState('object', document.title, newURL);

          generateData(gffData, collinearityData);
        }, 200);
      })
      .catch((error) => {
        d3Select("#loader").style("display", "none");

        // If error is defined and it is a string
        if (error && isString(error)) {
          console.log('ERROR: ', error);
          // Showing custom alert using react
          renderReactAlert(error, "danger", 15000);
        } else {
          // Showing error alert using react
          renderReactAlert(
            "There was an error while submitting the files. Please, try again!",
            "danger",
            15000
          );
        }
      });
  }

  render() {
    return (
      <div className="submit-main-files-form-container">
        <div className="gff-file-upload-container">
          <p>
            <label>
              <span>GFF file: </span>
              <input type="file" name="gff-file-upload" id="gff-file-upload" />
            </label>
          </p>
          <p>
            <span>Type:</span>
            <select defaultValue="GFF">
              <option value="GFF">GFF (Simplified)</option>
              <option value="GFF3">GFF3 (Complete)</option>
            </select>
          </p>
        </div>
        <p>
          <label>
            <span>MCScanX Collinearity file: </span>
            <input type="file" name="collinearity-file-upload" id="collinearity-file-upload" />
          </label>
        </p>
        <p>
          <input
            id="submit-file-upload"
            onClick={this.handleClick}
            title="Submits files to be loaded with the application."
            type="button"
            value="Submit"
          />
        </p>
      </div>
    );
  }
};

export default SubmitMainFilesForm;
