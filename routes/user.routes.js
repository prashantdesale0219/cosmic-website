/**
 * User routes
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');

// Protect all routes after this middleware
router.use(protect);

// User profile
router.get('/me', userController.getMe);
router.patch('/update-me', userController.updateMe);

// User addresses
router.get('/addresses', userController.getAddresses);
router.post('/addresses', userController.addAddress);
router.patch('/addresses/:id', userController.updateAddress);
router.delete('/addresses/:id', userController.deleteAddress);

// User wishlist
router.get('/wishlist', userController.getWishlist);
router.post('/wishlist', userController.addToWishlist);
router.delete('/wishlist/:productId', userController.removeFromWishlist);

// User orders
router.get('/orders', userController.getMyOrders);

module.exports = router;