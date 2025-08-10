async function fetchJSON(url, options) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const params = new URLSearchParams(location.search);
const quiz = params.get("quiz");

async function load() {
  const data = await fetchJSON(`/api/quizzes/${quiz}`);
  const main = document.getElementById("main");
  main.innerHTML = "";

  const title = document.createElement("div"); title.textContent = data.title; title.className = "muted";
  main.append(title);

  // Quiz-level controls: activate/deactivate and show/hide
  const aKey = `activation_quiz_${quiz}`;
  const getActivation = () => localStorage.getItem(aKey);
  const setActivation = (id) => localStorage.setItem(aKey, id);
  const clearActivation = () => localStorage.removeItem(aKey);

  const controls = document.createElement("div");
  const toggleActivate = document.createElement("button"); toggleActivate.className = "btn";
  const toggleShow = document.createElement("button"); toggleShow.className = "btn";
  const openDisplay = document.createElement("button"); openDisplay.className = "btn"; openDisplay.textContent = "overview"; openDisplay.onclick = () => globalThis.open(`/question.html?quiz=${quiz}`, "_blank");
  async function syncButtons() {
    const act = getActivation();
    toggleActivate.textContent = act ? "deactivate" : "activate";
    if (!act) {
      toggleShow.textContent = "show";
      toggleShow.disabled = true;
      return;
    }
    try {
      const info = await fetchJSON(`/api/activations/${act}`);
      toggleShow.textContent = info.showResults ? "hide" : "show";
      toggleShow.disabled = false;
    } catch (_) {
      // activation might have been cleared server-side
      clearActivation();
      toggleShow.textContent = "show";
      toggleShow.disabled = true;
    }
  }
  toggleActivate.onclick = async () => {
    const act = getActivation();
    if (act) {
      await fetchJSON(`/api/activations/${act}/deactivate`, { method: "POST" });
      clearActivation();
    } else {
      const first = data.questions[0];
      if (!first) return;
      const resp = await fetchJSON(`/api/questions/${first.question}/activate`, { method: "POST" });
      const id = (resp && (resp.activation?.activation || resp.activation || resp.id || resp.Activation || resp.Activate)) || null;
      if (id) setActivation(String(id));
    }
    await syncButtons();
  };
  toggleShow.onclick = async () => {
    const act = getActivation();
    if (!act) return;
    const info = await fetchJSON(`/api/activations/${act}`);
    if (info.showResults) {
      await fetchJSON(`/api/activations/${act}/hide`, { method: "POST" });
    } else {
      await fetchJSON(`/api/activations/${act}/show`, { method: "POST" });
      globalThis.open(`/question.html?activation=${act}`, "_blank");
    }
    await syncButtons();
  };
  controls.append(toggleActivate, toggleShow, openDisplay);
  main.append(controls);

  data.questions.forEach((q) => {
    const row = document.createElement("div"); row.className = "question";
    const del = document.createElement("span"); del.textContent = "🗑️"; del.onclick = async () => { await fetchJSON(`/api/questions/${q.question}`, { method: "DELETE" }); load(); };
    const input = document.createElement("input"); input.type = "text"; input.value = q.text; input.className = "text"; input.onchange = async () => { await fetchJSON(`/api/questions/${q.question}`, { method: "PATCH", body: JSON.stringify({ text: input.value }) }); };
    row.append(del, input);

    // Add correct answer label
    const correctAnswerLabel = document.createElement("div");
    correctAnswerLabel.className = "correct-answer-label";
    correctAnswerLabel.textContent = "Select correct answer:";
    row.append(correctAnswerLabel);

    // Create a container for options with radio buttons
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "options";
    row.append(optionsContainer);

    // Create a unique name for the radio button group for this question
    const radioGroupName = `correct-answer-${q.question}`;

    q.options.forEach((o) => {
      const orow = document.createElement("div");
      orow.className = "option-row";

      // Add delete button
      const odel = document.createElement("span");
      odel.textContent = "🗑️";
      odel.onclick = async () => {
        await fetchJSON(`/api/options/${o.option}`, { method: "DELETE" });
        load();
      };

      // Add radio button for correct answer selection
      const radioContainer = document.createElement("span");
      radioContainer.className = "radio-container";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = radioGroupName;
      radio.value = o.option;
      radio.id = `opt-${o.option}`;
      radio.checked = o.isCorrect;
      radio.onchange = async () => {
        if (radio.checked) {
          await fetchJSON(`/api/questions/${q.question}/correct`, {
            method: "POST",
            body: JSON.stringify({ option: o.option })
          });
          // No need to reload the entire page, just update the visual state
          optionsContainer.querySelectorAll('.option-row').forEach(row => {
            row.classList.remove('correct');
          });
          orow.classList.add('correct');
        }
      };
      radioContainer.append(radio);

      // Add letter indicator (A, B, C, etc.)
      const letter = document.createElement("span");
      letter.textContent = String.fromCharCode(65 + q.options.indexOf(o)); // A, B, C, etc.

      // Add option text input
      const i = document.createElement("input");
      i.type = "text";
      i.value = o.label;
      i.onchange = async () => {
        await fetchJSON(`/api/options/${o.option}`, {
          method: "PATCH",
          body: JSON.stringify({ label: i.value })
        });
      };

      // If this option is the correct answer, highlight it
      if (o.isCorrect) {
        orow.classList.add('correct');
      }

      orow.append(odel, radioContainer, letter, i);
      optionsContainer.append(orow);
    });

    // Add option button
    const addOpt = document.createElement("div");
    addOpt.className = "option-row";
    const plus = document.createElement("span");
    plus.textContent = "➕";
    const i2 = document.createElement("input");
    i2.type = "text";
    i2.placeholder = "enter text of new option";
    plus.onclick = async () => {
      const label = i2.value.trim();
      if (!label) return;
      await fetchJSON(`/api/questions/${q.question}/options`, {
        method: "POST",
        body: JSON.stringify({ label })
      });
      i2.value = "";
      load();
    };
    addOpt.append(plus, i2);
    row.append(addOpt);

    // Add "Remove correct answer" button
    const removeCorrectBtn = document.createElement("button");
    removeCorrectBtn.className = "btn remove-correct";
    removeCorrectBtn.textContent = "Remove correct answer";
    removeCorrectBtn.onclick = async () => {
      await fetchJSON(`/api/questions/${q.question}/correct`, { method: "DELETE" });
      optionsContainer.querySelectorAll('.option-row').forEach(row => {
        row.classList.remove('correct');
      });
      optionsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.checked = false;
      });
    };
    row.append(removeCorrectBtn);

    main.append(row);
  });

  const addQ = document.createElement("div");
  addQ.className = "question-row";
  const plus = document.createElement("span");
  plus.textContent = "➕";
  const qinput = document.createElement("input");
  qinput.type = "text";
  qinput.placeholder = "enter text of new question";
  plus.onclick = async () => {
    const text = qinput.value.trim();
    if (!text) return;
    await fetchJSON(`/api/quizzes/${quiz}/questions`, {
      method: "POST",
      body: JSON.stringify({ text })
    });
    qinput.value = "";
    load();
  };
  addQ.append(plus, qinput);
  main.append(addQ);
  await syncButtons();
}

load();