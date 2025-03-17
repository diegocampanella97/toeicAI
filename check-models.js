const { connectDB, sequelize } = require('./config/db');
const SpeakingText = require('./models/SpeakingText');
const SpeakingResponse = require('./models/SpeakingResponse');

async function init() {
  try {
    await connectDB();
    // Force sync to recreate tables
    await sequelize.sync({ force: true });
    console.log('Database synchronized with force option');
    console.log('Models in database:', Object.keys(sequelize.models));
    console.log('SpeakingText model:', sequelize.models.SpeakingText ? 'Exists' : 'Not found');
    console.log('SpeakingResponse model:', sequelize.models.SpeakingResponse ? 'Exists' : 'Not found');
  } catch (error) {
    console.error('Error:', error);
  }
}

init();