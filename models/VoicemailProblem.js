const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const VoicemailProblem = sequelize.define('VoicemailProblem', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  problem: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['rental_housing', 'office_space', 'deliveries', 'travel', 'customer_service', 'class_information']]
    }
  },
  difficulty: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'medium',
    validate: {
      isIn: [['easy', 'medium', 'hard']]
    }
  },
  possibleSolutions: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('possibleSolutions');
      return value ? JSON.parse(value) : [];
    },
    set(val) {
      this.setDataValue('possibleSolutions', JSON.stringify(val));
    }
  },
  audioUrl: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'VoicemailProblems',
  timestamps: true
});

module.exports = VoicemailProblem;