const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/user.model');
const { Admin } = require('../models/admin.model');
const Seller = require('../models/seller.model');
const { AppError } = require('../middlewares/error.middleware');
const { sendNotification } = require('../utils/notification');
const otpGenerator = require('otp-generator');

/**
 * Generate JWT token
 * @param {String} id - User ID
 * @param {String} role - User role
 * @returns {String} - JWT token
 */
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

/**
 * Create and send JWT token
 * @param {Object} user - User object
 * @param {String} role - User role
 * @param {Number} statusCode - HTTP status code
 * @param {Object} res - Response object
 */
const createSendToken = (user, role, statusCode, res) => {
  const token = signToken(user._id, role);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

/**
 * Generate OTP
 * @returns {String} - 6-digit OTP
 */
const generateOTP = () => {
  return otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false
  });
};

/**
 * Register a new user
 * @route POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role = 'user' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return next(new AppError('User with this email or phone already exists', 400));
    }

    // Create new user
    const newUser = await User.create({
      name,
      email,
      phone,
      password,
      role
    });

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    newUser.emailVerificationToken = crypto
      .createHash('sha256')
      .update(emailVerificationToken)
      .digest('hex');
    newUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Generate phone OTP
    const phoneOtp = generateOTP();
    newUser.phoneOtp = phoneOtp;
    newUser.phoneOtpExpires = Date.now() + parseInt(process.env.OTP_EXPIRY) * 60 * 1000; // OTP_EXPIRY minutes

    await newUser.save({ validateBeforeSave: false });

    // Send email verification
    try {
      // Send email verification link
      await sendNotification({
        recipient: newUser._id,
        recipientRole: 'user',
        type: 'verification',
        title: 'Email Verification',
        message: `Please verify your email by clicking on the link: ${process.env.FRONTEND_URL}/verify-email/${emailVerificationToken}`,
        email: true,
        sms: false,
        inApp: false
      });

      // Send phone OTP
      await sendNotification({
        recipient: newUser._id,
        recipientRole: 'user',
        type: 'verification',
        title: 'Phone Verification',
        message: `Your OTP for phone verification is: ${phoneOtp}`,
        email: false,
        sms: true,
        inApp: false
      });
    } catch (err) {
      // If error in sending notification, continue with registration
      console.error('Error sending verification:', err);
    }

    // Create and send token
    createSendToken(newUser, 'user', 201, res);
  } catch (err) {
    next(err);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Login functionality will be implemented soon',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send OTP for verification
 * @route POST /api/auth/send-otp
 */
exports.sendOTP = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully (placeholder)',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP
 * @route POST /api/auth/verify-otp
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully (placeholder)',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 * @route POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Password reset instructions sent (placeholder)',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * @route PATCH /api/auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully (placeholder)',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update password
 * @route PATCH /api/auth/update-password
 */
exports.updatePassword = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully (placeholder)',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin login
 * @route POST /api/auth/admin/login
 */
exports.adminLogin = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Admin login functionality will be implemented soon',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Seller login
 * @route POST /api/auth/seller/login
 */
exports.sellerLogin = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Seller login functionality will be implemented soon',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};