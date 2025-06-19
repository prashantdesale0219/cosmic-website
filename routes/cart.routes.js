/**
 * Cart routes
 */

const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { protect } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(protect);

// Get cart
router.get('/', cartController.getCart);

// Add item to cart
router.post('/items', cartController.addItem);

// Update cart item
router.patch('/items/:itemId', cartController.updateItem);

// Remove item from cart
router.delete('/items/:itemId', cartController.removeItem);

// Clear cart
router.delete('/', cartController.clearCart);

// Apply coupon
router.post('/coupon', cartController.applyCoupon);

// Remove coupon
router.delete('/coupon', cartController.removeCoupon);

module.exports = router;