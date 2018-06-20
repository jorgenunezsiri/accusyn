import * as d3 from 'd3';
import generateData from './generateData';
import { getQueryString } from './helpers';

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
      if (!current.chromosomeID.startsWith('Scaffold')) {
        dataInside.push(current);
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
      if (current.type === 'mRNA' && !current.chromosomeID.startsWith('Scaffold')) {
        dataInside.push(current);
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
  let isFlipped = 'no';

  return d3.text(fileName, function(data) {
    const result = data.split('\n').reduce((dataInside, current, i) => {
      const trimmedCurrent = current.trim();

      // If the string is not empty
      if (trimmedCurrent.length > 1) {
        if (!trimmedCurrent.startsWith('#')) {
          const currentLineSplit = trimmedCurrent.split(':');
          const currentObject = {
            block: currentLineSplit[0].split('-')[0].trim(),
            connection: currentLineSplit[0].split('-')[1].trim()
          };

          // Splitting connection details by any amount of white space
          const connectionDetails = currentLineSplit[1].trim().split(/\s+/);

          currentObject.source = connectionDetails[0];
          currentObject.target = connectionDetails[1];
          currentObject.eValueConnection = connectionDetails[2];
          currentObject.score = score;
          currentObject.eValueBlock = eValueBlock;
          currentObject.isFlipped = isFlipped;

          if (currentObject.source.includes('N') && currentObject.target.includes('N')) {
            dataInside.push(currentObject);
          }

        } else if (trimmedCurrent.startsWith('## Alignment')) {
          const currentLineSplit = trimmedCurrent.split(' ');
          score = currentLineSplit[3].split('=')[1];
          eValueBlock = currentLineSplit[4].split('=')[1];
          // plus means not flipped, and minus means flipped
          if (currentLineSplit[currentLineSplit.length - 1].trim() === 'plus') {
            isFlipped = 'no';
          } else if (currentLineSplit[currentLineSplit.length - 1].trim() === 'minus') {
            isFlipped = 'yes';
          }
        }
      }
      return dataInside;
    }, []);
    callback(null, result);
  });
};

(function main() {
  const gff = getQueryString('gff') || 'bnapus';
  const gffType = getQueryString('gffType') || 'gff';
  const collinearity = getQueryString('collinearity') || 'bnapus-top-5-hits';

  // Call generateData only after loading the data files
  d3.queue()
    .defer(gffType === 'gff3' ? processGFF3 : processGFF,
      `./files/${gff}.${gffType}`)
    .defer(processCollinearity, `./files/${collinearity}.collinearity`)
    .await(generateData);
})();
