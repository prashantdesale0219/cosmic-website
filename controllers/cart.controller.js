const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const Offer = require('../models/offer.model');
const { AppError } = require('../middlewares/error.middleware');

/**
 * Get user's cart
 * @route GET /api/cart
 */
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name images price stockQuantity status seller variants',
        populate: {
          path: 'seller',
          select: 'businessName logo'
        }
      });

    if (!cart) {
      // Create empty cart if not exists
      cart = await Cart.create({
        user: req.user.id,
        items: [],
        totalItems: 0,
        totalQuantity: 0,
        subtotal: 0,
        total: 0
      });
    } else {
      // Filter out items with inactive products or out of stock
      const validItems = [];
      let needsUpdate = false;

      for (const item of cart.items) {
        // Skip if product is null (might have been deleted)
        if (!item.product) {
          needsUpdate = true;
          continue;
        }

        // Skip if product is not active
        if (item.product.status !== 'active') {
          needsUpdate = true;
          continue;
        }

        // Check stock availability
        if (item.product.stockQuantity < item.quantity) {
          item.quantity = item.product.stockQuantity;
          item.total = item.price * item.quantity;
          needsUpdate = true;
          
          // Skip if completely out of stock
          if (item.quantity === 0) {
            continue;
          }
        }

        validItems.push(item);
      }

      // Update cart if needed
      if (needsUpdate) {
        cart.items = validItems;
        
        // Recalculate totals
        cart.totalItems = validItems.length;
        cart.totalQuantity = validItems.reduce((sum, item) => sum + item.quantity, 0);
        cart.subtotal = validItems.reduce((sum, item) => sum + item.total, 0);
        cart.total = cart.subtotal - cart.couponDiscount;
        
        await cart.save();
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        cart
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add item to cart
 * @route POST /api/cart/items
 */
exports.addItem = async (req, res, next) => {
  try {
    const { productId, variantId, quantity } = req.body;

    // Validate required fields
    if (!productId) {
      return next(new AppError('Product ID is required', 400));
    }

    if (!quantity || quantity < 1) {
      return next(new AppError('Quantity must be at least 1', 400));
    }

    // Get product details
    const product = await Product.findById(productId);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    if (product.status !== 'active') {
      return next(new AppError('Product is not available', 400));
    }

    // Check variant if provided
    let variantPrice = product.price;
    let selectedVariantId = null;

    if (req.body.variantId && product.variants && product.variants.length > 0) {
      const variant = product.variants.find(v => v._id.toString() === req.body.variantId);
      if (!variant) {
        return next(new AppError('Variant not found', 404));
      }
      variantPrice = variant.price || product.price;
      selectedVariantId = variant._id;
    }

    // Check stock availability
    if (product.stockQuantity < quantity) {
      return next(new AppError(`Only ${product.stockQuantity} items available in stock`, 400));
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = await Cart.create({
        user: req.user.id,
        items: [],
        totalItems: 0,
        totalQuantity: 0,
        subtotal: 0,
        total: 0
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.product.toString() === productId && 
      ((!selectedVariantId && !item.variant) || 
       (selectedVariantId && item.variant && item.variant.toString() === selectedVariantId.toString()))
    );

    if (existingItemIndex > -1) {
      // Update existing item
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      // Check stock again with combined quantity
      if (product.stockQuantity < newQuantity) {
        return next(new AppError(`Cannot add ${quantity} more items. Only ${product.stockQuantity - existingItem.quantity} additional items available`, 400));
      }
      
      existingItem.quantity = newQuantity;
      existingItem.price = variantPrice;
      existingItem.total = variantPrice * newQuantity;
      cart.items[existingItemIndex] = existingItem;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        variant: selectedVariantId,
        quantity,
        price: variantPrice,
        total: variantPrice * quantity,
        addedAt: new Date()
      });
    }

    // Update cart totals
    cart.totalItems = cart.items.length;
    cart.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.total, 0);
    
    // Apply coupon if exists
    if (cart.couponCode) {
      // Recalculate coupon discount
      const coupon = await Offer.findOne({ code: cart.couponCode, isActive: true });
      if (coupon) {
        if (coupon.type === 'percentage') {
          cart.couponDiscount = (cart.subtotal * coupon.value) / 100;
          if (coupon.maxDiscountValue && cart.couponDiscount > coupon.maxDiscountValue) {
            cart.couponDiscount = coupon.maxDiscountValue;
          }
        } else if (coupon.type === 'fixed') {
          cart.couponDiscount = coupon.value;
        }
      } else {
        // Coupon no longer valid
        cart.couponCode = null;
        cart.couponDiscount = 0;
      }
    }
    
    cart.total = cart.subtotal - cart.couponDiscount;
    cart.lastActive = new Date();
    
    await cart.save();

    // Populate product details for response
    await cart.populate({
      path: 'items.product',
      select: 'name images price stockQuantity status seller variants',
      populate: {
        path: 'seller',
        select: 'businessName logo'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update cart item
 * @route PATCH /api/cart/items/:itemId
 */
exports.updateItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return next(new AppError('Quantity must be at least 1', 400));
    }

    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(item => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return next(new AppError('Item not found in cart', 404));
    }

    // Get product to check stock
    const product = await Product.findById(cart.items[itemIndex].product);
    if (!product) {
      return next(new AppError('Product no longer exists', 404));
    }

    if (product.status !== 'active') {
      return next(new AppError('Product is not available', 400));
    }

    // Check stock availability
    if (product.stockQuantity < quantity) {
      return next(new AppError(`Only ${product.stockQuantity} items available in stock`, 400));
    }

    // Update item quantity and total
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].total = cart.items[itemIndex].price * quantity;

    // Update cart totals
    cart.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.total, 0);
    
    // Apply coupon if exists
    if (cart.couponCode) {
      // Recalculate coupon discount
      const coupon = await Offer.findOne({ code: cart.couponCode, isActive: true });
      if (coupon) {
        if (coupon.type === 'percentage') {
          cart.couponDiscount = (cart.subtotal * coupon.value) / 100;
          if (coupon.maxDiscountValue && cart.couponDiscount > coupon.maxDiscountValue) {
            cart.couponDiscount = coupon.maxDiscountValue;
          }
        } else if (coupon.type === 'fixed') {
          cart.couponDiscount = coupon.value;
        }
      } else {
        // Coupon no longer valid
        cart.couponCode = null;
        cart.couponDiscount = 0;
      }
    }
    
    cart.total = cart.subtotal - cart.couponDiscount;
    cart.lastActive = new Date();
    
    await cart.save();

    // Populate product details for response
    await cart.populate({
      path: 'items.product',
      select: 'name images price stockQuantity status seller variants',
      populate: {
        path: 'seller',
        select: 'businessName logo'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove item from cart
 * @route DELETE /api/cart/items/:itemId
 */
exports.removeItem = async (req, res, next) => {
  try {
    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(item => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return next(new AppError('Item not found in cart', 404));
    }

    // Remove item
    cart.items.splice(itemIndex, 1);

    // Update cart totals
    cart.totalItems = cart.items.length;
    cart.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.total, 0);
    
    // Apply coupon if exists
    if (cart.couponCode) {
      // Recalculate coupon discount
      const coupon = await Offer.findOne({ code: cart.couponCode, isActive: true });
      if (coupon) {
        if (coupon.type === 'percentage') {
          cart.couponDiscount = (cart.subtotal * coupon.value) / 100;
          if (coupon.maxDiscountValue && cart.couponDiscount > coupon.maxDiscountValue) {
            cart.couponDiscount = coupon.maxDiscountValue;
          }
        } else if (coupon.type === 'fixed') {
          cart.couponDiscount = coupon.value;
        }
      } else {
        // Coupon no longer valid
        cart.couponCode = null;
        cart.couponDiscount = 0;
      }
    }
    
    cart.total = cart.subtotal - cart.couponDiscount;
    cart.lastActive = new Date();
    
    await cart.save();

    // Populate product details for response
    await cart.populate({
      path: 'items.product',
      select: 'name images price stockQuantity status seller variants',
      populate: {
        path: 'seller',
        select: 'businessName logo'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Clear cart
 * @route DELETE /api/cart
 */
exports.clearCart = async (req, res, next) => {
  try {
    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Clear all items
    cart.items = [];
    cart.totalItems = 0;
    cart.totalQuantity = 0;
    cart.subtotal = 0;
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.total = 0;
    cart.lastActive = new Date();
    
    await cart.save();

    res.status(200).json({
      status: 'success',
      data: {
        cart
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Apply coupon to cart
 * @route POST /api/cart/coupon
 */
exports.applyCoupon = async (req, res, next) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return next(new AppError('Coupon code is required', 400));
    }

    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    if (cart.items.length === 0) {
      return next(new AppError('Cannot apply coupon to empty cart', 400));
    }

    // Find coupon
    const coupon = await Offer.findOne({
      code: couponCode,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });

    if (!coupon) {
      return next(new AppError('Invalid or expired coupon code', 400));
    }

    // Check if coupon is applicable
    if (coupon.minOrderValue && cart.subtotal < coupon.minOrderValue) {
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
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (cart.subtotal * coupon.value) / 100;
      if (coupon.maxDiscountValue && discount > coupon.maxDiscountValue) {
        discount = coupon.maxDiscountValue;
      }
    } else if (coupon.type === 'fixed') {
      discount = coupon.value;
    }

    // Update cart
    cart.couponCode = couponCode;
    cart.couponDiscount = discount;
    cart.total = cart.subtotal - discount;
    cart.lastActive = new Date();
    
    await cart.save();

    // Populate product details for response
    await cart.populate({
      path: 'items.product',
      select: 'name images price stockQuantity status seller variants',
      populate: {
        path: 'seller',
        select: 'businessName logo'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart,
        coupon: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          discount
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove coupon from cart
 * @route DELETE /api/cart/coupon
 */
exports.removeCoupon = async (req, res, next) => {
  try {
    // Find cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Remove coupon
    cart.couponCode = null;
    cart.couponDiscount = 0;
    cart.total = cart.subtotal;
    cart.lastActive = new Date();
    
    await cart.save();

    // Populate product details for response
    await cart.populate({
      path: 'items.product',
      select: 'name images price stockQuantity status seller variants',
      populate: {
        path: 'seller',
        select: 'businessName logo'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart
      }
    });
  } catch (err) {
    next(err);
  }
};