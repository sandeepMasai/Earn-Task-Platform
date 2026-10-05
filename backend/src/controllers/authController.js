const errorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const generateToken = require('../utils/generateToken');
const jwt = require('jsonwebtoken');
const { getCoinValue } = require('../utils/coinHelper');
const { getFileUrl } = require('../middleware/upload');

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { email, password, name, username, referralCode } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email or username',
      });
    }

    // Check referral code if provided
    let referredBy = null;
    if (referralCode && referralCode.trim()) {
      const cleanReferralCode = referralCode.trim().toUpperCase();
      console.log('🔍 Looking for referral code:', cleanReferralCode);
      const referrer = await User.findOne({ referralCode: cleanReferralCode });
      if (referrer) {
        referredBy = referrer._id;
        console.log('✅ Found referrer:', referrer.username, referrer._id);
      } else {
        console.log('❌ Referral code not found:', cleanReferralCode);
      }
    }

    const bonusAmount = referredBy ? await getCoinValue('REFERRAL_BONUS') : 0;
    const user = await require('mongoose').connection.transaction(async session => {
      const [created] = await User.create([{ email, password, name, username, referredBy }], { session });
      if (referredBy) {
        const referrer = await User.findByIdAndUpdate(referredBy, { $inc: { coins: bonusAmount, totalEarned: bonusAmount } }, { session });
        if (!referrer) throw require('../utils/httpError')(400, 'Referrer no longer exists');
        await Transaction.create([{ user: referredBy, type: 'referral', amount: bonusAmount, description: `Referral bonus for referring ${created.username}` }], { session });
      }
      return created;
    });

    if (!user.isActive) return res.status(403).json({ success: false, error: 'Account is blocked' });
    const accessToken = generateToken(user._id, { tokenVersion: user.tokenVersion });
    const refreshToken = generateToken(user._id, { type: 'refresh', tokenVersion: user.tokenVersion });
    const expiresAt = new Date(jwt.decode(accessToken).exp * 1000);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          coins: user.coins,
          totalEarned: user.totalEarned,
          totalWithdrawn: user.totalWithdrawn,
          referralCode: user.referralCode,
          instagramId: user.instagramId,
          role: user.role || 'user',
          isActive: user.isActive !== undefined ? user.isActive : true,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    const user = await User.findOne({ email }).select('+password +tokenVersion');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    if (!user.isActive) return res.status(403).json({ success: false, error: 'Account is blocked' });
    const accessToken = generateToken(user._id, { tokenVersion: user.tokenVersion });
    const refreshToken = generateToken(user._id, { type: 'refresh', tokenVersion: user.tokenVersion });
    const expiresAt = new Date(jwt.decode(accessToken).exp * 1000);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatar: user.avatar || null,
          avatarAsset: user.avatarAsset || null,
          mediaAsset: user.avatarAsset || null,
          coins: user.coins,
          totalEarned: user.totalEarned,
          totalWithdrawn: user.totalWithdrawn,
          referralCode: user.referralCode,
          instagramId: user.instagramId,
          role: user.role || 'user',
          isActive: user.isActive !== undefined ? user.isActive : true,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatar: user.avatar || null,
          avatarAsset: user.avatarAsset || null,
          mediaAsset: user.avatarAsset || null,
          coins: user.coins,
          totalEarned: user.totalEarned,
          totalWithdrawn: user.totalWithdrawn,
          referralCode: user.referralCode,
          instagramId: user.instagramId,
          role: user.role || 'user',
          isActive: user.isActive !== undefined ? user.isActive : true,
          followersCount: user.followers ? user.followers.length : 0,
          followingCount: user.following ? user.following.length : 0,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get user by ID
// @route   GET /api/auth/user/:userId
// @access  Private
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatar: user.avatar || null,
          avatarAsset: user.avatarAsset || null,
          mediaAsset: user.avatarAsset || null,
          instagramId: user.instagramId,
          coins: user.coins,
          totalEarned: user.totalEarned,
          totalWithdrawn: user.totalWithdrawn,
          referralCode: user.referralCode,
          role: user.role || 'user',
          isActive: user.isActive !== undefined ? user.isActive : true,
          followersCount: user.followers ? user.followers.length : 0,
          followingCount: user.following ? user.following.length : 0,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Update Instagram ID
// @route   PUT /api/auth/instagram-id
// @access  Private
exports.updateInstagramId = async (req, res) => {
  try {
    const { instagramId } = req.body;

    const user = await User.findById(req.user._id);
    user.instagramId = instagramId;
    await user.save();

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatar: user.avatar || null,
          avatarAsset: user.avatarAsset || null,
          mediaAsset: user.avatarAsset || null,
          coins: user.coins,
          totalEarned: user.totalEarned,
          totalWithdrawn: user.totalWithdrawn,
          referralCode: user.referralCode,
          instagramId: user.instagramId,
          role: user.role || 'user',
          isActive: user.isActive !== undefined ? user.isActive : true,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, username, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use',
        });
      }
      user.email = email;
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.user._id } });
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          error: 'Username already in use',
        });
      }
      user.username = username.toLowerCase();
    }

    // Update name if provided
    if (name) {
      user.name = name;
    }

    const previousAvatar = user.avatarAsset;
    // Update avatar if provided (file upload will set req.file)
    if (req.file) {
      const avatarUrl = getFileUrl(req.file);
      if (avatarUrl) {
        user.avatar = avatarUrl;
        user.avatarAsset = req.file.asset || null;
      }
    } else if (avatar !== undefined) {
      user.avatar = avatar;
      user.avatarAsset = null;
    }

    await user.save();

    if ((req.file || avatar !== undefined) && previousAvatar?.provider === 'r2' && previousAvatar.mediaId !== user.avatarAsset?.mediaId) await require('../services/storage/mediaLifecycle').retire(previousAvatar);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          avatarAsset: user.avatarAsset || null,
          mediaAsset: user.avatarAsset || null,
          coins: user.coins,
          totalEarned: user.totalEarned,
          totalWithdrawn: user.totalWithdrawn,
          referralCode: user.referralCode,
          instagramId: user.instagramId,
          role: user.role || 'user',
          isActive: user.isActive !== undefined ? user.isActive : true,
          createdAt: user.createdAt,
        },
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Old password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user._id).select('+password +tokenVersion');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Logout (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (uses refresh token)
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    );

    if (decoded.type !== 'refresh') return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    const user = await User.findById(decoded.userId).select('+tokenVersion');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    if (!user.isActive) return res.status(403).json({ success: false, error: 'Account is blocked' });
    const accessToken = generateToken(user._id, { tokenVersion: user.tokenVersion });
    const expiresAt = new Date(jwt.decode(accessToken).exp * 1000);

    res.json({
      success: true,
      data: {
        accessToken,
        expiresAt,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
};
