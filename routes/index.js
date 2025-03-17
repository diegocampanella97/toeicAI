const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const Email = require('../models/Email');
const EmailResponse = require('../models/EmailResponse');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Home page route
router.get('/', (req, res) => {
  res.render('index', { title: 'TOEIC Study App' });
});

// Writing section route
router.get('/writing', (req, res) => {
  res.render('writing', { title: 'TOEIC Writing Practice' });
});

// Speaking section route
router.get('/speaking', (req, res) => {
  res.render('speaking', { title: 'TOEIC Speaking Practice' });
});

// Generate a writing exercise
router.get('/writing/exercise', async (req, res) => {
  try {
    // Generate two random words for the exercise using OpenAI
    const wordPair = await generateWordPair();
    
    // Generate image prompt based on the word pair
    const imagePrompt = `A clear, professional photo showing a business or office setting that includes ${wordPair[0]} and ${wordPair[1]}. The image should be suitable for a TOEIC English exam writing question.`;
    
    // Generate image using OpenAI
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageUrl = image.data[0].url;
    
    res.render('exercise', {
      title: 'Writing Exercise',
      words: wordPair,
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error generating exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate exercise',
      error: error
    });
  }
});

// Submit writing answer
router.post('/writing/submit', async (req, res) => {
  const { sentence, words } = req.body;
  const wordArray = words.split(',');
  
  try {
    // Check if both required words are used in the sentence
    const wordUsageCheck = checkWordUsage(sentence, wordArray);
    
    // Use OpenAI to evaluate the sentence
    const feedback = await evaluateSentence(sentence, wordArray);
    
    // Determine feedback class based on evaluation
    const feedbackClass = feedback.score >= 4 ? 'alert-success' : 
                         feedback.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save statistics
    const Statistic = require('../models/Statistic');
    await Statistic.create({
      exerciseType: 'writing',
      wordPair: wordArray,
      sentence: sentence,
      score: feedback.score,
      allWordsUsed: wordUsageCheck.allWordsUsed,
      feedback: feedback.message,
      suggestions: feedback.suggestions
    });
    
    res.render('feedback', {
      title: 'Exercise Feedback',
      sentence: sentence,
      words: words,
      wordUsageCheck: wordUsageCheck,
      feedback: feedback.message,
      suggestions: feedback.suggestions,
      score: feedback.score,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating sentence:', error);
    res.render('feedback', {
      title: 'Exercise Feedback',
      sentence: sentence,
      words: words,
      feedback: 'We encountered an error while evaluating your sentence. Please try again.',
      feedbackClass: 'alert-danger'
    });
  }
});

// Function to check if both required words are used in the sentence
function checkWordUsage(sentence, wordArray) {
  const lowerSentence = sentence.toLowerCase();
  const result = {
    allWordsUsed: true,
    missingWords: []
  };
  
  for (const word of wordArray) {
    if (!lowerSentence.includes(word.toLowerCase())) {
      result.allWordsUsed = false;
      result.missingWords.push(word);
    }
  }
  
  return result;
}

// Function to generate a word pair using OpenAI
async function generateWordPair() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate a pair of words suitable for TOEIC writing questions 1-5, where students must write a sentence about a photo using two given words. The words should be business/office related and commonly appear in TOEIC exams."
        },
        {
          role: "user",
          content: "Generate a pair of words for a TOEIC writing exercise. The pair should contain two words that can be used together in a sentence about a business or office setting. Return only the two words as a JSON array with no additional text. The words should be some combination of: nouns, verbs, adjectives, or adverbs that are commonly used in business contexts."
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    return result.words || ['document', 'review']; // Fallback if format is incorrect
  } catch (error) {
    console.error('Error generating word pair:', error);
    // Fallback to a default pair if API call fails
    return ['document', 'review'];
  }
}

// Function to evaluate the sentence using OpenAI
async function evaluateSentence(sentence, wordArray) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an English teacher specializing in TOEIC exam preparation. You are evaluating sentences for Questions 1-5 of the TOEIC writing section where students must write a sentence about a photo using two given words. Your evaluation should focus on these targeted skills:\n\n1. Correct word order\n2. Proper clause structure (sentences with one clause or two clauses)\n3. Appropriate use of adjectives, adverbs, and prepositions\n4. Correct use of subordinating conjunctions\n5. Relevance to the photo described\n\nA good response uses the two provided words correctly in terms of both grammatical structure and word meaning and is relevant to the photo."
        },
        {
          role: "user",
          content: `Evaluate this sentence: "${sentence}". The required words were: ${wordArray.join(', ')}. \n\nPlease evaluate based on:\n1. Correct word order and sentence structure\n2. Proper use of clauses (single or multiple)\n3. Appropriate use of parts of speech (adjectives, adverbs, prepositions, etc.)\n4. Correct use of subordinating conjunctions (if applicable)\n5. Relevance to what would likely be in the photo\n6. Proper use of the required words\n\nRate the sentence on a scale of 1-5, where 5 is excellent. Format your response as JSON with these fields: {score: number, message: string, suggestions: string[]}`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI evaluation error:', error);
    return {
      score: 0,
      message: "We couldn't evaluate your sentence at this time.",
      suggestions: ["Please try again later."]
    };
  }
}

// Generate an email exercise
router.get('/writing/email-exercise', async (req, res) => {
  try {
    // Generate a random email exercise using OpenAI
    const email = await generateEmailExercise();
    
    res.render('email-exercise', {
      title: 'Email Response Exercise',
      email: email
    });
  } catch (error) {
    console.error('Error generating email exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate email exercise',
      error: error
    });
  }
});

// Submit email response
router.post('/writing/email-submit', async (req, res) => {
  const { response, emailId } = req.body;
  
  try {
    // Find the email by ID
    const email = await Email.findByPk(emailId);
    
    if (!email) {
      return res.status(404).render('error', {
        message: 'Email not found',
        error: { status: 404 }
      });
    }
    
    // Use OpenAI to evaluate the email response
    const evaluation = await evaluateEmailResponse(response, email);
    
    // Determine feedback class based on evaluation
    const feedbackClass = evaluation.score >= 4 ? 'alert-success' : 
                         evaluation.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save response statistics
    await EmailResponse.create({
      emailId: email.id,
      response: response,
      score: evaluation.score,
      organization: evaluation.organization,
      grammar: evaluation.grammar,
      vocabulary: evaluation.vocabulary,
      taskCompletion: evaluation.taskCompletion,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions
    });
    
    res.render('email-feedback', {
      title: 'Email Exercise Feedback',
      email: email,
      response: response,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions,
      score: evaluation.score,
      organization: evaluation.organization,
      grammar: evaluation.grammar,
      vocabulary: evaluation.vocabulary,
      taskCompletion: evaluation.taskCompletion,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating email response:', error);
    res.render('email-feedback', {
      title: 'Email Exercise Feedback',
      email: await Email.findByPk(emailId),
      response: response,
      feedback: 'We encountered an error while evaluating your response. Please try again.',
      feedbackClass: 'alert-danger',
      score: 0,
      organization: 0,
      grammar: 0,
      vocabulary: 0,
      taskCompletion: false,
      suggestions: []
    });
  }
});

// Function to generate an email exercise using OpenAI
async function generateEmailExercise() {
  try {
    // Categories for email exercises
    const categories = [
      'office_issues',
      'orders_shipments',
      'job_applications',
      'schedules',
      'product_services',
      'appointments'
    ];
    
    // Select a random category
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    // Generate email content using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate a business email for TOEIC writing questions 6-7, where students must respond to an email addressing specific tasks. The email should be business/office related and commonly appear in TOEIC exams."
        },
        {
          role: "user",
          content: `Generate a business email for a TOEIC writing exercise in the category: ${category}. Include 2-3 specific tasks that the respondent must address (e.g., ask questions, make requests, provide information). Return the email as a JSON object with these fields: from, to, subject, date, greeting, body (array of paragraphs), closing, signature, tasks (array of task descriptions). Make the email realistic and professional.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const emailData = JSON.parse(response.choices[0].message.content);
    
    // Save the email to the database
    const email = await Email.create({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      date: emailData.date,
      greeting: emailData.greeting,
      body: emailData.body,
      closing: emailData.closing,
      signature: emailData.signature,
      tasks: emailData.tasks,
      category: category
    });
    
    return email;
  } catch (error) {
    console.error('Error generating email exercise:', error);
    // Return a fallback email if API call fails
    return {
      id: 0,
      from: 'john.smith@example.com',
      to: 'you@company.com',
      subject: 'Upcoming Team Meeting',
      date: new Date().toLocaleDateString(),
      greeting: 'Dear Team Member,',
      body: [
        'I hope this email finds you well. I am writing to inform you about our upcoming team meeting scheduled for next week.',
        'We will be discussing the quarterly results and planning for the next quarter. Please prepare a short summary of your current projects.'
      ],
      closing: 'Best regards,',
      signature: 'John Smith\nTeam Manager',
      tasks: [
        'Ask two questions about the meeting agenda',
        'Confirm your attendance',
        'Suggest one topic for discussion'
      ],
      category: 'office_issues'
    };
  }
}

// Function to evaluate the email response using OpenAI
async function evaluateEmailResponse(response, email) {
  try {
    const tasksString = email.tasks.join('\n- ');
    
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an English teacher specializing in TOEIC exam preparation. You are evaluating responses for Questions 6-7 of the TOEIC writing section where students must respond to an email addressing specific tasks. Your evaluation should focus on these targeted skills:\n\n1. Organization of ideas\n2. Use of appropriate connecting words\n3. Variety of sentence types\n4. Grammatical correctness\n5. Appropriate vocabulary\n6. Completion of all required tasks\n\nA good response addresses all the tasks, has a variety of sentences, has logically organized ideas, and contains few or no grammar or vocabulary errors."
        },
        {
          role: "user",
          content: `Evaluate this email response:\n\n"${response}"\n\nThe original email was about: ${email.subject}\n\nThe required tasks were:\n- ${tasksString}\n\nPlease evaluate based on:\n1. Organization of ideas\n2. Use of appropriate connecting words\n3. Variety of sentence types\n4. Grammatical correctness\n5. Appropriate vocabulary\n6. Completion of all required tasks\n\nFormat your response as JSON with these fields: {score: number (1-5), organization: number (1-5), grammar: number (1-5), vocabulary: number (1-5), taskCompletion: boolean, message: string, suggestions: string[]}`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(aiResponse.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI evaluation error:', error);
    return {
      score: 0,
      organization: 0,
      grammar: 0,
      vocabulary: 0,
      taskCompletion: false,
      message: "We couldn't evaluate your response at this time.",
      suggestions: ["Please try again later."]
    };
  }
}

// Generate an essay exercise
router.get('/writing/essay-exercise', async (req, res) => {
  try {
    // Generate a random essay exercise using OpenAI
    const essay = await generateEssayExercise();
    
    res.render('essay-exercise', {
      title: 'Opinion Essay Exercise',
      essay: essay
    });
  } catch (error) {
    console.error('Error generating essay exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate essay exercise',
      error: error
    });
  }
});

// Submit essay response
router.post('/writing/essay-submit', async (req, res) => {
  const { response, essayId } = req.body;
  
  try {
    // Find the essay by ID
    const Essay = require('../models/Essay');
    const essay = await Essay.findByPk(essayId);
    
    if (!essay) {
      return res.status(404).render('error', {
        message: 'Essay not found',
        error: { status: 404 }
      });
    }
    
    // Count words in the response
    const wordCount = response.trim().split(/\s+/).length;
    
    // Use OpenAI to evaluate the essay response
    const evaluation = await evaluateEssayResponse(response, essay);
    
    // Determine feedback class based on evaluation
    const feedbackClass = evaluation.score >= 4 ? 'alert-success' : 
                         evaluation.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save response statistics
    const EssayResponse = require('../models/EssayResponse');
    await EssayResponse.create({
      essayId: essay.id,
      response: response,
      wordCount: wordCount,
      score: evaluation.score,
      organization: evaluation.organization,
      grammar: evaluation.grammar,
      vocabulary: evaluation.vocabulary,
      thesisDevelopment: evaluation.thesisDevelopment,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions
    });
    
    res.render('essay-feedback', {
      title: 'Essay Exercise Feedback',
      essay: essay,
      response: response,
      wordCount: wordCount,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions,
      score: evaluation.score,
      organization: evaluation.organization,
      grammar: evaluation.grammar,
      vocabulary: evaluation.vocabulary,
      thesisDevelopment: evaluation.thesisDevelopment,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating essay response:', error);
    res.render('essay-feedback', {
      title: 'Essay Exercise Feedback',
      essay: await Essay.findByPk(essayId),
      response: response,
      wordCount: response.trim().split(/\s+/).length,
      feedback: 'We encountered an error while evaluating your response. Please try again.',
      feedbackClass: 'alert-danger',
      score: 0,
      organization: 0,
      grammar: 0,
      vocabulary: 0,
      thesisDevelopment: 0,
      suggestions: []
    });
  }
});

// Function to generate an essay exercise using OpenAI
async function generateEssayExercise() {
  try {
    // Essay types for exercises
    const essayTypes = [
      'opinion',
      'agree_disagree',
      'advantages_disadvantages',
      'preference',
      'importance'
    ];
    
    // Select a random essay type
    const essayType = essayTypes[Math.floor(Math.random() * essayTypes.length)];
    
    // Generate essay prompt using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate an essay prompt for TOEIC writing question 8, where students must write an opinion essay. The prompt should be business/office related and commonly appear in TOEIC exams."
        },
        {
          role: "user",
          content: `Generate an essay prompt for a TOEIC writing exercise of type: ${essayType}. Return the essay as a JSON object with these fields: prompt (the main question), topic (short topic name), instructions (detailed instructions for the essay), essayType (the type of essay). Make the prompt clear, concise, and relevant to business or professional contexts.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const essayData = JSON.parse(response.choices[0].message.content);
    
    // Save the essay to the database
    const Essay = require('../models/Essay');
    const essay = await Essay.create({
      prompt: essayData.prompt,
      topic: essayData.topic,
      instructions: essayData.instructions,
      essayType: essayData.essayType
    });
    
    return essay;
  } catch (error) {
    console.error('Error generating essay exercise:', error);
    // Return a fallback essay if API call fails
    return {
      id: 0,
      prompt: 'Do you think technology has improved workplace communication?',
      topic: 'Technology in the Workplace',
      instructions: 'Write an essay explaining your opinion on whether technology has improved communication in the workplace. Include specific examples and reasons to support your view.',
      essayType: 'opinion'
    };
  }
}

// Function to evaluate the essay response using OpenAI
async function evaluateEssayResponse(response, essay) {
  try {
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an English teacher specializing in TOEIC exam preparation. You are evaluating responses for Question 8 of the TOEIC writing section where students must write an opinion essay. Your evaluation should focus on these targeted skills:\n\n1. Organization of ideas\n2. Grammar correctness\n3. Vocabulary usage\n4. Thesis development and support\n\nA good response has a clear thesis statement, two or three supporting ideas that are developed in separate paragraphs, and a strong conclusion. Grammar and vocabulary errors are minimal and don't interfere with understanding the ideas."
        },
        {
          role: "user",
          content: `Evaluate this essay response:\n\n"${response}"\n\nThe essay prompt was: ${essay.prompt}\n\nThe instructions were: ${essay.instructions}\n\nPlease evaluate based on:\n1. Organization of ideas\n2. Grammar correctness\n3. Vocabulary usage\n4. Thesis development and support\n\nFormat your response as JSON with these fields: {score: number (1-5), organization: number (1-5), grammar: number (1-5), vocabulary: number (1-5), thesisDevelopment: number (1-5), message: string, suggestions: string[]}`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(aiResponse.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI evaluation error:', error);
    return {
      score: 0,
      organization: 0,
      grammar: 0,
      vocabulary: 0,
      thesisDevelopment: 0,
      message: "We couldn't evaluate your essay at this time.",
      suggestions: ["Please try again later."]
    };
  }
}

// Speaking read aloud exercise route
router.get('/speaking/read-aloud', async (req, res) => {
  try {
    // Generate a random speaking text using OpenAI
    const speakingText = await generateSpeakingText();
    
    res.render('speaking-read-aloud', {
      title: 'Read Aloud Exercise',
      speakingText: speakingText
    });
  } catch (error) {
    console.error('Error generating speaking exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate speaking exercise',
      error: error
    });
  }
});

// Submit speaking response
router.post('/speaking/submit-read-aloud', async (req, res) => {
  const { speakingTextId, audioUrl } = req.body;
  
  try {
    // Find the speaking text by ID
    const SpeakingText = require('../models/SpeakingText');
    const speakingText = await SpeakingText.findByPk(speakingTextId);
    
    if (!speakingText) {
      return res.status(404).render('error', {
        message: 'Speaking text not found',
        error: { status: 404 }
      });
    }
    
    // In a real application, you would send the audio to a speech recognition service
    // For this demo, we'll simulate an evaluation
    const evaluation = simulateSpeakingEvaluation();
    
    // Determine feedback class based on evaluation
    const feedbackClass = evaluation.score >= 4 ? 'alert-success' : 
                         evaluation.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save response statistics
    const SpeakingResponse = require('../models/SpeakingResponse');
    await SpeakingResponse.create({
      speakingTextId: speakingText.id,
      audioUrl: audioUrl,
      pronunciation: evaluation.pronunciation,
      intonation: evaluation.intonation,
      fluency: evaluation.fluency,
      score: evaluation.score,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions
    });
    
    res.render('speaking-feedback', {
      title: 'Speaking Exercise Feedback',
      speakingText: speakingText,
      audioUrl: audioUrl,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions,
      score: evaluation.score,
      pronunciation: evaluation.pronunciation,
      intonation: evaluation.intonation,
      fluency: evaluation.fluency,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating speaking response:', error);
    const SpeakingText = require('../models/SpeakingText');
    res.render('speaking-feedback', {
      title: 'Speaking Exercise Feedback',
      speakingText: await SpeakingText.findByPk(speakingTextId),
      audioUrl: audioUrl,
      feedback: 'We encountered an error while evaluating your response. Please try again.',
      feedbackClass: 'alert-danger',
      score: 0,
      pronunciation: 0,
      intonation: 0,
      fluency: 0,
      suggestions: []
    });
  }
});

// Function to generate a speaking text using OpenAI
async function generateSpeakingText() {
  try {
    // Categories for speaking exercises
    const categories = [
      'advertisement',
      'announcement',
      'news',
      'tour',
      'traffic',
      'weather',
      'entertainment',
      'health',
      'housing',
      'shopping',
      'travel'
    ];
    
    // Select a random category for the prompt
    const promptCategory = categories[Math.floor(Math.random() * categories.length)];
    
    // Generate speaking text content using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate a short text for TOEIC speaking questions 1-2, where students must read a text aloud. The text should be written in common everyday language and deal with familiar topics."
        },
        {
          role: "user",
          content: `Generate a short text (approximately 100 words) for a TOEIC speaking exercise in the category: ${promptCategory}. The text should represent something that would normally be read aloud, such as an announcement, a radio or television advertisement, or the introduction of a speaker. Return the text as a JSON object with these fields: text (the text to read aloud), topic (short topic name), wordCount (number of words), category (the category of the text), difficulty (easy, medium, or hard).`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const textData = JSON.parse(response.choices[0].message.content);
    
    // Save the speaking text to the database
    const SpeakingText = require('../models/SpeakingText');
      
    // Ensure category is one of the allowed values
    const allowedCategories = ['advertisement', 'announcement', 'news', 'tour', 'traffic', 'weather', 'entertainment', 'health', 'housing', 'shopping', 'travel'];
    let category = textData.category.toLowerCase();
    
    // If category is not in allowed list, map it to a similar one or use 'announcement' as default
    if (!allowedCategories.includes(category)) {
      // Map common non-allowed categories to allowed ones
      const categoryMap = {
        'real estate': 'housing',
        'business': 'announcement',
        'education': 'announcement',
        'technology': 'news',
        'food': 'shopping',
        'restaurant': 'entertainment'
      };
      
      category = categoryMap[category.toLowerCase()] || 'announcement';
    }
    
    const speakingText = await SpeakingText.create({
      text: textData.text,
      topic: textData.topic,
      wordCount: textData.wordCount,
      category: category,
      difficulty: textData.difficulty || 'medium'
    });
    
    return speakingText;
    
    return speakingText;
  } catch (error) {
    console.error('Error generating speaking text:', error);
    // Return a fallback speaking text if API call fails
    const SpeakingText = require('../models/SpeakingText');
    return SpeakingText.create({
      text: "Welcome to our annual company conference. Today, we'll be discussing the latest developments in our industry and sharing strategies for growth in the coming year. Our keynote speaker, Dr. Jane Smith, will present her research on emerging market trends. Please silence your phones and enjoy the presentations.",
      topic: "Company Conference",
      wordCount: 47,
      category: "announcement",
      difficulty: "medium"
    });
  }
}

// Function to simulate speaking evaluation
// In a real application, this would be replaced with a call to a speech recognition API
function simulateSpeakingEvaluation() {
  // Generate random scores between 3 and 5 for a more positive experience
  const pronunciation = Math.floor(Math.random() * 3) + 3;
  const intonation = Math.floor(Math.random() * 3) + 3;
  const fluency = Math.floor(Math.random() * 3) + 3;
  
  // Calculate overall score (average of the three scores)
  const score = Math.round((pronunciation + intonation + fluency) / 3);
  
  // Generate feedback based on score
  let message = "";
  let suggestions = [];
  
  if (score >= 4) {
    message = "Excellent job! Your reading was clear and well-paced with good pronunciation and intonation.";
    suggestions = [
      "Continue practicing with more complex texts",
      "Work on maintaining consistent intonation throughout longer passages",
      "Practice emphasizing key words for even better clarity"
    ];
  } else if (score >= 3) {
    message = "Good job! Your reading was generally clear with some minor issues in pronunciation or pacing.";
    suggestions = [
      "Practice reading aloud daily to improve fluency",
      "Pay attention to sentence stress and intonation patterns",
      "Work on pronouncing challenging words more clearly"
    ];
  } else {
    message = "You've made a good start. With more practice, you can improve your clarity and fluency.";
    suggestions = [
      "Practice reading aloud slowly, focusing on clear pronunciation",
      "Record yourself and listen for areas to improve",
      "Work on proper pausing at punctuation marks",
      "Practice word stress patterns in English"
    ];
  }
  
  return {
    pronunciation,
    intonation,
    fluency,
    score,
    message,
    suggestions
  };
}

module.exports = router;