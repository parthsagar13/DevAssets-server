const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  init() {
    if (config.email.user && config.email.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.pass
        }
      });
    } else {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix'
      });
    }
  }

  async sendMail(options) {
    if (!this.transporter) {
      this.init();
    }

    const mailOptions = {
      from: config.email.from,
      ...options
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent:', info.messageId);
      return info;
    } catch (error) {
      logger.error('Email error:', error);
      throw error;
    }
  }

  async sendVerificationEmail(email, token, baseUrl) {
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await this.sendMail({
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <h1>Welcome to CodeMarket!</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verifyUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not create an account, please ignore this email.</p>
      `
    });
  }

  async sendPasswordResetEmail(email, token, baseUrl) {
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await this.sendMail({
      to: email,
      subject: 'Reset Your Password',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      `
    });
  }

  async sendWelcomeEmail(email, name) {
    await this.sendMail({
      to: email,
      subject: 'Welcome to CodeMarket!',
      html: `
        <h1>Welcome${name ? ` ${name}` : ''}!</h1>
        <p>Thank you for joining CodeMarket. We're excited to have you on board!</p>
        <p>Start exploring our marketplace to find premium templates, components, and more.</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
      `
    });
  }

  async sendOrderConfirmationEmail(email, order, items) {
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">$${item.price}</td>
      </tr>
    `).join('');

    await this.sendMail({
      to: email,
      subject: `Order Confirmation #${order.order_number}`,
      html: `
        <h1>Order Confirmation</h1>
        <p>Thank you for your purchase!</p>
        <p><strong>Order Number:</strong> ${order.order_number}</p>
        <p><strong>Total:</strong> $${order.total}</p>
        <h2>Order Items</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <p>You can download your purchases from your account dashboard.</p>
      `
    });
  }

  async sendSellerNotificationEmail(email, order, product) {
    await this.sendMail({
      to: email,
      subject: `New Sale: ${product.name}`,
      html: `
        <h1>New Sale!</h1>
        <p>Congratulations! You made a sale.</p>
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>Price:</strong> $${product.price}</p>
        <p><strong>Order:</strong> #${order.order_number}</p>
      `
    });
  }

  async sendReviewNotificationEmail(email, product, review) {
    await this.sendMail({
      to: email,
      subject: `New Review for ${product.name}`,
      html: `
        <h1>New Review Received</h1>
        <p>Your product <strong>${product.name}</strong> received a new ${review.rating}-star review.</p>
        <p><em>"${review.content}"</em></p>
        <p>Keep up the great work!</p>
      `
    });
  }
}

module.exports = new EmailService();
