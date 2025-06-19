const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'buy_x_get_y', 'free_shipping'],
    required: true
  },
  value: {
    type: Number,
    required: function() {
      return this.type !== 'free_shipping';
    }
  },
  minOrderValue: {
    type: Number,
    default: 0
  },
  maxDiscountValue: {
    type: Number
  },
  description: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableFor: {
    type: String,
    enum: ['all', 'new_users', 'existing_users', 'specific_users'],
    default: 'all'
  },
  specificUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  applicableProducts: {
    type: String,
    enum: ['all', 'specific_products', 'specific_categories'],
    default: 'all'
  },
  specificProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  specificCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  applicableSellers: {
    type: String,
    enum: ['all', 'specific_sellers'],
    default: 'all'
  },
  specificSellers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller'
  }],
  usageLimit: {
    type: Number, // -1 for unlimited
    default: -1
  },
  perUserLimit: {
    type: Number, // -1 for unlimited
    default: 1
  },
  usageCount: {
    type: Number,
    default: 0
  },
  userUsage: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    },
    lastUsed: Date
  }],
  buyXGetY: {
    buyQuantity: Number,
    getQuantity: Number,
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }
  },
  image: {
    type: String
  },
  termsAndConditions: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
offerSchema.index({ code: 1 });
offerSchema.index({ isActive: 1 });
offerSchema.index({ startDate: 1, endDate: 1 });

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;