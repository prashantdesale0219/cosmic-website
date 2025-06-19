const cron = require('node-cron');
const Order = require('../models/order.model');
const Return = require('../models/return.model');
const Settlement = require('../models/settlement.model');
const { sendNotification } = require('./notification');

/**
 * Setup all cron jobs for the application
 */
exports.setupCronJobs = () => {
  // Auto soft-delete order history after 3 months
  cron.schedule('0 0 * * *', async () => { // Runs at midnight every day
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const result = await Order.updateMany(
        { 
          createdAt: { $lt: threeMonthsAgo },
          status: { $in: ['delivered', 'cancelled', 'returned'] }
        },
        { isDeleted: true }
      );
      
      console.log(`Soft-deleted ${result.nModified} old orders`);
    } catch (error) {
      console.error('Error in order history cleanup cron job:', error);
    }
  });

  // Auto-penalty if seller doesn't act on video in 9 hours
  cron.schedule('0 */1 * * *', async () => { // Runs every hour
    try {
      const nineHoursAgo = new Date();
      nineHoursAgo.setHours(nineHoursAgo.getHours() - 9);
      
      const pendingReturns = await Return.find({
        'video.uploadedAt': { $lt: nineHoursAgo },
        'video.reviewedBySeller': false,
        penaltyApplied: false
      }).populate('seller');
      
      for (const returnItem of pendingReturns) {
        // Apply penalty to seller
        returnItem.penaltyApplied = true;
        returnItem.autoApproved = true;
        await returnItem.save();
        
        // Send notification to seller
        await sendNotification({
          recipient: returnItem.seller._id,
          recipientRole: 'seller',
          type: 'penalty',
          title: 'Auto-Penalty Applied',
          message: `You did not review the return video for order #${returnItem.order} within 9 hours. The return has been auto-approved.`,
          data: { returnId: returnItem._id }
        });
      }
      
      console.log(`Applied auto-penalty to ${pendingReturns.length} sellers`);
    } catch (error) {
      console.error('Error in auto-penalty cron job:', error);
    }
  });

  // Auto-settlement triggers
  cron.schedule('0 0 * * 1', async () => { // Runs at midnight every Monday
    try {
      // Find all eligible sellers for settlement
      // Logic: Orders delivered more than 7 days ago and not yet settled
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const orders = await Order.find({
        status: 'delivered',
        deliveredAt: { $lt: sevenDaysAgo },
        isSettled: false
      }).populate('seller');
      
      // Group orders by seller
      const sellerOrders = {};
      orders.forEach(order => {
        if (!sellerOrders[order.seller._id]) {
          sellerOrders[order.seller._id] = [];
        }
        sellerOrders[order.seller._id].push(order);
      });
      
      // Create settlement for each seller
      for (const [sellerId, sellerOrderList] of Object.entries(sellerOrders)) {
        const totalAmount = sellerOrderList.reduce((sum, order) => sum + order.sellerAmount, 0);
        
        const settlement = new Settlement({
          seller: sellerId,
          orders: sellerOrderList.map(order => order._id),
          amount: totalAmount,
          status: 'pending'
        });
        
        await settlement.save();
        
        // Update orders as settled
        await Order.updateMany(
          { _id: { $in: sellerOrderList.map(order => order._id) } },
          { isSettled: true, settlement: settlement._id }
        );
        
        // Send notification to seller
        await sendNotification({
          recipient: sellerId,
          recipientRole: 'seller',
          type: 'settlement',
          title: 'New Settlement Created',
          message: `A new settlement of ₹${totalAmount.toFixed(2)} has been created for ${sellerOrderList.length} orders.`,
          data: { settlementId: settlement._id }
        });
      }
      
      console.log(`Created settlements for ${Object.keys(sellerOrders).length} sellers`);
    } catch (error) {
      console.error('Error in auto-settlement cron job:', error);
    }
  });
};