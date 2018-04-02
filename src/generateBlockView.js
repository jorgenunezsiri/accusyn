/*
University of Saskatchewan
Project: A web-based genome synteny browser
Course: CMPT398 - Information Visualization

Name: Jorge Nunez Siri
NSID: jdn766
Student ID: 11239727

Function file: generateBlockView.js
*/

/**
 * Generates block view for the current highlighted block in the genome view
 *
 * @param  {Object} data Current data with all source and target chromosome
 *                       information
 * @return {undefined}   undefined
 */
function generateBlockView(data) {
  var sourceChromosomeID = data.source.id;
  var targetChromosomeID = data.target.id;
  var blockID = data.source.value.id;

  var margin = {
    top: 50,
    right: 90,
    bottom: 50,
    left: 90
  };
  var widthBlock = 500 - margin.left - margin.right;
  var heightBlock = 800 - margin.top - margin.bottom;

  // Set the ranges for x and y
  var y = [d3.scaleLinear().range([heightBlock, 0]), d3.scaleLinear().range([heightBlock, 0])];

  var x = d3.scalePoint().rangeRound([0, widthBlock]);
  var dimensions = [0, 1];
  x.domain(dimensions);

  var line = d3.line();

  /**
   * Defines the path for each data point in the block view
   *
   * d3 is looping through each data array
   * i can be either 0 or 1 (the dimensions),
   * thus dataArray[i] is the value for each dimension in the current array
   * y[i](dataArray[i]) is scaling the current value in the dimension
   *
   * @param  {Array<number>}   dataArray Current dataArray with [y0, y1] coordinates
   * @param  {Array<Function>} y         Current array of y scales
   * @return {Array<number>}             Current path line defined with the
   *                                     points [x0, projectionOfY0] and
   *                                     [x1, projectionOfY1]
   */
  function path(dataArray, y) {
    dataArray = dataArray.data;
    return line(dimensions.map(function(i) {
      return [x(i), y[i](dataArray[i])];
    }));
  }

  // Remove block view if it is present
  if (!d3.select("body").select("#block-view-container").empty()) {
    d3.select("body").select("#block-view-container").remove();
  }

  var gY0, gY1, y0axis, y1axis, isFlipped = false;
  var dataBlock = [];

  /**
   * Flips the data for the current block view
   *
   * @param  {Array<Object>} dataBlock Current block data array
   * @return {Array<Object>}           Flipped array
   */
  function flipTargetDataBlock(dataBlock) {
    var index = 1; // Flipping target by default
    var temp = 0;
    var tempArray = _.cloneDeep(dataBlock);

    for (var i = 0; i < tempArray.length / 2; i++) {
      temp = tempArray[i].data[index];
      tempArray[i].data[index] = tempArray[tempArray.length - i - 1].data[index];
      tempArray[tempArray.length - i - 1].data[index] = temp;
    }

    return tempArray;
  }

  /**
   * Determines if an array is perfectly flipped or not
   *
   * @param  {Array<Object>}  dataBlock Current block data array
   * @return {boolean}                  True if array is perfectly flipped,
   *                                    false otherwise
   */
  function isPerfectlyFlipped(dataBlock) {
    var tempArray = _.cloneDeep(dataBlock);
    var numericGeneArray = [];

    for (var i = 0; i < tempArray.length; i++) {
      numericGeneArray.push(parseInt(tempArray[i].target.id.split('g')[1].split('.')[0]));
    }

    var isDescending = true;

    for (var i = 0; i < numericGeneArray.length - 1; i++) {
      if (numericGeneArray[i] < numericGeneArray[i + 1]) {
        isDescending = false;
        break;
      }
    }

    return isDescending;
  }

  // Append block view container to the body of the page
  d3.select("body").append("div")
    .attr("id", "block-view-container")
    .style("float", "left")
    .style("margin-left", "50px")
    .style("margin-top", "50px");

  d3.select("#block-view-container")
    .append("button")
    .style("position", "absolute")
    .attr("title", "Resets the block view to its original scale.")
    .text("Reset")
    .on("click", function() {
      // Resetting by calling path block view
      generatePathBlockView(dataBlock);
    });

  var svgBlock = d3.select("#block-view-container")
    .append("svg")
    .attr("class", "block-view")
    .attr("width", widthBlock + margin.left + margin.right)
    .attr("height", heightBlock + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  d3.select("#block-view-container")
    .append("p")
    .style("text-align", "right")
    .style("margin", "-40px 30px 0 0")
    .append("input")
    .attr("class", "flip-orientation")
    .attr("type", "checkbox")
    .attr("name", "flip-orientation")
    .attr("value", "flip-orientation")
    .property("checked", false);

  d3.select("#block-view-container")
    .select("p")
    .append("span")
    .text("Flip Orientation");

  d3.select("#block-view-container")
    .append("p")
    .attr("class", "flip-hint")
    .style("display", "none")
    .style("margin-top", "10px")
    .html(function() {
      return '<em>Hint: This block is perfectly inverted.</em>';
    });

  d3.select("#block-view-container")
    .select(".flip-orientation")
    .on("change", function() {
      dataBlock = flipTargetDataBlock(dataBlock);
      isFlipped = d3.select(this).property("checked");

      // Calling path block view for updates
      generatePathBlockView(dataBlock);
    });

  // Rectangle that has the block view size to catch any zoom event
  var zoomView = svgBlock.append("rect")
    .attr("width", widthBlock)
    .attr("height", heightBlock)
    .style("fill", "none")
    .style("pointer-events", "all");

  // Defining a clip-path so that lines always stay inside the block view,
  // thus paths will be clipped when zooming
  var clip = svgBlock.append("defs").append("svg:clipPath")
    .attr("id", "clip")
    .append("svg:rect")
    .attr("id", "clip-rect")
    .attr("x", "0")
    .attr("y", "0")
    .attr("width", widthBlock)
    .attr("height", heightBlock);

  // Zoom behavior
  var zoom = d3.zoom()
    .scaleExtent([0.01, 100])
    .on("zoom", function() {
      if (gY0 && gY1) {
        var zoomTransform = d3.event.transform;

        // Rescaling axes using current zoom transform
        gY0.call(y0axis.scale(zoomTransform.rescaleY(y[0])));
        gY1.call(y1axis.scale(zoomTransform.rescaleY(y[1])));

        // Creating new scales (y0, y1) that incorporate current zoom transform
        var newY = [zoomTransform.rescaleY(y[0]), zoomTransform.rescaleY(y[1])];

        // Plotting the lines path using the new scales
        svgBlock.selectAll("path")
          .data(dataBlock)
          .attr("d", function(data) {
            return path(data, newY);
          })
      }
    });

  var blockArray = blockDictionary[blockID];
  for (var i = 0; i < blockArray.length; i++) {
    var blockSource = blockArray[i].source;
    var blockTarget = blockArray[i].target;
    var currentSource = geneDictionary[blockSource];
    var currentTarget = geneDictionary[blockTarget];

    // Points are the determined using the midpoint between start and end
    var currentData = [
      (currentSource.start + currentSource.end) / 2,
      (currentTarget.start + currentTarget.end) / 2
    ];

    dataBlock.push({
      source: {
        id: blockSource,
        start: currentSource.start,
        end: currentSource.end
      },
      target: {
        id: blockTarget,
        start: currentTarget.start,
        end: currentTarget.end
      },
      data: currentData
    });
  }

  // Numeric scale used for the stroke-width of each line path in the block
  var strokeWidthScale = d3.scaleQuantize()
    .domain([
      d3.min(dataBlock, function(d) {
        return (d.source.end - d.source.start) + (d.target.end - d.target.start);
      }),
      d3.max(dataBlock, function(d) {
        return (d.source.end - d.source.start) + (d.target.end - d.target.start);
      })
    ])
    .range([1, 2, 3, 4, 5]);

  /**
   * Generates all paths in the blockView using the current selected
   * block in the genomeView
   *
   * @param  {Array<Object>} dataBlock Current block data array
   * @return {undefined}               undefined
   */
  function generatePathBlockView(dataBlock) {
    // Calling zoom for the block, so it works for every path
    svgBlock.call(zoom)
      .call(zoom.transform, d3.zoomIdentity.scale(1));

    var d3Element = d3.select("#block-view-container")
      .select(".flip-hint");

    if (!isFlipped) {
      if (isPerfectlyFlipped(dataBlock)) {
        // If flip orientation is not selected, and the data block is perfectly
        // flipped, then show hint (display block)
        d3Element.style("display", "block");
      }
    } else {
      d3Element.style("display", "none");
    }

    /**
     * Determines the minimum value in the current block scale
     *
     * @param  {number} d The number of the scale: y0 or y1
     * @return {number}   Minimum value
     */
    function minData(d) {
      var minValue = 100000000;
      for (var i = 0; i < dataBlock.length; i++) {
        minValue = Math.min(minValue, dataBlock[i].data[d]);
      }
      return minValue;
    }

    /**
     * Determines the maximum value in the current block scale
     *
     * @param  {number} d The number of the scale: y0 or y1
     * @return {number}   Maximum value
     */
    function maxData(d) {
      var maxValue = 0;
      for (var i = 0; i < dataBlock.length; i++) {
        maxValue = Math.max(maxValue, dataBlock[i].data[d]);
      }
      return maxValue;
    }

    // Offset to be used for the scales domain
    var offset = 50000;

    // Y scale domains using minimum, maximum and offset values
    y[0].domain([minData(0) - offset, maxData(0) + offset]);
    y[1].domain([minData(1) - offset, maxData(1) + offset]);

    // Remove old paths if they are present
    if (!svgBlock.selectAll("path.line").empty()) {
      svgBlock.selectAll("path.line").remove();
    }

    // Add new paths inside the block
    svgBlock.append("g").attr("clip-path", "url(#clip)")
      .selectAll("path")
      .data(dataBlock).enter()
      .append("path")
      .attr("class", "line")
      .attr("d", function(data) {
        return path(data, y);
      })
      .attr("stroke", connectionColor)
      .attr("stroke-width", function(d) {
        // Returning stroke-width based on defined scale
        return strokeWidthScale(
          (d.source.end - d.source.start) + (d.target.end - d.target.start)
        );
      })
      .append("title") // Being used as simple tooptip
      .text(function(d) {
        return d.source.id + ' ➤ ' + d.target.id;
      });

    svgBlock.selectAll("path")
      .on("mouseover", function(d, i, nodes) {
        if (d3.selectAll(nodes).attr("opacity") != 0.35) {
          d3.selectAll(nodes).attr("opacity", 0.35);
          d3.select(nodes[i]).attr("opacity", 1);
        }
      })
      .on("mouseout", function(d, i, nodes) {
        if (d3.selectAll(nodes).attr("opacity") != 1) {
          d3.selectAll(nodes).attr("opacity", 1);
        }
      });

    // Add the Y0 Axis
    y0axis = d3.axisLeft(y[0]).tickSize(15);

    // Remove axisY0 if it is present
    if (!svgBlock.selectAll("g.axisY0").empty()) {
      svgBlock.selectAll("g.axisY0").remove();
    }

    gY0 = svgBlock.append("g")
      .attr("class", "axisY0")
      .call(y0axis.ticks(10))
      .attr("fill", function() {
        return colors(parseInt(sourceChromosomeID.split('N')[1]) - 1);
      });

    // Add the Y1 Axis
    y1axis = d3.axisRight(y[1]).tickSize(15);

    // Remove axisY1 if it is present
    if (!svgBlock.selectAll("g.axisY1").empty()) {
      svgBlock.selectAll("g.axisY1").remove();
    }

    gY1 = svgBlock.append("g")
      .attr("class", "axisY1")
      .attr("transform", "translate( " + widthBlock + ", 0 )")
      .call(y1axis.ticks(10))
      .attr("fill", function() {
        return colors(parseInt(targetChromosomeID.split('N')[1]) - 1);
      });
  }

  generatePathBlockView(dataBlock);

  // Add the Y0 Axis label text
  svgBlock.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (heightBlock / 2))
    .attr("dy", "1em")
    .style("font-size", "16px")
    .style("text-anchor", "middle")
    .text(sourceChromosomeID);

  // Add the Y1 Axis label text
  svgBlock.append("text")
    .attr("transform", "rotate(90)")
    .attr("y", 0 - widthBlock - margin.right)
    .attr("x", (heightBlock / 2))
    .attr("dy", "1em")
    .style("font-size", "16px")
    .style("text-anchor", "middle")
    .text(targetChromosomeID);

  // Add the Chart title
  svgBlock.append("text")
    .attr("x", (widthBlock / 2))
    .attr("y", 0 - (margin.top / 3))
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("text-decoration", "underline")
    .text(sourceChromosomeID + ' vs. ' + targetChromosomeID + ' - Block ' + blockID + ' gene locations');
}
