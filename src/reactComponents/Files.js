import React from 'react';
import ReactDOM from 'react-dom';
import App from './templates/App';
import SubmitMainFilesForm from './SubmitMainFilesForm';

import cloneDeep from 'lodash/cloneDeep';
import isString from 'lodash/isString';

import generateData from './../generateData';
import {
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3-selection';

import { getCurrentHost } from '../variables/currentHost';
import { renderReactAlert } from './../helpers';
import {
  processCollinearity,
  processGFF,
  processGFF3,
  readFileAsText
} from './../processFiles';


/**
 * Files component
 *
 * @param  {Object} props - Component props
 * @return {ReactElement} React element
 * @extends React.Component
 * @public
 */
class Files extends React.Component {
  constructor(props) {
    super(props);
    this.handleSubmitMainFilesFormClick = this.handleSubmitMainFilesFormClick.bind(this);
  }

  handleSubmitMainFilesFormClick() {
    const gffType = d3Select("div.submit-main-files-form-container select").property("value");
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
        gffData = cloneDeep(gff);
        return processCollinearity("collinearity-file-upload", readFileAsText);
      })
      .then((collinearity) => {
        collinearityData = cloneDeep(collinearity);

        // Hiding the page information until the new one is loaded
        if (!d3Select("#page-container").empty()) {
          d3Select("#page-container").style("display", "none");
        }
        if (!d3Select("#config").empty()) {
          d3Select("#config").style("display", "none");
        }

        if (!d3Select("#form-config").empty()) {
          // Removing everything inside configuration panel
          d3SelectAll("#form-config > *").remove();
        }

        if (!d3Select("div.genome-view-content").empty()) {
          // Removing the complete genome view
          d3Select("div.genome-view-content").node().parentNode.remove();
        }

        // Dismissing modal
        if (!d3Select(".modal-reactstrap button.close").empty()) {
          d3Select(".modal-reactstrap button.close").node().click();
        }

        // Removing current html container (Home or App)
        const containerElement = document.getElementById('root');
        ReactDOM.unmountComponentAtNode(containerElement);

        // Adding a delay so the modal can get closed
        setTimeout(function() {
          // Removing url parameters without refreshing page
          // More info here: https://stackoverflow.com/a/45012889
          const newURL = window.location.href.split('?')[0];
          window.history.pushState('object', document.title, newURL);

          // Adding the App html container
          ReactDOM.render(<App />, containerElement);

          generateData(gffData, collinearityData);
        }, 200);
      })
      .catch((error) => {
        d3Select("#loader").style("display", "none");

        // If error is defined and it is a string
        if (error && isString(error)) {
          // Showing custom alert using react
          renderReactAlert(error, 'danger', 15000);
        } else {
          // Showing error alert using react
          renderReactAlert(
            'There was an error while submitting the files. Please, try again!',
            'danger',
            15000
          );
        }
      });
  }

  render() {
    return (
      <div>
        {<SubmitMainFilesForm handleClick={this.handleSubmitMainFilesFormClick} />}

        <h5 className="separator disabled">──────────────────────────────────────────────────────</h5>

        <p>These are other sample files that can be loaded with <strong>AccuSyn</strong>:</p>
        <p>
          <a href={`${getCurrentHost()}?gff=at&collinearity=at`}>
          At</a> - <em>Arabidopsis thaliana</em> (Thale cress)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=at_vv&collinearity=at_vv`}>
          At vs. Vv</a> - <em>Arabidopsis thaliana</em> (Thale cress) vs. <em>Vitis vinifera</em> (Grape vine)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=bnapus&collinearity=bnapus&additionalTrack=bnapus_gene_count&additionalTrack=bnapus_gene_density&additionalTrack=bnapus_repeat_count&additionalTrack=bnapus_repeat_density`}>
          Bn</a> - <em>Brassica napus</em> (Canola)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=brassica&collinearity=brassica&additionalTrack=brassica_gene_count&additionalTrack=brassica_gene_density`}>
          Brassica</a> - <em>A (rapa), B (nigra), C (oleracea), D (napus)</em>
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=camelina&collinearity=camelina&additionalTrack=camelina_gene_count&additionalTrack=camelina_gene_density&additionalTrack=camelina_repeat_count&additionalTrack=camelina_repeat_density`}>
          Cs</a> - <em>Camelina sativa</em> (Camelina)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=hs_pt&collinearity=hs_pt&additionalTrack=hs_pt_gene_count`}>
          Hs vs. Pt</a> - <em>Homo sapiens</em> (Human - hg38) vs. <em>Pan troglodytes</em> (Chimpanzee - panTro3)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=os_sb&collinearity=os_sb`}>
          Os vs. Sb</a> - <em>Oryza sativa</em> (Asian rice) vs. <em>Sorghum bicolor</em> (Sorghum)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=cs_iwgsc&collinearity=cs_iwgsc&additionalTrack=cs_genes&additionalTrack=cs_SNPs&additionalTrack=cs_PresenceAbsence`}>
          Wheat (IWGSC)</a> - <em>Triticum aestivum</em> (Chinese Spring)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=wheat_hb&collinearity=wheat_hb`}>
          Wheat (Hybrid)</a> - <em>Artificial Hexaploid</em> (Hybrid)
        </p>
        <p>
          <a href={`${getCurrentHost()}?gff=cs_hb&collinearity=cs_hb`}>
          Wheat (CS vs. HB)</a> - <em>Chinese Spring</em> vs. <em>Artificial Hybrid Wheat</em>
        </p>
      </div>
    );
  }
};

export default Files;
