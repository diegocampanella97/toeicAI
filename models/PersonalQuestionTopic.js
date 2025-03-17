const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PersonalQuestionTopic = sequelize.define('PersonalQuestionTopic', {
  topic: {
    type: DataTypes.STRING,
    allowNull: false
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
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['personal_interests', 'community_life', 'marketing_research', 'work_life', 'education', 'travel', 'technology', 'health', 'entertainment']]
    }
  }
}, {
  tableName: 'PersonalQuestionTopics',
  timestamps: true
});

module.exports = PersonalQuestionTopic;