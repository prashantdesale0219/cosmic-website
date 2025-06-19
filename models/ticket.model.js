const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  senderRole: {
    type: String,
    enum: ['user', 'seller', 'admin', 'system'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  attachments: [{
    type: String
  }],
  isInternal: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['order', 'payment', 'return', 'product', 'account', 'shipping', 'other'],
    required: true
  },
  subcategory: {
    type: String
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_seller', 'resolved', 'closed'],
    default: 'open'
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_seller', 'resolved', 'closed']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId
    },
    updatedByRole: {
      type: String,
      enum: ['user', 'seller', 'admin', 'system']
    },
    comment: String
  }],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  creatorRole: {
    type: String,
    enum: ['user', 'seller', 'admin'],
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  relatedProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  relatedSeller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller'
  },
  messages: [messageSchema],
  attachments: [{
    type: String
  }],
  isEscalated: {
    type: Boolean,
    default: false
  },
  escalatedAt: Date,
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  escalatedByRole: {
    type: String,
    enum: ['user', 'seller', 'admin', 'system']
  },
  escalationReason: String,
  sla: {
    responseTime: {
      deadline: Date,
      met: {
        type: Boolean,
        default: false
      },
      actualTime: Date
    },
    resolutionTime: {
      deadline: Date,
      met: {
        type: Boolean,
        default: false
      },
      actualTime: Date
    }
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    givenAt: Date
  },
  tags: [{
    type: String
  }],
  internalNotes: [{
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create indexes for faster queries
ticketSchema.index({ ticketNumber: 1 });
ticketSchema.index({ creator: 1, creatorRole: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ createdAt: -1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;