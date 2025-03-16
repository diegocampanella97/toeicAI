const express = require('express');
const router = express.Router();
const Statistic = require('../models/Statistic');
const EmailResponse = require('../models/EmailResponse');
const Email = require('../models/Email');
const EssayResponse = require('../models/EssayResponse');
const Essay = require('../models/Essay');

// Statistics home page - show overview and history
router.get('/', async (req, res) => {
  try {
    // Get writing statistics
    const statistics = await Statistic.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    // Get email statistics
    const emailResponses = await EmailResponse.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    // Get essay statistics
    const essayResponses = await EssayResponse.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    // Combine all statistics for display
    const allExercises = [
      ...statistics.map(stat => ({
        id: stat.id,
        type: 'writing',
        createdAt: stat.createdAt,
        exerciseType: stat.exerciseType,
        wordPair: stat.wordPair,
        score: stat.score
      })),
      ...emailResponses.map(resp => ({
        id: resp.id,
        type: 'email',
        createdAt: resp.createdAt,
        exerciseType: 'email',
        subject: 'Email Exercise',
        score: resp.score
      })),
      ...essayResponses.map(resp => ({
        id: resp.id,
        type: 'essay',
        createdAt: resp.createdAt,
        exerciseType: 'essay',
        subject: 'Essay Exercise',
        score: resp.score
      }))
    ];
    
    // Sort all exercises by date
    allExercises.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Calculate average score across all exercise types
    const totalExercises = statistics.length + emailResponses.length + essayResponses.length;
    const totalScore = statistics.reduce((sum, stat) => sum + stat.score, 0) + 
                      emailResponses.reduce((sum, resp) => sum + resp.score, 0) +
                      essayResponses.reduce((sum, resp) => sum + resp.score, 0);
    const averageScore = totalExercises > 0 ? totalScore / totalExercises : 0;
    
    // Calculate word usage rate (only applicable to writing exercises)
    const wordUsageRate = statistics.length > 0
      ? (statistics.filter(stat => stat.allWordsUsed).length / statistics.length) * 100
      : 0;
    
    // Calculate task completion rate (only applicable to email exercises)
    const taskCompletionRate = emailResponses.length > 0
      ? (emailResponses.filter(resp => resp.taskCompletion).length / emailResponses.length) * 100
      : 0;
      
    // Calculate thesis development rate (only applicable to essay exercises)
    const thesisDevelopmentRate = essayResponses.length > 0
      ? (essayResponses.reduce((sum, resp) => sum + resp.thesisDevelopment, 0) / (essayResponses.length * 5)) * 100
      : 0;
    
    res.render('statistics/index', {
      title: 'Your Statistics',
      statistics,
      emailResponses,
      essayResponses,
      allExercises,
      averageScore,
      wordUsageRate,
      taskCompletionRate,
      thesisDevelopmentRate,
      totalExercises
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      message: 'Failed to load statistics',
      error: err
    });
  }
});

// View details of a specific writing exercise
router.get('/:id', async (req, res) => {
  try {
    const statistic = await Statistic.findByPk(req.params.id);
    
    if (!statistic) {
      // Check if it's an email response
      const emailResponse = await EmailResponse.findByPk(req.params.id);
      
      if (emailResponse) {
        const email = await Email.findByPk(emailResponse.emailId);
        return res.render('statistics/email-detail', {
          title: 'Email Exercise Details',
          emailResponse,
          email
        });
      }
      
      // Check if it's an essay response
      const essayResponse = await EssayResponse.findByPk(req.params.id);
      
      if (essayResponse) {
        const essay = await Essay.findByPk(essayResponse.essayId);
        return res.render('statistics/essay-detail', {
          title: 'Essay Exercise Details',
          essayResponse,
          essay
        });
      }
      
      return res.status(404).render('error', {
        message: 'Exercise not found',
        error: { status: 404 }
      });
    }
    
    res.render('statistics/exercise-detail', {
      title: 'Exercise Details',
      statistic
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      message: 'Failed to load exercise details',
      error: err
    });
  }
});

// View details of a specific email exercise
router.get('/email/:id', async (req, res) => {
  try {
    const emailResponse = await EmailResponse.findByPk(req.params.id);
    
    if (!emailResponse) {
      return res.status(404).render('error', {
        message: 'Email response not found',
        error: { status: 404 }
      });
    }
    
    const email = await Email.findByPk(emailResponse.emailId);
    
    res.render('statistics/email-detail', {
      title: 'Email Exercise Details',
      emailResponse,
      email
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      message: 'Failed to load email exercise details',
      error: err
    });
  }
});

// View details of a specific essay exercise
router.get('/essay/:id', async (req, res) => {
  try {
    const essayResponse = await EssayResponse.findByPk(req.params.id);
    
    if (!essayResponse) {
      return res.status(404).render('error', {
        message: 'Essay response not found',
        error: { status: 404 }
      });
    }
    
    const essay = await Essay.findByPk(essayResponse.essayId);
    
    res.render('statistics/essay-detail', {
      title: 'Essay Exercise Details',
      essayResponse,
      essay
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      message: 'Failed to load essay exercise details',
      error: err
    });
  }
});

module.exports = router;