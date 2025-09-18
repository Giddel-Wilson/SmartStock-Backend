// Shim: delegate to the catch-all handler so `/api/auth/login` is handled in one place
const catchAll = require('../[...slug].js')
module.exports = async (req, res) => {
  return catchAll(req, res)
}
