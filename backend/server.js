require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const userRoutes = require("./routes/userRoutes");
const gymRoutes = require("./routes/gymRoutes");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());


// =====================================================
// ROUTES
// =====================================================

app.use("/api/users", userRoutes);
app.use("/api/gyms", gymRoutes);


// =====================================================
// CHECK GOOGLE MAPS API KEY
// =====================================================

console.log(
  "Google Maps API key loaded:",
  !!process.env.GOOGLE_MAPS_API_KEY
);


// =====================================================
// MONGODB
// =====================================================

mongoose.connect("mongodb://127.0.0.1:27017/gymfinder")
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch(err => {
    console.log("MongoDB connection error:", err);
  });


// =====================================================
// SOCKET.IO
// =====================================================

io.on("connection", (socket) => {

  console.log("⚡ User connected:", socket.id);


  socket.on("join_room", (room) => {

    socket.join(room);

    console.log("Joined room:", room);

  });


  socket.on("send_message", (data) => {

    console.log("📩 Message:", data);

    io.to(data.room).emit(
      "receive_message",
      data
    );

  });


  socket.on("disconnect", () => {

    console.log(
      "❌ User disconnected:",
      socket.id
    );

  });

});


// =====================================================
// START SERVER
// =====================================================

server.listen(5000, () => {

  console.log(
    "Server running on port 5000 🚀"
  );

});