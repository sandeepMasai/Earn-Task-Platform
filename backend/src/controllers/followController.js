const errorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// @desc    Follow a user
// @route   POST /api/follow/:userId
// @access  Private
exports.followUser = async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) return res.status(400).json({ success: false, error: 'You cannot follow yourself' });
    const data = await require('mongoose').connection.transaction(async session => {
      const target = await User.findById(req.params.userId).session(session);
      const current = await User.findById(req.user._id).session(session);
      if (!target || !current) throw require('../utils/httpError')(404, 'User not found');
      const following = current.following.some(id => id.equals(target._id));
      if (following === true) throw require('../utils/httpError')(400, 'Follow state already set');
      current.following.push(target._id);
      target.followers.push(current._id);
      await current.save({ session });
      await target.save({ session });
      return { followersCount: target.followers.length, followingCount: current.following.length, isFollowing: true };
    });
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Unfollow a user
// @route   DELETE /api/follow/:userId
// @access  Private
exports.unfollowUser = async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) return res.status(400).json({ success: false, error: 'You cannot follow yourself' });
    const data = await require('mongoose').connection.transaction(async session => {
      const target = await User.findById(req.params.userId).session(session);
      const current = await User.findById(req.user._id).session(session);
      if (!target || !current) throw require('../utils/httpError')(404, 'User not found');
      const following = current.following.some(id => id.equals(target._id));
      if (following === false) throw require('../utils/httpError')(400, 'Follow state already set');
      current.following = current.following.filter(id => !id.equals(target._id));
      target.followers = target.followers.filter(id => !id.equals(current._id));
      await current.save({ session });
      await target.save({ session });
      return { followersCount: target.followers.length, followingCount: current.following.length, isFollowing: false };
    });
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Get user followers and following counts
// @route   GET /api/follow/:userId
// @access  Private
exports.getFollowStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const user = await User.findById(userId).select('followers following');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const isFollowing = user.followers.some(
      (id) => id.toString() === currentUserId.toString()
    );

    res.json({
      success: true,
      data: {
        followersCount: user.followers.length,
        followingCount: user.following.length,
        isFollowing,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

