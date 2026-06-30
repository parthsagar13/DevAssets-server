const mongoose = require('mongoose');
const { Schema } = mongoose;

const RefreshTokenSchema = new Schema({
  token: { type: String, required: true, unique: true },
  user_id: { type: String, ref: 'User', required: true },
  expires_at: { type: Date, required: true },
  is_revoked: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
