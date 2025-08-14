// server/utils/sanitizeRoom.js
// Utility to sanitize chat room names.
module.exports = function sanitizeRoom(name) {
  return (name || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 64) || 'public';
};
