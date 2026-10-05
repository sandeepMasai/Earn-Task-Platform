const { randomInt, randomBytes, createHmac } = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const mail = require('../services/passwordResetEmail');
const errorResponse = require('../utils/errorResponse');

const genericMessage = 'If an active account exists, a reset code has been sent. Check your inbox and spam folder.';

function hashCode(email, code) {
  if (!process.env.JWT_SECRET) throw new Error('Reset configuration unavailable');
  return createHmac('sha256', process.env.JWT_SECRET)
    .update(`password-reset:${String(email).trim().toLowerCase()}:${code}`)
    .digest('hex');
}

function hashToken(email, token) {
  if (!process.env.JWT_SECRET) throw new Error('Reset configuration unavailable');
  return createHmac('sha256', process.env.JWT_SECRET)
    .update(`password-reset-token:${String(email).trim().toLowerCase()}:${token}`)
    .digest('hex');
}

exports.hashCode = hashCode;
exports.hashToken = hashToken;
exports.genericMessage = genericMessage;

exports.forgotPassword = async (req, res) => {
  try {
    mail.assertConfigured();
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email' });
    }

    const now = Date.now();
    // Cryptographically random 6-digit OTP
    const code = String(randomInt(100000, 1000000));
    const resetCodeHash = hashCode(email, code);

    // Atomic per-account cooldown across processes (60 seconds).
    // Unknown or blocked accounts match 0 documents, but receive the same generic success response.
    const user = await User.findOneAndUpdate(
      {
        email,
        isActive: true,
        $or: [
          { resetCodeRequestedAt: { $exists: false } },
          { resetCodeRequestedAt: { $lte: new Date(now - 60000) } },
        ],
      },
      {
        $set: {
          resetCodeHash,
          resetCodeExpiresAt: new Date(now + 600000), // 10 minutes
          resetCodeAttempts: 0,
          resetCodeRequestedAt: new Date(now),
        },
        $unset: {
          resetTokenHash: 1,
          resetTokenExpiresAt: 1,
        },
      }
    );

    if (user) {
      try {
        await mail.sendResetCode(email, code);
      } catch {
        // Roll back the hash so the user is not locked to an undelivered code
        await User.updateOne(
          { _id: user._id, resetCodeHash },
          { $unset: { resetCodeHash: 1, resetCodeExpiresAt: 1, resetCodeAttempts: 1 } }
        );
        console.warn('Reset email delivery failed');
      }
    }

    return res.json({ success: true, message: genericMessage });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    const { code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and verification code are required' });
    }

    const resetCodeHash = hashCode(email, code);
    const now = new Date();

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = hashToken(email, resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + 600000); // 10 minutes

    // Atomic verify and consume to prevent OTP reuse
    const user = await User.findOneAndUpdate(
      {
        email,
        isActive: true,
        resetCodeExpiresAt: { $gt: now },
        resetCodeAttempts: { $lt: 5 },
        resetCodeHash,
      },
      {
        $set: {
          resetTokenHash,
          resetTokenExpiresAt,
        },
        $unset: {
          resetCodeHash: 1,
          resetCodeExpiresAt: 1,
          resetCodeAttempts: 1,
        },
      }
    );

    if (!user) {
      const existing = await User.findOne({
        email,
        isActive: true,
        resetCodeExpiresAt: { $gt: now },
      }).select('+resetCodeAttempts');

      if (existing) {
        const attempts = (existing.resetCodeAttempts || 0) + 1;
        await User.updateOne({ _id: existing._id }, { $set: { resetCodeAttempts: attempts } });
        if (attempts >= 5) {
          return res.status(400).json({
            success: false,
            error: 'Maximum verification attempts exceeded. Please request a new code.',
          });
        }
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid or expired code. Request a new code and try again.',
      });
    }

    return res.json({
      success: true,
      message: 'Code verified successfully.',
      resetToken,
      data: {
        resetToken,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    const { resetToken, code, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email and new password are required' });
    }

    const now = new Date();
    const password = await bcrypt.hash(newPassword, 12);
    let user = null;

    if (resetToken) {
      const resetTokenHash = hashToken(email, resetToken);
      user = await User.findOneAndUpdate(
        {
          email,
          isActive: true,
          resetTokenExpiresAt: { $gt: now },
          resetTokenHash,
        },
        {
          $set: { password },
          $inc: { tokenVersion: 1 },
          $unset: {
            resetTokenHash: 1,
            resetTokenExpiresAt: 1,
            resetCodeHash: 1,
            resetCodeExpiresAt: 1,
            resetCodeAttempts: 1,
            resetCodeRequestedAt: 1,
          },
        }
      );

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset session. Request a new code and try again.',
        });
      }
    } else if (code) {
      const resetCodeHash = hashCode(email, code);
      const eligible = { email, isActive: true, resetCodeExpiresAt: { $gt: now }, resetCodeAttempts: { $lt: 5 } };
      user = await User.findOneAndUpdate(
        { ...eligible, resetCodeHash },
        {
          $set: { password },
          $inc: { tokenVersion: 1 },
          $unset: {
            resetCodeHash: 1,
            resetCodeExpiresAt: 1,
            resetCodeAttempts: 1,
            resetCodeRequestedAt: 1,
            resetTokenHash: 1,
            resetTokenExpiresAt: 1,
          },
        }
      );

      if (!user) {
        await User.updateOne(eligible, { $inc: { resetCodeAttempts: 1 } });
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired code. Request a new code and try again.',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Reset token or verification code is required.',
      });
    }

    return res.json({
      success: true,
      message: 'Password reset successfully. Please log in again.',
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
