import React from 'react';
import { Button as ButtonReactstrap } from 'reactstrap';
import PropTypes from 'prop-types';

/**
 * Button component
 *
 * @param  {string} className - Button class
 * @param  {string} color - Button color
 * @param  {node}   children - Button children
 * @param  {Function} onClick - Function to execute in the onClick event
 * @return {ReactElement} React element
 * @public
 */
const Button = ({
  className,
  color,
  children,
  onClick
}) => {
  return (
    <ButtonReactstrap className={className} color={color} onClick={onClick}>
      {children}
    </ButtonReactstrap>
  );
};

/**
 * Button defaultProps
 * @type {Object}
 */
Button.defaultProps = {
  color: "success"
};

/**
 * Button propTypes
 * @type {Object}
 */
Button.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
  children: PropTypes.node,
  onClick: PropTypes.func
};

export default Button;
