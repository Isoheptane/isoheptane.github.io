
let state = {
    allowInput: false,
    score1: 0,
    score2: 0,
    values: null,
    startTime: null,
    value1: null,
    value2: null,
    inputs: [],
    stopUpdate: false,
};
function loadGame() {
  fetch('/game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
    .then(response => response.json())
    .then(data => {
      state.values = data.values;
      state.startTime = data.startTime * 1000;
      state.value1 = data.values[0][0];
      state.value2 = data.values[0][1];
      document.getElementById('value1').textContent = state.value1;
      document.getElementById('value2').textContent = state.value2;
      updateCountdown();
    })
    .catch(error => {
      document.getElementById('dialog').textContent = '加载失败，请刷新页面重试';
    });
}
function updateCountdown() {
  if (state.stopUpdate) {
    return;
  }
  const seconds = Math.ceil((state.startTime - Date.now()) / 1000);
  if (seconds >= 4) {
    requestAnimationFrame(updateCountdown);
  }
  if (seconds <= 3 && seconds >= 1) {
    document.getElementById('dialog').textContent = seconds;
    requestAnimationFrame(updateCountdown);
  } else if (seconds <= 0) {
    document.getElementById('dialog').style.display = 'none';
    state.allowInput = true;
    updateTimer();
  }
}
function updateTimer() {
  if (state.stopUpdate) {
    return;
  }
  const time1 = Date.now() - state.startTime;
  const time2 = Math.min(10000, time1);
  state.score2 = Math.max(0, Math.floor(time2 / 100));
  document.getElementById('time1').textContent = `${String(Math.floor(time1 / 60000)).padStart(2, '0')}:${String(Math.floor(time1 / 1000) % 60).padStart(2, '0')}.${String(time1 % 1000).padStart(3, '0')}`;
  document.getElementById('time2').textContent = `${String(Math.floor(time2 / 60000)).padStart(2, '0')}:${String(Math.floor(time2 / 1000) % 60).padStart(2, '0')}.${String(time2 % 1000).padStart(3, '0')}`;
  document.getElementById('score2').textContent = state.score2;
  document.getElementById('progress2').style.width = `${state.score2}%`;
  if (state.score2 === 100) {
    state.allowInput = false;
    state.stopUpdate = true;
    document.getElementById('dialog').textContent = '对手已完成，挑战失败！';
    document.getElementById('dialog').style.display = 'flex';
    document.getElementById('time1').textContent = `00:10.000`;
  } else {
    requestAnimationFrame(updateTimer);
  }
}
function chooseAnswer(choice) {
  if (!state.allowInput) {
    return;
  }
  state.inputs.push(choice);
  let correct;
  if (state.value1 < state.value2 && choice === '<' || state.value1 > state.value2 && choice === '>') {
    correct = true;
    state.score1++;
    document.getElementById('answer').style.backgroundColor = '#5e5';
  } else {
    correct = false;
    document.getElementById('answer').style.backgroundColor = '#e55';
  }
  document.getElementById('answer').textContent = choice;
  document.getElementById('score1').textContent = state.score1;
  document.getElementById('progress1').style.width = `${state.score1}%`;
  state.allowInput = false;
  setTimeout(() => {
    if (state.score1 === 100) {
      submit(state.inputs);
    } else if (correct) {
      state.value1 = state.values[state.score1][0];
      state.value2 = state.values[state.score1][1];
      state.allowInput = true;
      document.getElementById('value1').textContent = state.value1;
      document.getElementById('value2').textContent = state.value2;
      document.getElementById('answer').textContent = '?';
      document.getElementById('answer').style.backgroundColor = '#fff';
    } else {
      state.allowInput = false;
      state.stopUpdate = true;
      document.getElementById('dialog').textContent = '你选错了，挑战失败！';
      document.getElementById('dialog').style.display = 'flex';
    }
  }, 200);
}
function submit(inputs) {
  fetch('/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({inputs}),
  })
    .then(response => response.json())
    .then(data => {
      state.stopUpdate = true;
      document.getElementById('dialog').textContent = data.message;
      document.getElementById('dialog').style.display = 'flex';
    })
    .catch(error => {
      state.stopUpdate = true;
      document.getElementById('dialog').textContent = '提交失败，请刷新页面重试';
      document.getElementById('dialog').style.display = 'flex';
    });
}
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') {
    document.getElementById('less-than').classList.add('active');
    setTimeout(() => document.getElementById('less-than').classList.remove('active'), 200);
    chooseAnswer('<');
  } else if (e.key === 'ArrowRight' || e.key === 'd') {
    document.getElementById('greater-than').classList.add('active');
    setTimeout(() => document.getElementById('greater-than').classList.remove('active'), 200);
    chooseAnswer('>');
  }
});
document.getElementById('less-than').addEventListener('click', () => chooseAnswer('<'));
document.getElementById('greater-than').addEventListener('click', () => chooseAnswer('>'));
document.addEventListener('load', loadGame());