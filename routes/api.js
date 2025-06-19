/**
 * Main API routes configuration
 */

const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');
const sellerController = require('../controllers/seller.controller');
const productController = require('../controllers/product.controller');
const categoryController = require('../controllers/category.controller');
const cartController = require('../controllers/cart.controller');
const orderController = require('../controllers/order.controller');

// Import middlewares
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// ===================================================
// Authentication Routes
// ===================================================

// User authentication
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/send-otp', authController.sendOTP);
router.post('/auth/verify-otp', authController.verifyOTP);
router.post('/auth/forgot-password', authController.forgotPassword);
router.patch('/auth/reset-password', authController.resetPassword);
router.patch('/auth/update-password', protect, authController.updatePassword);

// Admin authentication
router.post('/auth/admin/login', authController.adminLogin);

// Seller authentication
router.post('/auth/seller/login', authController.sellerLogin);

// ===================================================
// User Routes
// ===================================================
router.get('/user/me', protect, userController.getMe);
router.patch('/user/update-me', protect, userController.updateMe);
router.get('/user/addresses', protect, userController.getAddresses);
router.post('/user/addresses', protect, userController.addAddress);
router.patch('/user/addresses/:id', protect, userController.updateAddress);
router.delete('/user/addresses/:id', protect, userController.deleteAddress);
router.get('/user/wishlist', protect, userController.getWishlist);
router.post('/user/wishlist', protect, userController.addToWishlist);
router.delete('/user/wishlist/:productId', protect, userController.removeFromWishlist);
router.get('/user/orders', protect, userController.getMyOrders);

// ===================================================
// Seller Routes
// ===================================================
router.post('/seller/onboarding', protect, sellerController.startOnboarding);
router.get('/seller/profile', protect, restrictTo('seller'), sellerController.getProfile);
router.patch('/seller/profile', protect, restrictTo('seller'), sellerController.updateProfile);
router.get('/seller/dashboard', protect, restrictTo('seller'), sellerController.getDashboard);
router.get('/seller/orders', protect, restrictTo('seller'), sellerController.getOrders);
router.get('/seller/products', protect, restrictTo('seller'), sellerController.getProducts);
router.get('/seller/settlements', protect, restrictTo('seller'), sellerController.getSettlements);

// ===================================================
// Catalog Routes
// ===================================================

// Categories
router.get('/catalog/categories', categoryController.getAllCategories);
router.get('/catalog/categories/:id', categoryController.getCategory);
router.post('/catalog/categories', protect, restrictTo('admin'), categoryController.createCategory);
router.patch('/catalog/categories/:id', protect, restrictTo('admin'), categoryController.updateCategory);
router.delete('/catalog/categories/:id', protect, restrictTo('admin'), categoryController.deleteCategory);
router.get('/catalog/categories/:id/products', categoryController.getCategoryProducts);

// Products
router.get('/catalog/products', productController.getAllProducts);
router.get('/catalog/products/:id', productController.getProduct);
router.post('/catalog/products', protect, restrictTo('seller', 'admin'), productController.createProduct);
router.patch('/catalog/products/:id', protect, restrictTo('seller', 'admin'), productController.updateProduct);
router.delete('/catalog/products/:id', protect, restrictTo('seller', 'admin'), productController.deleteProduct);
router.patch('/catalog/products/:id/status', protect, restrictTo('seller', 'admin'), productController.updateProductStatus);
router.post('/catalog/products/:id/reviews', protect, productController.addReview);
router.get('/catalog/products/:id/reviews', productController.getProductReviews);

// ===================================================
// Cart Routes
// ===================================================
router.get('/cart', protect, cartController.getCart);
router.post('/cart/items', protect, cartController.addItem);
router.patch('/cart/items/:itemId', protect, cartController.updateItem);
router.delete('/cart/items/:itemId', protect, cartController.removeItem);
router.delete('/cart', protect, cartController.clearCart);
router.post('/cart/coupon', protect, cartController.applyCoupon);
router.delete('/cart/coupon', protect, cartController.removeCoupon);

// ===================================================
// Order Routes
// ===================================================
router.post('/orders', protect, orderController.createOrder);
router.get('/orders', protect, orderController.getAllOrders);
router.get('/orders/:id', protect, orderController.getOrder);
router.patch('/orders/:id/status', protect, orderController.updateOrderStatus);
router.patch('/orders/:id/items/:itemId/status', protect, orderController.updateOrderItemStatus);
router.get('/orders/:id/invoice', protect, orderController.generateInvoice);
router.get('/orders/stats', protect, restrictTo('admin', 'seller'), orderController.getOrderStats);

module.exports = router;