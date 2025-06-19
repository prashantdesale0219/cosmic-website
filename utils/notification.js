const nodemailer = require('nodemailer');
const twilio = require('twilio');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const Seller = require('../models/seller.model');
const Admin = require('../models/admin.model');

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});

// Initialize Twilio client only if valid credentials are provided
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
} else {
  console.warn('Invalid or missing Twilio credentials. SMS notifications will be disabled.');
}

/**
 * Send notification to user/seller/admin
 * @param {Object} options - Notification options
 * @param {String} options.recipient - Recipient ID
 * @param {String} options.recipientRole - Role of recipient (user, seller, admin)
 * @param {String} options.type - Type of notification (order, complaint, settlement, sla)
 * @param {String} options.title - Notification title
 * @param {String} options.message - Notification message
 * @param {Object} options.data - Additional data for notification
 * @param {Boolean} options.email - Whether to send email notification (default: true)
 * @param {Boolean} options.sms - Whether to send SMS notification (default: false)
 * @param {Boolean} options.inApp - Whether to store in-app notification (default: true)
 */
exports.sendNotification = async (options) => {
  try {
    const {
      recipient,
      recipientRole,
      type,
      title,
      message,
      data = {},
      email = true,
      sms = false,
      inApp = true
    } = options;

    // Get recipient details based on role
    let recipientDetails;
    switch (recipientRole) {
      case 'user':
        recipientDetails = await User.findById(recipient);
        break;
      case 'seller':
        recipientDetails = await Seller.findById(recipient);
        break;
      case 'admin':
        recipientDetails = await Admin.findById(recipient);
        break;
      default:
        throw new Error('Invalid recipient role');
    }

    if (!recipientDetails) {
      throw new Error('Recipient not found');
    }

    // Store notification in database for in-app notifications
    if (inApp) {
      const notification = new Notification({
        recipient,
        recipientRole,
        type,
        title,
        message,
        data
      });

      await notification.save();
    }

    // Send email notification
    if (email && recipientDetails.email) {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipientDetails.email,
        subject: title,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #333;">${title}</h2>
            <p style="color: #666; font-size: 16px;">${message}</p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        `
      });
    }

    // Send SMS notification
    if (sms && recipientDetails.phone && twilioClient) {
      try {
        await twilioClient.messages.create({
          body: `${title}: ${message}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: recipientDetails.phone
        });
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
        // Continue execution even if SMS fails
      }
    } else if (sms && (!twilioClient || !process.env.TWILIO_PHONE_NUMBER)) {
      console.warn('SMS notification skipped: Twilio client not initialized or phone number missing');
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get unread notifications for a user/seller/admin
 * @param {String} recipient - Recipient ID
 * @param {String} recipientRole - Role of recipient (user, seller, admin)
 * @param {Number} limit - Maximum number of notifications to return
 * @returns {Array} - Array of notifications
 */
exports.getUnreadNotifications = async (recipient, recipientRole, limit = 10) => {
  try {
    const notifications = await Notification.find({
      recipient,
      recipientRole,
      read: false
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    return notifications;
  } catch (error) {
    console.error('Error getting unread notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {String} notificationId - Notification ID
 * @returns {Object} - Updated notification
 */
exports.markNotificationAsRead = async (notificationId) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};