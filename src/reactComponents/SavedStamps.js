import React from 'react';

import chunk from 'lodash/chunk';
import isEqual from 'lodash/isEqual';
import findIndex from 'lodash/findIndex';
import forEach from 'lodash/forEach';

import { resetUndoRedoButtons } from './../vendor/undoManager';

import {
  select as d3Select,
  selectAll as d3SelectAll
} from 'd3';

import generateGenomeView from '../genomeView/generateGenomeView';

import { getAdditionalTrackNames } from './../variables/additionalTrack';
import {
  getDataChords,
  toChordsOrder
} from './../variables/dataChords';
import { getDataChromosomes } from './../variables/dataChromosomes';
import { toChromosomeOrder } from './../variables/currentChromosomeOrder';
import { setCurrentSelectedBlock } from './../variables/currentSelectedBlock';
import {
  getSavedSolutions,
  setSavedSolutions
} from './../variables/savedSolutions';

import { callSwapPositionsAnimation } from './../genomeView/blockCollisions';
import {
  renderReactAlert,
  resetChromosomeCheckboxes,
  sortGffKeys
} from './../helpers';

/**
 * SavedStamps component
 *
 * @param  {Object} props - Component props
 * @return {ReactElement} React element
 * @extends React.Component
 * @public
 */
class SavedStamps extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      savedSolutions: getSavedSolutions()
    };

    this.handleItemClick = this.handleItemClick.bind(this);
    this.handleItemRemove = this.handleItemRemove.bind(this);
    this.renderItem = this.renderItem.bind(this);
  }

  handleItemRemove(index) {
    const confirming = confirm(`Are you sure you want to delete the stamp #${index + 1}?`);
    if (confirming) {
      const currentSolutions = this.state.savedSolutions;
      currentSolutions.splice(index, 1);
      setSavedSolutions(currentSolutions);

      this.setState({
        savedSolutions: currentSolutions
      });
    }
  }

  handleItemClick(item, index) {
    const dataChromosomes = getDataChromosomes();
    const dataChords = getDataChords();
    const savedDataChromosomes = item.bestSolution;
    const savedDataChords = item.dataChords;
    const selectedCheckboxes = item.selectedCheckboxes;
    const savedChromosomeOrder = sortGffKeys(toChromosomeOrder(savedDataChromosomes)).slice();
    const savedChordsOrder = toChordsOrder(savedDataChords);

    const equalConfiguration = isEqual(toChordsOrder(dataChords), savedChordsOrder) &&
      isEqual(sortGffKeys(toChromosomeOrder(dataChromosomes)).slice().toString(),
        savedChromosomeOrder.toString());

    // Selected block
    setCurrentSelectedBlock(item.selectedBlock);

    // Show all chromosomes
    d3Select("p.show-all input").property("checked", item.showAllChromosomes);

    // Show self connections
    d3Select("p.show-self-connections-chr input").property("checked", item.showSelfConnections.chr);
    if (!d3Select("p.show-self-connections-genome input").empty()) {
      d3Select("p.show-self-connections-genome input").property("checked", item.showSelfConnections.genome);
    }

    // Dark mode
    d3Select("p.dark-mode input").property("checked", item.darkMode);

    // Highlight flipped blocks and chromosomes
    d3Select("p.highlight-flipped-blocks input").property("checked", item.highlightFlippedBlocks);
    d3Select("p.highlight-flipped-chromosomes input").property("checked", item.highlightFlippedChromosomes);

    // Blocks color
    d3Select("div.blocks-color select").property("value", item.blocksColor);

    // Genome palette
    d3Select("div.chromosomes-palette select").property("value", item.genomePalette);
    d3Select("div.chromosomes-palette select").dispatch('change', { detail: { shouldUpdate: false } });

    // Drawing order
    d3Select('div.draw-blocks-order select').property("value", item.drawingOrder);

    // Filter block size and connections
    d3Select('.filter-connections-div #filter-block-size').property("value", item.filter.blockSize);
    d3Select('.filter-connections-div select').property("value", item.filter.connections);

    // Rotate value
    d3Select("#nAngle-genome-view").property("value", item.rotateValue);
    d3Select("#nAngle-genome-view").dispatch('input', { detail: { shouldUpdate: false } });

    // Resetting all the tracks
    const additionalTracksNames = getAdditionalTrackNames();
    forEach(additionalTracksNames, (name) =>
      d3Select(`div.additional-track.${name} .track-type select`).property("value", "None")
    );

    // Including only available tracks
    forEach(item.availableTracks, ({ name, placement, type, color }) => {
      d3Select(`div.additional-track.${name} .track-color select`).property("value", color);
      d3Select(`div.additional-track.${name} .track-type select`).property("value", type);
      d3Select(`div.additional-track.${name} .track-placement select`).property("value", placement);
    });

    // Dismissing modal
    d3Select(".modal-reactstrap button.close").node().click();

    // Adding a delay so the modal can get closed
    setTimeout(function() {
      if (equalConfiguration) {
        // Here I do need to re-render even when dataChromosomes and bestSolution are the same,
        // because I want to set the extra options, such as additional tracks,
        // and for that I need to re-render
        callSwapPositionsAnimation({
          dataChromosomes: dataChromosomes,
          bestSolution: savedDataChromosomes,
          bestFlippedChromosomes: item.bestFlippedChromosomes,
          updateWhenSame: true
        });
      } else {
        d3SelectAll(".chr-box").each(function() {
          const cb = d3Select(this);
          const value = cb.property("value");
          const isChecked = cb.property("checked");
          const isPresent = selectedCheckboxes.indexOf(value) !== (-1);

          if (isPresent && !isChecked || !isPresent && isChecked) {
            cb.property("checked", !isChecked);
            cb.dispatch('change', { detail: { shouldUpdate: false } });
          }
        });

        resetUndoRedoButtons();

        generateGenomeView({});
      }

      // Showing alert using react
      renderReactAlert(`The layout was successfully updated with the stamp #${index + 1}.`, "success");
    }, 200);
  }

  componentDidMount() {
    const savedSolutionsState = this.state.savedSolutions;
    if (savedSolutionsState.length <= 5) {
      // Add bottom-modal class to modal-reactstrap
      d3Select(".modal-reactstrap").node().classList.add('bottom-modal');
    }
  }

  renderItem(item, index) {
    const darkModeClassName = item.darkMode ? 'dark-mode' : '';
    return (
      <div className="stamps-item" key={index}>
        <span className={`item-index ${darkModeClassName}`}>{index + 1}</span>
        <span
          className={`item-close ${darkModeClassName}`}
          onClick={() => this.handleItemRemove(index)}>
          &#10005;
        </span>
        <img
          onClick={() => this.handleItemClick(item, index)}
          src={item.imageSrc}
          height="120"
          width="120" />
      </div>
    );
  }

  render() {
    const savedSolutions = chunk(this.state.savedSolutions, 5);
    let cumulativeIndex = -1;
    const items = savedSolutions.map((portion, indexPortion) => {
      return (
        <div className="row" key={`${indexPortion}`}>
          {portion.map((item, index) => {
            cumulativeIndex++;
            return (
              <div className="col-lg-2" key={`${index}`}>
                {this.renderItem(item, cumulativeIndex)}
              </div>
            );
          })}
        </div>
      );
    });

    const messageToShow = items.length > 0 ?
      "Select one of the stamps below to go back to that layout:" :
      "No saved stamps currently available.";

    return (
      <div className="saved-solutions-container">
        <p>{messageToShow}</p>
        <div className="container stamps-container">
          {items}
        </div>
      </div>
    );
  }
};

export default SavedStamps;
