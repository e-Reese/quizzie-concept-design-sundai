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
    renderQuestion(data, data.options, data.showResults, false);
    return data;
  } else if (quiz) {
    const data = await fetchJSON(`/api/display/${quiz}`);
    const currentQuestionIndex = parseInt(new URLSearchParams(location.search).get('question') || '0', 10);
    const currentQuestion = data.questions[currentQuestionIndex];

    if (currentQuestion) {
      // For quiz mode, we'll show one question at a time
      renderQuestion(
        currentQuestion,
        currentQuestion.options || [],
        currentQuestion.showResults || false,
        true, // isQuiz
        quiz,
        currentQuestionIndex,
        data.questions.length
      );
    } else {
      // If no question is found, show an error
      main.innerHTML = "<div class='error'>Question not found</div>";
      return;
    }

    // For quiz overview mode, show all questions
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

function renderQuestion(activationData, optionsData, showResults, isQuiz = false, quiz = null, currentQuestionIndex = 0, totalQuestions = 0) {
  if (!activationData) return;

  main.innerHTML = "";

  // Header with question text
  const header = document.createElement("div");
  const h = document.createElement("h2");
  h.textContent = isQuiz ? activationData.text : activationData.question.text;
  header.append(h);

  // Share panel (only for activations)
  if (!isQuiz) {
    const share = document.createElement("div");
    share.className = "share-panel";
    const qr = document.createElement("img");
    qr.className = "qr";
    const shareBaseInput = document.createElement("input");
    shareBaseInput.type = "text";
    shareBaseInput.placeholder = location.origin;
    shareBaseInput.value = (localStorage.getItem("quizzie_share_base") || location.origin);

    shareBaseInput.onchange = () => {
      const v = shareBaseInput.value.trim().replace(/\/$/, "");
      localStorage.setItem("quizzie_share_base", v);
      poll();
    };

    const updateQR = () => {
      const shareBase = shareBaseInput.value.trim().replace(/\/$/, "") || location.origin;
      const url = `${shareBase}/question.html?activation=${activation}`;
      qr.src = `/api/qr?url=${encodeURIComponent(url)}&format=svg`;
      urlText.textContent = url;
    };

    const urlText = document.createElement("div");
    urlText.className = "muted hint";
    share.append(qr, urlText);
    header.append(share);
    updateQR();
  }
  main.append(header);
  const options = document.createElement("div"); options.className = "options";
  const optionsToRender = optionsData || activationData.options || [];
  optionsToRender.forEach((o) => {
    const row = document.createElement("div"); row.className = "option-row";
    const circle = document.createElement("span"); circle.className = "circle"; circle.onclick = async () => { await fetchJSON(`/api/activations/${activation}/choose`, { method: "POST", body: JSON.stringify({ option: o.option, user: USER_ID }) }); document.querySelectorAll('.option-row').forEach(el => el.classList.remove('selected')); row.classList.add('selected'); poll(); };
    const l = document.createElement("span"); l.textContent = o.letter;
    const t = document.createElement("span"); t.textContent = o.label;
    const showResultsToUse = showResults !== undefined ? showResults : activationData.showResults;
    const c = document.createElement("span"); c.className = "muted"; c.textContent = showResultsToUse ? `${o.count}/${o.total}` : "";
    row.append(circle, l, t, c); options.append(row);
  });

  main.append(options);

  // Navigation across questions of the same quiz
  if (activationData.quiz) {
    const nav = document.createElement("div"); nav.style.display = "flex"; nav.style.gap = "8px"; nav.style.marginTop = "12px";
    const prev = document.createElement("button"); prev.className = "btn"; prev.textContent = "Prev";
    const next = document.createElement("button"); next.className = "btn"; next.textContent = "Next";
    prev.onclick = () => navigateSibling(activationData.quiz, activationData.question.question, -1, !!showResultsToUse);
    next.onclick = () => navigateSibling(activationData.quiz, activationData.question.question, 1, !!showResultsToUse);
    nav.append(prev, next); main.append(nav);
  }
}

async function navigateSibling(quizId, currentQuestionId, delta, shouldShowResults) {
  const data = await fetchJSON(`/api/display/${quizId}`);
  const idx = data.questions.findIndex(q => q.question === currentQuestionId);
  if (idx === -1) return;

  // Get the next question in the quiz
  const target = data.questions[(idx + data.questions.length + delta) % data.questions.length];
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

async function navigateToQuestion(quizId, questionIndex) {
  // Update URL without page reload
  const url = new URL(location.href);
  url.searchParams.set('question', questionIndex);
  window.history.pushState({}, '', url);

  // Refresh the display
  await poll();
}

async function poll() {
  try {
    await loadQuestionData();
  } catch (error) {
    console.error("Error polling:", error);
  }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  poll();
});

async function load() {
  await poll();
}

load();