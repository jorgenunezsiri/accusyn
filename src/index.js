import * as d3 from 'd3';

import React from 'react';
import ReactDOM from 'react-dom';
import App from './reactComponents/templates/App';
import Home from './reactComponents/templates/Home';

import isString from 'lodash/isString';

import generateData from './generateData';
import {
  detectDeviceType,
  getQueryString,
  isUrlFound,
  renderReactAlert
} from './helpers';

import {
  processBedGraph,
  processCollinearity,
  processGFF,
  processGFF3
} from './processFiles';

// Variables
import { getCurrentHost } from './variables/currentHost';

/*
// To set things only in production mode:

if (process.env.NODE_ENV === 'production') {
  console.log('PRODUCTION MODE HERE!!!!');
}
*/

(async function main() {
  function requireAll(r) {
    r.keys().forEach(r);
  }

  // Importing all SVG icons into the JS bundle
  requireAll(require.context('./icons/', true, /\.svg$/));

  const deviceType = detectDeviceType(window.navigator.userAgent).type;
  const {
    chrome,
    screen: { width: screenWidth },
    devicePixelRatio
  } = window;

  if (deviceType !== 'desktop') {
    // Alerting the user if not Desktop browser
    // Showing alert using react
    renderReactAlert(
      `Warning: Use a desktop browser for the best app experience.
      Your current device is ${deviceType}.`,
      'warning',
      15000
    );
  } else if (!chrome) {
    // Alerting the user if not Google Chrome
    // Showing alert using react
    renderReactAlert(
      'Warning: Use the latest version of Google Chrome for the best app experience.',
      'warning',
      15000
    );
  } else if (screenWidth < 1440) {
    // Alerting the user if not Desktop resolution
    // Showing alert using react
    renderReactAlert(
      `Warning: Use a desktop screen width of at least 1440 pixels for the best app experience.
      Your current screen width is ${screenWidth} pixels.`,
      'warning',
      15000
    );
  } else if (devicePixelRatio !== 1 && devicePixelRatio !== 2) {
    // Alerting the user if not Desktop resolution
    // Showing alert using react
    renderReactAlert(
      'Warning: Set the browser zoom level to 100% for the best app experience.',
      'warning',
      15000
    );
  }

  // Reading query parameters
  let gff = getQueryString('gff');
  let gffType = getQueryString('gffType');
  let collinearity = getQueryString('collinearity');
  let additionalTrack = getQueryString('additionalTrack');

  const containerElement = document.getElementById('root');
  ReactDOM.unmountComponentAtNode(containerElement);
  if (gff === null || collinearity === null) {
    ReactDOM.render(<Home />, containerElement);
    return; // Returning earlier
  } else {
    ReactDOM.render(<App />, containerElement);
  }

  gff = gff[0];
  collinearity = collinearity[0];
  gffType = gffType !== null ? gffType[0].toLowerCase() : 'gff';

  // Displaying the loader if not homepage (i.e. parameters are not null)
  d3.select("#loader")
    .style("display", "block");

  const gffFilePath = `files/${gff}.${gffType}`;
  const collinearityFilePath = `files/${collinearity}.collinearity`;
  const additionalTrackFilePaths = [];

  const isValidUrlGff =
    await isUrlFound(`${getCurrentHost()}${gffFilePath}`);
  const isValidUrlCollinearity =
    await isUrlFound(`${getCurrentHost()}${collinearityFilePath}`);

  let isValidUrlAdditionalTrack = true;
  if (additionalTrack) {
    for (let i = 0; i < additionalTrack.length; i++) {
      additionalTrackFilePaths.push(`files/${additionalTrack[i]}.bg`);
      isValidUrlAdditionalTrack = isValidUrlAdditionalTrack &&
        await isUrlFound(`${getCurrentHost()}${additionalTrackFilePaths[i]}`);
    }
  }

  if (isValidUrlGff && isValidUrlCollinearity && isValidUrlAdditionalTrack) {
    // NOTE: Anything that is inside a Promise that fails,
    // it's caught as an error inside the catch of the Promise.
    // But it needs to be inside a Promise in order to be caught.
    // i.e. if something fails when calling generateData below, it's going to be caught.
    try {
      // Call generateData only after loading the data files
      const gffData = gffType === 'gff3' ?
        await processGFF3(gffFilePath) : await processGFF(gffFilePath);
      const collinearityData = await processCollinearity(collinearityFilePath);
      let additionalTrackData;
      if (additionalTrack) {
        additionalTrackData = await processBedGraph(additionalTrackFilePaths, additionalTrack);
      }

      generateData(gffData, collinearityData, additionalTrackData);
    } catch (error) {
      console.log('ERROR: ', error);
      // If error is defined and it is a string
      if (error && isString(error)) {
        // Showing custom alert using react
        renderReactAlert(error, "danger", 15000);
      } else {
        // Showing error alert using react
        renderReactAlert(
          "There was an error while reading the files. Please, try again!",
          "danger",
          15000
        );
      }
    }
  } else {
    // Showing alert using react
    renderReactAlert(
      "The current url parameters are not valid. Please, try again!",
      "danger",
      15000
    );
  }

  return;
})();
