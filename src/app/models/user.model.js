import mongoose from 'mongoose';
import bcrypt from 'bcrypt-nodejs';

let userSchema = mongoose.Schema({
  username: { type: String, unique: true, validate: /^[a-zA-Z][a-zA-Z0-9-_.]{3,20}$/ },
  local : {
    password : String,
    email : { type : String, unique : true }
  },
  suspendedUntil: Date,
  name: { type: String, maxlength: 30 },
  role : { type : String },
  showEmail: Boolean,
  hideStats: Boolean,
  description: { type: String, maxlength: 300 },
  website: { type: String, maxlength: 100 },
  country: String,
  lastActive: Date,
  lastMeditation: { type: Date, required: true, default: new Date(0) },
  lastLike: Date,
  sound: { type: String, default: '/assets/audio/bell1.mp3' },
  stableBell: { type: Boolean, default: false },
  gravatarHash: String,
  timezone: String,
  verified: { type: Boolean, default: false },
  verifyToken: String,
  recoverUntil: Date,
  notifications: {
    message: { type: Boolean, default: true },
    meditation: Boolean,
    question: { type: Boolean, default: true },
    livestream: Boolean,
    // relevant for admins only
    testimonial: Boolean,
    appointment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PushSubscriptions' }]
  }
});

userSchema.methods.generateHash = function(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

userSchema.methods.validPassword = function(password) {
  return bcrypt.compareSync(password, this.local.password);
};

export default mongoose.model('User', userSchema);
