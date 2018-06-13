var _currentChromosomeOrder = []; // Array that stores the current order of chromosomes

exports.getCurrentChromosomeOrder = function getCurrentChromosomeOrder() {
  return _currentChromosomeOrder;
};

exports.setCurrentChromosomeOrder = function setCurrentChromosomeOrder(order) {
  _currentChromosomeOrder = order;
};
