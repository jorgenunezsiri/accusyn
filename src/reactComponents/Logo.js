import React from 'react';
import PropTypes from 'prop-types';

import { getCurrentHost } from './../variables/currentHost';

/**
 * Logo component
 *
 * @param  {string} alt       - Alternative text
 * @param  {string} className - Logo class
 * @param  {string} height    - Logo image height
 * @param  {string} href      - Logo URL link
 * @param  {string} src       - Image source
 * @param  {string} height    - Logo image height
 * @return {ReactElement} React element
 * @public
 */
const Logo = ({
  alt,
  className,
  height,
  href,
  src,
  width
}) => {
  return (
    <div className={className}>
      <a href={href}>
        <img alt={alt} src={src} height={height} width={width} />
      </a>
    </div>
  );
};

/**
 * Logo defaultProps
 * @type {Object}
 */
Logo.defaultProps = {
  alt: "AccuSyn Logo",
  href: getCurrentHost()
};

/**
 * Logo propTypes
 * @type {Object}
 */
Logo.propTypes = {
  alt: PropTypes.string,
  className: PropTypes.string,
  height: PropTypes.string,
  href: PropTypes.string,
  src: PropTypes.string,
  width: PropTypes.string
};

export default Logo;
