const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  reviewedBySeller: {
    type: Boolean,
    default: false
  },
  reviewedAt: Date,
  sellerComments: String
});

const returnSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderItem: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  type: {
    type: String,
    enum: ['return', 'exchange'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  reasonCategory: {
    type: String,
    enum: ['damaged', 'defective', 'wrong_item', 'not_as_described', 'size_issue', 'quality_issue', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  video: videoSchema,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'pickup_scheduled', 'picked_up', 'received', 'refunded', 'exchanged', 'closed'],
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'pickup_scheduled', 'picked_up', 'received', 'refunded', 'exchanged', 'closed']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    comment: String,
    updatedBy: {
      type: String,
      enum: ['system', 'seller', 'admin', 'user']
    }
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: Date,
  rejectionReason: String,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  rejectedAt: Date,
  pickupDate: Date,
  pickupSlot: String,
  pickupAddress: {
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  trackingNumber: String,
  trackingUrl: String,
  shippingProvider: String,
  receivedAt: Date,
  receivedCondition: {
    type: String,
    enum: ['good', 'damaged', 'not_as_described', 'not_received']
  },
  receivedNotes: String,
  refundAmount: Number,
  refundedAt: Date,
  refundTransactionId: String,
  exchangeProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  exchangeVariant: String,
  exchangeShippedAt: Date,
  exchangeDeliveredAt: Date,
  exchangeTrackingNumber: String,
  exchangeTrackingUrl: String,
  penaltyApplied: {
    type: Boolean,
    default: false
  },
  autoApproved: {
    type: Boolean,
    default: false
  },
  sellerComplaint: {
    type: Boolean,
    default: false
  },
  sellerComplaintReason: String,
  sellerComplaintStatus: {
    type: String,
    enum: ['pending', 'resolved', 'rejected'],
    default: 'pending'
  },
  sellerComplaintResolution: String
}, {
  timestamps: true
});

// Create indexes for faster queries
returnSchema.index({ order: 1 });
returnSchema.index({ user: 1 });
returnSchema.index({ seller: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

const Return = mongoose.model('Return', returnSchema);

module.exports = Return;