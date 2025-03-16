const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Essay = sequelize.define('Essay', {
  prompt: {
    type: DataTypes.STRING,
    allowNull: false
  },
  topic: {
    type: DataTypes.STRING,
    allowNull: false
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  essayType: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['opinion', 'agree_disagree', 'advantages_disadvantages', 'preference', 'importance']]
    }
  }
}, {
  timestamps: true
});

module.exports = Essay;