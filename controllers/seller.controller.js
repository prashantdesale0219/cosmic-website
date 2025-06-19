const User = require('../models/user.model');
const Seller = require('../models/seller.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Settlement = require('../models/settlement.model');
const { AppError } = require('../middlewares/error.middleware');
const { sendNotification } = require('../utils/notification');

/**
 * Start seller onboarding
 * @route POST /api/sellers/onboarding
 */
exports.startOnboarding = async (req, res, next) => {
  try {
    // Check if user already has a seller profile
    const existingSeller = await Seller.findOne({ userId: req.user.id });
    
    if (existingSeller) {
      return next(new AppError('You already have a seller profile', 400));
    }

    // Check if user is verified
    const user = await User.findById(req.user.id);
    
    if (!user.isEmailVerified || !user.isPhoneVerified) {
      return next(new AppError('Please verify your email and phone before becoming a seller', 400));
    }

    // Create seller profile with basic info
    const {
      businessName,
      businessType,
      gstNumber,
      panNumber,
      description,
      categories
    } = req.body;

    // Validate required fields
    if (!businessName || !businessType) {
      return next(new AppError('Please provide business name and type', 400));
    }

    // Create new seller profile
    const newSeller = await Seller.create({
      userId: req.user.id,
      businessName,
      businessType,
      gstNumber,
      panNumber,
      description,
      categories: categories || [],
      onboardingStatus: 'basic_info_completed',
      onboardingStep: 1,
      isActive: false,
      isVerified: false
    });

    // Update user role
    user.role = 'seller';
    await user.save({ validateBeforeSave: false });

    // Send notification
    await sendNotification({
      recipient: req.user.id,
      recipientRole: 'seller',
      type: 'account',
      title: 'Seller Onboarding Started',
      message: 'You have successfully started the seller onboarding process. Please complete all the required steps to start selling on our platform.',
      email: true,
      sms: false,
      inApp: true
    });

    res.status(201).json({
      status: 'success',
      data: {
        seller: newSeller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update seller address
 * @route PATCH /api/sellers/address
 */
exports.updateAddress = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    const {
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      location
    } = req.body;

    // Validate required fields
    if (!addressLine1 || !city || !state || !pincode || !country) {
      return next(new AppError('Please provide all required address fields', 400));
    }

    // Update address
    seller.address = {
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country
    };

    // Update location if provided
    if (location && location.coordinates) {
      seller.location = {
        type: 'Point',
        coordinates: location.coordinates
      };
    }

    // Update onboarding status if this is the first time
    if (seller.onboardingStatus === 'basic_info_completed') {
      seller.onboardingStatus = 'address_completed';
      seller.onboardingStep = 2;
    }

    await seller.save();

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update bank details
 * @route PATCH /api/sellers/bank-details
 */
exports.updateBankDetails = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    const {
      accountHolderName,
      accountNumber,
      bankName,
      branchName,
      ifscCode
    } = req.body;

    // Validate required fields
    if (!accountHolderName || !accountNumber || !bankName || !ifscCode) {
      return next(new AppError('Please provide all required bank details', 400));
    }

    // Update bank details
    seller.bankDetails = {
      accountHolderName,
      accountNumber,
      bankName,
      branchName,
      ifscCode
    };

    // Update onboarding status if this is the next step
    if (seller.onboardingStatus === 'address_completed') {
      seller.onboardingStatus = 'bank_details_completed';
      seller.onboardingStep = 3;
    }

    await seller.save();

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Upload KYC documents
 * @route POST /api/sellers/kyc
 */
exports.uploadKYC = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Get files from multer middleware
    const { gstCertificate, panCard, shopImage, cancelledCheque } = req.files || {};

    // Update KYC document URLs
    const kyc = {};

    if (gstCertificate && gstCertificate[0]) {
      kyc.gstCertificate = gstCertificate[0].location || `/uploads/${gstCertificate[0].filename}`;
    }

    if (panCard && panCard[0]) {
      kyc.panCard = panCard[0].location || `/uploads/${panCard[0].filename}`;
    }

    if (shopImage && shopImage[0]) {
      kyc.shopImage = shopImage[0].location || `/uploads/${shopImage[0].filename}`;
    }

    if (cancelledCheque && cancelledCheque[0]) {
      kyc.cancelledCheque = cancelledCheque[0].location || `/uploads/${cancelledCheque[0].filename}`;
    }

    // Update KYC details
    seller.kyc = { ...seller.kyc, ...kyc };

    // Update onboarding status if this is the next step
    if (seller.onboardingStatus === 'bank_details_completed') {
      seller.onboardingStatus = 'kyc_uploaded';
      seller.onboardingStep = 4;
    }

    await seller.save();

    // Notify admin about new KYC submission
    // This would typically go to all admins with KYC verification permissions
    await sendNotification({
      recipientRole: 'admin',
      type: 'seller',
      title: 'New Seller KYC Submission',
      message: `Seller ${seller.businessName} has submitted KYC documents for verification.`,
      email: false,
      sms: false,
      inApp: true,
      data: {
        sellerId: seller._id,
        businessName: seller.businessName
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit seller application for review
 * @route POST /api/sellers/submit-application
 */
exports.submitApplication = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Check if all required steps are completed
    if (seller.onboardingStatus !== 'kyc_uploaded') {
      return next(new AppError('Please complete all onboarding steps before submitting', 400));
    }

    // Update seller status
    seller.onboardingStatus = 'under_review';
    seller.applicationSubmittedAt = Date.now();
    await seller.save();

    // Notify admin about new seller application
    await sendNotification({
      recipientRole: 'admin',
      type: 'seller',
      title: 'New Seller Application',
      message: `Seller ${seller.businessName} has submitted their application for review.`,
      email: true,
      sms: false,
      inApp: true,
      data: {
        sellerId: seller._id,
        businessName: seller.businessName
      }
    });

    // Notify seller about application submission
    await sendNotification({
      recipient: req.user.id,
      recipientRole: 'seller',
      type: 'account',
      title: 'Application Submitted Successfully',
      message: 'Your seller application has been submitted successfully. We will review your application and get back to you soon.',
      email: true,
      sms: true,
      inApp: true
    });

    res.status(200).json({
      status: 'success',
      message: 'Application submitted successfully',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get seller profile
 * @route GET /api/sellers/profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update seller profile
 * @route PATCH /api/sellers/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Filter allowed fields
    const allowedFields = [
      'businessName',
      'description',
      'categories',
      'logo',
      'banner',
      'supportEmail',
      'supportPhone',
      'returnPolicy',
      'shippingPolicy',
      'minOrderAmount',
      'freeShippingAmount',
      'processingTime',
      'workingHours',
      'holidays'
    ];

    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    // Update seller profile
    const updatedSeller = await Seller.findByIdAndUpdate(seller._id, filteredBody, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        seller: updatedSeller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update seller settings
 * @route PATCH /api/sellers/settings
 */
exports.updateSettings = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Filter allowed fields
    const allowedFields = [
      'autoAcceptOrders',
      'vacationMode',
      'vacationNote',
      'commissionSettings',
      'taxSettings',
      'shippingSettings'
    ];

    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    // Update seller settings
    const updatedSeller = await Seller.findByIdAndUpdate(seller._id, filteredBody, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        seller: updatedSeller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get seller dashboard stats
 * @route GET /api/sellers/dashboard
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Get time period from query params (default: 30 days)
    const period = req.query.period || '30days';
    let startDate;
    const endDate = new Date();

    switch (period) {
      case '7days':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // This would typically involve aggregation queries on orders, products, etc.
    // For now, we'll return placeholder data
    // In a real implementation, you would query the Orders collection, etc.

    const stats = {
      totalOrders: 0,
      totalSales: 0,
      totalProducts: 0,
      totalCustomers: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      returnedOrders: 0,
      salesByDay: [],
      topProducts: [],
      recentOrders: []
    };

    res.status(200).json({
      status: 'success',
      data: {
        stats,
        period
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get seller by ID (Admin only)
 * @route GET /api/sellers/:id
 */
exports.getSellerById = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Get user details
    const user = await User.findById(seller.userId);

    res.status(200).json({
      status: 'success',
      data: {
        seller,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          createdAt: user.createdAt
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve seller (Admin only)
 * @route PATCH /api/sellers/:id/approve
 */
exports.approveSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Update seller status
    seller.isVerified = true;
    seller.isActive = true;
    seller.onboardingStatus = 'approved';
    seller.verifiedAt = Date.now();
    seller.verifiedBy = req.user.id; // Admin ID
    await seller.save();

    // Get user details
    const user = await User.findById(seller.userId);

    // Send notification to seller
    await sendNotification({
      recipient: seller.userId,
      recipientRole: 'seller',
      type: 'account',
      title: 'Seller Application Approved',
      message: 'Congratulations! Your seller application has been approved. You can now start selling on our platform.',
      email: true,
      sms: true,
      inApp: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject seller (Admin only)
 * @route PATCH /api/sellers/:id/reject
 */
exports.rejectSeller = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return next(new AppError('Please provide a reason for rejection', 400));
    }

    const seller = await Seller.findById(req.params.id);
    
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Update seller status
    seller.onboardingStatus = 'rejected';
    seller.rejectionReason = reason;
    seller.rejectedAt = Date.now();
    seller.rejectedBy = req.user.id; // Admin ID
    await seller.save();

    // Send notification to seller
    await sendNotification({
      recipient: seller.userId,
      recipientRole: 'seller',
      type: 'account',
      title: 'Seller Application Rejected',
      message: `We're sorry, but your seller application has been rejected. Reason: ${reason}. Please contact support for more information.`,
      email: true,
      sms: true,
      inApp: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deactivate seller (Admin only)
 * @route PATCH /api/sellers/:id/deactivate
 */
exports.deactivateSeller = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return next(new AppError('Please provide a reason for deactivation', 400));
    }

    const seller = await Seller.findById(req.params.id);
    
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Update seller status
    seller.isActive = false;
    seller.deactivationReason = reason;
    seller.deactivatedAt = Date.now();
    seller.deactivatedBy = req.user.id; // Admin ID
    await seller.save();

    // Send notification to seller
    await sendNotification({
      recipient: seller.userId,
      recipientRole: 'seller',
      type: 'account',
      title: 'Seller Account Deactivated',
      message: `Your seller account has been deactivated. Reason: ${reason}. Please contact support for more information.`,
      email: true,
      sms: true,
      inApp: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reactivate seller (Admin only)
 * @route PATCH /api/sellers/:id/reactivate
 */
exports.reactivateSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Update seller status
    seller.isActive = true;
    seller.deactivationReason = undefined;
    seller.deactivatedAt = undefined;
    seller.deactivatedBy = undefined;
    await seller.save();

    // Send notification to seller
    await sendNotification({
      recipient: seller.userId,
      recipientRole: 'seller',
      type: 'account',
      title: 'Seller Account Reactivated',
      message: 'Your seller account has been reactivated. You can now continue selling on our platform.',
      email: true,
      sms: true,
      inApp: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        seller
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all sellers (Admin only)
 * @route GET /api/sellers
 */
exports.getAllSellers = async (req, res, next) => {
  try {
    // Build query
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(field => delete queryObj[field]);

    // Filter by status if provided
    if (req.query.status) {
      queryObj.onboardingStatus = req.query.status;
    }

    // Filter by verification status if provided
    if (req.query.verified !== undefined) {
      queryObj.isVerified = req.query.verified === 'true';
    }

    // Filter by active status if provided
    if (req.query.active !== undefined) {
      queryObj.isActive = req.query.active === 'true';
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build query
    let query = Seller.find(JSON.parse(queryStr));

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Field limiting
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const sellers = await query;
    const total = await Seller.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: sellers.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: {
        sellers
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get seller orders
 * @route GET /api/sellers/orders
 */
exports.getOrders = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Build query to find orders for this seller
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(field => delete queryObj[field]);

    // Filter by seller ID
    queryObj.sellerId = seller._id;

    // Filter by status if provided
    if (req.query.status) {
      queryObj.status = req.query.status;
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build query
    let query = Order.find(JSON.parse(queryStr));

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const orders = await query;
    const total = await Order.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: orders.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: {
        orders
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get seller products
 * @route GET /api/sellers/products
 */
exports.getProducts = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Build query to find products for this seller
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(field => delete queryObj[field]);

    // Filter by seller ID
    queryObj.sellerId = seller._id;

    // Filter by status if provided
    if (req.query.status) {
      queryObj.status = req.query.status;
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build query
    let query = Product.find(JSON.parse(queryStr));

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const products = await query;
    const total = await Product.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: products.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: {
        products
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get seller settlements
 * @route GET /api/sellers/settlements
 */
exports.getSettlements = async (req, res, next) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    // Build query to find settlements for this seller
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(field => delete queryObj[field]);

    // Filter by seller ID
    queryObj.sellerId = seller._id;

    // Filter by status if provided
    if (req.query.status) {
      queryObj.status = req.query.status;
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build query
    let query = Settlement.find(JSON.parse(queryStr));

    // Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const settlements = await query;
    const total = await Settlement.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: settlements.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: {
        settlements
      }
    });
  } catch (err) {
    next(err);
  }
};