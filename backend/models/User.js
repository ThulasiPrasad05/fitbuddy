const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,

  email: String,

  password: String,

  picture: String,

  age: Number,

  gender: String,

  location: String,

  workoutType: String,

  goals: {
    type: [String],
    default: []
  },

  plan: String,

  onboardingCompleted: {
    type: Boolean,
    default: false
  },

  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ]
});

module.exports = mongoose.model("User", userSchema);