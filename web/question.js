async function fetchJSON(url, options) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const params = new URLSearchParams(location.search);
const activation = params.get("activation");
const quiz = params.get("quiz");

const USER_ID = localStorage.getItem("quizzie_user") || (localStorage.setItem("quizzie_user", crypto.randomUUID()), localStorage.getItem("quizzie_user"));

const main = document.getElementById("main");

function _makeOptionRow(letter, label, option, countText) {
  const row = document.createElement("div"); row.className = "option-row";
  const circle = document.createElement("span"); circle.className = "circle"; circle.onclick = async () => { await fetchJSON(`/api/activations/${activation}/choose`, { method: "POST", body: JSON.stringify({ option, user: USER_ID }) }); poll(); };
  const l = document.createElement("span"); l.textContent = letter;
  const t = document.createElement("span"); t.textContent = label;
  const c = document.createElement("span"); c.className = "muted"; c.textContent = countText || "";
  row.append(circle, l, t, c); return row;
}

async function poll() {
  if (activation) {
    const data = await fetchJSON(`/api/activations/${activation}`);
    renderQuestion(data, data.options, data.showResults, false);
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
    }
  }
}

function renderQuestion(questionData, optionsData, showResults, isQuiz = false, quizId = null, currentQuestionIndex = 0, totalQuestions = 0) {
  main.innerHTML = "";

  // Header with question text
  const header = document.createElement("div");
  const h = document.createElement("h2");
  h.textContent = isQuiz ? questionData.text : questionData.question.text;
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

  // Options
  const options = document.createElement("div");
  options.className = "options";

  optionsData.forEach((o, index) => {
    const row = document.createElement("div");
    row.className = "option-row";

    const circle = document.createElement("span");
    circle.className = "circle";
    circle.onclick = async () => {
      if (isQuiz) {
        // For quiz mode, use the quiz answer endpoint
        await fetchJSON(`/api/quizzes/${quizId}/questions/${currentQuestionIndex}/answer`, {
          method: "POST",
          body: JSON.stringify({
            option: o.option,
            user: USER_ID
          })
        });
      } else {
        // For activation mode, use the activation choose endpoint
        await fetchJSON(`/api/activations/${activation}/choose`, {
          method: "POST",
          body: JSON.stringify({
            option: o.option,
            user: USER_ID
          })
        });
      }

      // Update UI to show selection
      document.querySelectorAll('.option-row').forEach(el => el.classList.remove('selected'));
      row.classList.add('selected');
      poll();
    };

    const l = document.createElement("span");
    l.textContent = o.letter || String.fromCharCode(65 + index); // Fallback to A, B, C... if no letter

    const t = document.createElement("span");
    t.textContent = o.label;

    const c = document.createElement("span");
    c.className = "muted";
    c.textContent = showResults ? `${o.count || 0}/${o.total || 0}` : "";

    row.append(circle, l, t, c);
    options.append(row);
  });

  main.append(options);

  // Navigation
  const nav = document.createElement("div");
  nav.style.display = "flex";
  nav.style.gap = "8px";
  nav.style.marginTop = "12px";

  if (isQuiz) {
    // Quiz navigation (next/prev within a quiz with loop)
    const prev = document.createElement("button");
    prev.className = "btn";
    prev.textContent = "Previous";

    const next = document.createElement("button");
    next.className = "btn";
    next.textContent = "Next";

    // Loop navigation - goes to last question when clicking previous on first question
    // and to first question when clicking next on last question
    prev.onclick = () => {
      const newIndex = (currentQuestionIndex - 1 + totalQuestions) % totalQuestions;
      navigateToQuestion(quizId, newIndex);
    };
    
    next.onclick = () => {
      const newIndex = (currentQuestionIndex + 1) % totalQuestions;
      navigateToQuestion(quizId, newIndex);
    };

    const progress = document.createElement("div");
    progress.className = "quiz-progress";
    progress.textContent = `Question ${currentQuestionIndex + 1} of ${totalQuestions}`;

    nav.append(prev, progress, next);
  } else if (questionData.quiz) {
    // Activation navigation (next/prev within a quiz activation)
    const prev = document.createElement("button");
    prev.className = "btn";
    prev.textContent = "Previous";

    const next = document.createElement("button");
    next.className = "btn";
    next.textContent = "Next";

    prev.onclick = () => navigateSibling(questionData.quiz, questionData.question.question, -1, !!showResults);
    next.onclick = () => navigateSibling(questionData.quiz, questionData.question.question, 1, !!showResults);

    nav.append(prev, next);
  }

  if (nav.children.length > 0) {
    main.append(nav);
  }
}

async function navigateSibling(quizId, currentQuestionId, delta, shouldShowResults) {
  const data = await fetchJSON(`/api/display/${quizId}`);
  const idx = data.questions.findIndex(q => q.question === currentQuestionId);
  if (idx === -1) return;
  const target = data.questions[(idx + data.questions.length + delta) % data.questions.length];
  let actId = target.activation;
  if (!actId) {
    // auto-activate target question so it can accept votes
    const resp = await fetchJSON(`/api/questions/${target.question}/activate`, { method: "POST" });
    actId = (resp && (resp.activation?.activation || resp.activation || resp.id || resp.Activation || resp.Activate)) || undefined;
  }
  if (!actId) return;
  if (shouldShowResults) {
    await fetchJSON(`/api/activations/${actId}/show`, { method: "POST" });
  }
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

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  poll();
});

async function load() {
  await poll();

  // Auto-poll for updates every 5 seconds
  setInterval(poll, 5000);
}

load();


