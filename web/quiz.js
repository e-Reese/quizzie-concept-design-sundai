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

  // Quiz-level controls: activate/deactivate and overview
  const aKey = `activation_quiz_${quiz}`;
  const getActivation = () => localStorage.getItem(aKey);
  const setActivation = (id) => localStorage.setItem(aKey, id);
  const clearActivation = () => localStorage.removeItem(aKey);

  const controls = document.createElement("div");
  const toggleActivate = document.createElement("button"); 
  toggleActivate.className = "btn";
  
  const openDisplay = document.createElement("button"); 
  openDisplay.className = "btn"; 
  openDisplay.textContent = "overview"; 
  openDisplay.onclick = () => globalThis.open(`/question.html?quiz=${quiz}`, "_blank");
  
  async function syncActivationButton() {
    const act = getActivation();
    toggleActivate.textContent = act ? "deactivate" : "activate";
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
    await syncActivationButton();
  };
  
  controls.append(toggleActivate, openDisplay);
  main.append(controls);
  
  // Set initial button state
  await syncActivationButton();

  data.questions.forEach((q) => {
    const row = document.createElement("div"); row.className = "question";
    const del = document.createElement("span"); del.textContent = "🗑️"; del.onclick = async () => { await fetchJSON(`/api/questions/${q.question}`, { method: "DELETE" }); load(); };
    const input = document.createElement("input"); 
    input.type = "text"; 
    input.value = q.text; 
    input.className = "text"; 
    
    const saveQuestion = async () => {
      if (input.value.trim()) {
        await fetchJSON(`/api/questions/${q.question}`, { 
          method: "PATCH", 
          body: JSON.stringify({ text: input.value }) 
        });
      }
    };
    
    input.onchange = saveQuestion;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur(); // Triggers onchange
      }
    };
    
    row.append(del, input);

    q.options.forEach((o) => {
      const list = row.querySelector('.options') || (()=>{ const d = document.createElement('div'); d.className = 'options'; row.append(d); return d; })();
      const orow = document.createElement("div"); orow.className = "option-row";
      const odel = document.createElement("span"); odel.textContent = "🗑️"; odel.onclick = async () => { await fetchJSON(`/api/options/${o.option}`, { method: "DELETE" }); load(); };
      const letter = document.createElement("span"); letter.textContent = ""; // A/B label omitted for simplicity
      const i = document.createElement("input"); 
      i.type = "text"; 
      i.value = o.label; 
      
      const saveOption = async () => {
        if (i.value.trim()) {
          await fetchJSON(`/api/options/${o.option}`, { 
            method: "PATCH", 
            body: JSON.stringify({ label: i.value }) 
          });
        }
      };
      
      i.onchange = saveOption;
      i.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          i.blur(); // Triggers onchange
        }
      };
      orow.append(odel, letter, i); list.append(orow);
    });

    const addOpt = document.createElement("div"); 
    addOpt.className = "option-row"; 
    const plus = document.createElement("span"); 
    plus.textContent = "➕"; 
    const i2 = document.createElement("input"); 
    i2.type = "text"; 
    i2.placeholder = "enter text of new option";
    
    const addOption = async () => {
      const label = i2.value.trim();
      if (!label) return;
      await fetchJSON(`/api/questions/${q.question}/options`, { 
        method: "POST", 
        body: JSON.stringify({ label }) 
      });
      i2.value = "";
      load();
    };
    
    plus.onclick = addOption;
    i2.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addOption();
      }
    };
    addOpt.append(plus, i2); row.append(addOpt);

    main.append(row);
  });

  const addQ = document.createElement("div"); 
  addQ.className = "question-row"; 
  const plus = document.createElement("span"); 
  plus.textContent = "➕"; 
  const qinput = document.createElement("input"); 
  qinput.type = "text"; 
  qinput.placeholder = "enter text of new question";
  
  const addQuestion = async () => {
    const text = qinput.value.trim();
    if (!text) return;
    await fetchJSON(`/api/quizzes/${quiz}/questions`, { 
      method: "POST", 
      body: JSON.stringify({ text }) 
    });
    qinput.value = "";
    load();
  };
  
  plus.onclick = addQuestion;
  qinput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addQuestion();
    }
  };
  addQ.append(plus, qinput); main.append(addQ);
  await syncButtons();
}

load();


