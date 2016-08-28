import mongoose from 'mongoose';

let messageSchema = mongoose.Schema({
  text : { type: String, required: true, maxlength: 1000 },
  user : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
    timestamps: true
});

export default mongoose.model('Message', messageSchema);