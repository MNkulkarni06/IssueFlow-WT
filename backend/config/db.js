const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/issueflow';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log(`[DB] Connected to MongoDB: ${uri}`);
}

module.exports = connectDB;
