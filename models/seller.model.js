const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  addressLine1: {
    type: String,
    required: [true, 'Address line 1 is required']
  },
  addressLine2: {
    type: String
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required']
  },
  country: {
    type: String,
    default: 'India'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  }
});

const bankDetailsSchema = new mongoose.Schema({
  accountHolderName: {
    type: String,
    required: [true, 'Account holder name is required']
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required']
  },
  bankName: {
    type: String,
    required: [true, 'Bank name is required']
  },
  ifscCode: {
    type: String,
    required: [true, 'IFSC code is required']
  },
  accountType: {
    type: String,
    enum: ['savings', 'current'],
    default: 'current'
  },
  cancelChequeImage: {
    type: String,
    required: [true, 'Cancel cheque image is required']
  }
});

const kycSchema = new mongoose.Schema({
  gstNumber: {
    type: String,
    required: [true, 'GST number is required']
  },
  gstCertificate: {
    type: String,
    required: [true, 'GST certificate is required']
  },
  panNumber: {
    type: String,
    required: [true, 'PAN number is required']
  },
  panImage: {
    type: String,
    required: [true, 'PAN image is required']
  },
  businessProofType: {
    type: String,
    enum: ['shop_establishment', 'trade_license', 'udyog_aadhaar', 'other'],
    required: [true, 'Business proof type is required']
  },
  businessProofImage: {
    type: String,
    required: [true, 'Business proof image is required']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  verifiedAt: Date,
  rejectionReason: String
});

const sellerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required']
  },
  businessType: {
    type: String,
    enum: ['proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp', 'other'],
    required: [true, 'Business type is required']
  },
  contactPerson: {
    name: {
      type: String,
      required: [true, 'Contact person name is required']
    },
    email: {
      type: String,
      required: [true, 'Contact person email is required'],
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    phone: {
      type: String,
      required: [true, 'Contact person phone is required']
    },
    designation: {
      type: String,
      required: [true, 'Contact person designation is required']
    }
  },
  address: addressSchema,
  bankDetails: bankDetailsSchema,
  kyc: kycSchema,
  logo: {
    type: String
  },
  description: {
    type: String,
    maxlength: 1000
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  onboardingStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected'],
    default: 'pending'
  },
  onboardingStep: {
    type: Number,
    default: 1
  },
  commissionRate: {
    type: Number,
    default: 10 // 10%
  },
  rating: {
    type: Number,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: String,
  pickupAddresses: [addressSchema]
}, {
  timestamps: true
});

// Create index for location-based queries
sellerSchema.index({ 'address.location': '2dsphere' });

const Seller = mongoose.model('Seller', sellerSchema);

module.exports = Seller;