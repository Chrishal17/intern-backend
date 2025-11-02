const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  profilePicture: {
    type: String,
    default: '',
  },
  headline: {
    type: String,
    default: '',
  },
  location: {
    type: String,
    default: '',
  },
  about: {
    type: String,
    default: '',
  },
  experience: [{
    title: { type: String, required: true },
    company: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    description: { type: String, default: '' },
  }],
  education: [{
    school: { type: String, required: true },
    degree: { type: String, required: true },
    fieldOfStudy: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
  }],
  skills: [{
    type: String,
    trim: true,
  }],
  connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
