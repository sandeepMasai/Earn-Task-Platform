const User = require('../models/User');

// @desc    Follow a user
// @route   POST /api/follow/:userId
// @access  Private
exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot follow yourself',
      });
    }

    const userToFollow = await User.findById(userId);
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const currentUser = await User.findById(currentUserId);

    // Check if already following
    const isFollowing = currentUser.following.some(
      (id) => id.toString() === userId
    );

    if (isFollowing) {
      return res.status(400).json({
        success: false,
        error: 'You are already following this user',
      });
    }

    // Add to following list
    currentUser.following.push(userId);
    await currentUser.save();

    // Add to user's followers list
    userToFollow.followers.push(currentUserId);
    await userToFollow.save();

    res.json({
      success: true,
      message: 'User followed successfully',
      data: {
        followersCount: userToFollow.followers.length,
        followingCount: currentUser.following.length,
        isFollowing: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/follow/:userId
// @access  Private
exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const userToUnfollow = await User.findById(userId);
    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const currentUser = await User.findById(currentUserId);

    // Check if following
    const isFollowing = currentUser.following.some(
      (id) => id.toString() === userId
    );

    if (!isFollowing) {
      return res.status(400).json({
        success: false,
        error: 'You are not following this user',
      });
    }

    // Remove from following list
    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== userId
    );
    await currentUser.save();

    // Remove from user's followers list
    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== currentUserId.toString()
    );
    await userToUnfollow.save();

    res.json({
      success: true,
      message: 'User unfollowed successfully',
      data: {
        followersCount: userToUnfollow.followers.length,
        followingCount: currentUser.following.length,
        isFollowing: false,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

