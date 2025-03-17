const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ListeningPhoto = sequelize.define('ListeningPhoto', {
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  audioUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  correctDescription: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  incorrectDescriptions: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const value = this.getDataValue('incorrectDescriptions');
      return value ? value.split('|') : [];
    },
    set(val) {
      this.setDataValue('incorrectDescriptions', Array.isArray(val) ? val.join('|') : val);
    }
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['restaurant', 'airport', 'office', 'store', 'factory', 'street', 'hotel', 'transportation', 'meeting', 'outdoor']]
    }
  },
  difficulty: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'medium',
    validate: {
      isIn: [['easy', 'medium', 'hard']]
    }
  }
}, {
  tableName: 'ListeningPhotos',
  timestamps: true
});

module.exports = ListeningPhoto;