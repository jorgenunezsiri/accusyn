import React from 'react';
import SubmitMainFilesForm from './../reactComponents/SubmitMainFilesForm';

import { getCurrentHost } from './currentHost';

/**
 * Load files template - To be shown inside a modal
 * @type {ReactElement}
 */
const loadFiles = (
  <div>
    <SubmitMainFilesForm />

    <h5 className="disabled">──────────────────────────────────────────────────────</h5>

    <p>These are other sample files that can be loaded with <strong>GSB</strong>:</p>
    <p>
      <a href={`${getCurrentHost()}?gff=at&collinearity=at`}>
      At</a> - <em>Arabidopsis thaliana</em> (Thale cress)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=at_vv&collinearity=at_vv`}>
      At vs. Vv</a> - <em>Arabidopsis thaliana</em> (Thale cress) vs. <em>Vitis vinifera</em> (Grape vine)
    </p>
    {/* <p>
      <a href={`${getCurrentHost()}?gff=bnapus&collinearity=bnapus&additionalTrack=bnapus_gene_count&additionalTrack=bnapus_gene_density&additionalTrack=bnapus_repeat_count&additionalTrack=bnapus_repeat_density`}>
      Bn</a> - <em>Brassica napus</em> (Canola)
    </p> */}
    <p>
      <a href={`${getCurrentHost()}?gff=bnapus&collinearity=bnapus_top_5_hits&additionalTrack=bnapus_gene_count&additionalTrack=bnapus_gene_density&additionalTrack=bnapus_repeat_count&additionalTrack=bnapus_repeat_density`}>
      Bn</a> - <em>Brassica napus</em> (Canola)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=brassica&collinearity=brassica&additionalTrack=brassica_gene_count&additionalTrack=brassica_gene_density`}>
      Brassica</a> - <em>A(rapa), B(nigra), C(oleracea), D(napus)</em>
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=camelina&collinearity=camelina&additionalTrack=camelina_gene_count&additionalTrack=camelina_gene_density&additionalTrack=camelina_repeat_count&additionalTrack=camelina_repeat_density`}>
      Cs</a> - <em>Camelina sativa</em> (Camelina)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=os_sb&collinearity=os_sb`}>
      Os vs. Sb</a> - <em>Oryza sativa</em> (Asian rice) vs. <em>Sorghum bicolor</em> (Sorghum)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=cs_iwgsc&collinearity=cs_iwgsc&additionalTrack=cs_genes&additionalTrack=cs_PresenceAbsence&additionalTrack=cs_SNPs&additionalTrack=cs_TEs`}>
      Wheat (IWGSC)</a> - <em>Triticum aestivum</em> (Chinese Spring)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=wheat_hb&collinearity=wheat_hb`}>
      Wheat (Hybrid)</a> - <em>Artificial Hexaploid</em> (Hybrid)
    </p>
    <p>
      <a href={`${getCurrentHost()}?gff=cs_hb&collinearity=cs_hb`}>
      Wheat (CS vs. HB)</a> - <em>Chinese Spring</em> vs. <em>Artificial Hybrid Wheat</em>
    </p>
    {/* <p>
      <a href={`${getCurrentHost()}?gff=hb_cs&collinearity=hb_cs`}>
      Wheat (HB vs. CS)</a> - <em>Artificial Hybrid Wheat</em> vs. <em>Chinese Spring</em>
    </p> */}
  </div>
);

export {
  loadFiles
};
