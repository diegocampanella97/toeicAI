// JavaScript for TOEIC Listening Exercises

document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const startListeningBtn = document.getElementById('start-listening-btn');
  const audioContainer = document.getElementById('audio-container');
  const audioPlayer = document.getElementById('audio-player');
  const choicesContainer = document.getElementById('choices-container');
  const controlButtons = document.getElementById('control-buttons');
  const choiceItems = document.querySelectorAll('.choice-item');
  const selectedChoiceInput = document.getElementById('selected-choice');
  const submitAnswerBtn = document.getElementById('submit-answer-btn');
  
  // Start listening button click handler
  if (startListeningBtn) {
    startListeningBtn.addEventListener('click', function() {
      // Show audio player
      audioContainer.classList.remove('d-none');
      // Hide control buttons
      controlButtons.classList.add('d-none');
      
      // Play audio
      audioPlayer.play();
      
      // When audio ends, show choices
      audioPlayer.addEventListener('ended', function() {
        choicesContainer.classList.remove('d-none');
      });
    });
  }
  
  // Choice selection handler
  if (choiceItems.length > 0) {
    choiceItems.forEach(item => {
      item.addEventListener('click', function() {
        // Remove selected class from all choices
        choiceItems.forEach(choice => choice.classList.remove('selected'));
        
        // Add selected class to clicked choice
        this.classList.add('selected');
        
        // Set the selected choice value in the hidden input
        selectedChoiceInput.value = this.dataset.value;
        
        // Enable submit button
        submitAnswerBtn.disabled = false;
      });
    });
  }
});