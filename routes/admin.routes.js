/**
 * Admin routes
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Protect all routes and restrict to admin role
router.use(protect, restrictTo('admin'));

// Admin dashboard
router.get('/dashboard', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Admin dashboard route'
  });
});

// Admin user management
router.get('/users', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Admin users route'
  });
});

// Admin seller management
router.get('/sellers', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Admin sellers route'
  });
});

// Admin order management
router.get('/orders', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Admin orders route'
  });
});

// Admin product management
router.get('/products', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Admin products route'
  });
});

// Admin category management
router.get('/categories', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Admin categories route'
  });
});

// Admin settings
router.get('/settings', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Admin settings route'
  });
});

module.exports = router;