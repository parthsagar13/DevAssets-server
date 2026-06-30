const mongoose = require('mongoose');
const { Schema } = mongoose;

const PasswordResetTokenSchema = new Schema({
  token: { type: String, required: true, unique: true },
  user_id: { type: String, ref: 'User', required: true },
  expires_at: { type: Date, required: true },
  used: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
