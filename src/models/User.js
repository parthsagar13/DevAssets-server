const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  _id: { type: String },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String },
  username: { type: String },
  first_name: { type: String },
  last_name: { type: String },
  role_id: { type: Schema.Types.String, ref: 'Role' },
  is_email_verified: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  store_name: { type: String },
  store_description: { type: String },
  seller_status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  last_login_at: { type: Date },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
