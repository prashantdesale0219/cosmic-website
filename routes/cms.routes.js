/**
 * CMS routes (banners, pages, FAQs, etc.)
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// ===================================================
// Banner Routes
// ===================================================

// Public routes
router.get('/banners', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all banners route'
  });
});

// Protected routes - admin only
router.use('/banners', protect, restrictTo('admin'));
router.post('/banners', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create banner route'
  });
});
router.patch('/banners/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Update banner route'
  });
});
router.delete('/banners/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Delete banner route'
  });
});

// ===================================================
// Page Routes
// ===================================================

// Public routes
router.get('/pages', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all pages route'
  });
});
router.get('/pages/:slug', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get page by slug route'
  });
});

// Protected routes - admin only
router.use('/pages', protect, restrictTo('admin'));
router.post('/pages', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create page route'
  });
});
router.patch('/pages/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Update page route'
  });
});
router.delete('/pages/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Delete page route'
  });
});

// ===================================================
// FAQ Routes
// ===================================================

// Public routes
router.get('/faqs', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all FAQs route'
  });
});
router.get('/faqs/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get FAQ by ID route'
  });
});

// Protected routes - admin only
router.use('/faqs', protect, restrictTo('admin'));
router.post('/faqs', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create FAQ route'
  });
});
router.patch('/faqs/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Update FAQ route'
  });
});
router.delete('/faqs/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Delete FAQ route'
  });
});

module.exports = router;