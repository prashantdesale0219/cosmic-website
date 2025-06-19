/**
 * Order routes
 */

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(protect);

// Create order
router.post('/', orderController.createOrder);

// Get all orders (with role-based access control)
router.get('/', orderController.getAllOrders);

// Get specific order
router.get('/:id', orderController.getOrder);

// Update order status
router.patch('/:id/status', orderController.updateOrderStatus);

// Update order item status
router.patch('/:id/items/:itemId/status', orderController.updateOrderItemStatus);

// Generate invoice
router.get('/:id/invoice', orderController.generateInvoice);

// Get order statistics (admin and seller only)
router.get('/stats', restrictTo('admin', 'seller'), orderController.getOrderStats);

module.exports = router;