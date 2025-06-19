/**
 * Finance routes (settlements, offers, payments, etc.)
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// ===================================================
// Settlement Routes
// ===================================================

// Seller settlement routes
router.get('/settlements/seller', protect, restrictTo('seller'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get seller settlements route'
  });
});
router.get('/settlements/seller/:id', protect, restrictTo('seller'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get seller settlement by ID route'
  });
});

// Admin settlement routes
router.get('/settlements/admin', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all settlements (admin) route'
  });
});
router.post('/settlements/admin', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create settlement (admin) route'
  });
});
router.patch('/settlements/admin/:id', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Update settlement (admin) route'
  });
});

// ===================================================
// Offer/Coupon Routes
// ===================================================

// Public routes
router.get('/offers/public', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get public offers route'
  });
});
router.post('/offers/validate', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Validate offer/coupon route'
  });
});

// Admin offer routes
router.get('/offers/admin', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all offers (admin) route'
  });
});
router.post('/offers/admin', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create offer (admin) route'
  });
});
router.get('/offers/admin/:id', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get offer by ID (admin) route'
  });
});
router.patch('/offers/admin/:id', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Update offer (admin) route'
  });
});
router.delete('/offers/admin/:id', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Delete offer (admin) route'
  });
});

// ===================================================
// Payment Routes
// ===================================================

// Payment gateway webhook
router.post('/payments/webhook', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Payment gateway webhook route'
  });
});

// User payment routes
router.post('/payments/create', protect, (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create payment route'
  });
});
router.get('/payments/verify/:id', protect, (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Verify payment route'
  });
});

// Admin payment routes
router.get('/payments/admin', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all payments (admin) route'
  });
});

module.exports = router;