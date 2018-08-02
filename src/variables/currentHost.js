/**
 * Getter function for current host
 *
 * @return {string} Current host with protocol
 */
export function getCurrentHost() {
  const currentHost = window.location.host;
  const currentProtocol = window.location.protocol;
  return `${currentProtocol}//${currentHost}/`;
};
