const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SpeakingResponse = sequelize.define('SpeakingResponse', {
  speakingTextId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  audioUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pronunciation: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  intonation: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  fluency: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  suggestions: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('suggestions');
      return value ? value.split('|') : [];
    },
    set(val) {
      this.setDataValue('suggestions', Array.isArray(val) ? val.join('|') : val);
    }
  }
}, {
  tableName: 'SpeakingResponses',
  timestamps: true
});

module.exports = SpeakingResponse;