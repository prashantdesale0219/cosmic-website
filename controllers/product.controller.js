const Product = require('../models/product.model');
const Seller = require('../models/seller.model');
const Category = require('../models/category.model');
const { AppError } = require('../middlewares/error.middleware');
const { sendNotification } = require('../utils/notification');

/**
 * Create a new product
 * @route POST /api/products
 */
exports.createProduct = async (req, res, next) => {
  try {
    // Check if seller is verified and active
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller) {
      return next(new AppError('Seller profile not found', 404));
    }

    if (!seller.isVerified) {
      return next(new AppError('Your seller account is not verified yet', 403));
    }

    if (!seller.isActive) {
      return next(new AppError('Your seller account is currently inactive', 403));
    }

    // Validate category
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return next(new AppError('Invalid category', 400));
      }
    }

    // Create product
    const newProduct = await Product.create({
      ...req.body,
      seller: seller._id,
      status: 'draft' // Default status
    });

    res.status(201).json({
      status: 'success',
      data: {
        product: newProduct
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all products (with filtering, sorting, pagination)
 * @route GET /api/products
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    // Build query
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(field => delete queryObj[field]);

    // Filter by status - for public access, only show active products
    if (!req.user || req.user.role === 'user') {
      queryObj.status = 'active';
    } else if (req.user.role === 'seller') {
      // For sellers, only show their own products
      const seller = await Seller.findOne({ userId: req.user.id });
      if (seller) {
        queryObj.seller = seller._id;
      }
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      queryObj.price = {};
      if (req.query.minPrice) queryObj.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) queryObj.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build base query
    let query = Product.find(JSON.parse(queryStr));

    // Search functionality
    if (req.query.search) {
      query = query.find(
        { $text: { $search: req.query.search } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } });
    }

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
    const products = await query.populate('category', 'name');
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
 * Get product by ID
 * @route GET /api/products/:id
 */
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name path')
      .populate('seller', 'businessName logo rating');

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // For public access, only show active products
    if ((!req.user || req.user.role === 'user') && product.status !== 'active') {
      return next(new AppError('Product not found', 404));
    }

    // For sellers, only show their own products
    if (req.user && req.user.role === 'seller') {
      const seller = await Seller.findOne({ userId: req.user.id });
      if (seller && product.seller._id.toString() !== seller._id.toString()) {
        return next(new AppError('You do not have permission to view this product', 403));
      }
    }

    // Increment view count
    product.viewCount += 1;
    await product.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        product
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update product
 * @route PATCH /api/products/:id
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if seller owns the product
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller || product.seller.toString() !== seller._id.toString()) {
      return next(new AppError('You do not have permission to update this product', 403));
    }

    // Filter out fields that are not allowed to be updated
    const filteredBody = {};
    const allowedFields = [
      'name',
      'description',
      'price',
      'comparePrice',
      'costPrice',
      'category',
      'subcategory',
      'brand',
      'images',
      'videos',
      'attributes',
      'variants',
      'tags',
      'status',
      'stock',
      'lowStockThreshold',
      'weight',
      'dimensions',
      'shippingClass',
      'taxClass',
      'seo'
    ];
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    // Validate category if updated
    if (filteredBody.category) {
      const category = await Category.findById(filteredBody.category);
      if (!category) {
        return next(new AppError('Invalid category', 400));
      }
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, filteredBody, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        product: updatedProduct
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete product
 * @route DELETE /api/products/:id
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if seller owns the product or user is admin
    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ userId: req.user.id });
      
      if (!seller || product.seller.toString() !== seller._id.toString()) {
        return next(new AppError('You do not have permission to delete this product', 403));
      }
    }

    // Soft delete product
    product.status = 'deleted';
    product.deletedAt = Date.now();
    product.deletedBy = req.user.id;
    await product.save({ validateBeforeSave: false });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update product status
 * @route PATCH /api/products/:id/status
 */
exports.updateProductStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!status || !['draft', 'pending', 'active', 'inactive', 'rejected'].includes(status)) {
      return next(new AppError('Please provide a valid status', 400));
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check permissions based on role
    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ userId: req.user.id });
      
      if (!seller || product.seller.toString() !== seller._id.toString()) {
        return next(new AppError('You do not have permission to update this product', 403));
      }

      // Sellers can only set certain statuses
      if (!['draft', 'pending', 'inactive'].includes(status)) {
        return next(new AppError(`Sellers cannot set product status to ${status}`, 403));
      }
    }

    // Update product status
    product.status = status;
    product.statusHistory.push({
      status,
      changedBy: req.user.id,
      changedAt: Date.now()
    });

    await product.save();

    // If status is changed to pending, notify admin
    if (status === 'pending') {
      await sendNotification({
        recipientRole: 'admin',
        type: 'product',
        title: 'New Product Pending Approval',
        message: `Product "${product.name}" is pending approval.`,
        email: false,
        sms: false,
        inApp: true,
        data: {
          productId: product._id,
          productName: product.name,
          sellerId: product.seller
        }
      });
    }

    // If status is changed to active or rejected by admin, notify seller
    if ((status === 'active' || status === 'rejected') && req.user.role === 'admin') {
      const seller = await Seller.findById(product.seller);
      if (seller) {
        await sendNotification({
          recipient: seller.userId,
          recipientRole: 'seller',
          type: 'product',
          title: `Product ${status === 'active' ? 'Approved' : 'Rejected'}`,
          message: `Your product "${product.name}" has been ${status === 'active' ? 'approved' : 'rejected'}.`,
          email: true,
          sms: false,
          inApp: true,
          data: {
            productId: product._id,
            productName: product.name
          }
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        product
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add product variant
 * @route POST /api/products/:id/variants
 */
exports.addProductVariant = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if seller owns the product
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller || product.seller.toString() !== seller._id.toString()) {
      return next(new AppError('You do not have permission to update this product', 403));
    }

    // Validate variant data
    const {
      name,
      sku,
      attributes,
      price,
      comparePrice,
      costPrice,
      stock,
      images
    } = req.body;

    if (!name || !attributes || !price) {
      return next(new AppError('Please provide all required variant fields', 400));
    }

    // Create new variant
    const newVariant = {
      name,
      sku,
      attributes,
      price,
      comparePrice,
      costPrice,
      stock,
      images
    };

    // Add variant to product
    product.variants.push(newVariant);
    await product.save();

    res.status(201).json({
      status: 'success',
      data: {
        variant: product.variants[product.variants.length - 1],
        product
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update product variant
 * @route PATCH /api/products/:id/variants/:variantId
 */
exports.updateProductVariant = async (req, res, next) => {
  try {
    const { id, variantId } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if seller owns the product
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller || product.seller.toString() !== seller._id.toString()) {
      return next(new AppError('You do not have permission to update this product', 403));
    }

    // Find variant index
    const variantIndex = product.variants.findIndex(v => v._id.toString() === variantId);

    if (variantIndex === -1) {
      return next(new AppError('Variant not found', 404));
    }

    // Update variant fields
    const allowedFields = [
      'name',
      'sku',
      'attributes',
      'price',
      'comparePrice',
      'costPrice',
      'stock',
      'images'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        product.variants[variantIndex][field] = req.body[field];
      }
    });

    await product.save();

    res.status(200).json({
      status: 'success',
      data: {
        variant: product.variants[variantIndex],
        product
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete product variant
 * @route DELETE /api/products/:id/variants/:variantId
 */
exports.deleteProductVariant = async (req, res, next) => {
  try {
    const { id, variantId } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if seller owns the product
    const seller = await Seller.findOne({ userId: req.user.id });
    
    if (!seller || product.seller.toString() !== seller._id.toString()) {
      return next(new AppError('You do not have permission to update this product', 403));
    }

    // Find variant index
    const variantIndex = product.variants.findIndex(v => v._id.toString() === variantId);

    if (variantIndex === -1) {
      return next(new AppError('Variant not found', 404));
    }

    // Remove variant
    product.variants.splice(variantIndex, 1);
    await product.save();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add product review
 * @route POST /api/products/:id/reviews
 */
exports.addProductReview = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if product is active
    if (product.status !== 'active') {
      return next(new AppError('Cannot review inactive product', 400));
    }

    // Check if user has purchased the product
    // This would typically involve checking the Orders collection
    // For now, we'll skip this check

    // Check if user has already reviewed this product
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return next(new AppError('You have already reviewed this product', 400));
    }

    // Validate review data
    const { rating, title, comment, images } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return next(new AppError('Please provide a valid rating between 1 and 5', 400));
    }

    // Create new review
    const newReview = {
      user: req.user.id,
      rating,
      title,
      comment,
      images: images || []
    };

    // Add review to product
    product.reviews.push(newReview);

    // Update product rating
    const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);
    product.rating = totalRating / product.reviews.length;

    await product.save();

    // Notify seller about new review
    const seller = await Seller.findById(product.seller);
    if (seller) {
      await sendNotification({
        recipient: seller.userId,
        recipientRole: 'seller',
        type: 'product',
        title: 'New Product Review',
        message: `Your product "${product.name}" has received a new ${rating}-star review.`,
        email: false,
        sms: false,
        inApp: true,
        data: {
          productId: product._id,
          productName: product.name,
          reviewId: product.reviews[product.reviews.length - 1]._id
        }
      });
    }

    res.status(201).json({
      status: 'success',
      data: {
        review: product.reviews[product.reviews.length - 1],
        productRating: product.rating
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get product reviews
 * @route GET /api/products/:id/reviews
 */
exports.getProductReviews = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'reviews.user',
        select: 'name profileImage'
      });

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // For public access, only show reviews of active products
    if ((!req.user || req.user.role === 'user') && product.status !== 'active') {
      return next(new AppError('Product not found', 404));
    }

    // Calculate rating statistics
    const stats = {
      totalReviews: product.reviews.length,
      averageRating: product.rating,
      ratingDistribution: {
        5: product.reviews.filter(review => review.rating === 5).length,
        4: product.reviews.filter(review => review.rating === 4).length,
        3: product.reviews.filter(review => review.rating === 3).length,
        2: product.reviews.filter(review => review.rating === 2).length,
        1: product.reviews.filter(review => review.rating === 1).length
      }
    };

    res.status(200).json({
      status: 'success',
      data: {
        reviews: product.reviews,
        stats
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update product review
 * @route PATCH /api/products/:id/reviews/:reviewId
 */
exports.updateProductReview = async (req, res, next) => {
  try {
    const { id, reviewId } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Find review index
    const reviewIndex = product.reviews.findIndex(
      review => review._id.toString() === reviewId && review.user.toString() === req.user.id
    );

    if (reviewIndex === -1) {
      return next(new AppError('Review not found or you are not the author', 404));
    }

    // Update review fields
    const allowedFields = ['rating', 'title', 'comment', 'images'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        product.reviews[reviewIndex][field] = req.body[field];
      }
    });

    // Update review date
    product.reviews[reviewIndex].updatedAt = Date.now();

    // Update product rating
    const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);
    product.rating = totalRating / product.reviews.length;

    await product.save();

    res.status(200).json({
      status: 'success',
      data: {
        review: product.reviews[reviewIndex],
        productRating: product.rating
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete product review
 * @route DELETE /api/products/:id/reviews/:reviewId
 */
exports.deleteProductReview = async (req, res, next) => {
  try {
    const { id, reviewId } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Find review index
    let reviewIndex;
    
    if (req.user.role === 'admin') {
      // Admins can delete any review
      reviewIndex = product.reviews.findIndex(review => review._id.toString() === reviewId);
    } else {
      // Users can only delete their own reviews
      reviewIndex = product.reviews.findIndex(
        review => review._id.toString() === reviewId && review.user.toString() === req.user.id
      );
    }

    if (reviewIndex === -1) {
      return next(new AppError('Review not found or you are not authorized to delete it', 404));
    }

    // Remove review
    product.reviews.splice(reviewIndex, 1);

    // Update product rating
    if (product.reviews.length > 0) {
      const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0);
      product.rating = totalRating / product.reviews.length;
    } else {
      product.rating = 0;
    }

    await product.save();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get seller products
 * @route GET /api/sellers/:sellerId/products
 */
exports.getSellerProducts = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    
    // Verify seller exists
    const seller = await Seller.findById(sellerId);
    
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Build query
    const queryObj = { ...req.query, seller: sellerId };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(field => delete queryObj[field]);

    // For public access, only show active products
    if (!req.user || req.user.role === 'user') {
      queryObj.status = 'active';
    }

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    // Build base query
    let query = Product.find(JSON.parse(queryStr));

    // Search functionality
    if (req.query.search) {
      query = query.find(
        { $text: { $search: req.query.search } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } });
    }

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
    const products = await query.populate('category', 'name');
    const total = await Product.countDocuments(JSON.parse(queryStr));

    res.status(200).json({
      status: 'success',
      results: products.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: {
        seller: {
          _id: seller._id,
          businessName: seller.businessName,
          logo: seller.logo,
          rating: seller.rating
        },
        products
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get related products
 * @route GET /api/products/:id/related
 */
exports.getRelatedProducts = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Find products in the same category, excluding the current product
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      status: 'active'
    })
      .limit(6)
      .select('name price images rating category');

    res.status(200).json({
      status: 'success',
      results: relatedProducts.length,
      data: {
        products: relatedProducts
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get featured products
 * @route GET /api/products/featured
 */
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    // Get limit from query params or default to 10
    const limit = parseInt(req.query.limit, 10) || 10;

    // Find featured products
    const featuredProducts = await Product.find({
      status: 'active',
      isFeatured: true
    })
      .limit(limit)
      .select('name price images rating category seller')
      .populate('category', 'name')
      .populate('seller', 'businessName logo');

    res.status(200).json({
      status: 'success',
      results: featuredProducts.length,
      data: {
        products: featuredProducts
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get best selling products
 * @route GET /api/products/best-selling
 */
exports.getBestSellingProducts = async (req, res, next) => {
  try {
    // Get limit from query params or default to 10
    const limit = parseInt(req.query.limit, 10) || 10;

    // Find best selling products
    const bestSellingProducts = await Product.find({
      status: 'active'
    })
      .sort('-salesCount')
      .limit(limit)
      .select('name price images rating category seller salesCount')
      .populate('category', 'name')
      .populate('seller', 'businessName logo');

    res.status(200).json({
      status: 'success',
      results: bestSellingProducts.length,
      data: {
        products: bestSellingProducts
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get new arrivals
 * @route GET /api/products/new-arrivals
 */
exports.getNewArrivals = async (req, res, next) => {
  try {
    // Get limit from query params or default to 10
    const limit = parseInt(req.query.limit, 10) || 10;

    // Find new arrival products
    const newArrivals = await Product.find({
      status: 'active'
    })
      .sort('-createdAt')
      .limit(limit)
      .select('name price images rating category seller createdAt')
      .populate('category', 'name')
      .populate('seller', 'businessName logo');

    res.status(200).json({
      status: 'success',
      results: newArrivals.length,
      data: {
        products: newArrivals
      }
    });
  } catch (err) {
    next(err);
  }
};