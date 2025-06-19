const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/user.model');
const { Admin } = require('../models/admin.model');
const Seller = require('../models/seller.model');
const Log = require('../models/log.model');

/**
 * Middleware to protect routes - checks if user is logged in
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // 2) Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    let currentUser;
    
    if (decoded.role === 'admin') {
      currentUser = await Admin.findById(decoded.id);
    } else if (decoded.role === 'seller') {
      // For seller, we need to get the user first, then the seller profile
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          status: 'fail',
          message: 'The user belonging to this token no longer exists.'
        });
      }
      
      currentUser = await Seller.findOne({ userId: user._id });
      if (!currentUser) {
        return res.status(401).json({
          status: 'fail',
          message: 'Seller profile not found. Please complete your seller registration.'
        });
      }
      
      // Attach user to seller for reference
      currentUser.user = user;
    } else {
      // Regular user
      currentUser = await User.findById(decoded.id);
    }

    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // 4) Check if user changed password after the token was issued
    if (decoded.role !== 'seller' && currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'fail',
        message: 'User recently changed password. Please log in again.'
      });
    }

    // 5) Check if user is active
    if (currentUser.isActive === false) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // 6) For sellers, check if seller is approved and active
    if (decoded.role === 'seller') {
      if (currentUser.isBlocked) {
        return res.status(401).json({
          status: 'fail',
          message: `Your seller account has been blocked. Reason: ${currentUser.blockReason || 'Not specified'}`
        });
      }

      if (!currentUser.isActive) {
        return res.status(401).json({
          status: 'fail',
          message: 'Your seller account is not active yet. Please complete the onboarding process.'
        });
      }
    }

    // 7) Log user activity
    await Log.create({
      level: 'info',
      module: 'auth',
      action: 'access',
      message: `User accessed ${req.originalUrl}`,
      user: currentUser._id,
      userRole: decoded.role,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token. Please log in again.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Your token has expired. Please log in again.'
      });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.'
    });
  }
};

/**
 * Middleware to restrict access to certain roles
 * @param  {...String} roles - Roles allowed to access the route
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

/**
 * Middleware to check if admin has specific role
 * @param  {...String} adminRoles - Admin roles allowed to access the route
 */
exports.restrictToAdmin = (...adminRoles) => {
  return (req, res, next) => {
    // First check if user is admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }

    // Then check if admin has the required role
    if (!adminRoles.includes(req.user.role) && req.user.role !== 'super_admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is verified
 */
exports.isVerified = (req, res, next) => {
  if (!req.user.isEmailVerified && !req.user.isPhoneVerified) {
    return res.status(403).json({
      status: 'fail',
      message: 'Please verify your email or phone number to access this resource.'
    });
  }
  next();
};

/**
 * Middleware to check if seller has completed onboarding
 */
exports.isOnboarded = (req, res, next) => {
  if (req.userRole !== 'seller') {
    return next();
  }

  if (req.user.onboardingStatus !== 'approved') {
    return res.status(403).json({
      status: 'fail',
      message: `Your seller onboarding is ${req.user.onboardingStatus}. Please complete the onboarding process.`
    });
  }
  next();
};