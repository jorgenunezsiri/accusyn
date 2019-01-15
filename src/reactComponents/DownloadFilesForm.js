import React from 'react';

import { saveSvg, saveSvgAsPng } from 'save-svg-as-png';

import isEmpty from 'lodash/isEmpty';

import {
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';

import { getCurrentSelectedBlock } from './../variables/currentSelectedBlock';
import { renderReactAlert } from './../helpers';

/**
 * DownloadFilesForm component
 *
 * @param  {Object} props - Component props
 * @return {ReactElement} React element
 * @extends React.Component
 * @public
 */
class DownloadFilesForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      plotType: 'genome'
    };

    this.handleClick = this.handleClick.bind(this);
    this.handlePlotTypeChange = this.handlePlotTypeChange.bind(this);
  }

  handlePlotTypeChange(evt) {
    this.setState({
      plotType: evt.target.value
    });
  }

  handleClick() {
    const plotType = this.state.plotType;
    const formatType = d3Select(".download-files-form-container p.format-type select").property("value");
    const darkMode = d3Select("p.dark-mode input").property("checked");
    const backgroundColor = darkMode ? '#222222' : '#ffffff';
    // If keep-block-highlighted input is not found, then there are no chords in the genome view,
    // meaning that I don't need to reset opacity
    const shouldResetOpacity = !d3Select(".download-files-form-container p.keep-block-highlighted input").empty() &&
      !d3Select(".download-files-form-container p.keep-block-highlighted input").property("checked");

    let downloadFileName = '';
    let downloadView = '';

    if (plotType === 'genome') {
      downloadFileName = 'genome-view';
      downloadView = document.getElementById('main-container');
      // Before downloading, set all chords with the same opacity
      if (shouldResetOpacity) d3SelectAll("path.chord").attr("opacity", 0.7);
    } else if (plotType === 'block') {
      downloadFileName = 'block-view';
      downloadView = d3Select("#block-view-container svg.block-view").node();
    }

    if (downloadView && downloadView.hasChildNodes()) {
      switch(formatType) {
        case 'SVG':
          saveSvg(downloadView, `${downloadFileName}.svg`, {
            backgroundColor: backgroundColor
          });
          break;
        case 'JPEG':
          saveSvgAsPng(downloadView, `${downloadFileName}.jpeg`, {
            backgroundColor: backgroundColor,
            encoderOptions: 1, // 1 means top image quality
            encoderType: 'image/jpeg'
          });
          break;
        case 'PNG':
          saveSvgAsPng(downloadView, `${downloadFileName}.png`, {
            backgroundColor: backgroundColor,
            encoderOptions: 1, // 1 means top image quality
            encoderType: 'image/png'
          });
          break;
      }
    } else {
      // Showing error alert using react
      renderReactAlert(
        `The ${downloadFileName} is not present right now. Please, try again!`,
        'danger',
        10000
      );
    }

    if (plotType === 'genome') {
      // Adding a delay to re-select the current selected block by changing opacity
      setTimeout(function() {
        if (shouldResetOpacity) {
          const currentSelectedBlock = getCurrentSelectedBlock();
          d3SelectAll("path.chord").attr("opacity", 0.3);
          d3Select(`path.chord.id${currentSelectedBlock}`).attr("opacity", 0.9);
        }
      }, 500);
    }
  }

  render() {
    const isBlockViewPresent = !d3Select("#block-view-container svg.block-view").empty();
    const currentSelectedBlock = getCurrentSelectedBlock();
    const shouldIncludeHighlightedCheckbox = !d3Select("#genome-view g.chords > g").empty() && !isEmpty(currentSelectedBlock);

    return (
      <div className="download-files-form-container">
        <div className="options-container">
          <p className="plot-type">
            <span>View:</span>
            <select defaultValue="genome" onChange={this.handlePlotTypeChange}>
              <option value="genome">Genome</option>
              {isBlockViewPresent && <option value="block">Block</option>}
            </select>
          </p>
          {shouldIncludeHighlightedCheckbox && this.state.plotType === 'genome' &&
            <p className="keep-block-highlighted">
              <label>
                <input type="checkbox" name="keep-block-highlighted" value="Keep block highlighted" />
                <span>Keep block highlighted</span>
              </label>
            </p>
          }
          <p className="format-type">
            <span>Format:</span>
            <select defaultValue="SVG">
              <option value="SVG">SVG</option>
              <option value="JPEG">JPEG</option>
              <option value="PNG">PNG</option>
            </select>
          </p>
        </div>
        <p>
          <input
            onClick={this.handleClick}
            title="Downloads the selected view in the preferred format."
            type="button"
            value="Download"
          />
        </p>
      </div>
    );
  }
};

export default DownloadFilesForm;
