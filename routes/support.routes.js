/**
 * Support routes (tickets, help center, etc.)
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// ===================================================
// Ticket Routes
// ===================================================

// Protected routes - requires authentication
router.use('/tickets', protect);

// User ticket routes
router.get('/tickets', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get user tickets route'
  });
});
router.post('/tickets', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create ticket route'
  });
});
router.get('/tickets/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get ticket by ID route'
  });
});
router.post('/tickets/:id/messages', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Add message to ticket route'
  });
});
router.patch('/tickets/:id/close', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Close ticket route'
  });
});

// Admin ticket routes
router.get('/admin/tickets', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all tickets (admin) route'
  });
});
router.patch('/admin/tickets/:id/assign', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Assign ticket route'
  });
});
router.patch('/admin/tickets/:id/status', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Update ticket status route'
  });
});

// ===================================================
// Return/Exchange Routes
// ===================================================

// Protected routes - requires authentication
router.use('/returns', protect);

// User return/exchange routes
router.post('/returns', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(201).json({
    status: 'success',
    message: 'Create return/exchange request route'
  });
});
router.get('/returns', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get user return/exchange requests route'
  });
});
router.get('/returns/:id', (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get return/exchange request by ID route'
  });
});

// Seller return/exchange routes
router.get('/seller/returns', protect, restrictTo('seller'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get seller return/exchange requests route'
  });
});
router.patch('/seller/returns/:id/approve', protect, restrictTo('seller'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Approve return/exchange request route'
  });
});
router.patch('/seller/returns/:id/reject', protect, restrictTo('seller'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Reject return/exchange request route'
  });
});

// Admin return/exchange routes
router.get('/admin/returns', protect, restrictTo('admin'), (req, res) => {
  // This is a placeholder - implement the actual controller
  res.status(200).json({
    status: 'success',
    message: 'Get all return/exchange requests (admin) route'
  });
});

module.exports = router;