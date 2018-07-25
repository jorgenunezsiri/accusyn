import * as d3 from 'd3';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import AlertWithTimeout from './reactComponents/Alert';

import generateData from './generateData';
import {
  getQueryString,
  isUrlFound
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
 * Process simplified gff file
 *
 * @param  {[type]}   fileName File name to read
 * @param  {Function} callback Callback function to be called
 * @return {undefined}         undefined
 */
const processGFF = function processGFF(fileName, callback) {
  return d3.text(fileName, function(data) {
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

    callback(null, returnData);
  });
};

/**
 * Process gff3 file
 *
 * @param  {[type]}   fileName File name to read
 * @param  {Function} callback Callback function to be called
 * @return {undefined}         undefined
 */
const processGFF3 = function processGFF3(fileName, callback) {
  return d3.text(fileName, function(data) {
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

    callback(null, returnData);
  });
};

/**
 * Process collinearity file
 *
 * @param  {[type]}   fileName File name to read
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

  return d3.text(fileName, function(data) {
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

    callback(null, result);
  });
};

(async function main() {
  const gff = getQueryString('gff') || 'bnapus';
  const gffType = getQueryString('gffType') || 'gff';
  const collinearity = getQueryString('collinearity') || 'bnapus-top-5-hits';

  const isValidUrlGff =
    await isUrlFound(`${getCurrentHost()}files/${gff}.${gffType}`);
  const isValidUrlCollinearity =
    await isUrlFound(`${getCurrentHost()}files/${collinearity}.collinearity`);

  if (isValidUrlGff && isValidUrlCollinearity) {
    // Call generateData only after loading the data files
    d3.queue()
    .defer(gffType === 'gff3' ? processGFF3 : processGFF,
    `./files/${gff}.${gffType}`)
    .defer(processCollinearity, `./files/${collinearity}.collinearity`)
    .await(generateData);
  } else {
    ReactDOM.render(
      <AlertWithTimeout
        color = "danger"
        message = {"The current url parameters are not valid. Please, try again!"}
      />,
      document.getElementById('alert-container')
    );
  }
})();
