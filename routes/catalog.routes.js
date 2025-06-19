/**
 * Catalog routes (products and categories)
 */

const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const categoryController = require('../controllers/category.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// ===================================================
// Category Routes
// ===================================================

// Public routes
router.get('/categories', categoryController.getAllCategories);
router.get('/categories/:id', categoryController.getCategory);
router.get('/categories/:id/products', categoryController.getCategoryProducts);

// Protected routes - admin only
router.post('/categories', protect, restrictTo('admin'), categoryController.createCategory);
router.patch('/categories/:id', protect, restrictTo('admin'), categoryController.updateCategory);
router.delete('/categories/:id', protect, restrictTo('admin'), categoryController.deleteCategory);

// ===================================================
// Product Routes
// ===================================================

// Public routes
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProduct);
router.get('/products/:id/reviews', productController.getProductReviews);

// Protected routes - requires authentication
router.post('/products/:id/reviews', protect, productController.addProductReview);

// Protected routes - seller or admin only
router.post('/products', protect, restrictTo('seller', 'admin'), productController.createProduct);
router.patch('/products/:id', protect, restrictTo('seller', 'admin'), productController.updateProduct);
router.delete('/products/:id', protect, restrictTo('seller', 'admin'), productController.deleteProduct);
router.patch('/products/:id/status', protect, restrictTo('seller', 'admin'), productController.updateProductStatus);

module.exports = router;