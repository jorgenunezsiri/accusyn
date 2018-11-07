import * as d3 from 'd3';

import generateData from './generateData';
import {
  detectDeviceType,
  getQueryString,
  isUrlFound,
  renderReactAlert
} from './helpers';

// Variables
import { getCurrentHost } from './variables/currentHost';

/*
// To set things only in production mode:

if (process.env.NODE_ENV === 'production') {
  console.log('PRODUCTION MODE HERE!!!!');
}
*/

/**
 * Process BedGraph file (e.g. feature_count, feature_density)
 *
 * @param  {Array<string>} fileNames File names to read
 * @param  {Function}      callback  Callback function to be called
 * @return {undefined}               undefined
 */
const processBedGraph = function processBedGraph(fileNames, callback) {
  const allData = [];
  for (let i = 0; i < fileNames.length; i++) {
    d3.text(`./files/${fileNames[i]}.bg`, function(data) {
      const result = `chromosomeID\tstart\tend\tvalue\n${data}`;
      const returnData = d3.tsvParse(result).reduce((dataInside, current) => {
        // Not including Scaffold chromosomes
        if (!current.chromosomeID.startsWith('Scaffold') &&
          !current.chromosomeID.startsWith('scaffold')) {

          // To check if last character is a number.
          // If not is treated as scaffold, i.e. current is not included
          if (isFinite(current.chromosomeID[current.chromosomeID.length - 1])) {
            dataInside.push(current);
          }
        }

        return dataInside;
      }, []);

      allData.push({
        data: returnData,
        name: fileNames[i]
      });

      // First callback parameter is null if complete task is successful
      if (i === (fileNames.length - 1)) callback(null, allData);
    });
  }
};

/**
 * Process simplified gff file
 *
 * @param  {string}   fileName File name to read
 * @param  {string}   fileType File type to read
 * @param  {Function} callback Callback function to be called
 * @return {undefined}         undefined
 */
const processGFF = function processGFF(fileName, fileType, callback) {
  return d3.text(`./files/${fileName}.${fileType}`, function(data) {
    const result = `chromosomeID\tgeneID\tstart\tend\n${data}`;
    const returnData = d3.tsvParse(result).reduce((dataInside, current) => {
      // Not including Scaffold chromosomes
      if (!current.chromosomeID.startsWith('Scaffold') &&
        !current.chromosomeID.startsWith('scaffold')) {

        // To check if last character is a number.
        // If not is treated as scaffold, i.e. current is not included
        if (isFinite(current.chromosomeID[current.chromosomeID.length - 1])) {
          dataInside.push(current);
        }
      }

      return dataInside;
    }, []);

    // First callback parameter is null if task is successful
    callback(null, returnData);
  });
};

/**
 * Process gff3 file
 *
 * @param  {string}   fileName File name to read
 * @param  {string}   fileType File type to read
 * @param  {Function} callback Callback function to be called
 * @return {undefined}         undefined
 */
const processGFF3 = function processGFF3(fileName, fileType, callback) {
  return d3.text(`./files/${fileName}.${fileType}`, function(data) {
    const result = `chromosomeID\torigin\ttype\tstart\tend\tscore\tstrand\tphase\tattributes\n${data}`;
    const returnData = d3.tsvParse(result).reduce((dataInside, current) => {
      // Only including features that are mRNA
      // and not including Scaffold chromosomes
      if (current.type === 'mRNA' && !current.chromosomeID.startsWith('Scaffold') &&
        !current.chromosomeID.startsWith('scaffold')) {

        // To check if last character is a number.
        // If not is treated as scaffold, i.e. current is not included
        if (isFinite(current.chromosomeID[current.chromosomeID.length - 1])) {
          dataInside.push(current);
        }
      }

      return dataInside;
    }, []);

    // First callback parameter is null if task is successful
    callback(null, returnData);
  });
};

/**
 * Process collinearity file
 *
 * @param  {string}   fileName File name to read
 * @param  {Function} callback Callback function to be called
 * @return {undefined}         undefined
 */
const processCollinearity = function processCollinearity(fileName, callback) {
  let score = 0;
  let eValueBlock = 0;
  let sourceChromosome = null;
  let targetChromosome = null;
  let isFlipped = 'no';
  let isScaffold = false;

  return d3.text(`./files/${fileName}.collinearity`, function(data) {
    const result = data.split('\n').reduce((dataInside, current) => {
      const trimmedCurrent = current.trim();

      // If the string is not empty
      if (trimmedCurrent.length > 1) {
        if (trimmedCurrent.startsWith('## Alignment')) {
          isScaffold = false;

          if (trimmedCurrent.includes('Scaffold') || trimmedCurrent.includes('scaffold')) {
            isScaffold = true;
            return dataInside; // Return before because it is Scaffold data
          }

          const currentLineSplit = trimmedCurrent.split(' ');
          score = currentLineSplit[3].split('=')[1];
          eValueBlock = currentLineSplit[4].split('=')[1];
          const sourceAndTarget = currentLineSplit[6].split('&');
          sourceChromosome = sourceAndTarget[0];
          targetChromosome = sourceAndTarget[1];

          // If last character from source or target is not a number, then return early
          if (!isFinite(sourceChromosome[sourceChromosome.length - 1]) ||
            !isFinite(targetChromosome[targetChromosome.length - 1])) {
            isScaffold = true;
            return dataInside; // Return before because it is Scaffold data
          }

          // Plus means not flipped, and minus means flipped
          if (currentLineSplit[currentLineSplit.length - 1].trim() === 'plus') {
            isFlipped = 'no';
          } else if (currentLineSplit[currentLineSplit.length - 1].trim() === 'minus') {
            isFlipped = 'yes';
          }
        } else if (!trimmedCurrent.startsWith('#')) {
          if (isScaffold) {
            return dataInside; // Return before because it is Scaffold data
          }

          const currentLineSplit = trimmedCurrent.split(':');
          const currentObject = {
            block: currentLineSplit[0].split('-')[0].trim(),
            connection: currentLineSplit[0].split('-')[1].trim()
          };

          // Splitting connection details by any amount of white space
          const connectionDetails = currentLineSplit[1].trim().split(/\s+/);

          currentObject.connectionSource = connectionDetails[0];
          currentObject.connectionTarget = connectionDetails[1];
          currentObject.sourceChromosome = sourceChromosome;
          currentObject.targetChromosome = targetChromosome;
          currentObject.eValueConnection = connectionDetails[2];
          currentObject.score = score;
          currentObject.eValueBlock = eValueBlock;
          currentObject.isFlipped = isFlipped;

          dataInside.push(currentObject);
        }
      }

      return dataInside;
    }, []);

    // First callback parameter is null if task is successful
    callback(null, result);
  });
};

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
  gffType = gffType !== null ? gffType[0] : 'gff';
  collinearity = collinearity !== null ? collinearity[0] : 'bnapus_top_5_hits';
  additionalTrack = additionalTrack !== null ? additionalTrack : (gff === 'bnapus' ? [
    'bnapus_gene_count',
    'bnapus_gene_density',
    'bnapus_repeat_count',
    'bnapus_repeat_density'
  ] : null);

  const isValidUrlGff =
    await isUrlFound(`${getCurrentHost()}files/${gff}.${gffType}`);
  const isValidUrlCollinearity =
    await isUrlFound(`${getCurrentHost()}files/${collinearity}.collinearity`);

  let isValidUrlAdditionalTrack = true;
  if (additionalTrack) {
    for (let i = 0; i < additionalTrack.length; i++) {
      isValidUrlAdditionalTrack = isValidUrlAdditionalTrack &&
        await isUrlFound(`${getCurrentHost()}files/${additionalTrack[i]}.bg`);
    }
  }

  if (isValidUrlGff && isValidUrlCollinearity && isValidUrlAdditionalTrack) {
    // Call generateData only after loading the data files
    const q = d3.queue();
    q.defer(gffType === 'gff3' ? processGFF3 : processGFF, gff, gffType);
    q.defer(processCollinearity, collinearity);

    if (additionalTrack) {
      q.defer(processBedGraph, additionalTrack);
    }

    q.await(generateData);
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
