const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
  module: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: Object,
  ip: String,
  userAgent: String,
  user: {
    type: mongoose.Schema.Types.ObjectId
  },
  userRole: {
    type: String,
    enum: ['user', 'seller', 'admin', 'system']
  },
  resourceType: String,
  resourceId: mongoose.Schema.Types.ObjectId,
  prevState: Object,
  newState: Object,
  isResolved: {
    type: Boolean,
    default: true
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  resolvedAt: Date,
  resolutionNotes: String
}, {
  timestamps: true
});

// Create indexes for faster queries
logSchema.index({ level: 1 });
logSchema.index({ module: 1 });
logSchema.index({ action: 1 });
logSchema.index({ user: 1, userRole: 1 });
logSchema.index({ resourceType: 1, resourceId: 1 });
logSchema.index({ createdAt: -1 });

const Log = mongoose.model('Log', logSchema);

module.exports = Log;