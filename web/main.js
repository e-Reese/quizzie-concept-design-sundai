async function fetchJSON(url, options) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function load() {
  const main = document.getElementById("main");
  main.innerHTML = "";
  const quizzes = await fetchJSON("/api/quizzes");
  for (const q of (quizzes || [])) {
    const row = document.createElement("div");
    row.className = "quiz-row";
    
    // Delete button
    const del = document.createElement("span");
    del.className = "trash"; 
    del.textContent = "🗑️";
    del.onclick = async () => { 
      await fetchJSON(`/api/quizzes/${q.quiz}`, { method: "DELETE" }); 
      load(); 
    };
    
    // Quiz title (plain text)
    const titleSpan = document.createElement("span");
    titleSpan.textContent = q.title;
    titleSpan.style.flexGrow = "1";
    
    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "btn small";
    editBtn.textContent = "Edit";
    editBtn.style.marginLeft = "10px";
    editBtn.onclick = () => {
      window.location.href = `/quiz.html?quiz=${q.quiz}`;
    };
    
    // Show button
    const showBtn = document.createElement("button");
    showBtn.className = "btn small";
    showBtn.textContent = "Show";
    
    // Check activation status
    const aKey = `activation_quiz_${q.quiz}`;
    const getActivation = () => localStorage.getItem(aKey);
    const setActivation = (id) => localStorage.setItem(aKey, id);
    const clearActivation = () => localStorage.removeItem(aKey);
    
    async function updateShowButton() {
      const act = getActivation();
      showBtn.disabled = !act; // Disable if not activated
    }
    
    showBtn.onclick = async () => {
      const act = getActivation();
      if (!act) return;
      // Always show the results and open in a new tab
      await fetchJSON(`/api/activations/${act}/show`, { method: "POST" });
      globalThis.open(`/question.html?activation=${act}`, "_blank");
    };
    
    // Initial button state
    await updateShowButton();
    
    row.append(del, titleSpan, editBtn, showBtn);
    main.append(row);
  }

  const addRow = document.createElement("div"); addRow.className = "quiz-row";
  const plus = document.createElement("button"); plus.className = "btn"; plus.textContent = "+";
  const input = document.createElement("input"); input.type = "text"; input.placeholder = "enter name of new quiz";
  const add = async () => {
    const title = input.value.trim();
    if (!title) return;
    await fetchJSON("/api/quizzes", { method: "POST", body: JSON.stringify({ title }) });
    input.value = "";
    load();
  };
  plus.onclick = add;
  input.onkeydown = (e) => { if (e.key === "Enter") add(); };
  addRow.append(plus, input); main.append(addRow);

  if (!quizzes || quizzes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No quizzes yet. Enter a name and press + to create your first quiz.";
    main.append(empty);
  }
}

load();


