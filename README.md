# AccuSyn
Website: [https://accusyn.usask.ca/](https://accusyn.usask.ca/)

<p align="center">
  <img src="https://accusyn.usask.ca/images/after.svg" width="500" height="500">
  <br />
  <i>AccuSyn providing a complete overview of the conserved synteny blocks in the Wheat genome.</i>
</p>

## Description

We apply Simulated Annealing, a well-known heuristic for obtaining near-optimal solutions to optimization problems, to discover conserved synteny relations (similar features) in genomes. As even simple organisms have huge numbers of genetic features, syntenic plots present an enormous clutter of connections, making the structure difficult to understand. Our interactive software, AccuSyn, visualizes syntenic relations with circular plots of chromosomes and draws links between similar blocks of genes, using Simulated Annealing to minimize link crossings. This provides geneticists with insights into the evolutionary history of species or functional relationships between genes. AccuSyn is actively used in the research being done at the University of Saskatchewan and has already produced a visualization of the recently-sequenced Wheat genome.

## Development

AccuSyn is a client-side-only application created using JavaScript. These three main libraries made this project possible: [D3.js](https://github.com/d3/d3), [CircosJS](https://github.com/nicgirault/circosJS), and [React.js](https://github.com/facebook/react).

To interact with AccuSyn locally, first install all the project dependencies using the Node Package Manager (`npm`):
```
  npm install
```
Then, run a development server inside the `accusyn` directory using `webpack-dev-server`, which also watches for changes and re-compiles the local bundle automatically:
```
  npm run start
```
Finally, go to [http://localhost:8080/](http://localhost:8080/) using Google Chrome (our recommended browser for the best app experience).

To build a production-ready minified JavaScript file, run:
```
  npm run build
```

**Note:** AccuSyn has been created using `node v6.11.3 (LTS)` and `npm v3.10.10`.

## Research Publication

To know more about AccuSyn or if you are considering citing our work, you can follow the following research publication:

> Nunez Siri, J., Neufeld, E., Parkin, I., and Sharpe, A., May 2020. Using Simulated Annealing to Declutter Genome Visualizations. The Thirty-Third International Florida Artificial Intelligence Research Society Conference (FLAIRS-33). Available at: www.aaai.org/ocs/index.php/FLAIRS/FLAIRS20/paper/view/18433/17546.

## Contact

Jorge Nunez Siri - jorge.nunez@usask.ca

AccuSyn has been created as part of the research being done by [P<sup>2</sup>IRC](https://p2irc.usask.ca) at the [University of Saskatchewan](https://www.usask.ca).

> Copyright &copy; 2018 - 2021 Jorge Nunez Siri. All rights reserved.
