import React from 'react';
import PropTypes from 'prop-types';

/**
 * SubmitMainFilesForm component
 *
 * @param  {string} handleClick - Function for submit onClick event
 * @return {ReactElement} React element
 * @public
 */
const SubmitMainFilesForm = ({ handleClick }) => {
  return (
    <div className="submit-main-files-form-container">
      <div className="gff-file-upload-container">
        <p className="gff-file">
          <label>
            <span>General Feature Format (GFF) file: </span>
            <input type="file" name="gff-file-upload" id="gff-file-upload" />
          </label>
        </p>
        <p className="gff-type">
          <span>Type:</span>
          <select className="form-control" defaultValue="GFF">
            <option value="GFF">GFF (Simplified)</option>
            <option value="GFF3">GFF3 (Complete)</option>
          </select>
        </p>
      </div>
      <p className="collinearity-file">
        <label>
          <span>MCScanX Collinearity file: </span>
          <input type="file" name="collinearity-file-upload" id="collinearity-file-upload" />
        </label>
      </p>
      <p>
        <input
          className="btn btn-outline-primary"
          id="submit-file-upload"
          onClick={handleClick}
          title="Submits files to be loaded with the application."
          type="button"
          value="Submit" />
      </p>
    </div>
  );
};

/**
 * SubmitMainFilesForm propTypes
 * @type {Object}
 */
SubmitMainFilesForm.propTypes = {
  handleClick: PropTypes.func
};

export default SubmitMainFilesForm;
