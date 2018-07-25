import React from 'react';
import { Alert } from 'reactstrap';
import PropTypes from 'prop-types';

/**
 * AlertWithTimeout component
 *
 * @param  {Object} props - Component props
 * @return {ReactElement} React element
 * @extends React.Component
 * @public
 */
class AlertWithTimeout extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      visible: true
    };

    this.onDismiss = this.onDismiss.bind(this);
  }

  componentDidMount() {
    this.timer = setTimeout(() => {
      this.setState({ visible: false });
    }, this.props.alertTimeout);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  onDismiss() {
    this.setState({ visible: false }, () => clearTimeout(this.timer));
  }

  render() {
    return (
      <Alert color={this.props.color} isOpen={this.state.visible} toggle={this.onDismiss}>
        {this.props.message}
      </Alert>
    );
  }
};

/**
 * AlertWithTimeout defaultProps
 * @type {Object}
 */
AlertWithTimeout.defaultProps = {
  alertTimeout: 5000,
  color: "success",
  message: "I am an alert"
};

/**
 * AlertWithTimeout propTypes
 * @type {Object}
 */
AlertWithTimeout.propTypes = {
  alertTimeout: PropTypes.number,
  color: PropTypes.string,
  message: PropTypes.string
};

export default AlertWithTimeout;
