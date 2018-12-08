import React from 'react';
import {
  Modal as ModalReactstrap,
  ModalHeader,
  ModalBody,
  ModalFooter
} from 'reactstrap';
import Button from './Button';
import PropTypes from 'prop-types';

/**
 * Modal component
 *
 * @param  {Object} props - Component props
 * @return {ReactElement} React element
 * @extends React.Component
 * @public
 */
class Modal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      modal: false
    };

    this.toggle = this.toggle.bind(this);
  }

  toggle() {
    this.setState({
      modal: !this.state.modal
    });
  }

  render() {
    return (
      <div>
        <Button
          className={this.props.buttonClassName}
          color={this.props.buttonColor}
          onClick={this.toggle}>
          {this.props.buttonLabel}
        </Button>
        <ModalReactstrap
          centered={this.props.centered}
          className={this.props.className}
          isOpen={this.state.modal}
          toggle={this.toggle}
          size={this.props.size}>

          <ModalHeader toggle={this.toggle}>{this.props.modalHeader}</ModalHeader>
          <ModalBody>
            {this.props.children}
          </ModalBody>
          {/* <ModalFooter>
            <Button color="primary" onClick={this.toggle}>Do Something</Button>{' '}
            <Button color="secondary" onClick={this.toggle}>Cancel</Button>
          </ModalFooter> */}
        </ModalReactstrap>
      </div>
    );
  }
};

/**
 * Modal defaultProps
 * @type {Object}
 */
Modal.defaultProps = {
  buttonColor: "link",
  centered: true,
  className: "modal-reactstrap",
  size: 'lg'
};

/**
 * Modal propTypes
 * @type {Object}
 */
Modal.propTypes = {
  buttonClassName: PropTypes.string,
  buttonColor: PropTypes.string,
  buttonLabel: PropTypes.node,
  centered: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
  modalHeader: PropTypes.string,
  size: PropTypes.string
};

export default Modal;
