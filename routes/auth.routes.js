/**
 * Authentication routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

// User authentication
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password', authController.resetPassword);
router.patch('/update-password', protect, authController.updatePassword);

// Admin authentication
router.post('/admin/login', authController.adminLogin);

// Seller authentication
router.post('/seller/login', authController.sellerLogin);

module.exports = router;