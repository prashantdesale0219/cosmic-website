const Order = require('../models/order.model');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const Seller = require('../models/seller.model');
const Offer = require('../models/offer.model');
const Return = require('../models/return.model');
const { AppError } = require('../middlewares/error.middleware');
const { sendNotification } = require('../utils/notification');

/**
 * Create a new order
 * @route POST /api/orders
 */
exports.createOrder = async (req, res, next) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      couponCode,
      notes,
      isGift,
      giftMessage
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('Order must contain at least one item', 400));
    }

    if (!shippingAddress) {
      return next(new AppError('Shipping address is required', 400));
    }

    if (!paymentMethod) {
      return next(new AppError('Payment method is required', 400));
    }

    // Generate order number
    const orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Process items and calculate totals
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    let shippingCost = 0;
    const processedItems = [];

    for (const item of items) {
      // Validate product and quantity
      if (!item.productId || !item.quantity) {
        return next(new AppError('Each item must have a product ID and quantity', 400));
      }

      // Get product details
      const product = await Product.findById(item.productId);
      if (!product) {
        return next(new AppError(`Product not found: ${item.productId}`, 404));
      }

      if (product.status !== 'active') {
        return next(new AppError(`Product is not available: ${product.name}`, 400));
      }

      // Check if variant exists if specified
      let variantPrice = product.price;
      let variantSku = product.sku;
      let variantImage = product.images && product.images.length > 0 ? product.images[0] : null;

      if (item.variant && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === item.variant.toString());
        if (!variant) {
          return next(new AppError(`Variant not found for product: ${product.name}`, 404));
        }
        variantPrice = variant.price || product.price;
        variantSku = variant.sku || product.sku;
        variantImage = variant.image || variantImage;
      }

      // Check stock availability
      if (product.stockQuantity < item.quantity) {
        return next(new AppError(`Insufficient stock for product: ${product.name}`, 400));
      }

      // Get seller details
      const seller = await Seller.findById(product.seller);
      if (!seller) {
        return next(new AppError(`Seller not found for product: ${product.name}`, 404));
      }

      if (seller.status !== 'active' || !seller.isVerified) {
        return next(new AppError(`Seller is not active for product: ${product.name}`, 400));
      }

      // Calculate item total
      const itemPrice = variantPrice;
      const itemTotal = itemPrice * item.quantity;
      const itemTax = (itemTotal * (product.taxRate || 0)) / 100;

      // Calculate platform fee based on seller's commission settings
      const platformFeePercentage = seller.commissionSettings?.percentage || 5; // Default 5%
      const platformFee = (itemTotal * platformFeePercentage) / 100;
      const sellerAmount = itemTotal - platformFee;

      // Add to processed items
      processedItems.push({
        product: product._id,
        variant: item.variant,
        name: product.name,
        sku: variantSku,
        image: variantImage,
        price: itemPrice,
        quantity: item.quantity,
        tax: itemTax,
        total: itemTotal + itemTax,
        seller: seller._id,
        sellerAmount,
        platformFee,
        status: 'pending',
        statusHistory: [{
          status: 'pending',
          timestamp: new Date(),
          updatedBy: 'system'
        }]
      });

      // Update totals
      subtotal += itemTotal;
      tax += itemTax;

      // Update product stock
      product.stockQuantity -= item.quantity;
      product.salesCount = (product.salesCount || 0) + item.quantity;
      await product.save();
    }

    // Apply coupon if provided
    let coupon = null;
    if (couponCode) {
      coupon = await Offer.findOne({
        code: couponCode,
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });

      if (!coupon) {
        return next(new AppError('Invalid or expired coupon code', 400));
      }

      // Check if coupon is applicable
      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        return next(new AppError(`Minimum order value for this coupon is ${coupon.minOrderValue}`, 400));
      }

      // Check user-specific restrictions
      if (coupon.applicableFor === 'new_users') {
        const userOrders = await Order.countDocuments({ user: req.user.id });
        if (userOrders > 0) {
          return next(new AppError('This coupon is only for new users', 400));
        }
      } else if (coupon.applicableFor === 'specific_users') {
        if (!coupon.specificUsers.includes(req.user.id)) {
          return next(new AppError('This coupon is not applicable for your account', 400));
        }
      }

      // Check usage limits
      if (coupon.usageLimit !== -1 && coupon.usageCount >= coupon.usageLimit) {
        return next(new AppError('This coupon has reached its usage limit', 400));
      }

      const userUsage = coupon.userUsage.find(u => u.user.toString() === req.user.id);
      if (userUsage && coupon.perUserLimit !== -1 && userUsage.count >= coupon.perUserLimit) {
        return next(new AppError('You have already used this coupon the maximum number of times', 400));
      }

      // Calculate discount
      if (coupon.type === 'percentage') {
        discount = (subtotal * coupon.value) / 100;
        if (coupon.maxDiscountValue && discount > coupon.maxDiscountValue) {
          discount = coupon.maxDiscountValue;
        }
      } else if (coupon.type === 'fixed') {
        discount = coupon.value;
      } else if (coupon.type === 'free_shipping') {
        shippingCost = 0;
      }

      // Update coupon usage
      coupon.usageCount += 1;
      if (userUsage) {
        userUsage.count += 1;
        userUsage.lastUsed = new Date();
      } else {
        coupon.userUsage.push({
          user: req.user.id,
          count: 1,
          lastUsed: new Date()
        });
      }
      await coupon.save();
    }

    // Calculate total
    const total = subtotal + tax + shippingCost - discount;

    // Create payment object
    const payment = {
      method: paymentMethod,
      amount: total,
      status: paymentMethod === 'cod' ? 'pending' : 'pending',
      paymentGateway: paymentMethod === 'cod' ? 'cod' : 'razorpay' // Default to Razorpay for non-COD
    };

    // Create order
    const order = await Order.create({
      orderNumber,
      user: req.user.id,
      items: processedItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      payment,
      subtotal,
      tax,
      shippingCost,
      discount,
      coupon: coupon ? coupon._id : null,
      total,
      notes,
      isGift,
      giftMessage,
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        updatedBy: 'system'
      }],
      estimatedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });

    // Send notifications
    // To user
    await sendNotification({
      recipient: req.user.id,
      recipientType: 'user',
      title: 'Order Placed Successfully',
      message: `Your order #${orderNumber} has been placed successfully.`,
      type: 'order',
      referenceId: order._id
    });

    // To sellers
    const sellerIds = [...new Set(processedItems.map(item => item.seller.toString()))];
    for (const sellerId of sellerIds) {
      const sellerItems = processedItems.filter(item => item.seller.toString() === sellerId);
      await sendNotification({
        recipient: sellerId,
        recipientType: 'seller',
        title: 'New Order Received',
        message: `You have received a new order #${orderNumber} with ${sellerItems.length} item(s).`,
        type: 'order',
        referenceId: order._id
      });
    }

    res.status(201).json({
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
 * Get all orders
 * @route GET /api/orders
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    // Build query based on user role
    let query = {};

    // For regular users, only show their own orders
    if (req.user.role === 'user') {
      query.user = req.user.id;
    }
    // For sellers, only show orders containing their products
    else if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ user: req.user.id });
      if (!seller) {
        return next(new AppError('Seller profile not found', 404));
      }
      query['items.seller'] = seller._id;
    }
    // Admin can see all orders

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    } else if (req.query.duration) {
      const now = new Date();
      let startDate;

      switch (req.query.duration) {
        case '1m':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case '3m':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        case '1y':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1)); // Default to 1 month
      }

      query.createdAt = { $gte: startDate };
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images')
      .populate('items.seller', 'businessName');

    // Get total count for pagination
    const total = await Order.countDocuments(query);

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
 * Get order by ID
 * @route GET /api/orders/:id
 */
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images description')
      .populate('items.seller', 'businessName logo')
      .populate('coupon', 'code type value');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check permissions
    if (req.user.role === 'user' && order.user._id.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to view this order', 403));
    }

    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ user: req.user.id });
      if (!seller) {
        return next(new AppError('Seller profile not found', 404));
      }

      // Check if this seller has any items in this order
      const hasSellerItems = order.items.some(item => item.seller._id.toString() === seller._id.toString());
      if (!hasSellerItems) {
        return next(new AppError('You do not have permission to view this order', 403));
      }

      // For sellers, filter out items from other sellers
      if (req.query.sellerItemsOnly === 'true') {
        order.items = order.items.filter(item => item.seller._id.toString() === seller._id.toString());
      }
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
 * Update order status
 * @route PATCH /api/orders/:id/status
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, comment } = req.body;
    
    if (!status) {
      return next(new AppError('Status is required', 400));
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check permissions based on role and requested status change
    if (req.user.role === 'user') {
      // Users can only cancel their own orders if they're still pending
      if (status !== 'cancelled' || order.user.toString() !== req.user.id || order.status !== 'pending') {
        return next(new AppError('You do not have permission to update this order status', 403));
      }
    } else if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ user: req.user.id });
      if (!seller) {
        return next(new AppError('Seller profile not found', 404));
      }

      // Sellers can only update status of their own items
      // For simplicity, we're updating the entire order status here
      // In a real implementation, you might want to update individual item statuses
      const hasSellerItems = order.items.some(item => item.seller.toString() === seller._id.toString());
      if (!hasSellerItems) {
        return next(new AppError('You do not have permission to update this order', 403));
      }

      // Sellers can only update to certain statuses
      const allowedSellerStatuses = ['processing', 'shipped'];
      if (!allowedSellerStatuses.includes(status)) {
        return next(new AppError(`Sellers can only update status to: ${allowedSellerStatuses.join(', ')}`, 400));
      }
    }
    // Admins can update to any status

    // Update order status
    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      comment: comment || '',
      updatedBy: req.user.role
    });

    // Update additional fields based on status
    if (status === 'shipped') {
      order.shippedAt = new Date();
      if (req.body.trackingNumber) order.trackingNumber = req.body.trackingNumber;
      if (req.body.trackingUrl) order.trackingUrl = req.body.trackingUrl;
      if (req.body.shippingProvider) order.shippingProvider = req.body.shippingProvider;
    } else if (status === 'delivered') {
      order.deliveredAt = new Date();
    } else if (status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = req.body.cancellationReason || 'No reason provided';

      // Restore product stock for cancelled orders
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stockQuantity: item.quantity, salesCount: -item.quantity }
        });
      }
    }

    await order.save();

    // Send notification to user
    await sendNotification({
      recipient: order.user,
      recipientType: 'user',
      title: 'Order Status Updated',
      message: `Your order #${order.orderNumber} status has been updated to ${status}.`,
      type: 'order',
      referenceId: order._id
    });

    // If user updated status, notify sellers
    if (req.user.role === 'user') {
      const sellerIds = [...new Set(order.items.map(item => item.seller.toString()))];
      for (const sellerId of sellerIds) {
        await sendNotification({
          recipient: sellerId,
          recipientType: 'seller',
          title: 'Order Status Updated',
          message: `Order #${order.orderNumber} has been ${status} by the customer.`,
          type: 'order',
          referenceId: order._id
        });
      }
    }
    // If seller updated status, notify user
    else if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ user: req.user.id });
      await sendNotification({
        recipient: order.user,
        recipientType: 'user',
        title: 'Order Status Updated',
        message: `Your order #${order.orderNumber} from ${seller.businessName} has been updated to ${status}.`,
        type: 'order',
        referenceId: order._id
      });
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
 * Update order item status
 * @route PATCH /api/orders/:id/items/:itemId
 */
exports.updateOrderItemStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber, trackingUrl, shippingProvider, comment } = req.body;
    
    if (!status) {
      return next(new AppError('Status is required', 400));
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Find the specific item
    const itemIndex = order.items.findIndex(item => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return next(new AppError('Order item not found', 404));
    }

    const item = order.items[itemIndex];

    // Check permissions
    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ user: req.user.id });
      if (!seller) {
        return next(new AppError('Seller profile not found', 404));
      }

      // Seller can only update their own items
      if (item.seller.toString() !== seller._id.toString()) {
        return next(new AppError('You do not have permission to update this item', 403));
      }

      // Sellers can only update to certain statuses
      const allowedSellerStatuses = ['processing', 'shipped'];
      if (!allowedSellerStatuses.includes(status)) {
        return next(new AppError(`Sellers can only update status to: ${allowedSellerStatuses.join(', ')}`, 400));
      }
    } else if (req.user.role === 'user') {
      // Users can only cancel their own orders if they're still pending
      if (status !== 'cancelled' || order.user.toString() !== req.user.id || item.status !== 'pending') {
        return next(new AppError('You do not have permission to update this item status', 403));
      }
    }

    // Update item status
    item.status = status;
    item.statusHistory.push({
      status,
      timestamp: new Date(),
      comment: comment || '',
      updatedBy: req.user.role
    });

    // Update additional fields based on status
    if (status === 'shipped') {
      item.shippedAt = new Date();
      if (trackingNumber) item.trackingNumber = trackingNumber;
      if (trackingUrl) item.trackingUrl = trackingUrl;
      if (shippingProvider) item.shippingProvider = shippingProvider;
    } else if (status === 'delivered') {
      item.deliveredAt = new Date();
    } else if (status === 'cancelled') {
      item.cancelledAt = new Date();
      item.cancellationReason = req.body.cancellationReason || 'No reason provided';

      // Restore product stock for cancelled item
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stockQuantity: item.quantity, salesCount: -item.quantity }
      });
    }

    // Check if all items have the same status to update the overall order status
    const allItemsHaveSameStatus = order.items.every(i => i.status === status);
    if (allItemsHaveSameStatus) {
      order.status = status;
      order.statusHistory.push({
        status,
        timestamp: new Date(),
        comment: `All items are now ${status}`,
        updatedBy: req.user.role
      });

      // Update order-level fields based on status
      if (status === 'delivered') {
        order.deliveredAt = new Date();
      } else if (status === 'cancelled') {
        order.cancelledAt = new Date();
        order.cancellationReason = 'All items cancelled';
      }
    }

    await order.save();

    // Send notifications
    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ user: req.user.id });
      await sendNotification({
        recipient: order.user,
        recipientType: 'user',
        title: 'Order Item Status Updated',
        message: `Your order item in order #${order.orderNumber} from ${seller.businessName} has been updated to ${status}.`,
        type: 'order',
        referenceId: order._id
      });
    } else if (req.user.role === 'user') {
      await sendNotification({
        recipient: item.seller,
        recipientType: 'seller',
        title: 'Order Item Cancelled',
        message: `An item in order #${order.orderNumber} has been cancelled by the customer.`,
        type: 'order',
        referenceId: order._id
      });
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
 * Generate invoice for order
 * @route POST /api/orders/:id/invoice
 */
exports.generateInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name')
      .populate('items.seller', 'businessName gstNumber address');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check permissions
    if (req.user.role === 'user' && order.user._id.toString() !== req.user.id) {
      return next(new AppError('You do not have permission to access this order', 403));
    }

    // Generate invoice number
    const invoiceNumber = `INV${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // In a real implementation, you would generate a PDF invoice here
    // For this example, we'll just update the order with invoice details
    order.invoice = {
      number: invoiceNumber,
      url: `/invoices/${invoiceNumber}.pdf`, // This would be a real URL in production
      generatedAt: new Date()
    };

    await order.save();

    res.status(200).json({
      status: 'success',
      data: {
        invoice: order.invoice
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get order statistics
 * @route GET /api/orders/stats
 */
exports.getOrderStats = async (req, res, next) => {
  try {
    // Only admins and sellers can access stats
    if (req.user.role === 'user') {
      return next(new AppError('You do not have permission to access order statistics', 403));
    }

    let matchStage = {};

    // For sellers, only show their orders
    if (req.user.role === 'seller') {
      const seller = await Seller.findOne({ user: req.user.id });
      if (!seller) {
        return next(new AppError('Seller profile not found', 404));
      }
      matchStage['items.seller'] = seller._id;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      matchStage.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    } else if (req.query.duration) {
      const now = new Date();
      let startDate;

      switch (req.query.duration) {
        case '7d':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case '30d':
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
        case '90d':
          startDate = new Date(now.setDate(now.getDate() - 90));
          break;
        case '1y':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setDate(now.getDate() - 30)); // Default to 30 days
      }

      matchStage.createdAt = { $gte: startDate };
    }

    // Get order count by status
    const ordersByStatus = await Order.aggregate([
      { $match: matchStage },
      { $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      }
    ]);

    // Get total revenue
    const revenueStats = await Order.aggregate([
      { $match: { ...matchStage, status: { $nin: ['cancelled'] } } },
      { $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);

    // Get daily orders for the period
    const dailyOrders = await Order.aggregate([
      { $match: matchStage },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        ordersByStatus,
        revenue: revenueStats[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 },
        dailyOrders
      }
    });
  } catch (err) {
    next(err);
  }
};