const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Match = require("../models/Match");
const Message = require("../models/Message");

const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");

// ======================================================
// GOOGLE LOGIN CONFIGURATION
// ======================================================

const GOOGLE_CLIENT_ID =
  "1037151065604-ndngc00d5o3sunn8nqjo7u254k09hjnk.apps.googleusercontent.com";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

console.log("User routes loaded...");

// ======================================================
// GOOGLE LOGIN
// ======================================================

router.post("/google-login", async (req, res) => {
  try {
    console.log("🔵 Google Login API hit");

    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required"
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    if (!email) {
      return res.status(400).json({
        message: "Google account email not available"
      });
    }

    // ==================================================
    // FIND USER
    // ==================================================

    let user = await User.findOne({ email });

    // ==================================================
    // CREATE NEW GOOGLE USER
    // ==================================================

    if (!user) {
      user = await User.create({
        name: name || "FitBuddy User",
        email: email,
        picture: picture || null,
        onboardingCompleted: false
      });

      console.log("🆕 New Google user created:", email);

      return res.status(200).json({
        message: "Google login successful",
        isNewUser: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          workoutType: user.workoutType,
          age: user.age,
          gender: user.gender,
          location: user.location,
          goals: user.goals,
          plan: user.plan,
          picture: user.picture || picture || null,
          onboardingCompleted: false
        }
      });
    }

    // ==================================================
    // EXISTING GOOGLE USER
    // ==================================================

    console.log("👤 Existing Google user:", email);

    // Update picture if Google provides one
    if (picture && !user.picture) {
      user.picture = picture;
    }

    // ==================================================
    // CHECK WHETHER ONBOARDING IS COMPLETE
    // ==================================================

    const hasGoals =
      (Array.isArray(user.goals) && user.goals.length > 0) ||
      (typeof user.goals === "string" &&
        user.goals.trim() !== "");

    const hasAge =
      user.age !== undefined &&
      user.age !== null &&
      user.age !== "";

    const hasGender =
      typeof user.gender === "string" &&
      user.gender.trim() !== "";

    const hasLocation =
      typeof user.location === "string" &&
      user.location.trim() !== "";

    const hasWorkoutType =
      typeof user.workoutType === "string" &&
      user.workoutType.trim() !== "";

    const hasPlan =
      typeof user.plan === "string" &&
      user.plan.trim() !== "";

    const profileComplete =
      user.onboardingCompleted === true ||
      (
        hasAge &&
        hasGender &&
        hasLocation &&
        hasWorkoutType &&
        hasGoals &&
        hasPlan
      );

    // ==================================================
    // IMPORTANT:
    // If an old user already completed onboarding,
    // permanently mark it as completed.
    // ==================================================

    if (
      profileComplete &&
      user.onboardingCompleted !== true
    ) {
      user.onboardingCompleted = true;
    }

    await user.save();

    console.log(
      "📋 Onboarding completed:",
      profileComplete
    );

    // ==================================================
    // RETURN USER
    // ==================================================

    return res.status(200).json({
      message: "Google login successful",

      // true  = show onboarding
      // false = go directly to home
      isNewUser: !profileComplete,

      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        workoutType: user.workoutType,
        age: user.age,
        gender: user.gender,
        location: user.location,
        goals: user.goals,
        plan: user.plan,
        picture: user.picture || picture || null,
        onboardingCompleted: profileComplete
      }
    });

  } catch (error) {
    console.log("❌ Google Login Error:", error);

    res.status(401).json({
      message: "Google authentication failed"
    });
  }
});

// ======================================================
// MATCH USERS API
// ======================================================

router.get("/match/:workoutType/:userId", async (req, res) => {
  try {
    console.log("🔥 MATCH ROUTE HIT 🔥");

    const { workoutType, userId } = req.params;

    const users = await User.find({
      workoutType,
      _id: { $ne: userId }
    }).select("-password");

    res.status(200).json({
      message: "Matching users found",
      count: users.length,
      users
    });

  } catch (error) {
    console.log("Match error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// LIKE + MATCH LOGIC
// ======================================================

router.post("/like", async (req, res) => {
  try {
    console.log("❤️ Like API hit");

    const { fromUserId, toUserId } = req.body;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({
        message: "fromUserId and toUserId are required"
      });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({
        message: "You cannot like yourself"
      });
    }

    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!fromUser || !toUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    fromUser.likes = fromUser.likes || [];
    toUser.likes = toUser.likes || [];

    // ==================================================
    // CHECK IF ALREADY LIKED
    // ==================================================

    const alreadyLiked = fromUser.likes.some(
      id => id.toString() === toUserId.toString()
    );

    if (alreadyLiked) {

      const existingMatch = await Match.findOne({
        users: {
          $all: [fromUserId, toUserId]
        }
      });

      if (existingMatch) {
        return res.status(200).json({
          message: "🎉 You are already matched!",
          match: true
        });
      }

      return res.status(400).json({
        message: "Already liked",
        match: false
      });
    }

    // ==================================================
    // CHECK IF OTHER USER LIKED US
    // ==================================================

    const alreadyLikedBack = toUser.likes.some(
      id => id.toString() === fromUserId.toString()
    );

    if (alreadyLikedBack) {

      fromUser.likes.push(toUserId);

      await fromUser.save();

      const existingMatch = await Match.findOne({
        users: {
          $all: [fromUserId, toUserId]
        }
      });

      if (!existingMatch) {
        await Match.create({
          users: [fromUserId, toUserId]
        });
      }

      return res.status(200).json({
        message: "🎉 It's a MATCH!",
        match: true
      });
    }

    // ==================================================
    // NORMAL LIKE
    // ==================================================

    fromUser.likes.push(toUserId);

    await fromUser.save();

    res.status(200).json({
      message: "User liked successfully ❤️",
      match: false
    });

  } catch (error) {
    console.log("Like error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// UNLIKE USER
// ======================================================

router.post("/unlike", async (req, res) => {
  try {
    console.log("💔 Unlike API hit");

    const { fromUserId, toUserId } = req.body;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({
        message: "fromUserId and toUserId are required"
      });
    }

    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!fromUser || !toUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    fromUser.likes = (fromUser.likes || []).filter(
      id => id.toString() !== toUserId.toString()
    );

    await fromUser.save();

    await Match.deleteOne({
      users: {
        $all: [fromUserId, toUserId]
      }
    });

    res.status(200).json({
      message: "Like removed successfully 💔"
    });

  } catch (error) {
    console.log("Unlike error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// GET MATCHES
// ======================================================

router.get("/matches/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const matches = await Match.find({
      users: userId
    }).populate("users", "-password");

    res.status(200).json({
      count: matches.length,
      matches
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// SEND MESSAGE
// ======================================================

router.post("/message", async (req, res) => {
  try {
    console.log("💬 Message API hit");

    const {
      senderId,
      receiverId,
      text
    } = req.body;

    if (!senderId || !receiverId || !text) {
      return res.status(400).json({
        message: "senderId, receiverId and text are required"
      });
    }

    const match = await Match.findOne({
      users: {
        $all: [senderId, receiverId]
      }
    });

    if (!match) {
      return res.status(403).json({
        message: "You can only chat after matching"
      });
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      text
    });

    await newMessage.save();

    res.status(201).json({
      message: "Message sent",
      data: newMessage
    });

  } catch (error) {
    console.log("Message error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// GET CHAT HISTORY
// ======================================================

router.get("/messages/:user1/:user2", async (req, res) => {
  try {
    const {
      user1,
      user2
    } = req.params;

    const messages = await Message.find({
      $or: [
        {
          sender: user1,
          receiver: user2
        },
        {
          sender: user2,
          receiver: user1
        }
      ]
    }).sort({
      createdAt: 1
    });

    res.status(200).json({
      count: messages.length,
      messages
    });

  } catch (error) {
    console.log("Message history error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// TEST ROUTE
// ======================================================

router.get("/test", (req, res) => {
  res.send("Test route working");
});

// ======================================================
// REGISTER
// ======================================================

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      workoutType
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      workoutType
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully"
    });

  } catch (error) {
    console.log("Register error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// NORMAL LOGIN
// ======================================================

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    const user = await User.findOne({
      email
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid password"
      });
    }

    const {
      password: _,
      ...userWithoutPassword
    } = user._doc;

    res.status(200).json({
      message: "Login successful",
      user: userWithoutPassword
    });

  } catch (error) {
    console.log("Login error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// SAVE ONBOARDING DATA
// ======================================================

router.put("/onboarding/:id", async (req, res) => {
  try {
    const {
      age,
      gender,
      location,
      workoutType,
      goals,
      plan
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        age,
        gender,
        location,
        workoutType,
        goals,
        plan,

        // ⭐ IMPORTANT
        onboardingCompleted: true
      },
      {
        new: true
      }
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user
    });

  } catch (error) {
    console.log("Onboarding error:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;