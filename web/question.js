async function fetchJSON(url, options) {
  console.log(`[DEBUG API] Fetching: ${url}`, options);
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DEBUG API] Error response: ${errorText}`);
    throw new Error(errorText);
  }
  const data = await res.json();
  console.log(`[DEBUG API] Response:`, data);
  return data;
}

const params = new URLSearchParams(location.search);
const activation = params.get("activation");
const quiz = params.get("quiz");

const USER_ID = localStorage.getItem("quizzie_user") || (localStorage.setItem("quizzie_user", crypto.randomUUID()), localStorage.getItem("quizzie_user"));

const main = document.getElementById("main");

// Track if the user has submitted an answer for the current question
let userHasSubmitted = false;
// Track if feedback is currently being shown
let showingFeedback = false;
// Track the currently selected option
let selectedOption = null;
// Store the current question data
let currentQuestionData = null;
// Store the quiz data
let quizData = null;

function _makeOptionRow(letter, label, option) {
  const row = document.createElement("div"); row.className = "option-row";
  const circle = document.createElement("span"); circle.className = "circle";
  circle.onclick = () => {
    selectedOption = option;
    userHasSubmitted = true;
    showingFeedback = false;
    document.querySelectorAll('.option-row').forEach(el => el.classList.remove('selected'));
    row.classList.add('selected');
    renderQuestion(currentQuestionData);
  };
  const l = document.createElement("span"); l.textContent = letter;
  const t = document.createElement("span"); t.textContent = label;

  row.append(circle, l, t);
  return row;
}

async function loadQuestionData() {
  if (activation) {
    console.log("[DEBUG] Loading question data for ID:", activation);
    console.log("[DEBUG] User ID:", USER_ID);
    const data = await fetchJSON(`/api/activations/${activation}?user=${USER_ID}`);
    console.log("[DEBUG] Received question data:", data);
    currentQuestionData = data;
    renderQuestion(data);
    return data;
  } else if (quiz) {
    const data = await fetchJSON(`/api/display/${quiz}`);
    main.innerHTML = "";
    const title = document.createElement("h2"); title.textContent = data.title; main.append(title);
    for (const q of data.questions) {
      const section = document.createElement("div"); section.className = "question";
      const h = document.createElement("div"); h.className = "text"; h.textContent = q.text; section.append(h);
      const list = document.createElement("div"); list.className = "options";
      q.options.forEach((o) => {
        const row = document.createElement("div"); row.className = "option-row";

        // Apply styling based on correctness if the user has selected this option
        if (o.isUserSelection && q.userVote && showingFeedback) {
          if (o.isCorrect) {
            row.classList.add("correct");
          } else {
            row.classList.add("incorrect");
          }
        }
        // Highlight the correct answer if the user has submitted an answer
        else if (q.userVote && o.isCorrect && showingFeedback) {
          row.classList.add("correct");
        }

        const circle = document.createElement("span");
        circle.className = "circle";
        circle.onclick = async () => {
          if (q.activation) {
            await fetchJSON(`/api/activations/${q.activation}/choose`, {
              method: "POST",
              body: JSON.stringify({ option: o.option, user: USER_ID })
            });
            userHasSubmitted = true;
            poll();
          }
        };

        const l = document.createElement("span"); l.textContent = o.letter;
        const t = document.createElement("span"); t.textContent = o.label;

        // Add feedback icon if user has submitted an answer and feedback is shown
        if (o.isUserSelection && q.userVote && showingFeedback) {
          const feedback = document.createElement("span");
          feedback.className = "feedback-icon";
          feedback.textContent = o.isCorrect ? "✓" : "✗";
          row.append(circle, l, t, feedback);
        } else {
          row.append(circle, l, t);
        }

        list.append(row);
      });
      section.append(list); main.append(section);
    }
  }
}

function renderQuestion(activationData) {
  if (!activationData) return;

  const optionsData = activationData.options;
  const showResults = activationData.showResults;
  main.innerHTML = "";
  const header = document.createElement("div");
  const h = document.createElement("h2"); h.textContent = activationData.question.text; header.append(h);
  // Right-aligned share panel with QR + base + URL
  const share = document.createElement("div"); share.className = "share-panel";
  const qr = document.createElement("img"); qr.className = "qr";
  const shareBaseInput = document.createElement("input"); shareBaseInput.type = "text"; shareBaseInput.placeholder = location.origin; shareBaseInput.value = (localStorage.getItem("quizzie_share_base") || location.origin);
  shareBaseInput.onchange = () => { const v = shareBaseInput.value.trim().replace(/\/$/, ""); localStorage.setItem("quizzie_share_base", v); poll(); };
  const updateQR = () => {
    const shareBase = location.origin.replace(/\/$/, "");
    const url = `${shareBase}/question.html?activation=${activation}`;
    qr.src = `/api/qr?url=${encodeURIComponent(url)}&format=svg`;
    urlText.textContent = url;
  };

  const urlText = document.createElement("div");
  urlText.className = "muted hint";
  share.append(qr, urlText);
  header.append(share);
  updateQR();
  main.append(header);

  const options = document.createElement("div"); options.className = "options";
  optionsData.forEach((o) => {
    const row = document.createElement("div");
    row.className = "option-row";

    // Apply styling based on correctness if the user has submitted an answer and feedback is shown
    if (showingFeedback && selectedOption) {
      console.log("[DEBUG] Applying feedback styling for option:", o.option);
      console.log("[DEBUG] Selected option:", selectedOption);
      console.log("[DEBUG] Option is correct:", o.isCorrect);

      const isSelected = o.option === selectedOption;

      if (isSelected) {
        // If user selected this option
        if (o.isCorrect) {
          // Correct answer selected by user
          console.log("[DEBUG] User selected correct answer");
          row.classList.add("correct");
        } else {
          // Incorrect answer selected by user
          console.log("[DEBUG] User selected incorrect answer");
          row.classList.add("incorrect");
        }
        row.classList.add("selected");
      } else if (o.isCorrect) {
        // This is the correct answer but user didn't select it
        console.log("[DEBUG] Highlighting correct answer not selected by user");
        row.classList.add("correct");
      }
    } else if (o.option === selectedOption) {
      // Just show selection without correctness feedback
      console.log("[DEBUG] Showing Selection without correctness");
      row.classList.add("selected");
    }

    const circle = document.createElement("span");
    circle.className = "circle";
    circle.onclick = () => {
      selectedOption = o.option;
      document.querySelectorAll('.option-row').forEach(el => el.classList.remove('selected'));
      row.classList.add('selected');
      userHasSubmitted = true;
      showingFeedback = false; // Reset feedback state when a new answer is selected
      renderQuestion(currentQuestionData);
    };

    const l = document.createElement("span"); l.textContent = o.letter;
    const t = document.createElement("span"); t.textContent = o.label;

    // Add feedback icon if user has submitted an answer and feedback is shown
    if (selectedOption === o.option && showingFeedback) {
      const feedback = document.createElement("span");
      feedback.className = "feedback-icon";
      feedback.textContent = o.isCorrect ? "✓" : "✗";
      row.append(circle, l, t, feedback);
    } else {
      row.append(circle, l, t);
    }

    options.append(row);
  });
  main.append(options);

  // Add feedback message if user has submitted an answer and feedback is shown
  if (selectedOption && showingFeedback) {
    console.log("[DEBUG] Adding feedback message");
    console.log("[DEBUG] Selected option:", selectedOption);
    console.log("[DEBUG] Options data:", optionsData);

    const userOption = optionsData.find(o => o.option === selectedOption);
    console.log("[DEBUG] User selected option:", userOption);

    if (userOption) {
      const feedbackMsg = document.createElement("div");
      feedbackMsg.className = "feedback-message";

      if (userOption.isCorrect) {
        console.log("[DEBUG] User's answer is correct");
        feedbackMsg.textContent = "Correct! Well done!";
        feedbackMsg.classList.add("correct-message");
      } else {
        console.log("[DEBUG] User's answer is incorrect");
        const correctOption = optionsData.find(o => o.isCorrect);
        console.log("[DEBUG] Correct option:", correctOption);
        feedbackMsg.textContent = `Incorrect. The correct answer is ${correctOption ? correctOption.letter + ': ' + correctOption.label : 'not available'}.`;
        feedbackMsg.classList.add("incorrect-message");
      }

      main.append(feedbackMsg);
    }
  }

  // Navigation and action buttons
  if (activationData.quiz) {
    const nav = document.createElement("div");
    nav.className = "navigation-buttons";

    // Check Answer button (only visible when user has submitted an answer and feedback is not shown)
    const checkAnswerBtn = document.createElement("button");
    checkAnswerBtn.className = "btn primary";
    checkAnswerBtn.textContent = "Check Answer";
    checkAnswerBtn.style.display = userHasSubmitted && !showingFeedback ? "block" : "none";
    checkAnswerBtn.onclick = async () => {
      console.log("[DEBUG] Check Answer button clicked");
      console.log("[DEBUG] User has submitted answer:", userHasSubmitted);
      console.log("[DEBUG] Selected option:", selectedOption);

      if (selectedOption) {
        try {
          // Direct evaluation of the selected answer against the correct answer
          const evaluationResult = await fetchJSON(`/api/questions/${activationData.question.question}/evaluate`, {
            method: "POST",
            body: JSON.stringify({ option: selectedOption })
          });
          console.log("[DEBUG] Evaluation result:", evaluationResult);

          // Update the current question data with the evaluation result
          if (evaluationResult && typeof evaluationResult.isCorrect === 'boolean') {
            // Update the option in the current data
            currentQuestionData.options.forEach(o => {
              if (o.option === selectedOption) {
                o.isCorrect = evaluationResult.isCorrect;
              }
            });
          }
        } catch (error) {
          console.error("[DEBUG] Error evaluating answer:", error);
        }
      }

      showingFeedback = true;
      renderQuestion(currentQuestionData);
    };

    // Next button
    const next = document.createElement("button");
    next.className = "btn primary";
    next.textContent = "Next";

    // If user has submitted but not seen feedback, next button shows feedback first
    if (userHasSubmitted && !showingFeedback) {
      next.textContent = "Check & Next";
      next.onclick = async () => {
        // First check the answer
        if (selectedOption) {
          try {
            const evaluationResult = await fetchJSON(`/api/questions/${activationData.question.question}/evaluate`, {
              method: "POST",
              body: JSON.stringify({ option: selectedOption })
            });
            console.log("[DEBUG] Evaluation result from Next button:", evaluationResult);

            // Update the current question data with the evaluation result
            if (evaluationResult && typeof evaluationResult.isCorrect === 'boolean') {
              // Update the option in the current data
              currentQuestionData.options.forEach(o => {
                if (o.option === selectedOption) {
                  o.isCorrect = evaluationResult.isCorrect;
                }
              });
            }
          } catch (error) {
            console.error("[DEBUG] Error evaluating answer from Next button:", error);
          }
        }

        showingFeedback = true;
        renderQuestion(currentQuestionData);

        // After a short delay, navigate to the next question
        setTimeout(() => {
          navigateSibling(activationData.quiz, activationData.question.question, 1, !!showResults, true); // Always show correct answers
        }, 1500);
      };
    } else {
      // Regular next button behavior
      next.onclick = () => navigateSibling(activationData.quiz, activationData.question.question, 1, !!showResults, true); // Always show correct answers
    }

    // Add check answer button if applicable
    if (userHasSubmitted && !showingFeedback) {
      nav.append(checkAnswerBtn);
    }

    nav.append(next);
    main.append(nav);
  }
}

async function navigateSibling(quizId, currentQuestionId, delta, shouldShowResults, shouldShowCorrectAnswer) {
  // If we don't have the quiz data yet, fetch it
  if (!quizData) {
    quizData = await fetchJSON(`/api/display/${quizId}`);
  }

  const idx = quizData.questions.findIndex(q => q.question === currentQuestionId);
  if (idx === -1) return;

  // Get the next question in the quiz
  const target = quizData.questions[(idx + quizData.questions.length + delta) % quizData.questions.length];
  let actId = target.activation;

  if (!actId) {
    // auto-activate target question so it can accept votes
    const resp = await fetchJSON(`/api/questions/${target.question}/activate`, { method: "POST" });
    actId = (resp && (resp.activation?.activation || resp.activation || resp.id || resp.Activation || resp.Activate)) || undefined;
  }

  if (!actId) return;

  // Reset state for the new question
  selectedOption = null;
  userHasSubmitted = false;
  showingFeedback = false;

  // Navigate to the new question
  location.href = `/question.html?activation=${actId}`;
}

async function load() {
  await loadQuestionData();
}

load();