module.exports = function errorResponse(res, error) {
  const status = error.status || (error.code === 11000 ? 409 : ['ValidationError', 'CastError'].includes(error.name) ? 400 : 500);
  const message = error.code === 11000 ? 'This record already exists' : status < 500 ? (['ValidationError', 'CastError'].includes(error.name) ? 'Invalid request fields' : error.message) : 'Server error';
  if (status >= 500) console.error('Request failed', { status, code: error.code || error.name });
  return res.status(status).json({ success: false, error: message });
};
