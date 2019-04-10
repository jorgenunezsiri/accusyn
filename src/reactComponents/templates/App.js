import React from 'react';
import Logo from './../Logo';

/**
 * App component
 *
 * @return {ReactElement} React element
 * @public
 */
const App = () => {
  return (
    <div style={{display: 'none'}} id="page-container" className="container animate-bottom">
      <div className="row">
        <div id="config" className="col-lg-2" style={{display: 'none'}}>
          <form id="form-config" className="border border-secondary rounded"></form>
        </div>
        <Logo
          className="app-logo-container"
          height="55px"
          src="./images/AccuSyn-logo.png"
          width="170px" />
        <div id="load-files-container"></div>
        <div id="download-svg-container"></div>
      </div>
    </div>
  );
};

export default App;
