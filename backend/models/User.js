const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  // 👤 Basic information

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String
  },

  picture: {
    type: String
  },


  // 🏋️ Fitness information

  workoutType: {
    type: String
  },

  age: {
    type: Number
  },

  gender: {
    type: String
  },

  location: {
    type: String
  },

  // Multiple fitness goals
  goals: {
    type: [String],
    default: []
  },

  plan: {
    type: String
  },


  // ❤️ Users this person liked

  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ]

}, {
  timestamps: true
});


module.exports = mongoose.model("User", userSchema);