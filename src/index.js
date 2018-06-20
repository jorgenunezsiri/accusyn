import * as d3 from 'd3';
import generateData from './generateData';

/*
// To set things only in production mode:

if (process.env.NODE_ENV === 'production') {
  console.log('PRODUCTION MODE HERE!!!!');
}
*/

const processGFF = function processGFF(fileName, callback) {
  return d3.text(fileName, function(data) {
    const result = `sequenceID\torigin\ttype\tstart\tend\tscore\tstrand\tphase\tattributes\n${data}`;
    const returnData = d3.tsvParse(result).reduce((dataInside, current) => {
      // Only including features that are mRNA
      // and not including Scaffold chromosomes
      if (current.type === 'mRNA' && !current.sequenceID.startsWith('Scaffold')) {
        dataInside.push(current);
      }
      return dataInside;
    }, []);
    console.log('length: ', returnData.length);
    callback(null, returnData);
  });
};

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
          if (currentLineSplit[currentLineSplit.length - 1].trim() == 'plus') {
            isFlipped = 'no';
          } else if (currentLineSplit[currentLineSplit.length - 1].trim() == 'minus') {
            isFlipped = 'yes';
          }
        }
      }
      return dataInside;
    }, []);
    console.log('result size: ', result.length);
    callback(null, result);
  });
};

// Call generateData only after loading the data files
d3.queue()
  .defer(processGFF, './files/Bnapus_genes_v3.1.gff3')
  .defer(processCollinearity, './files/bnapus.collinearity')
  // .defer(d3.csv, './files/gff.csv')
  // .defer(d3.csv, './files/collinearity.csv')
  .await(generateData);
