/**
 * Seller routes
 */

const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/seller.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Onboarding route - only requires user to be logged in
router.post('/onboarding', protect, sellerController.startOnboarding);

// All routes after this middleware require seller role
router.use(protect, restrictTo('seller'));

// Seller profile
router.get('/profile', sellerController.getProfile);
router.patch('/profile', sellerController.updateProfile);

// Seller dashboard
router.get('/dashboard', sellerController.getDashboardStats);

// Seller orders
router.get('/orders', sellerController.getOrders);

// Seller products
router.get('/products', sellerController.getProducts);

// Seller settlements
router.get('/settlements', sellerController.getSettlements);

module.exports = router;