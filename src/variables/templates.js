import React from 'react';

import { getCurrentHost } from './currentHost';

/**
 * Sample files template - To be shown inside a modal
 * @type {ReactElement}
 */
const sampleFiles = (
  <div>
    <p>These are all the current files that can be loaded with <strong>GSB</strong>:</p>
    <p>
      <a href={`${getCurrentHost()}?gff=at&collinearity=at`}>
      At</a> - <em>Arabidopsis thaliana</em> (Thale cress)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=at_vv&collinearity=at_vv`}>
      At vs. Vv</a> - <em>Arabidopsis thaliana</em> (Thale cress) vs. <em>Vitis vinifera</em> (Grape vine)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=bnapus&collinearity=bnapus`}>
      Bn</a> - <em>Brassica napus</em> (Canola)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=bnapus&collinearity=bnapus-top-5-hits`}>
      Bn (with top 5 BLAST hits)</a> - <em>Brassica napus</em> (Canola)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=camelina&collinearity=camelina`}>
      Cs</a> - <em>Camelina sativa</em> (Camelina)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=os_sb&collinearity=os_sb`}>
      Os vs. Sb</a> - <em>Oryza sativa</em> (Asian rice) vs. <em>Sorghum bicolor</em> (Sorghum)
    </p>
  </div>
);

export {
  sampleFiles
};
