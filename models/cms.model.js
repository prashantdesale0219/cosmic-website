const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  subtitle: String,
  image: {
    type: String,
    required: true
  },
  mobileImage: String,
  link: String,
  buttonText: String,
  position: {
    type: Number,
    default: 0
  },
  startDate: Date,
  endDate: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  target: {
    type: String,
    enum: ['all', 'app', 'web'],
    default: 'all'
  },
  placement: {
    type: String,
    enum: ['home_top', 'home_middle', 'home_bottom', 'category_page', 'product_page'],
    default: 'home_top'
  },
  backgroundColor: String,
  textColor: String
}, {
  timestamps: true
});

const pageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    type: String,
    required: true
  },
  metaTitle: String,
  metaDescription: String,
  isActive: {
    type: Boolean,
    default: true
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

const emailTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  subject: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  description: String,
  variables: [{
    name: String,
    description: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

const smsTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 160
  },
  description: String,
  variables: [{
    name: String,
    description: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'account', 'orders', 'payments', 'shipping', 'returns', 'sellers'],
    default: 'general'
  },
  position: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const menuItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  icon: String,
  position: {
    type: Number,
    default: 0
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  target: {
    type: String,
    enum: ['_self', '_blank'],
    default: '_self'
  },
  placement: {
    type: String,
    enum: ['header', 'footer', 'mobile'],
    default: 'header'
  }
}, {
  timestamps: true
});

const Banner = mongoose.model('Banner', bannerSchema);
const Page = mongoose.model('Page', pageSchema);
const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);
const SmsTemplate = mongoose.model('SmsTemplate', smsTemplateSchema);
const Faq = mongoose.model('Faq', faqSchema);
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

module.exports = {
  Banner,
  Page,
  EmailTemplate,
  SmsTemplate,
  Faq,
  MenuItem
};