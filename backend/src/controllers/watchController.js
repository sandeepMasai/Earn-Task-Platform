const service = require('../services/watchSessions');
const errorResponse = require('../utils/errorResponse');
exports.start = async (req, res) => {
  try { res.status(201).json({ success: true, data: await service.start(req.params.id, req.user._id) }); }
  catch (error) { return errorResponse(res, error); }
};
exports.heartbeat = async (req, res) => {
  try { res.json({ success: true, data: await service.heartbeat(req.params.id, req.user._id, req.body) }); }
  catch (error) { return errorResponse(res, error); }
};
