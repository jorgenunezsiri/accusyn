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
  // Alerting the user and returning early if not Google Chrome
  if (!window.chrome) {
    // Showing alert using react
    renderReactAlert(
      "Please, use the latest version of Google Chrome for the best app experience.",
      "danger",
      15000
    );

    return;
  }

  console.log('SCREN WIDTH: ', window.screen.width, detectDeviceType(window.navigator.userAgent).type);

  // Alerting the user and returning early if not Desktop browser
  const deviceType = detectDeviceType(window.navigator.userAgent).type;
  if (deviceType !== 'desktop') {
    // Showing alert using react
    renderReactAlert(
      `Please, use a desktop browser for the best app experience.
      Your current device is ${deviceType}.`,
      "danger",
      15000
    );

    return;
  }

  // Alerting the user and returning early if not Desktop resolution
  const screenWidth = window.screen.width;
  if (screenWidth < 1440) {
    // Showing alert using react
    renderReactAlert(
      `Please, use a desktop screen width of at least 1440 pixels for the best app experience.
      Your current screen width is ${screenWidth} pixels.`,
      "danger",
      15000
    );

    return;
  }

  // Reading query parameters
  let gff = getQueryString('gff');
  let gffType = getQueryString('gffType');
  let collinearity = getQueryString('collinearity');
  let additionalTrack = getQueryString('additionalTrack');

  gff = gff !== null ? gff[0] : 'bnapus';
  gffType = gffType !== null ? gffType[0].toLowerCase() : 'gff';
  collinearity = collinearity !== null ? collinearity[0] : 'bnapus_top_5_hits';
  additionalTrack = additionalTrack !== null ? additionalTrack : (gff === 'bnapus' ? [
    'bnapus_gene_count',
    'bnapus_gene_density',
    'bnapus_repeat_count',
    'bnapus_repeat_density'
  ] : null);

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
