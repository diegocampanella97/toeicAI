const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmailResponse = sequelize.define('EmailResponse', {
  exerciseType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'email',
    validate: {
      isIn: [['email']]
    }
  },
  emailId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Emails',
      key: 'id'
    }
  },
  response: {
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
  organization: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 5
    }
  },
  grammar: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 5
    }
  },
  vocabulary: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 5
    }
  },
  taskCompletion: {
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

module.exports = EmailResponse;