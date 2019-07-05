// D3
import { text as d3Text } from 'd3-fetch';
import { tsvParse as d3TsvParse } from 'd3-dsv';

// Lodash
import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';

// Variable getters
import { getAdditionalTrackNames } from './variables/additionalTrack';

// Local variable to store the chromosomes in the GFF file
// This is used to make sure the user loads compatible collinearity
// and additional track files
let currentChromosomesInsideGFF = [];

/**
 * Checks if chromosome ID should be added, or if it is scaffold data
 *
 * @param  {string} chromosomeID Chromosome ID
 * @return {boolean} True if chromosome ID should be added (it's not scaffold), false otherwise
 */
function shouldAddChromosomeID(chromosomeID) {
  // Not including Scaffold chromosomes
  if (chromosomeID.toLowerCase().includes('scaffold')) return false;

  const chromosomeIDLength = chromosomeID.length;
  const lastChrPosition = chromosomeID[chromosomeIDLength - 1];

  // If last character is not a number and is not an uppercase letter,
  // or if the chromosome ID length is more than 5.
  // Then it is treated as scaffold, i.e. is not included
  if ((!isFinite(lastChrPosition) && !(lastChrPosition >= 'A' && lastChrPosition <= 'Z')) ||
    chromosomeIDLength > 5) return false;

  return true;
};


/**
 * Checks for additional track file name format
 *
 * @param  {string} fileName Current file name
 * @return {boolean}         True if file name is in wrong format, false otherwise
 */
function checkAdditionalTrackNameFormat(fileName) {
  const lowerCaseFileName = fileName.toLowerCase();
  const firstPosition = lowerCaseFileName.charAt(0);

  // The fileName cannot start with hyphen or underscore
  if (firstPosition === '-' || firstPosition === '_') return true;

  for (let i = 0; i < lowerCaseFileName.length; i++) {
    const currentPosition = lowerCaseFileName[i];

    // Checking for letters, hyphens, and underscores
    // NOTE: It is in wrong format if file name does not include those
    if (!(currentPosition >= 'a' && currentPosition <= 'z') &&
      currentPosition !== '-' && currentPosition !== '_') {
        return true;
    }
  }

  return false;
};

/**
 * Process BedGraph file (e.g. feature_count, feature_density)
 *
 * @param  {Array<string>} files     Files to read
 * @param  {Array<string>} fileNames File names to be used in returned obect
 * @param  {Function}      reader    Reader function to read file as text
 * @return {undefined}               undefined
 */
export function processBedGraph(files, fileNames, reader = d3Text) {
  const allPromises = [];
  let haveAtLeastOneGffChromosome = false;
  const currentAdditionalTrackNames = cloneDeep(getAdditionalTrackNames());
  for (let i = 0; i < files.length; i++) {
    allPromises.push(reader(files[i]).then(function(data) {
      const currentFileName = fileNames[i].toString();
      // Checking for file format
      // The second column needs to be a number. If it is NaN then error
      const firstLineSplit = data.split('\n')[0].split('\t');
      if (firstLineSplit.length !== 4 ||
        !isEmpty(firstLineSplit[1]) && isNaN(firstLineSplit[1])) {
        return new Promise((resolve, reject) =>
          reject(`The additional track file "${currentFileName}" was not submitted in the BedGraph file format. Please, try again!`)
        );
      }

      // Checking for file name duplication
      // If current file name is found in the current additional tracks or
      // if the fileNames array contains the current file name more than once
      if (currentAdditionalTrackNames.indexOf(currentFileName) !== (-1) ||
        fileNames.filter(file => file === currentFileName).length > 1) {
        return new Promise((resolve, reject) =>
          reject(`The additional track name "${currentFileName}" is already being used by another track. Please, try again!`)
        );
      }

      // Checking for file name additional track format
      if (checkAdditionalTrackNameFormat(currentFileName)) {
        return new Promise((resolve, reject) =>
          reject(`The additional track "${currentFileName}" is using the wrong format on its name.
            The valid characters are letters, hyphens, and underscores.
            Please, try again!`)
        );
      }

      haveAtLeastOneGffChromosome = false;
      const result = `chromosomeID\tstart\tend\tvalue\n${data}`;
      const returnData = d3TsvParse(result).reduce((dataInside, current) => {
        const currentChromosomeID = current.chromosomeID;

        // Checking for scaffold data
        if (shouldAddChromosomeID(currentChromosomeID)) {
          // Checking if current track is compatible with the gff file
          if (!haveAtLeastOneGffChromosome &&
            currentChromosomesInsideGFF.includes(currentChromosomeID)) {
            haveAtLeastOneGffChromosome = true;
          }

          dataInside.push(current);
        }

        return dataInside;
      }, []);

      // Return promise for each file
      return new Promise((resolve, reject) => {
        // Checking for compatibility with GFF file
        if (!haveAtLeastOneGffChromosome) {
          reject(`The additional track file "${currentFileName}" is not compatible with the GFF file. Please, try again!`);
        } else {
          resolve({
            data: returnData,
            name: currentFileName
          });
        }
      });
    }));
  }

  // Return promise if complete task is successful
  return Promise.all(allPromises).then(values => values);
};

/**
 * Process simplified gff file
 *
 * @param  {string}   file   File to read
 * @param  {Function} reader Reader function to read file as text
 * @return {undefined}       undefined
 */
export function processGFF(file, reader = d3Text) {
  currentChromosomesInsideGFF = [];
  return reader(file).then(function(data) {
    // Checking for file format
    // The second column needs to be a string. If it is not NaN (it is a number) then error
    const firstLineSplit = data.split('\n')[0].split('\t');
    if (firstLineSplit.length !== 4 ||
      !isEmpty(firstLineSplit[1]) && !isNaN(firstLineSplit[1]) && isString(firstLineSplit[1])) {
      return new Promise((resolve, reject) =>
        reject("The GFF file was not submitted in GFF simplified file format. Please, try again!")
      );
    }

    const result = `chromosomeID\tgeneID\tstart\tend\n${data}`;
    const returnData = d3TsvParse(result).reduce((dataInside, current) => {
      const currentChromosomeID = current.chromosomeID;

      // Checking for scaffold data
      if (shouldAddChromosomeID(currentChromosomeID)) {
        if (!currentChromosomesInsideGFF.includes(currentChromosomeID)) {
          currentChromosomesInsideGFF.push(currentChromosomeID);
        }

        dataInside.push(current);
      }

      return dataInside;
    }, []);

    if (currentChromosomesInsideGFF.length === 0) {
      return new Promise((resolve, reject) =>
        reject(`The first column in the GFF file is not following the correct format. The last character
          of the chromosomes needs to be a number or an uppercase letter (i.e. chr1, chrA1, chr1A).`)
      );
    }

    // Return promise if task is successful
    return new Promise(resolve => resolve(returnData));
  });
};

/**
 * Process gff3 file
 *
 * @param  {string}   file   File to read
 * @param  {Function} reader Reader function to read file as text
 * @return {undefined}       undefined
 */
export function processGFF3(file, reader = d3Text) {
  currentChromosomesInsideGFF = [];
  return reader(file).then(function(data) {
    // Checking for file format
    // The fourth and fifth columns need to be a number. If they are NaN then error
    const firstLineSplit = data.split('\n')[0].split('\t');
    if (firstLineSplit.length !== 9 ||
      !isEmpty(firstLineSplit[3]) && isNaN(firstLineSplit[3]) ||
      !isEmpty(firstLineSplit[4]) && isNaN(firstLineSplit[4])) {
      return new Promise((resolve, reject) =>
        reject("The GFF file was not submitted in GFF3 complete file format. Please, try again!")
      );
    }

    const result = `chromosomeID\torigin\ttype\tstart\tend\tscore\tstrand\tphase\tattributes\n${data}`;
    const returnData = d3TsvParse(result).reduce((dataInside, current) => {
      const currentChromosomeID = current.chromosomeID;
      // Only including features that are mRNA (this is for GFF3 files only)
      if (current.type !== 'mRNA') return dataInside;

      // Checking for scaffold data
      if (shouldAddChromosomeID(currentChromosomeID)) {
        if (!currentChromosomesInsideGFF.includes(currentChromosomeID)) {
          currentChromosomesInsideGFF.push(currentChromosomeID);
        }

        dataInside.push(current);
      }

      return dataInside;
    }, []);

    if (currentChromosomesInsideGFF.length === 0) {
      return new Promise((resolve, reject) =>
        reject(`The first column in the GFF3 file is not following the correct format. The last character
          of the chromosomes needs to be a number or an uppercase letter (i.e. chr1, chrA1, chr1A).`)
      );
    }

    // Return promise if task is successful
    return new Promise(resolve => resolve(returnData));
  });
};

/**
 * Process collinearity file
 *
 * @param  {string}   file   File to read
 * @param  {Function} reader Reader function to read file as text
 * @return {undefined}       undefined
 */
export function processCollinearity(file, reader = d3Text) {
  let blockID = -1;
  let connectionID = 0;
  let score = 0;
  let eValueBlock = 0;
  let sourceChromosome = null;
  let targetChromosome = null;
  let isFlipped = 'no';
  let isScaffold = false;
  let haveAtLeastOneGffChromosome = false;

  return reader(file).then(function(data) {
    return new Promise((resolve, reject) => {
      const result = data.split('\n').reduce((dataInside, current) => {
        const trimmedCurrent = current.trim();

        // If the string is not empty
        if (trimmedCurrent.length > 1) {
          if (trimmedCurrent.startsWith('## Alignment')) {
            // Reading block information (first line)

            const currentLineSplit = trimmedCurrent.split(' ');
            score = currentLineSplit[3].split('=')[1];
            eValueBlock = currentLineSplit[4].split('=')[1];
            const sourceAndTarget = currentLineSplit[6].split('&');
            sourceChromosome = sourceAndTarget[0];
            targetChromosome = sourceAndTarget[1];

            // Checking for scaffold data
            isScaffold = false;
            if (!shouldAddChromosomeID(sourceChromosome) ||
              !shouldAddChromosomeID(targetChromosome)) {
              isScaffold = true;
              return dataInside; // Return before because it is Scaffold data
            }

            // Checking if collinearity is compatible with the gff file
            if (!haveAtLeastOneGffChromosome && (
              currentChromosomesInsideGFF.includes(sourceChromosome) ||
              currentChromosomesInsideGFF.includes(targetChromosome)
            )) {
              haveAtLeastOneGffChromosome = true;
            }

            // Plus means not flipped, and minus means flipped
            if (currentLineSplit[currentLineSplit.length - 1].trim() === 'plus') {
              isFlipped = 'no';
            } else if (currentLineSplit[currentLineSplit.length - 1].trim() === 'minus') {
              isFlipped = 'yes';
            }
            // Increasing block ID and resetting connection ID for the next block
            blockID++;
            connectionID = 0;
          } else if (!trimmedCurrent.startsWith('#')) {
            // Reading block connections
            if (isScaffold) {
              return dataInside; // Return before because it is Scaffold data
            }

            const currentLineSplit = trimmedCurrent.split(':');
            const currentObject = {
              block: blockID,
              connection: connectionID++
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

      // Rejecting if not compatible with gff file
      if (!haveAtLeastOneGffChromosome) reject();

      // Return promise if task is successful
      resolve(result);
    })
    .catch(() => {
      return new Promise((resolve, reject) => {
        if (!haveAtLeastOneGffChromosome) {
          return reject("The GFF file is not compatible with the MCScanX collinearity file. Please, try again!");
        } else {
          return reject("There was an error while parsing the MCScanX Collinearity file. Please, try again!");
        }
      })
    });
  });
};

/**
 * Reads file as text
 * NOTE: This reader function is used when submitting new files
 *
 * @param  {string} fileID File ID from input field
 * @return {Object}        Promise with loaded text result or error
 */
export function readFileAsText(fileID) {
  const file = document.getElementById(fileID).files[0];
  let fileType = fileID.replace('-file-upload', '');
  if (fileType === 'gff') fileType = 'GFF';
  else if (fileType === 'collinearity') fileType = 'MCScanX Collinearity';
  else if (fileType === 'additional-track') fileType = 'Additional Track';

  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    // Returning content after loading it using onload event handler from FileReader
    reader.onload = (evt) => resolve(evt.target.result);
    reader.onerror = () => reject();
    if (file) reader.readAsText(file);
    else reject(`The ${fileType} file was not submitted. Please, try again!`);
  });
};
