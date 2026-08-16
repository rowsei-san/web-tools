const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const promptInput = document.getElementById('promptText');
const answerInput = document.getElementById('answerText');
const aspectSelect = document.getElementById('aspectSelect');
const themeSelect = document.getElementById('themeSelect');
const speedInput = document.getElementById('typingSpeed');
const jitterInput = document.getElementById('humanJitter');
const jitterLevelLabel = document.getElementById('jitterLevelLabel');
const thinkTimeInput = document.getElementById('thinkTime');
const answerSpeedInput = document.getElementById('answerSpeed');
const endDelayInput = document.getElementById('endDelay');
const formatSelect = document.getElementById('formatSelect');
const playBtn = document.getElementById('playBtn');
const recordBtn = document.getElementById('recordBtn');
const statusEl = document.getElementById('status');

let currentPrompt = '';
let currentAnswer = '';
let phase = 'idle';
let thinkFrame = 0;
let actionIconOpacity = 0;
let showCursor = true;
let cursorInterval = null;
let isAnimating = false;
let enterEffectState = { active: false, scale: 1, pulseRing: 0 };

jitterInput.addEventListener('input', function() {
  jitterLevelLabel.innerText = 'Lv. ' + jitterInput.value;
});

function updateCanvasSize() {
  const aspect = aspectSelect.value;
  if (aspect === '9:16') {
    canvas.width = 1080;
    canvas.height = 1920;
    canvas.style.aspectRatio = '9 / 16';
  } else {
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.aspectRatio = '16 / 9';
  }
  renderUI();
}
aspectSelect.addEventListener('change', updateCanvasSize);

function drawRoundRect(x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ★ 手動改行（\n）と幅溢れ自動改行の両方に対応したテキストラッピング関数
function wrapText(text, maxWidth, fontSize) {
  fontSize = fontSize || 28;
  ctx.font = '400 ' + fontSize + 'px sans-serif';
  if (!text) return [''];
  
  const paragraphs = text.split('\n');
  const lines = [];

  for (let p = 0; p < paragraphs.length; p++) {
    const paragraph = paragraphs[p];
    if (paragraph === '') {
      lines.push(''); // 空行の保持
      continue;
    }
    const chars = Array.from(paragraph);
    let currentLine = '';
    for (let i = 0; i < chars.length; i++) {
      const testLine = currentLine + chars[i];
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        lines.push(currentLine);
        currentLine = chars[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

function renderActionIcons(startX, y, opacity, theme) {
  if (opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  const isDark = theme === 'gemini';
  const color = isDark ? '#8E9196' : '#6E737A';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const spacing = 50;
  let x = startX;
  ctx.beginPath();
  ctx.rect(x - 10, y - 2, 6, 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 2);
  ctx.lineTo(x + 2, y + 2);
  ctx.lineTo(x + 4, y - 6);
  ctx.lineTo(x + 2, y - 10);
  ctx.lineTo(x - 1, y - 10);
  ctx.lineTo(x - 4, y - 4);
  ctx.lineTo(x - 4, y + 10);
  ctx.lineTo(x + 5, y + 10);
  ctx.lineTo(x + 8, y + 2);
  ctx.stroke();

  x += spacing;
  ctx.beginPath();
  ctx.rect(x - 10, y - 10, 6, 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 2);
  ctx.lineTo(x + 2, y - 2);
  ctx.lineTo(x + 4, y + 6);
  ctx.lineTo(x + 2, y + 10);
  ctx.lineTo(x - 1, y + 10);
  ctx.lineTo(x - 4, y + 4);
  ctx.lineTo(x - 4, y - 10);
  ctx.lineTo(x + 5, y - 10);
  ctx.lineTo(x + 8, y - 2);
  ctx.stroke();

  x += spacing;
  ctx.beginPath();
  ctx.rect(x - 8, y - 8, 12, 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - 4, y - 4, 12, 14);
  ctx.stroke();

  x += spacing;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0.2 * Math.PI, 1.7 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 10);
  ctx.lineTo(x + 9, y - 7);
  ctx.lineTo(x + 5, y - 3);
  ctx.stroke();

  x += spacing;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(x + i * 8, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderUI() {
  const W = canvas.width;
  const H = canvas.height;
  const theme = themeSelect.value;
  if (theme === 'copilot') renderCopilot(W, H);
  else if (theme === 'gemini') renderGemini(W, H);
  else if (theme === 'chatgpt') renderChatGPT(W, H);
}

// 1. Copilot UI
function renderCopilot(W, H) {
  ctx.fillStyle = '#F9F6F2';
  ctx.fillRect(0, 0, W, H);

  const isPortrait = H > W;
  const fontSize = isPortrait ? 36 : 28;
  const lineHeight = isPortrait ? 52 : 42;
  const aMaxW = isPortrait ? 820 : 1000;
  const qMaxW = isPortrait ? 760 : 700;
  const rightEdgeX = (W + aMaxW) / 2;
  const leftEdgeX = (W - aMaxW) / 2;

  if (phase === 'idle' || phase === 'typing') {
    const titleY = H / 2 - (isPortrait ? 180 : 130);
    ctx.textAlign = 'center';
    ctx.font = '500 52px sans-serif';
    ctx.fillStyle = '#22252A';
    ctx.fillText('今日はどんなことを考えていますか？', W / 2, titleY);

    const lines = wrapText(currentPrompt, aMaxW - 140, fontSize);
    const extraHeight = Math.max(0, (lines.length - 1) * lineHeight);
    const barH = (isPortrait ? 150 : 130) + extraHeight;
    const barX = leftEdgeX;
    const barY = titleY + 70;

    ctx.fillStyle = '#F1ECE6';
    drawRoundRect(barX - 6, barY - 6, aMaxW + 12, barH + 12, 36);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    drawRoundRect(barX, barY, aMaxW, barH, 32);
    ctx.fill();
    ctx.strokeStyle = '#EBE5DF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const textStartX = barX + 36;
    const textStartY = barY + (isPortrait ? 55 : 45);
    ctx.textAlign = 'left';

    if (currentPrompt.length === 0) {
      ctx.fillStyle = '#6E737A';
      ctx.font = '400 ' + fontSize + 'px sans-serif';
      ctx.fillText('メッセージを送る', textStartX, textStartY);
      if (showCursor) {
        ctx.fillStyle = '#111827';
        ctx.fillRect(textStartX + 4, textStartY - fontSize + 4, 3, fontSize + 4);
      }
    } else {
      ctx.fillStyle = '#111827';
      ctx.font = '400 ' + fontSize + 'px sans-serif';
      lines.forEach(function(line, idx) {
        const ly = textStartY + idx * lineHeight;
        ctx.fillText(line, textStartX, ly);
        if (idx === lines.length - 1 && showCursor) {
          const lw = ctx.measureText(line).width;
          ctx.fillStyle = '#0078D4';
          ctx.fillRect(textStartX + lw + 4, ly - fontSize + 4, 3, fontSize + 4);
        }
      });
    }

    const btlY = barY + barH - 32;
    const sendBtnX = barX + aMaxW - 40;
    const btnRadius = 20 * enterEffectState.scale;
    const isTextReady = currentPrompt.length > 0;

    if (enterEffectState.pulseRing > 0) {
      ctx.fillStyle = 'rgba(0, 120, 212, ' + (0.4 * (1 - enterEffectState.pulseRing)) + ')';
      ctx.beginPath();
      ctx.arc(sendBtnX, btlY, btnRadius + enterEffectState.pulseRing * 35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isTextReady ? '#0078D4' : '#E5E0DA';
    ctx.beginPath();
    ctx.arc(sendBtnX, btlY, btnRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isTextReady ? '#FFFFFF' : '#8E9196';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sendBtnX, btlY + 6 * enterEffectState.scale);
    ctx.lineTo(sendBtnX, btlY - 6 * enterEffectState.scale);
    ctx.lineTo(sendBtnX - 5 * enterEffectState.scale, btlY - 1 * enterEffectState.scale);
    ctx.moveTo(sendBtnX, btlY - 6 * enterEffectState.scale);
    ctx.lineTo(sendBtnX + 5 * enterEffectState.scale, btlY - 1 * enterEffectState.scale);
    ctx.stroke();
  } else {
    const qLines = wrapText(currentPrompt, qMaxW - 60, fontSize);
    const qH = Math.max(80, qLines.length * (lineHeight - 2) + 36);
    const fullAnsLines = wrapText(promptInput.value ? answerInput.value : currentAnswer, aMaxW, fontSize);
    const aH = Math.max(100, fullAnsLines.length * lineHeight + 80);

    const gap = 40;
    const totalH = qH + gap + aH;
    const startY = Math.max(80, (H - totalH) / 2);

    const qX = rightEdgeX - qMaxW;
    const qY = startY;

    ctx.fillStyle = '#EAE3DA';
    drawRoundRect(qX, qY, qMaxW, qH, 24);
    ctx.fill();
    ctx.fillStyle = '#22252A';
    ctx.font = '400 ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'left';
    qLines.forEach(function(line, idx) {
      ctx.fillText(line, qX + 30, qY + (isPortrait ? 50 : 42) + idx * (lineHeight - 2));
    });

    const aX = leftEdgeX;
    const aY = qY + qH + gap;

    if (phase === 'thinking') {
      ctx.fillStyle = '#6E737A';
      ctx.font = '400 ' + (fontSize - 2) + 'px sans-serif';
      const dots = '.'.repeat((Math.floor(thinkFrame / 8) % 4));
      ctx.fillText(dots + ' 考え中', aX, aY + 40);
    } else {
      ctx.fillStyle = '#22252A';
      ctx.font = '400 ' + fontSize + 'px sans-serif';
      const ansLines = wrapText(currentAnswer, aMaxW, fontSize);
      ansLines.forEach(function(line, idx) {
        ctx.fillText(line, aX, aY + 40 + idx * lineHeight);
      });
      const lastLineY = aY + 40 + ansLines.length * lineHeight + 25;
      renderActionIcons(aX + 20, lastLineY, actionIconOpacity, 'copilot');
    }
  }
}

// 2. Gemini UI
function renderGemini(W, H) {
  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W);
  bgGrad.addColorStop(0, '#131822');
  bgGrad.addColorStop(0.6, '#0b0c10');
  bgGrad.addColorStop(1, '#050608');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const isPortrait = H > W;
  const fontSize = isPortrait ? 36 : 28;
  const lineHeight = isPortrait ? 52 : 44;
  const aMaxW = isPortrait ? 820 : 1000;
  const qMaxW = isPortrait ? 760 : 700;
  const rightEdgeX = (W + aMaxW) / 2;
  const leftEdgeX = (W - aMaxW) / 2;

  if (phase === 'idle' || phase === 'typing') {
    ctx.fillStyle = '#E3E3E3';
    ctx.font = isPortrait ? '500 56px sans-serif' : '500 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('何から始めますか？', W / 2, H / 2 - 120);

    const lines = wrapText(currentPrompt, aMaxW - 180, fontSize);
    const extraHeight = Math.max(0, (lines.length - 1) * lineHeight);
    const barH = 110 + extraHeight;
    const barX = leftEdgeX;
    const barY = H / 2 + 20;

    ctx.fillStyle = '#1e1f20';
    drawRoundRect(barX, barY, aMaxW, barH, 45);
    ctx.fill();

    const plusX = barX + 45;
    const plusY = barY + 55;
    ctx.strokeStyle = '#c4c7c5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(plusX - 10, plusY); ctx.lineTo(plusX + 10, plusY);
    ctx.moveTo(plusX, plusY - 10); ctx.lineTo(plusX, plusY + 10);
    ctx.stroke();

    const textStartX = barX + 80;
    const textStartY = barY + (isPortrait ? 65 : 60);
    ctx.textAlign = 'left';
    ctx.font = '400 ' + fontSize + 'px sans-serif';

    if (currentPrompt.length === 0) {
      ctx.fillStyle = '#8e9196';
      ctx.fillText('相談をする', textStartX, textStartY);
    } else {
      ctx.fillStyle = '#e3e3e3';
      lines.forEach(function(line, idx) {
        const ly = textStartY + idx * lineHeight;
        ctx.fillText(line, textStartX, ly);
        if (idx === lines.length - 1 && showCursor) {
          const lw = ctx.measureText(line).width;
          ctx.fillStyle = '#a8c7fa';
          ctx.fillRect(textStartX + lw + 4, ly - fontSize + 4, 3, fontSize + 4);
        }
      });
    }

    const sendBtnX = barX + aMaxW - 50;
    const sendBtnY = barY + barH - 55;
    const btnRadius = 22 * enterEffectState.scale;
    const isTextReady = currentPrompt.length > 0;

    if (enterEffectState.pulseRing > 0) {
      ctx.fillStyle = 'rgba(168, 199, 250, ' + (0.4 * (1 - enterEffectState.pulseRing)) + ')';
      ctx.beginPath();
      ctx.arc(sendBtnX, sendBtnY, btnRadius + enterEffectState.pulseRing * 35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isTextReady ? '#a8c7fa' : '#2d3037';
    ctx.beginPath();
    ctx.arc(sendBtnX, sendBtnY, btnRadius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const qLines = wrapText(currentPrompt, qMaxW - 60, fontSize);
    const qH = Math.max(80, qLines.length * (lineHeight - 2) + 36);
    const fullAnsLines = wrapText(promptInput.value ? answerInput.value : currentAnswer, aMaxW, fontSize);
    const aH = Math.max(100, fullAnsLines.length * lineHeight + 80);

    const gap = 40;
    const totalH = qH + gap + aH;
    const startY = Math.max(80, (H - totalH) / 2);

    const qX = rightEdgeX - qMaxW;
    const qY = startY;

    ctx.fillStyle = '#282a2d';
    drawRoundRect(qX, qY, qMaxW, qH, 20);
    ctx.fill();
    ctx.fillStyle = '#E3E3E3';
    ctx.font = '400 ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'left';
    qLines.forEach(function(line, idx) {
      ctx.fillText(line, qX + 30, qY + (isPortrait ? 50 : 42) + idx * (lineHeight - 2));
    });

    const aX = leftEdgeX;
    const aY = qY + qH + gap;

    if (phase === 'thinking') {
      for (let i = 0; i < 3; i++) {
        const waveY = aY + 40 + Math.sin(thinkFrame * 0.2 + i * 0.8) * 8;
        ctx.fillStyle = '#E3E3E3';
        ctx.beginPath();
        ctx.arc(aX + 15 + i * 22, waveY, isPortrait ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#E3E3E3';
      ctx.font = '400 ' + fontSize + 'px sans-serif';
      const ansLines = wrapText(currentAnswer, aMaxW, fontSize);
      ansLines.forEach(function(line, idx) {
        ctx.fillText(line, aX, aY + 40 + idx * lineHeight);
      });
      const lastLineY = aY + 40 + ansLines.length * lineHeight + 25;
      renderActionIcons(aX + 10, lastLineY, actionIconOpacity, 'gemini');
    }
  }
}

// 3. ChatGPT UI
function renderChatGPT(W, H) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  const isPortrait = H > W;
  const fontSize = isPortrait ? 36 : 28;
  const lineHeight = isPortrait ? 52 : 42;
  const aMaxW = isPortrait ? 820 : 1000;
  const qMaxW = isPortrait ? 760 : 700;
  const rightEdgeX = (W + aMaxW) / 2;
  const leftEdgeX = (W - aMaxW) / 2;

  if (phase === 'idle' || phase === 'typing') {
    ctx.fillStyle = '#0D0D0D';
    ctx.font = isPortrait ? '600 52px sans-serif' : '600 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('今日は何をしましょうか？', W / 2, H / 2 - 130);

    const lines = wrapText(currentPrompt, aMaxW - 160, fontSize);
    const extraHeight = Math.max(0, (lines.length - 1) * lineHeight);
    const barH = 110 + extraHeight;
    const barX = leftEdgeX;
    const barY = H / 2 + 10;

    ctx.fillStyle = '#FFFFFF';
    drawRoundRect(barX, barY, aMaxW, barH, 40);
    ctx.fill();
    ctx.strokeStyle = '#E5E5E5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const textStartX = barX + 75;
    const textStartY = barY + (isPortrait ? 65 : 60);
    ctx.textAlign = 'left';
    ctx.font = '400 ' + fontSize + 'px sans-serif';

    if (currentPrompt.length === 0) {
      ctx.fillStyle = '#8E8E93';
      ctx.fillText('質問してみましょう', textStartX, textStartY);
    } else {
      ctx.fillStyle = '#0D0D0D';
      lines.forEach(function(line, idx) {
        const ly = textStartY + idx * lineHeight;
        ctx.fillText(line, textStartX, ly);
        if (idx === lines.length - 1 && showCursor) {
          const lw = ctx.measureText(line).width;
          ctx.fillStyle = '#0D0D0D';
          ctx.fillRect(textStartX + lw + 4, ly - fontSize + 4, 3, fontSize + 4);
        }
      });
    }

    const sendBtnX = barX + aMaxW - 50;
    const sendBtnY = barY + barH - 55;
    const btnRadius = 22 * enterEffectState.scale;
    const isTextReady = currentPrompt.length > 0;

    if (enterEffectState.pulseRing > 0) {
      ctx.fillStyle = 'rgba(58, 131, 247, ' + (0.4 * (1 - enterEffectState.pulseRing)) + ')';
      ctx.beginPath();
      ctx.arc(sendBtnX, sendBtnY, btnRadius + enterEffectState.pulseRing * 35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isTextReady ? '#3A83F7' : '#E5E5E5';
    ctx.beginPath();
    ctx.arc(sendBtnX, sendBtnY, btnRadius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const qLines = wrapText(currentPrompt, qMaxW - 60, fontSize);
    const qH = Math.max(80, qLines.length * (lineHeight - 2) + 36);
    const fullAnsLines = wrapText(promptInput.value ? answerInput.value : currentAnswer, aMaxW, fontSize);
    const aH = Math.max(100, fullAnsLines.length * lineHeight + 80);

    const gap = 40;
    const totalH = qH + gap + aH;
    const startY = Math.max(80, (H - totalH) / 2);

    const qX = rightEdgeX - qMaxW;
    const qY = startY;

    ctx.fillStyle = '#F4F4F4';
    drawRoundRect(qX, qY, qMaxW, qH, 20);
    ctx.fill();
    ctx.fillStyle = '#0D0D0D';
    ctx.font = '400 ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'left';
    qLines.forEach(function(line, idx) {
      ctx.fillText(line, qX + 30, qY + (isPortrait ? 50 : 42) + idx * (lineHeight - 2));
    });

    const aX = leftEdgeX;
    const aY = qY + qH + gap;

    if (phase === 'thinking') {
      const scale = 1 + Math.sin(thinkFrame * 0.15) * 0.3;
      ctx.fillStyle = '#3A83F7';
      ctx.beginPath();
      ctx.arc(aX + 20, aY + 40, (isPortrait ? 14 : 10) * scale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#0D0D0D';
      ctx.font = '400 ' + fontSize + 'px sans-serif';
      const ansLines = wrapText(currentAnswer, aMaxW, fontSize);
      ansLines.forEach(function(line, idx) {
        ctx.fillText(line, aX, aY + 40 + idx * lineHeight);
      });
      const lastLineY = aY + 40 + ansLines.length * lineHeight + 25;
      renderActionIcons(aX + 10, lastLineY, actionIconOpacity, 'chatgpt');
    }
  }
}

async function playEnterAnimation() {
  showCursor = false;
  for (let p = 0; p <= 1; p += 0.08) {
    enterEffectState.pulseRing = p;
    enterEffectState.scale = 1 + Math.sin(p * Math.PI) * 0.12;
    renderUI();
    await new Promise(r => setTimeout(r, 16));
  }
  for (let p = 1; p >= 0.85; p -= 0.05) {
    enterEffectState.scale = p;
    renderUI();
    await new Promise(r => setTimeout(r, 16));
  }
  for (let p = 0.85; p <= 1; p += 0.05) {
    enterEffectState.scale = p;
    renderUI();
    await new Promise(r => setTimeout(r, 16));
  }
  enterEffectState.pulseRing = 0;
  enterEffectState.scale = 1;
}

async function runFullAnimation() {
  isAnimating = true;
  const promptText = promptInput.value;
  const answerText = answerInput.value;
  const charDelay = parseInt(speedInput.value) || 40;
  const jitterLevel = parseInt(jitterInput.value) || 2;
  const thinkSec = parseFloat(thinkTimeInput.value) || 2.0;
  const ansCharDelay = parseInt(answerSpeedInput.value) || 20;
  const endDelayMs = parseFloat(endDelayInput.value) * 1000;

  let jitterMax = 25, pauseMs = 180;
  if (jitterLevel === 1) { jitterMax = 10; pauseMs = 60; }
  else if (jitterLevel === 3) { jitterMax = 45; pauseMs = 320; }
  else if (jitterLevel === 4) { jitterMax = 70; pauseMs = 480; }

  phase = 'typing';
  currentPrompt = '';
  currentAnswer = '';
  actionIconOpacity = 0;
  renderUI();

  for (let i = 0; i < promptText.length; i++) {
    const char = promptText[i];
    currentPrompt += char;
    renderUI();
    let delay = Math.max(10, charDelay + (Math.random() * 2 - 1) * jitterMax);
    if (pauseMs > 0 && ['、', '。', '！', '？', ' '].includes(char)) delay += pauseMs;
    await new Promise(r => setTimeout(r, delay));
  }

  await new Promise(r => setTimeout(r, 600));
  await playEnterAnimation();

  phase = 'thinking';
  thinkFrame = 0;
  const thinkInterval = setInterval(() => { thinkFrame++; renderUI(); }, 30);
  await new Promise(r => setTimeout(r, thinkSec * 1000));
  clearInterval(thinkInterval);

  phase = 'answering';
  for (let i = 0; i < answerText.length; i++) {
    currentAnswer += answerText[i];
    renderUI();
    await new Promise(r => setTimeout(r, ansCharDelay));
  }

  phase = 'done';
  for (let op = 0; op <= 1; op += 0.05) {
    actionIconOpacity = op;
    renderUI();
    await new Promise(r => setTimeout(r, 20));
  }
  actionIconOpacity = 1;
  renderUI();

  await new Promise(r => setTimeout(r, endDelayMs));
  isAnimating = false;
}

renderUI();
themeSelect.addEventListener('change', renderUI);

playBtn.addEventListener('click', async function() {
  if (isAnimating) return;
  playBtn.disabled = true;
  recordBtn.disabled = true;
  statusEl.innerText = '▶ フル対話再生中...';
  await runFullAnimation();
  statusEl.innerText = '✅ 再生完了';
  playBtn.disabled = false;
  recordBtn.disabled = false;
});

recordBtn.addEventListener('click', async function() {
  if (isAnimating) return;
  playBtn.disabled = true;
  recordBtn.disabled = true;
  statusEl.innerText = '🎥 録画中...';

  const fmt = formatSelect.value;
  let mimeType = 'video/webm;codecs=vp9';
  let ext = 'webm';

  if (fmt === 'mp4' || (fmt === 'auto' && MediaRecorder.isTypeSupported('video/mp4'))) {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
      ext = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
      ext = 'mp4';
    }
  }

  const stream = canvas.captureStream(60);
  let mediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType });
  } catch (err) {
    mimeType = 'video/webm';
    ext = 'webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType });
  }

  const chunks = [];
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const aspectName = aspectSelect.value.replace(':', 'x');
    a.download = `${themeSelect.value}_${aspectName}_animation.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.innerText = `💾 動画（${ext.toUpperCase()}形式）の保存が完了しました！`;
    playBtn.disabled = false;
    recordBtn.disabled = false;
  };

  mediaRecorder.start();
  await runFullAnimation();
  mediaRecorder.stop();
});
