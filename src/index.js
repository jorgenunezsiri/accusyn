var d3 = require('d3');
var generateData = require('./generateData').generateData;

// Call generateData only after loading the data files
d3.queue()
  .defer(d3.csv, './files/gff.csv')
  .defer(d3.csv, './files/collinearity.csv')
  .await(generateData);
