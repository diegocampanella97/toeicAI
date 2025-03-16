const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SpeakingText = sequelize.define('SpeakingText', {
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  topic: {
    type: DataTypes.STRING,
    allowNull: false
  },
  difficulty: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['easy', 'medium', 'hard']]
    }
  },
  wordCount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['advertisement', 'announcement', 'news', 'tour', 'traffic', 'weather', 'entertainment', 'health', 'housing', 'shopping', 'travel']]
    }
  }
}, {
  tableName: 'SpeakingTexts',
  timestamps: true
});

module.exports = SpeakingText;