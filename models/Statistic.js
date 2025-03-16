const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Statistic = sequelize.define('Statistic', {
  exerciseType: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['writing', 'email']]
    }
  },
  wordPair: {
    type: DataTypes.STRING,
    allowNull: false,
    get() {
      return this.getDataValue('wordPair').split(',');
    },
    set(val) {
      this.setDataValue('wordPair', Array.isArray(val) ? val.join(',') : val);
    }
  },
  sentence: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 5
    }
  },
  allWordsUsed: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: false
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
  timestamps: true
});

module.exports = Statistic;