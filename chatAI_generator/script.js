const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const promptTextEl = document.getElementById('promptText');
const answerTextEl = document.getElementById('answerText');
const aspectSelectEl = document.getElementById('aspectSelect');
const themeSelectEl = document.getElementById('themeSelect');
const typingSpeedEl = document.getElementById('typingSpeed');
const humanJitterEl = document.getElementById('humanJitter');
const jitterLevelLabelEl = document.getElementById('jitterLevelLabel');
const thinkTimeEl = document.getElementById('thinkTime');
const answerSpeedEl = document.getElementById('answerSpeed');
const endDelayEl = document.getElementById('endDelay');
const formatSelectEl = document.getElementById('formatSelect');

const playBtn = document.getElementById('playBtn');
const recordBtn = document.getElementById('recordBtn');
const statusEl = document.getElementById('status');

// State variables
let animationFrameId = null;
let isAnimating = false;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

// Jitter level label update
humanJitterEl.addEventListener('input', (e) => {
  const val = e.target.value;
  jitterLevelLabelEl.textContent = `Lv. ${val}`;
  updatePreview();
});

// Event listeners for instant preview updates
[promptTextEl, answerTextEl, aspectSelectEl, themeSelectEl, typingSpeedEl, thinkTimeEl, answerSpeedEl, endDelayEl].forEach(el => {
  el.addEventListener('input', updatePreview);
  el.addEventListener('change', updatePreview);
});

// --- Canvas Resolution & Aspect Ratio Setup ---
function setupCanvasDimensions() {
  const aspect = aspectSelectEl.value;
  if (aspect === '16:9') {
    canvas.width = 1920;
    canvas.height = 1080;
  } else {
    canvas.width = 1080;
    canvas.height = 1920;
  }
}

// --- Theme Colors and Layout Configs ---
function getThemeConfig(theme) {
  const isPortrait = aspectSelectEl.value === '9:16';
  
  if (theme === 'copilot') {
    return {
      bg: '#FAF9F6',
      textPrimary: '#1F1F1F',
      textSecondary: '#616161',
      userBubbleBg: '#EDEBE9',
      userBubbleText: '#1F1F1F',
      inputBg: '#FFFFFF',
      inputBorder: '#E1DFDD',
      accentColor: '#0078D4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      cardWidth: isPortrait ? 960 : 1400,
      padding: isPortrait ? 60 : 80
    };
  } else if (theme === 'gemini') {
    return {
      bg: '#131314',
      textPrimary: '#E3E3E3',
      textSecondary: '#8E9196',
      userBubbleBg: '#282A2C',
      userBubbleText: '#E3E3E3',
      inputBg: '#1E1F20',
      inputBorder: '#37393B',
      accentColor: '#A8C7FA',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      cardWidth: isPortrait ? 960 : 1400,
      padding: isPortrait ? 60 : 80
    };
  } else {
    // chatgpt (Light)
    return {
      bg: '#FFFFFF',
      textPrimary: '#0D0D0D',
      textSecondary: '#707070',
      userBubbleBg: '#F3F3F3',
      userBubbleText: '#0D0D0D',
      inputBg: '#F4F4F4',
      inputBorder: '#E5E5E5',
      accentColor: '#10A37F',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      cardWidth: isPortrait ? 960 : 1400,
      padding: isPortrait ? 60 : 80
    };
  }
}

// --- Drawing Functions ---
function drawFrame(state) {
  setupCanvasDimensions();
  const themeName = themeSelectEl.value;
  const config = getThemeConfig(themeName);
  const isPortrait = aspectSelectEl.value === '9:16';

  ctx.fillStyle = config.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const startX = (canvas.width - config.cardWidth) / 2;
  let currentY = isPortrait ? 180 : 120;

  // 1. User Prompt Bubble (Render if user has started typing or finished)
  if (state.userTypedText.length > 0 || state.phase !== 'userTyping') {
    ctx.font = `500 ${isPortrait ? '38px' : '32px'} ${config.fontFamily}`;
    const userText = state.userTypedText;
    const maxBubbleWidth = config.cardWidth * 0.75;
    const lines = getWrappedLines(ctx, userText, maxBubbleWidth);
    const lineHeight = isPortrait ? 54 : 46;
    const bubblePaddingX = 36;
    const bubblePaddingY = 24;
    
    let maxLineWidth = 0;
    lines.forEach(l => {
      const w = ctx.measureText(l).width;
      if (w > maxLineWidth) maxLineWidth = w;
    });
    
    const bubbleWidth = Math.max(120, maxLineWidth + bubblePaddingX * 2);
    const bubbleHeight = lines.length * lineHeight + bubblePaddingY * 2;
    const bubbleX = startX + config.cardWidth - bubbleWidth;

    // Draw Rounded Bubble
    drawRoundedRect(ctx, bubbleX, currentY, bubbleWidth, bubbleHeight, 24, config.userBubbleBg);

    // Draw Text
    ctx.fillStyle = config.userBubbleText;
    lines.forEach((line, index) => {
      ctx.fillText(line, bubbleX + bubblePaddingX, currentY + bubblePaddingY + (index + 1) * lineHeight - (lineHeight * 0.25));
    });

    currentY += bubbleHeight + 60;
  }

  // 2. AI Thinking Animation or AI Answer Text
  if (state.phase === 'thinking') {
    // Thinking Indicator
    ctx.fillStyle = config.textSecondary;
    ctx.font = `600 ${isPortrait ? '32px' : '26px'} ${config.fontFamily}`;
    ctx.fillText('✨ Thinking...', startX, currentY + 36);
    
    // Pulsing Dot / Shimmer
    const dotAlpha = 0.3 + 0.7 * Math.abs(Math.sin(state.time * 0.005));
    ctx.fillStyle = config.accentColor;
    ctx.globalAlpha = dotAlpha;
    ctx.beginPath();
    ctx.arc(startX + 220, currentY + 28, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    currentY += 100;
  } else if (state.phase === 'aiTyping' || state.phase === 'ended') {
    // AI Answer Icon / Label
    ctx.fillStyle = config.accentColor;
    ctx.font = `700 ${isPortrait ? '34px' : '28px'} ${config.fontFamily}`;
    ctx.fillText('✦ AI Answer', startX, currentY + 30);
    currentY += 60;

    // Answer Text
    ctx.font = `400 ${isPortrait ? '36px' : '30px'} ${config.fontFamily}`;
    ctx.fillStyle = config.textPrimary;
    const answerText = state.aiTypedText;
    const lines = getWrappedLines(ctx, answerText, config.cardWidth);
    const lineHeight = isPortrait ? 58 : 48;

    lines.forEach((line, index) => {
      ctx.fillText(line, startX, currentY + (index + 1) * lineHeight - (lineHeight * 0.25));
    });

    // Blinking Cursor during AI Typing
    if (state.phase === 'aiTyping' && Math.floor(state.time / 400) % 2 === 0) {
      const lastLine = lines[lines.length - 1] || '';
      const lastLineWidth = ctx.measureText(lastLine).width;
      const cursorX = startX + (lines.length > 1 ? lastLineWidth : ctx.measureText(lines[0] || '').width);
      const cursorY = currentY + (lines.length - 1) * lineHeight + 10;
      ctx.fillRect(cursorX + 6, cursorY, 12, lineHeight * 0.8);
    }
  }

  // 3. Bottom Input Box UI Mockup
  const inputHeight = isPortrait ? 120 : 90;
  const inputY = canvas.height - (isPortrait ? 160 : 120);
  
  drawRoundedRect(ctx, startX, inputY, config.cardWidth, inputHeight, 30, config.inputBg, config.inputBorder, 2);
  
  ctx.fillStyle = config.textSecondary;
  ctx.font = `400 ${isPortrait ? '32px' : '26px'} ${config.fontFamily}`;
  
  const placeholderText = themeName === 'copilot' ? 'メッセージを入力...' : 
                          themeName === 'gemini' ? '質問や相談を入力...' : 'メッセージを入力...';
  
  const textStartX = startX + 36;
  const textStartY = inputY + (inputHeight / 2) + 10;
  
  if (state.phase === 'userTyping' && state.userTypedText.length > 0) {
    ctx.fillStyle = config.textPrimary;
    ctx.fillText(state.userTypedText, textStartX, textStartY);
    
    // Blinking cursor in input box
    if (Math.floor(state.time / 300) % 2 === 0) {
      const textW = ctx.measureText(state.userTypedText).width;
      ctx.fillRect(textStartX + textW + 4, textStartY - 28, 3, 34);
    }
  } else {
    ctx.fillText(placeholderText, textStartX, textStartY);
  }

  // Send Button Icon
  const sendBtnRadius = isPortrait ? 30 : 24;
  const sendBtnX = startX + config.cardWidth - (isPortrait ? 50 : 40);
  const sendBtnY = inputY + (inputHeight / 2);
  
  ctx.fillStyle = (state.phase === 'userTyping' && state.userTypedText.length > 0) ? config.accentColor : config.textSecondary;
  ctx.beginPath();
  ctx.arc(sendBtnX, sendBtnY, sendBtnRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Arrow Icon inside Send Button
  ctx.strokeStyle = config.bg;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sendBtnX, sendBtnY + 8);
  ctx.lineTo(sendBtnX, sendBtnY - 8);
  ctx.lineTo(sendBtnX - 6, sendBtnY - 2);
  ctx.moveTo(sendBtnX, sendBtnY - 8);
  ctx.lineTo(sendBtnX + 6, sendBtnY - 2);
  ctx.stroke();
}

// --- Helper: Wrapped Lines ---
function getWrappedLines(context, text, maxWidth) {
  const paragraphs = text.split('\n');
  const lines = [];

  paragraphs.forEach(paragraph => {
    if (paragraph === '') {
      lines.push('');
      return;
    }
    const words = paragraph.split('');
    let currentLine = '';

    words.forEach(char => {
      const testLine = currentLine + char;
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine !== '') {
      lines.push(currentLine);
    }
  });

  return lines;
}

// --- Helper: Rounded Rectangle ---
function drawRoundedRect(context, x, y, width, height, radius, fillColor, strokeColor = null, strokeWidth = 1) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();

  if (fillColor) {
    context.fillStyle = fillColor;
    context.fill();
  }
  if (strokeColor) {
    context.strokeStyle = strokeColor;
    context.lineWidth = strokeWidth;
    context.stroke();
  }
}

// --- Static Preview Update ---
function updatePreview() {
  if (isAnimating) return;
  const fullPrompt = promptTextEl.value;
  const fullAnswer = answerTextEl.value;
  
  drawFrame({
    phase: 'ended',
    userTypedText: fullPrompt,
    aiTypedText: fullAnswer,
    time: 0
  });
}

// --- Timeline & Animation Controller ---
function runAnimation(onComplete = null) {
  if (isAnimating) return;
  isAnimating = true;
  playBtn.disabled = true;
  recordBtn.disabled = true;
  statusEl.textContent = '▶ アニメーション再生中...';

  const fullPrompt = promptTextEl.value;
  const fullAnswer = answerTextEl.value;
  
  const userTypingBaseSpeed = parseFloat(typingSpeedEl.value) || 40;
  const jitterLevel = parseInt(humanJitterEl.value) || 2;
  const thinkDuration = (parseFloat(thinkTimeEl.value) || 2.0) * 1000;
  const aiSpeed = parseFloat(answerSpeedEl.value) || 20;
  const endDelayDuration = (parseFloat(endDelayEl.value) || 2.5) * 1000;

  let startTime = null;
  let phase = 'userTyping'; // userTyping -> thinking -> aiTyping -> ended
  let phaseStartTime = null;
  
  let userCharIndex = 0;
  let aiCharIndex = 0;
  let nextUserCharDelay = userTypingBaseSpeed;

  function animate(timestamp) {
    if (!startTime) {
      startTime = timestamp;
      phaseStartTime = timestamp;
    }
    const totalTime = timestamp - startTime;
    const phaseTime = timestamp - phaseStartTime;

    if (phase === 'userTyping') {
      if (phaseTime >= nextUserCharDelay && userCharIndex < fullPrompt.length) {
        userCharIndex++;
        phaseStartTime = timestamp;
        
        // Jitter Calculation
        let jitterFactor = 1.0;
        if (jitterLevel === 2) jitterFactor = 0.7 + Math.random() * 0.6;
        if (jitterLevel === 3) jitterFactor = 0.4 + Math.random() * 1.2;
        if (jitterLevel === 4) jitterFactor = 0.2 + Math.random() * 2.0;
        
        // Pause longer on punctuation
        const lastChar = fullPrompt[userCharIndex - 1];
        if (['、', '。', '？', '?', '!', '！', '\n'].includes(lastChar)) {
          jitterFactor *= 2.5;
        }
        nextUserCharDelay = userTypingBaseSpeed * jitterFactor;
      }

      if (userCharIndex >= fullPrompt.length) {
        phase = 'thinking';
        phaseStartTime = timestamp;
      }
    } else if (phase === 'thinking') {
      if (phaseTime >= thinkDuration) {
        phase = 'aiTyping';
        phaseStartTime = timestamp;
      }
    } else if (phase === 'aiTyping') {
      aiCharIndex = Math.min(fullAnswer.length, Math.floor(phaseTime / aiSpeed));
      if (aiCharIndex >= fullAnswer.length) {
        phase = 'ended';
        phaseStartTime = timestamp;
      }
    } else if (phase === 'ended') {
      if (phaseTime >= endDelayDuration) {
        // Finished Animation
        isAnimating = false;
        playBtn.disabled = false;
        recordBtn.disabled = false;
        statusEl.textContent = '✅ アニメーション完了';
        if (onComplete) onComplete();
        return;
      }
    }

    drawFrame({
      phase: phase,
      userTypedText: fullPrompt.substring(0, userCharIndex),
      aiTypedText: fullAnswer.substring(0, aiCharIndex),
      time: totalTime
    });

    animationFrameId = requestAnimationFrame(animate);
  }

  animationFrameId = requestAnimationFrame(animate);
}

// --- Video Recording (MediaRecorder API) ---
function recordVideo() {
  if (isRecording || isAnimating) return;
  isRecording = true;
  statusEl.textContent = '🎥 録画準備中...';

  const stream = canvas.captureStream(60); // 60 FPS capture
  let mimeType = 'video/webm;codecs=vp9';
  
  const prefFormat = formatSelectEl.value;
  if (prefFormat === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    mimeType = 'video/webm;codecs=vp9';
  } else if (MediaRecorder.isTypeSupported('video/webm')) {
    mimeType = 'video/webm';
  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  }

  recordedChunks = [];
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
  } catch (e) {
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const ext = (mediaRecorder.mimeType && mediaRecorder.mimeType.includes('mp4')) ? 'mp4' : 'webm';
    a.download = `chat_ai_animation_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);

    isRecording = false;
    statusEl.textContent = `💾 動画ダウンロード完了 (${ext.toUpperCase()})`;
  };

  mediaRecorder.start();
  statusEl.textContent = '🔴 録画中...';

  runAnimation(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  });
}

// Button Event Bindings
playBtn.addEventListener('click', () => runAnimation());
recordBtn.addEventListener('click', () => recordVideo());

// Initial setup
updatePreview();