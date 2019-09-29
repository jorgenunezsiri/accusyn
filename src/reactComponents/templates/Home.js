import React from 'react';

import Files from './../Files';
import Logo from './../Logo';
import Modal from './../Modal';
import YouTube from 'react-youtube';

/**
 * Home component
 *
 * @return {ReactElement} React element
 * @public
 */
const Home = () => {
  return (
    <div id="home-page-container">
      <div className="container">
        <div className="row">
          <div className="col-lg-10">
            <div className="jumbotron">
              <div className="home-page-header text-center">
                <Logo
                  className="home-page-logo"
                  height="60px"
                  src="./images/AccuSyn-logo-gray.png"
                  width="205px" />
                <h5 className="text-center">An Accurate Web-based Genome Synteny Browser</h5>
                <Modal
                  buttonClassName="get-started-button"
                  buttonColor="primary"
                  buttonLabel="Get started"
                  modalHeader="Get started">
                  {<Files />}
                </Modal>
              </div>
              <hr className="my-3" />
              <div className="before-after-content row text-center mb-3">
                <div className="col-lg-5">
                  <img src="./images/before.svg" height="500px" width="500px" />
                </div>
                <div className="col-lg-1">
                  <svg className="right-arrow-svg" pointerEvents="none">
                    <use
                      href="./images/icons.svg#right-arrow_si-bootstrap-arrow-right"
                      xlinkHref="./images/icons.svg#right-arrow_si-bootstrap-arrow-right" />
                  </svg>
                </div>
                <div className="col-lg-5">
                  <img src="./images/after.svg" height="500px" width="500px" />
                </div>
              </div>
              <p className="lead" align="justify">
                As even simple organisms have huge numbers of genetic features, syntenic plots present an enormous clutter
                of connections, making the structure difficult to understand. <em>AccuSyn</em> provides a high-level of interactivity
                and performance, by letting users visualize the syntenic relations in two side-by-side views: the genome and
                the block view. The genome view uses circular plots to get a complete overview of the genome and to allow
                exploring all the similar blocks of genes between chromosomes. The block view shows all the pairs of gene
                locations for each block, by using separate scales for each chromosome.
              </p>
              <p className="lead" align="justify">
                We apply <em>Simulated Annealing</em>, a well-known heuristic for obtaining near-optimal solutions to optimization problems,
                to automate the process of discovering syntenic relations by minimizing link crossings in the genome view (as shown with the
                decluttering of the Wheat genome in the above image).{' '} <em>AccuSyn</em> also allows users to manually drag chromosomes around
                or right click on top of a chromosome to flip its block locations, which helps in getting further enhancements.
              </p>
              <p className="lead">
                <em>AccuSyn</em> supports three file formats:
              </p>
              <ul className="lead" align="justify">
                <li><em>Genomic Feature Format (GFF)</em> file: Describes all the genomic features, giving the essential coordinate information.
                In <em>AccuSyn</em>, users can either load a simplified four column GFF file (chrID, featureID,
                  featureStart, featureEnd) or a complete nine column GFF3 file.</li>
                <li><em>Collinearity</em> file: Contains the output of  <a target="_blank" href="http://chibba.pgml.uga.edu/mcscan2/">MCScanX</a>,
                with the information for all the syntenic blocks of similar genes.</li>
                <li><em>BedGraph</em> file: Uses four columns (chrID, chrStart, chrEnd, dataValue) to display additional genomic track data
                as heatmaps, histograms, lines, and scatter plots.</li>
              </ul>
              <div className="home-video mt-2">
                <YouTube videoId="37XC30eLBzo" />
              </div>
              <div className="text-center mt-3">
                <a target="_blank" href="https://www.usask.ca">
                  <img alt="USask Logo" src="./images/usask-logo.png" height="30px" width="135px" />
                </a>
                <p className="mt-1 small">
                  Copyright {'\u00A9'} 2018 – {new Date().getFullYear()} {' '} Jorge Nunez Siri. All rights reserved.
                </p>
                <p className="small">
                  <a href="mailto:jorge.nunez@usask.ca?cc=eric.neufeld@usask.ca&subject=AccuSyn Software">Contact Us</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
