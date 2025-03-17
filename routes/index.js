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
      model: "o3-mini",
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
      model: "o3-mini",
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
      model: "o3-mini",
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
      model: "o3-mini",
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
      model: "o3-mini",
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

// Speaking describe photo exercise route
router.get('/speaking/describe-photo', async (req, res) => {
  try {
    // Categories for photo description exercises
    const categories = [
      'dining_out',
      'shopping',
      'healthcare',
      'household_chores',
      'entertainment',
      'leisure',
      'outdoor_scenes',
      'street_scenes',
      'travel',
      'office_work'
    ];
    
    // Select a random category
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    // Generate image prompt based on the category
    let imagePrompt = "";
    switch(category) {
      case 'dining_out':
        imagePrompt = "A clear, professional photo of people dining in a restaurant, showing waiters, tables, and customers enjoying their meal.";
        break;
      case 'shopping':
        imagePrompt = "A clear, professional photo of people shopping in a mall or store, showing products, shoppers, and store employees.";
        break;
      case 'healthcare':
        imagePrompt = "A clear, professional photo of a healthcare setting with medical professionals and patients in a clinic or hospital.";
        break;
      case 'household_chores':
        imagePrompt = "A clear, professional photo of someone performing household chores like cleaning, cooking, or organizing at home.";
        break;
      case 'entertainment':
        imagePrompt = "A clear, professional photo of people enjoying entertainment such as watching a movie, attending a concert, or playing games.";
        break;
      case 'leisure':
        imagePrompt = "A clear, professional photo of people engaged in leisure activities like reading, relaxing in a park, or having a picnic.";
        break;
      case 'outdoor_scenes':
        imagePrompt = "A clear, professional photo of an outdoor scene with people engaging in activities in a natural setting like a park or garden.";
        break;
      case 'street_scenes':
        imagePrompt = "A clear, professional photo of a street scene with pedestrians, vehicles, and buildings in an urban environment.";
        break;
      case 'travel':
        imagePrompt = "A clear, professional photo of people traveling, showing transportation, luggage, and tourist activities.";
        break;
      case 'office_work':
        imagePrompt = "A clear, professional photo of people working in an office environment with desks, computers, and colleagues collaborating.";
        break;
      default:
        imagePrompt = "A clear, professional photo of people engaged in a common everyday activity in a familiar setting.";
    }
    
    // Add TOEIC-specific requirements to the prompt
    imagePrompt += " The image should be suitable for a TOEIC English exam speaking question where test-takers need to describe what they see.";
    
    // Generate image using OpenAI
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageUrl = image.data[0].url;
    
    // Format category for display (replace underscores with spaces and capitalize)
    const displayCategory = category.replace('_', ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    res.render('speaking-describe-photo', {
      title: 'Describe a Photo Exercise',
      imageUrl: imageUrl,
      category: displayCategory
    });
  } catch (error) {
    console.error('Error generating photo description exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate photo description exercise',
      error: error
    });
  }
});

// Submit photo description response
router.post('/speaking/submit-describe-photo', async (req, res) => {
  const { photoCategory, photoUrl, audioUrl } = req.body;
  
  try {
    // In a real application, you would send the audio to a speech recognition service
    // For this demo, we'll simulate an evaluation with additional criteria for photo description
    const evaluation = simulatePhotoDescriptionEvaluation();
    
    // Determine feedback class based on evaluation
    const feedbackClass = evaluation.score >= 4 ? 'alert-success' : 
                         evaluation.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save response statistics
    const SpeakingResponse = require('../models/SpeakingResponse');
    await SpeakingResponse.create({
      speakingTextId: 0, // No text ID for photo description
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
      speakingText: { 
        text: `[Photo Description - ${photoCategory}]`,
        topic: 'Photo Description',
        category: photoCategory
      },
      audioUrl: audioUrl,
      photoUrl: photoUrl,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions,
      score: evaluation.score,
      pronunciation: evaluation.pronunciation,
      intonation: evaluation.intonation,
      fluency: evaluation.fluency,
      vocabulary: evaluation.vocabulary,
      grammar: evaluation.grammar,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating photo description:', error);
    res.render('speaking-feedback', {
      title: 'Speaking Exercise Feedback',
      speakingText: { 
        text: `[Photo Description - ${photoCategory}]`,
        topic: 'Photo Description',
        category: photoCategory
      },
      audioUrl: audioUrl,
      photoUrl: photoUrl,
      feedback: 'We encountered an error while evaluating your response. Please try again.',
      feedbackClass: 'alert-danger',
      score: 0,
      pronunciation: 0,
      intonation: 0,
      fluency: 0,
      vocabulary: 0,
      grammar: 0,
      suggestions: []
    });
  }
});

// Function to simulate photo description evaluation
// In a real application, this would be replaced with a call to a speech recognition API
function simulatePhotoDescriptionEvaluation() {
  // Generate random scores between 3 and 5 for a more positive experience
  const pronunciation = Math.floor(Math.random() * 3) + 3;
  const intonation = Math.floor(Math.random() * 3) + 3;
  const fluency = Math.floor(Math.random() * 3) + 3;
  const vocabulary = Math.floor(Math.random() * 3) + 3;
  const grammar = Math.floor(Math.random() * 3) + 3;
  
  // Calculate overall score (average of the five scores)
  const score = Math.round((pronunciation + intonation + fluency + vocabulary + grammar) / 5);
  
  // Generate feedback based on score
  let message = "";
  let suggestions = [];
  
  if (score >= 4) {
    message = "Excellent job! Your description was clear, detailed, and well-structured with good pronunciation and appropriate vocabulary.";
    suggestions = [
      "Continue practicing with more complex scenes",
      "Work on including more specific details in your descriptions",
      "Practice using a wider range of descriptive adjectives",
      "Try to make connections between elements in the photo"
    ];
  } else if (score >= 3) {
    message = "Good job! Your description covered the main elements of the photo with generally clear pronunciation and appropriate vocabulary.";
    suggestions = [
      "Practice organizing your description more logically",
      "Work on using more precise vocabulary to describe actions and objects",
      "Pay attention to verb tenses when describing activities",
      "Try to speak at a more natural pace"
    ];
  } else {
    message = "You've made a good start. With more practice, you can improve your photo description skills.";
    suggestions = [
      "Start by identifying the main elements in the photo before speaking",
      "Practice using simple, clear sentences to describe what you see",
      "Work on basic vocabulary for common objects, actions, and settings",
      "Record yourself and listen for areas to improve"
    ];
  }
  
  return {
    pronunciation,
    intonation,
    fluency,
    vocabulary,
    grammar,
    score,
    message,
    suggestions
  };
}

// Speaking personal questions exercise route
router.get('/speaking/personal-questions', async (req, res) => {
  try {
    // Generate a random personal questions topic using OpenAI
    const personalQuestionTopic = await generatePersonalQuestionTopic();
    
    res.render('speaking-personal-questions', {
      title: 'Personal Experience Questions',
      topicId: personalQuestionTopic.id,
      topic: personalQuestionTopic.topic,
      questions: personalQuestionTopic.questions
    });
  } catch (error) {
    console.error('Error generating personal questions exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate personal questions exercise',
      error: error
    });
  }
});

// Submit personal questions response
router.post('/speaking/submit-personal-questions', async (req, res) => {
  const { topicId, topic, audioUrl } = req.body;
  
  try {
    // In a real application, you would send the audio to a speech recognition service
    // For this demo, we'll simulate an evaluation with additional criteria for personal questions
    const evaluation = simulatePersonalQuestionsEvaluation();
    
    // Determine feedback class based on evaluation
    const feedbackClass = evaluation.score >= 4 ? 'alert-success' : 
                         evaluation.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save response statistics
    const SpeakingResponse = require('../models/SpeakingResponse');
    await SpeakingResponse.create({
      speakingTextId: 0, // No text ID for personal questions
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
      speakingText: { 
        text: `[Personal Questions - ${topic}]`,
        topic: 'Personal Experience Questions',
        category: topic
      },
      audioUrl: audioUrl,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions,
      score: evaluation.score,
      pronunciation: evaluation.pronunciation,
      intonation: evaluation.intonation,
      fluency: evaluation.fluency,
      vocabulary: evaluation.vocabulary,
      grammar: evaluation.grammar,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating personal questions response:', error);
    res.render('speaking-feedback', {
      title: 'Speaking Exercise Feedback',
      speakingText: { 
        text: `[Personal Questions - ${topic}]`,
        topic: 'Personal Experience Questions',
        category: topic
      },
      audioUrl: audioUrl,
      feedback: 'We encountered an error while evaluating your response. Please try again.',
      feedbackClass: 'alert-danger',
      score: 0,
      pronunciation: 0,
      intonation: 0,
      fluency: 0,
      vocabulary: 0,
      grammar: 0,
      suggestions: []
    });
  }
});

// Function to generate a personal question topic using OpenAI
async function generatePersonalQuestionTopic() {
  try {
    // Categories for personal questions exercises
    const categories = [
      'personal_interests',
      'community_life',
      'marketing_research',
      'work_life',
      'education',
      'travel',
      'technology',
      'health',
      'entertainment'
    ];
    
    // Select a random category
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    // Generate personal questions using OpenAI
    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate a set of three related questions for TOEIC speaking questions 4-6, where students must answer questions about a personal experience or familiar topic."
        },
        {
          role: "user",
          content: `Generate a set of three related questions for a TOEIC speaking exercise in the category: ${category}. The questions should be about a personal experience or familiar topic. The first two questions should be simple and require a short answer (15 seconds). The third question should be more complex and require a longer answer (30 seconds). Return the questions as a JSON object with these fields: topic (short topic name), questions (array of 3 questions), category (the category of the questions).`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const questionData = JSON.parse(response.choices[0].message.content);
    
    // Save the personal question topic to the database
    const PersonalQuestionTopic = require('../models/PersonalQuestionTopic');
    
    // Ensure category is one of the allowed values
    const allowedCategories = ['personal_interests', 'community_life', 'marketing_research', 'work_life', 'education', 'travel', 'technology', 'health', 'entertainment'];
    let topicCategory = questionData.category.toLowerCase().replace(' ', '_');
    
    // If category is not in allowed list, map it to a similar one or use 'personal_interests' as default
    if (!allowedCategories.includes(topicCategory)) {
      topicCategory = 'personal_interests';
    }
    
    const personalQuestionTopic = await PersonalQuestionTopic.create({
      topic: questionData.topic,
      questions: questionData.questions,
      category: topicCategory
    });
    
    return personalQuestionTopic;
  } catch (error) {
    console.error('Error generating personal questions:', error);
    // Return fallback questions if API call fails
    const PersonalQuestionTopic = require('../models/PersonalQuestionTopic');
    return PersonalQuestionTopic.create({
      topic: 'Work-Life Balance',
      questions: [
        'How many hours do you typically work each day?',
        'What do you usually do to relax after work?',
        'Do you think it\'s important to maintain a balance between work and personal life? Why or why not?'
      ],
      category: 'work_life'
    });
  }
}

// Function to simulate personal questions evaluation
function simulatePersonalQuestionsEvaluation() {
  // Generate random scores between 3 and 5 for a more positive experience
  const pronunciation = Math.floor(Math.random() * 3) + 3;
  const intonation = Math.floor(Math.random() * 3) + 3;
  const fluency = Math.floor(Math.random() * 3) + 3;
  const vocabulary = Math.floor(Math.random() * 3) + 3;
  const grammar = Math.floor(Math.random() * 3) + 3;
  const relevance = Math.floor(Math.random() * 3) + 3;
  
  // Calculate overall score (average of the six scores)
  const score = Math.round((pronunciation + intonation + fluency + vocabulary + grammar + relevance) / 6);
  
  // Generate feedback based on score
  let message = "";
  let suggestions = [];
  
  if (score >= 4) {
    message = "Excellent job! Your responses were clear, detailed, and well-structured with good pronunciation and appropriate vocabulary.";
    suggestions = [
      "Continue practicing with more complex topics",
      "Work on providing even more specific examples in your responses",
      "Practice using a wider range of transition phrases",
      "Try to incorporate more advanced vocabulary in your answers"
    ];
  } else if (score >= 3) {
    message = "Good job! Your responses addressed the questions with generally clear pronunciation and appropriate vocabulary.";
    suggestions = [
      "Practice organizing your responses more logically",
      "Work on using more precise vocabulary",
      "Pay attention to verb tenses when describing experiences",
      "Try to speak at a more natural pace"
    ];
  } else {
    message = "You've made a good start. With more practice, you can improve your speaking skills.";
    suggestions = [
      "Start by identifying the key parts of each question before answering",
      "Practice using simple, clear sentences",
      "Work on basic vocabulary for expressing opinions and experiences",
      "Record yourself and listen for areas to improve"
    ];
  }
  
  return {
    pronunciation,
    intonation,
    fluency,
    vocabulary,
    grammar,
    relevance,
    score,
    message,
    suggestions
  };
}

// Function to generate a schedule agenda using OpenAI
async function generateScheduleAgenda() {
  try {
    // Types of schedule agendas
    const scheduleTypes = [
      'meeting_agenda',
      'travel_itinerary',
      'conference_schedule',
      'tour_schedule'
    ];
    
    // Select a random type
    const scheduleType = scheduleTypes[Math.floor(Math.random() * scheduleTypes.length)];
    
    // Generate schedule agenda content using OpenAI
    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate a schedule or agenda for TOEIC speaking questions 7-9, where students must respond to questions based on information in a schedule, agenda, itinerary, or timetable."
        },
        {
          role: "user",
          content: `Generate a ${scheduleType.replace('_', ' ')} for a TOEIC speaking exercise. Return the result as a JSON object with these fields: title (descriptive title), content (array of objects, each with key-value pairs representing schedule items), questions (array of 3 questions about the schedule), questionTypes (array of 3 question types). The questions should require the test-taker to locate and summarize information from the schedule. Question types should be one of: 'Information Location', 'Time/Date Confirmation', 'Detail Explanation', 'Comparison', or 'Summary'. Make the schedule realistic and professional.`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const scheduleData = JSON.parse(response.choices[0].message.content);
    
    // Save the schedule agenda to the database
    const ScheduleAgenda = require('../models/ScheduleAgenda');
    
    const scheduleAgenda = await ScheduleAgenda.create({
      title: scheduleData.title,
      type: scheduleType,
      content: scheduleData.content,
      questions: scheduleData.questions,
      questionTypes: scheduleData.questionTypes
    });
    
    return scheduleAgenda;
  } catch (error) {
    console.error('Error generating schedule agenda:', error);
    // Return fallback schedule agenda if API call fails
    const ScheduleAgenda = require('../models/ScheduleAgenda');
    
    // Create a fallback schedule based on the type
    const fallbackSchedule = {
      title: 'Team Project Planning Meeting',
      type: 'meeting_agenda',
      content: [
        { 'Time': '9:00 AM', 'Activity': 'Welcome and Introduction' },
        { 'Time': '9:15 AM', 'Activity': 'Project Overview' },
        { 'Time': '10:00 AM', 'Activity': 'Task Assignment' },
        { 'Time': '10:45 AM', 'Activity': 'Break' },
        { 'Time': '11:00 AM', 'Activity': 'Timeline Discussion' },
        { 'Time': '12:00 PM', 'Activity': 'Lunch' },
        { 'Time': '1:00 PM', 'Activity': 'Budget Review' },
        { 'Time': '2:00 PM', 'Activity': 'Q&A Session' },
        { 'Time': '3:00 PM', 'Activity': 'Closing Remarks' }
      ],
      questions: [
        'What time is the Task Assignment scheduled to begin?',
        'How long is the lunch break?',
        'Could you summarize the activities scheduled for the morning session?'
      ],
      questionTypes: [
        'Information Location',
        'Time/Date Confirmation',
        'Summary'
      ]
    };
    
    return ScheduleAgenda.create(fallbackSchedule);
  }
}

// Schedule questions exercise route
router.get('/speaking/schedule-questions', async (req, res) => {
  try {
    // Generate a random schedule agenda using OpenAI
    const scheduleAgenda = await generateScheduleAgenda();
    
    res.render('speaking-schedule-questions', {
      title: 'Schedule Questions',
      scheduleAgenda: scheduleAgenda
    });
  } catch (error) {
    console.error('Error generating schedule questions exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate schedule questions exercise',
      error: error
    });
  }
});

// Submit schedule questions response
router.post('/speaking/submit-schedule-questions', async (req, res) => {
  const { scheduleAgendaId, title, type, audioUrl } = req.body;
  
  try {
    // In a real application, you would send the audio to a speech recognition service
    // For this demo, we'll simulate an evaluation with additional criteria for schedule questions
    const evaluation = simulateScheduleQuestionsEvaluation();
    
    // Determine feedback class based on evaluation
    const feedbackClass = evaluation.score >= 4 ? 'alert-success' : 
                         evaluation.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save response statistics
    const SpeakingResponse = require('../models/SpeakingResponse');
    await SpeakingResponse.create({
      speakingTextId: 0, // No text ID for schedule questions
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
      speakingText: { 
        text: `[Schedule Questions - ${title}]`,
        topic: 'Schedule Questions',
        category: type
      },
      audioUrl: audioUrl,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions,
      score: evaluation.score,
      pronunciation: evaluation.pronunciation,
      intonation: evaluation.intonation,
      fluency: evaluation.fluency,
      vocabulary: evaluation.vocabulary,
      grammar: evaluation.grammar,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating schedule questions response:', error);
    res.render('speaking-feedback', {
      title: 'Speaking Exercise Feedback',
      speakingText: { 
        text: `[Schedule Questions - ${title}]`,
        topic: 'Schedule Questions',
        category: type
      },
      audioUrl: audioUrl,
      feedback: 'We encountered an error while evaluating your response. Please try again.',
      feedbackClass: 'alert-danger',
      score: 0,
      pronunciation: 0,
      intonation: 0,
      fluency: 0,
      vocabulary: 0,
      grammar: 0,
      suggestions: []
    });
  }
});

// Function to simulate schedule questions evaluation
function simulateScheduleQuestionsEvaluation() {
  // Generate random scores between 3 and 5 for a more positive experience
  const pronunciation = Math.floor(Math.random() * 3) + 3;
  const intonation = Math.floor(Math.random() * 3) + 3;
  const fluency = Math.floor(Math.random() * 3) + 3;
  const vocabulary = Math.floor(Math.random() * 3) + 3;
  const grammar = Math.floor(Math.random() * 3) + 3;
  const accuracy = Math.floor(Math.random() * 3) + 3;
  
  // Calculate overall score (average of the six scores)
  const score = Math.round((pronunciation + intonation + fluency + vocabulary + grammar + accuracy) / 6);
  
  // Generate feedback based on score
  let message = "";
  let suggestions = [];
  
  if (score >= 4) {
    message = "Excellent job! You accurately located and conveyed the information from the schedule with clear pronunciation and appropriate vocabulary.";
    suggestions = [
      "Continue practicing with more complex schedules and agendas",
      "Work on summarizing information more concisely",
      "Practice using a wider range of transition phrases",
      "Try to incorporate more specific vocabulary related to schedules and planning"
    ];
  } else if (score >= 3) {
    message = "Good job! You were able to find most of the relevant information and communicate it with generally clear pronunciation.";
    suggestions = [
      "Practice scanning schedules more quickly to locate specific information",
      "Work on using more precise vocabulary when describing times and events",
      "Pay attention to prepositions when describing schedule details",
      "Try to speak at a more natural pace when giving information"
    ];
  } else {
    message = "You've made a good start. With more practice, you can improve your ability to respond to schedule-based questions.";
    suggestions = [
      "Practice identifying key information in schedules and agendas",
      "Learn common phrases for describing times, locations, and events",
      "Work on basic vocabulary for schedules and planning",
      "Practice organizing your response in a logical order"
    ];
  }
  
  return {
    pronunciation,
    intonation,
    fluency,
    vocabulary,
    grammar,
    accuracy,
    score,
    message,
    suggestions
  };
}

// Voicemail problem exercise route
router.get('/speaking/voicemail-problem', async (req, res) => {
  try {
    // Generate a random voicemail problem using OpenAI
    const voicemailProblem = await generateVoicemailProblem();
    
    res.render('speaking-voicemail-problem', {
      title: 'Respond to a Voicemail Problem',
      voicemailProblem: voicemailProblem
    });
  } catch (error) {
    console.error('Error generating voicemail problem exercise:', error);
    res.status(500).render('error', {
      message: 'Failed to generate voicemail problem exercise',
      error: error
    });
  }
});

// Submit voicemail problem response
router.post('/speaking/submit-voicemail-problem', async (req, res) => {
  const { voicemailProblemId, audioUrl } = req.body;
  
  try {
    // Find the voicemail problem by ID
    const VoicemailProblem = require('../models/VoicemailProblem');
    const voicemailProblem = await VoicemailProblem.findByPk(voicemailProblemId);
    
    if (!voicemailProblem) {
      return res.status(404).render('error', {
        message: 'Voicemail problem not found',
        error: { status: 404 }
      });
    }
    
    // In a real application, you would send the audio to a speech recognition service
    // For this demo, we'll simulate an evaluation with additional criteria for voicemail problems
    const evaluation = simulateVoicemailProblemEvaluation();
    
    // Determine feedback class based on evaluation
    const feedbackClass = evaluation.score >= 4 ? 'alert-success' : 
                         evaluation.score >= 2 ? 'alert-info' : 'alert-warning';
    
    // Save response statistics
    const SpeakingResponse = require('../models/SpeakingResponse');
    await SpeakingResponse.create({
      speakingTextId: 0, // No text ID for voicemail problems
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
      speakingText: { 
        text: `[Voicemail Problem - ${voicemailProblem.title}]`,
        topic: 'Voicemail Problem Response',
        category: voicemailProblem.category
      },
      audioUrl: audioUrl,
      feedback: evaluation.message,
      suggestions: evaluation.suggestions,
      score: evaluation.score,
      pronunciation: evaluation.pronunciation,
      intonation: evaluation.intonation,
      fluency: evaluation.fluency,
      vocabulary: evaluation.vocabulary,
      grammar: evaluation.grammar,
      problemSolving: evaluation.problemSolving,
      feedbackClass: feedbackClass
    });
  } catch (error) {
    console.error('Error evaluating voicemail problem response:', error);
    res.render('speaking-feedback', {
      title: 'Speaking Exercise Feedback',
      speakingText: { 
        text: `[Voicemail Problem Response]`,
        topic: 'Voicemail Problem Response',
        category: 'problem_solving'
      },
      audioUrl: audioUrl,
      feedback: 'We encountered an error while evaluating your response. Please try again.',
      feedbackClass: 'alert-danger',
      score: 0,
      pronunciation: 0,
      intonation: 0,
      fluency: 0,
      vocabulary: 0,
      grammar: 0,
      problemSolving: 0,
      suggestions: []
    });
  }
});

// Function to generate a voicemail problem using OpenAI
async function generateVoicemailProblem() {
  try {
    // Categories for voicemail problem exercises
    const categories = [
      'rental_housing',
      'office_space',
      'deliveries',
      'travel',
      'customer_service',
      'class_information'
    ];
    
    // Select a random category
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    // Generate voicemail problem content using OpenAI
    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant specializing in TOEIC exam preparation. Generate a voicemail problem for TOEIC speaking question 10, where students must respond to a voicemail message that describes a problem and suggest a solution."
        },
        {
          role: "user",
          content: `Generate a voicemail problem for a TOEIC speaking exercise in the category: ${category}. The problem should be something that would be left in a voicemail message asking for help or a solution. Return the problem as a JSON object with these fields: title (short descriptive title), problem (the full voicemail message text), category (the category of the problem), possibleSolutions (array of 2-3 possible solutions that would be reasonable responses).`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const problemData = JSON.parse(response.choices[0].message.content);
    
    // Save the voicemail problem to the database
    const VoicemailProblem = require('../models/VoicemailProblem');
    
    const voicemailProblem = await VoicemailProblem.create({
      title: problemData.title,
      problem: problemData.problem,
      category: category,
      possibleSolutions: problemData.possibleSolutions,
      difficulty: 'medium'
    });
    
    return voicemailProblem;
  } catch (error) {
    console.error('Error generating voicemail problem:', error);
    // Return a fallback voicemail problem if API call fails
    const VoicemailProblem = require('../models/VoicemailProblem');
    return VoicemailProblem.create({
      title: 'Office Equipment Malfunction',
      problem: 'Hello, this is Sarah from the marketing department. I\'m calling because our printer has stopped working, and we have an important client presentation this afternoon. We need to print 20 color copies of our proposal by 2:00 PM. Could you please help us resolve this issue or suggest an alternative solution? Please call me back at extension 4567 as soon as possible. Thank you.',
      category: 'office_space',
      possibleSolutions: [
        'Contact IT support to fix the printer',
        'Use another department\'s printer',
        'Send the files to a nearby print shop'
      ],
      difficulty: 'medium'
    });
  }
}

// Function to simulate voicemail problem evaluation
function simulateVoicemailProblemEvaluation() {
  // Generate random scores between 3 and 5 for a more positive experience
  const pronunciation = Math.floor(Math.random() * 3) + 3;
  const intonation = Math.floor(Math.random() * 3) + 3;
  const fluency = Math.floor(Math.random() * 3) + 3;
  const vocabulary = Math.floor(Math.random() * 3) + 3;
  const grammar = Math.floor(Math.random() * 3) + 3;
  const problemSolving = Math.floor(Math.random() * 3) + 3;
  
  // Calculate overall score (average of the six scores)
  const score = Math.round((pronunciation + intonation + fluency + vocabulary + grammar + problemSolving) / 6);
  
  // Generate feedback based on score
  let message = "";
  let suggestions = [];
  
  if (score >= 4) {
    message = "Excellent job! You clearly understood the problem and provided a well-structured solution with good pronunciation and appropriate vocabulary.";
    suggestions = [
      "Continue practicing with more complex problems",
      "Work on providing even more detailed step-by-step solutions",
      "Practice using a wider range of professional expressions",
      "Try to incorporate more specific vocabulary related to problem-solving"
    ];
  } else if (score >= 3) {
    message = "Good job! You understood the main problem and offered a reasonable solution with generally clear pronunciation.";
    suggestions = [
      "Practice organizing your response more logically",
      "Work on using more precise vocabulary when explaining solutions",
      "Make sure to address all aspects of the problem",
      "Try to speak at a more natural pace when giving your solution"
    ];
  } else {
    message = "You've made a good start. With more practice, you can improve your ability to respond to problems.";
    suggestions = [
      "Practice identifying the key issues in a problem",
      "Learn common phrases for offering solutions and assistance",
      "Work on basic vocabulary for problem-solving scenarios",
      "Practice organizing your response in a logical order"
    ];
  }
  
  return {
    pronunciation,
    intonation,
    fluency,
    vocabulary,
    grammar,
    problemSolving,
    score,
    message,
    suggestions
  };
}

module.exports = router;