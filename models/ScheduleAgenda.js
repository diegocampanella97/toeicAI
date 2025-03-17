const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ScheduleAgenda = sequelize.define('ScheduleAgenda', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['meeting_agenda', 'travel_itinerary', 'conference_schedule', 'tour_schedule']]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const value = this.getDataValue('content');
      return value ? JSON.parse(value) : [];
    },
    set(val) {
      this.setDataValue('content', JSON.stringify(val));
    }
  },
  questions: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const value = this.getDataValue('questions');
      return value ? JSON.parse(value) : [];
    },
    set(val) {
      this.setDataValue('questions', JSON.stringify(val));
    }
  },
  questionTypes: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const value = this.getDataValue('questionTypes');
      return value ? JSON.parse(value) : [];
    },
    set(val) {
      this.setDataValue('questionTypes', JSON.stringify(val));
    }
  }
}, {
  tableName: 'ScheduleAgendas',
  timestamps: true
});

module.exports = ScheduleAgenda;