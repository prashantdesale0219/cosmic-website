const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    default: 1
  },
  path: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  image: {
    type: String
  },
  icon: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  attributes: [{
    name: {
      type: String,
      required: true
    },
    values: [{
      type: String
    }],
    isRequired: {
      type: Boolean,
      default: false
    },
    isVariant: {
      type: Boolean,
      default: false
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  }],
  metaTitle: {
    type: String
  },
  metaDescription: {
    type: String
  },
  metaKeywords: [{
    type: String
  }],
  displayOrder: {
    type: Number,
    default: 0
  },
  commissionRate: {
    type: Number,
    default: null // If null, use default commission rate
  }
}, {
  timestamps: true
});

// Pre-save hook to set path and level
categorySchema.pre('save', async function(next) {
  if (this.isModified('parent')) {
    if (!this.parent) {
      // Root category
      this.level = 1;
      this.path = [];
    } else {
      const parentCategory = await this.constructor.findById(this.parent);
      if (!parentCategory) {
        return next(new Error('Parent category not found'));
      }
      this.level = parentCategory.level + 1;
      this.path = [...parentCategory.path, parentCategory._id];
    }
  }
  next();
});

// Create text index for search
categorySchema.index(
  {
    name: 'text',
    description: 'text'
  },
  {
    weights: {
      name: 10,
      description: 1
    }
  }
);

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;