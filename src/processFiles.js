import {
  text as d3Text,
  tsvParse as d3TsvParse
} from 'd3';

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

  // Checking if last character is a number,
  // and if the chromosome ID length is maximum 5.
  // If not is treated as scaffold, i.e. is not included
  if (!isFinite(chromosomeID[chromosomeID.length - 1]) ||
    chromosomeID.length > 5) return false;

  return true;
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
  for (let i = 0; i < files.length; i++) {
    allPromises.push(reader(files[i]).then(function(data) {
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
        if (!haveAtLeastOneGffChromosome) {
          reject(`The additional track file ${fileNames[i]} is not compatible with the GFF file. Please, try again!`);
        } else {
          resolve({
            data: returnData,
            name: fileNames[i]
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
    if (data.split("\n")[0].split("\t").length !== 4) {
      return new Promise((resolve, reject) =>
        reject("The GFF file was not submitted in GFF simplified file format. Please, try again!"));
    }

    const result = `chromosomeID\tgeneID\tstart\tend\n${data}`;
    const returnData = d3TsvParse(result).reduce((dataInside, current) => {
      const currentChromosomeID = current.chromosomeID;

      // Checking for scaffold data
      if (shouldAddChromosomeID(currentChromosomeID)) {
        if (!currentChromosomesInsideGFF.includes(currentChromosomeID)) {
          console.log('PUSHING: ', currentChromosomeID);
          currentChromosomesInsideGFF.push(currentChromosomeID);
        }

        dataInside.push(current);
      }

      return dataInside;
    }, []);

    console.log('RESULT: ', currentChromosomesInsideGFF);

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
    if (data.split("\n")[0].split("\t").length !== 9) {
      return new Promise((resolve, reject) =>
        reject("The GFF file was not submitted in GFF3 complete file format. Please, try again!"));
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
  let score = 0;
  let eValueBlock = 0;
  let sourceChromosome = null;
  let targetChromosome = null;
  let isFlipped = 'no';
  let isScaffold = false;
  let haveAtLeastOneGffChromosome = false;

  console.log('currentChromosomesInsideGFF: ', currentChromosomesInsideGFF);

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
          } else if (!trimmedCurrent.startsWith('#')) {
            // Reading block connections
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

  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    // Returning content after loading it using onload event handler from FileReader
    reader.onload = (evt) => resolve(evt.target.result);
    reader.onerror = () => reject();
    if (file) reader.readAsText(file);
    else reject(`The ${fileType} file was not submitted. Please, try again!`);
  });
};
