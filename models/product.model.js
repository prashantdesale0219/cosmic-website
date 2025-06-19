const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Variant name is required']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required']
  },
  salePrice: {
    type: Number
  },
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: 0
  },
  attributes: {
    type: Map,
    of: String
  },
  images: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
});

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  isApproved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  shortDescription: {
    type: String
  },
  brand: {
    type: String,
    required: [true, 'Brand is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  subcategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: [true, 'Seller is required']
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required']
  },
  baseSalePrice: {
    type: Number
  },
  tax: {
    type: Number,
    default: 0
  },
  taxClass: {
    type: String,
    default: 'standard'
  },
  hasVariants: {
    type: Boolean,
    default: false
  },
  variants: [variantSchema],
  attributes: {
    type: Map,
    of: [String]
  },
  images: [{
    type: String,
    required: [true, 'At least one image is required']
  }],
  videos: [{
    type: String
  }],
  specifications: {
    type: Map,
    of: String
  },
  tags: [{
    type: String
  }],
  weight: {
    value: {
      type: Number
    },
    unit: {
      type: String,
      enum: ['g', 'kg', 'lb', 'oz'],
      default: 'g'
    }
  },
  dimensions: {
    length: {
      type: Number
    },
    width: {
      type: Number
    },
    height: {
      type: Number
    },
    unit: {
      type: String,
      enum: ['cm', 'in'],
      default: 'cm'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true
  },
  barcode: {
    type: String
  },
  isDigital: {
    type: Boolean,
    default: false
  },
  digitalAssets: [{
    name: {
      type: String
    },
    file: {
      type: String
    },
    downloadLimit: {
      type: Number,
      default: -1 // -1 means unlimited
    }
  }],
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: Date,
  rejectionReason: String,
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isSponsored: {
    type: Boolean,
    default: false
  },
  sponsoredUntil: Date,
  sponsoredKeywords: [{
    type: String
  }],
  rating: {
    type: Number,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  reviews: [reviewSchema],
  warranty: {
    type: String
  },
  returnPolicy: {
    type: String
  },
  shippingInfo: {
    type: String
  },
  metaTitle: {
    type: String
  },
  metaDescription: {
    type: String
  },
  metaKeywords: [{
    type: String
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  salesCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create text index for search
productSchema.index(
  {
    name: 'text',
    description: 'text',
    brand: 'text',
    tags: 'text'
  },
  {
    weights: {
      name: 10,
      brand: 5,
      tags: 3,
      description: 1
    }
  }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;