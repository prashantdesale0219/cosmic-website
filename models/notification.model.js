const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  recipientRole: {
    type: String,
    enum: ['user', 'seller', 'admin'],
    required: true
  },
  type: {
    type: String,
    enum: ['order', 'payment', 'return', 'complaint', 'settlement', 'sla', 'account', 'product', 'offer', 'system', 'penalty'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  isActionable: {
    type: Boolean,
    default: false
  },
  actionUrl: String,
  actionText: String,
  expiresAt: Date
}, {
  timestamps: true
});

// Create indexes for faster queries
notificationSchema.index({ recipient: 1, recipientRole: 1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;