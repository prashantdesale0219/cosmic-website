const User = require('../models/user.model');
const { AppError } = require('../middlewares/error.middleware');
const { sendNotification } = require('../utils/notification');
const crypto = require('crypto');
const otpGenerator = require('otp-generator');

/**
 * Get current user profile
 * @route GET /api/users/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update user profile
 * @route PATCH /api/users/update-profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    // Filter out fields that are not allowed to be updated
    const filteredBody = {};
    const allowedFields = ['name', 'email', 'phone', 'gender', 'dateOfBirth', 'profileImage'];
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    // Check if email is being updated
    if (filteredBody.email && filteredBody.email !== req.user.email) {
      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      filteredBody.emailVerificationToken = crypto
        .createHash('sha256')
        .update(emailVerificationToken)
        .digest('hex');
      filteredBody.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      filteredBody.isEmailVerified = false;

      // Send email verification
      try {
        await sendNotification({
          recipient: req.user.id,
          recipientRole: 'user',
          type: 'account',
          title: 'Verify Your New Email',
          message: `Please verify your new email by clicking on the link: ${req.protocol}://${req.get('host')}/api/auth/verify-email/${emailVerificationToken}`,
          email: true,
          emailRecipient: filteredBody.email, // Send to new email
          sms: false,
          inApp: true
        });
      } catch (err) {
        console.error('Error sending verification:', err);
        // Don't fail update if notification fails
      }
    }

    // Check if phone is being updated
    if (filteredBody.phone && filteredBody.phone !== req.user.phone) {
      // Generate phone OTP
      const phoneOtp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
      });
      
      filteredBody.phoneOtp = phoneOtp;
      filteredBody.phoneOtpExpires = Date.now() + parseInt(process.env.OTP_EXPIRY) * 60 * 1000; // OTP_EXPIRY minutes
      filteredBody.isPhoneVerified = false;

      // Send phone OTP
      try {
        await sendNotification({
          recipient: req.user.id,
          recipientRole: 'user',
          type: 'account',
          title: 'Your OTP for New Phone Verification',
          message: `Your OTP for new phone verification is: ${phoneOtp}. It is valid for ${process.env.OTP_EXPIRY} minutes.`,
          email: false,
          sms: true,
          smsRecipient: filteredBody.phone, // Send to new phone
          inApp: true
        });
      } catch (err) {
        console.error('Error sending OTP:', err);
        // Don't fail update if notification fails
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update current user
 * @route PATCH /api/users/update-me
 */
exports.updateMe = exports.updateProfile;

/**
 * Add a new address
 * @route POST /api/users/addresses
 */
exports.addAddress = async (req, res, next) => {
  try {
    const { type, name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = req.body;

    if (!type || !name || !phone || !addressLine1 || !city || !state || !postalCode || !country) {
      return next(new AppError('Please provide all required address fields', 400));
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Create new address object
    const newAddress = {
      type,
      name,
      phone,
      addressLine1,
      addressLine2: addressLine2 || '',
      city,
      state,
      postalCode,
      country,
      isDefault: isDefault || false
    };

    // If this is the first address or isDefault is true, make it default
    if (user.addresses.length === 0 || isDefault) {
      // Set all existing addresses to non-default
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
      newAddress.isDefault = true;
    }

    // Add new address to addresses array
    user.addresses.push(newAddress);

    // Save user
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      status: 'success',
      data: {
        address: newAddress
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an address
 * @route PATCH /api/users/addresses/:addressId
 */
exports.updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const { type, name, phone, addressLine1, addressLine2, city, state, postalCode, country, isDefault } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Find address index
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);

    if (addressIndex === -1) {
      return next(new AppError('Address not found', 404));
    }

    // Update address fields if provided
    if (type) user.addresses[addressIndex].type = type;
    if (name) user.addresses[addressIndex].name = name;
    if (phone) user.addresses[addressIndex].phone = phone;
    if (addressLine1) user.addresses[addressIndex].addressLine1 = addressLine1;
    if (addressLine2 !== undefined) user.addresses[addressIndex].addressLine2 = addressLine2;
    if (city) user.addresses[addressIndex].city = city;
    if (state) user.addresses[addressIndex].state = state;
    if (postalCode) user.addresses[addressIndex].postalCode = postalCode;
    if (country) user.addresses[addressIndex].country = country;

    // Handle default address
    if (isDefault) {
      // Set all addresses to non-default
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
      // Set this address as default
      user.addresses[addressIndex].isDefault = true;
    }

    // Save user
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        address: user.addresses[addressIndex]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete an address
 * @route DELETE /api/users/addresses/:addressId
 */
exports.deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Find address index
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);

    if (addressIndex === -1) {
      return next(new AppError('Address not found', 404));
    }

    // Check if this is the default address
    const isDefault = user.addresses[addressIndex].isDefault;

    // Remove address
    user.addresses.splice(addressIndex, 1);

    // If deleted address was default and there are other addresses, make the first one default
    if (isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    // Save user
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Address deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all addresses
 * @route GET /api/users/addresses
 */
exports.getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      results: user.addresses.length,
      data: {
        addresses: user.addresses
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a specific address
 * @route GET /api/users/addresses/:addressId
 */
exports.getAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Find address
    const address = user.addresses.find(addr => addr._id.toString() === addressId);

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        address
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Set an address as default
 * @route PATCH /api/users/addresses/:addressId/set-default
 */
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Find address index
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);

    if (addressIndex === -1) {
      return next(new AppError('Address not found', 404));
    }

    // Set all addresses to non-default
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });

    // Set this address as default
    user.addresses[addressIndex].isDefault = true;

    // Save user
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        address: user.addresses[addressIndex]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add product to wishlist
 * @route POST /api/users/wishlist
 */
exports.addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return next(new AppError('Please provide a product ID', 400));
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if product already in wishlist
    if (user.wishlist.includes(productId)) {
      return res.status(200).json({
        status: 'success',
        message: 'Product already in wishlist'
      });
    }

    // Add product to wishlist
    user.wishlist.push(productId);

    // Save user
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Product added to wishlist'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove product from wishlist
 * @route DELETE /api/users/wishlist/:productId
 */
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if product in wishlist
    const index = user.wishlist.indexOf(productId);
    if (index === -1) {
      return next(new AppError('Product not found in wishlist', 404));
    }

    // Remove product from wishlist
    user.wishlist.splice(index, 1);

    // Save user
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Product removed from wishlist'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get wishlist
 * @route GET /api/users/wishlist
 */
exports.getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      results: user.wishlist.length,
      data: {
        wishlist: user.wishlist
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get user orders
 * @route GET /api/users/orders
 */
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: {
        orders
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get specific order
 * @route GET /api/users/orders/:orderId
 */
exports.getMyOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user.id
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        order
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deactivate account
 * @route PATCH /api/users/deactivate
 */
exports.deactivateAccount = async (req, res, next) => {
  try {
    const { password, reason } = req.body;

    if (!password) {
      return next(new AppError('Please provide your password', 400));
    }

    // Get user
    const user = await User.findById(req.user.id).select('+password');

    // Check if password is correct
    if (!(await user.correctPassword(password, user.password))) {
      return next(new AppError('Your password is incorrect', 401));
    }

    // Update user status
    user.isActive = false;
    user.deactivationReason = reason || 'Not specified';
    user.deactivatedAt = Date.now();
    await user.save({ validateBeforeSave: false });

    // Send notification
    await sendNotification({
      recipient: user._id,
      recipientRole: 'user',
      type: 'account',
      title: 'Account Deactivated',
      message: 'Your account has been deactivated successfully. We hope to see you again soon!',
      email: true,
      sms: true,
      inApp: false
    });

    res.status(200).json({
      status: 'success',
      message: 'Account deactivated successfully'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reactivate account
 * @route PATCH /api/users/reactivate
 */
exports.reactivateAccount = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Find inactive user
    const user = await User.findOne({ email, isActive: false }).select('+password');

    if (!user) {
      return next(new AppError('No inactive account found with this email', 404));
    }

    // Check if password is correct
    if (!(await user.correctPassword(password, user.password))) {
      return next(new AppError('Your password is incorrect', 401));
    }

    // Update user status
    user.isActive = true;
    user.deactivationReason = undefined;
    user.deactivatedAt = undefined;
    await user.save({ validateBeforeSave: false });

    // Send notification
    await sendNotification({
      recipient: user._id,
      recipientRole: 'user',
      type: 'account',
      title: 'Account Reactivated',
      message: 'Your account has been reactivated successfully. Welcome back!',
      email: true,
      sms: true,
      inApp: true
    });

    // Log user in
    createSendToken(user, user.role, 200, res);
  } catch (err) {
    next(err);
  }
};