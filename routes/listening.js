const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { ListeningPhoto } = require('../models');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Listening main page
router.get('/', (req, res) => {
  res.render('listening', { title: 'TOEIC Listening Practice' });
});

// Listening photographs exercise
router.get('/photographs', async (req, res) => {
  try {
    // Always generate a new photo for each session
    const photo = await generateListeningPhoto();
    
    // Helper function to shuffle array
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    
    res.render('listening-photographs', {
      title: 'Listening: Photographs',
      photo: photo,
      shuffleArray: shuffleArray
    });
  } catch (error) {
    console.error('Error loading listening photograph exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to load listening exercise',
      error: error
    });
  }
});

// Submit listening photograph answer
router.post('/submit-photograph', async (req, res) => {
  const { photoId, selectedDescription } = req.body;
  
  try {
    // Find the photo by ID
    const photo = await ListeningPhoto.findByPk(photoId);
    
    if (!photo) {
      return res.status(404).render('error', {
        message: 'Photo not found',
        error: { status: 404 }
      });
    }
    
    // Check if the selected description is correct
    const isCorrect = selectedDescription === photo.correctDescription;
    
    // Save statistics
    const Statistic = require('../models/Statistic');
    await Statistic.create({
      exerciseType: 'listening_photo',
      score: isCorrect ? 1 : 0,
      wordPair: ['listening', photo.category], // Using category as part of wordPair
      sentence: selectedDescription, // Using selected description as the sentence
      allWordsUsed: true, // For listening exercises, this is always true
      feedback: isCorrect ? 'Correct answer selected' : 'Incorrect answer selected',
      suggestions: isCorrect ? [] : [`The correct description is: ${photo.correctDescription}`]
    });
    
    // Render feedback
    res.render('listening-feedback', {
      title: 'Listening Exercise Feedback',
      photo: photo,
      selectedDescription: selectedDescription,
      isCorrect: isCorrect,
      feedbackClass: isCorrect ? 'alert-success' : 'alert-danger'
    });
  } catch (error) {
    console.error('Error evaluating listening answer:', error);
    res.render('error', {
      message: 'Error evaluating your answer',
      error: error
    });
  }
});

// Generate a new listening photo exercise
router.get('/generate-photograph', async (req, res) => {
  try {
    const photo = await generateListeningPhoto();
    res.redirect('/listening/photographs');
  } catch (error) {
    console.error('Error generating listening photograph:', error);
    res.status(500).render('error', {
      message: 'Failed to generate listening exercise',
      error: error
    });
  }
});

// Function to generate a listening photo exercise using OpenAI
async function generateListeningPhoto() {
  try {
    // Categories for listening photo exercises
    const categories = [
      'restaurant',
      'airport',
      'office',
      'store',
      'factory',
      'street',
      'hotel',
      'transportation',
      'meeting',
      'outdoor'
    ];
    
    // Select a random category
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    // Generate image prompt based on the category
    const imagePrompt = `A clear, professional photo showing a ${category} scene. The image should be suitable for a TOEIC English exam listening question.`;
    
    // Generate image using OpenAI
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageUrl = image.data[0].url;
    
    // Download the image and save it locally
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    // Create directory if it doesn't exist
    const imagesDir = path.join(__dirname, '../public/images/listening');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Generate a unique filename
    const timestamp = Date.now();
    const imagePath = path.join(imagesDir, `${category}_${timestamp}.png`);
    const relativeImagePath = `/images/listening/${category}_${timestamp}.png`;
    
    // Save the image
    fs.writeFileSync(imagePath, Buffer.from(buffer));
    
    // Generate descriptions using OpenAI
    const descriptionsResponse = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate one correct description and three incorrect descriptions for a photo in a TOEIC listening test. The descriptions should be simple statements about what is in the photo."
        },
        {
          role: "user",
          content: `Generate descriptions for a photo of a ${category} scene. Create one correct description that accurately describes what would be in the photo, and three incorrect descriptions that contain plausible errors. Each description should be a simple statement using present continuous, simple present tense, or 'There is/There are' statements. Return as a JSON object with 'correctDescription' and 'incorrectDescriptions' (array of 3 strings).`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const descriptions = JSON.parse(descriptionsResponse.choices[0].message.content);
    
    // Generate audio using OpenAI
    const audioPrompts = [
      `Statement A: ${descriptions.incorrectDescriptions[0]}`,
      `Statement B: ${descriptions.incorrectDescriptions[1]}`,
      `Statement C: ${descriptions.correctDescription}`,
      `Statement D: ${descriptions.incorrectDescriptions[2]}`
    ];
    
    // Create audio directory if it doesn't exist
    const audioDir = path.join(__dirname, '../public/audio/listening');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    // Generate audio file
    const audioResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: audioPrompts.join('. ')
    });
    
    const audioPath = path.join(audioDir, `${category}_${timestamp}.mp3`);
    const relativeAudioPath = `/audio/listening/${category}_${timestamp}.mp3`;
    
    // Convert audio response to buffer and save
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    fs.writeFileSync(audioPath, audioBuffer);
    
    // Create and save the ListeningPhoto record
    const photo = await ListeningPhoto.create({
      imageUrl: relativeImagePath,
      audioUrl: relativeAudioPath,
      correctDescription: descriptions.correctDescription,
      incorrectDescriptions: descriptions.incorrectDescriptions,
      category: category,
      difficulty: 'medium'
    });
    
    return photo;
  } catch (error) {
    console.error('Error generating listening photo:', error);
    throw error;
  }
}

module.exports = router;