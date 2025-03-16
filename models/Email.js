const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Email = sequelize.define('Email', {
  from: {
    type: DataTypes.STRING,
    allowNull: false
  },
  to: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false
  },
  greeting: {
    type: DataTypes.STRING,
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const value = this.getDataValue('body');
      return value ? value.split('|') : [];
    },
    set(val) {
      this.setDataValue('body', Array.isArray(val) ? val.join('|') : val);
    }
  },
  closing: {
    type: DataTypes.STRING,
    allowNull: false
  },
  signature: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tasks: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const value = this.getDataValue('tasks');
      return value ? value.split('|') : [];
    },
    set(val) {
      this.setDataValue('tasks', Array.isArray(val) ? val.join('|') : val);
    }
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['office_issues', 'orders_shipments', 'job_applications', 'schedules', 'product_services', 'appointments']]
    }
  }
}, {
  timestamps: true
});

module.exports = Email;