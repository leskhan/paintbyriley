const canvas = document.querySelector("#paintCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const textInput = document.querySelector("#textInput");
const statusText = document.querySelector("#status");

const tools = [...document.querySelectorAll(".tool")];
const primaryColor = document.querySelector("#primaryColor");
const fillColor = document.querySelector("#fillColor");
const brushSize = document.querySelector("#brushSize");
const brushSizeValue = document.querySelector("#brushSizeValue");
const shapeFill = document.querySelector("#shapeFill");
const canvasWidth = document.querySelector("#canvasWidth");
const canvasHeight = document.querySelector("#canvasHeight");
const swatches = document.querySelector("#swatches");

const state = {
  tool: "pencil",
  drawing: false,
  start: { x: 0, y: 0 },
  last: { x: 0, y: 0 },
  snapshot: null,
  undo: [],
  redo: [],
};

const palette = [
  "#161616",
  "#ffffff",
  "#c92a2a",
  "#e67700",
  "#2f9e44",
  "#0c8599",
  "#1c7ed6",
  "#364fc7",
  "#862e9c",
  "#f08c00",
  "#ffe066",
  "#8ce99a",
  "#66d9e8",
  "#74c0fc",
  "#b197fc",
  "#adb5bd",
  "#495057",
  "#795548",
  "#ff8787",
  "#faa2c1",
  "#63e6be",
];

function setStatus(message) {
  statusText.textContent = message;
}

function prepareCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveHistory();
}

function saveHistory() {
  state.undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (state.undo.length > 30) {
    state.undo.shift();
  }
  state.redo.length = 0;
}

function restore(imageData) {
  ctx.putImageData(imageData, 0, 0);
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
    pageX: event.clientX,
    pageY: event.clientY,
  };
}

function configureStroke() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Number(brushSize.value);
  ctx.strokeStyle = state.tool === "eraser" ? "#ffffff" : primaryColor.value;
  ctx.fillStyle = state.tool === "eraser" ? "#ffffff" : fillColor.value;
}

function drawFreehand(from, to) {
  configureStroke();
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawShape(from, to) {
  configureStroke();
  const width = to.x - from.x;
  const height = to.y - from.y;
  ctx.beginPath();

  if (state.tool === "line") {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    return;
  }

  if (state.tool === "rectangle") {
    if (shapeFill.checked) {
      ctx.fillRect(from.x, from.y, width, height);
    }
    ctx.strokeRect(from.x, from.y, width, height);
    return;
  }

  if (state.tool === "circle") {
    const radiusX = Math.abs(width) / 2;
    const radiusY = Math.abs(height) / 2;
    const centerX = from.x + width / 2;
    const centerY = from.y + height / 2;
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    if (shapeFill.checked) {
      ctx.fill();
    }
    ctx.stroke();
  }
}

function hexToRgba(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function colorsMatch(data, index, target) {
  return (
    data[index] === target[0] &&
    data[index + 1] === target[1] &&
    data[index + 2] === target[2] &&
    data[index + 3] === target[3]
  );
}

function fillBucket(point) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const startX = Math.floor(point.x);
  const startY = Math.floor(point.y);
  const startIndex = (startY * canvas.width + startX) * 4;
  const target = [
    data[startIndex],
    data[startIndex + 1],
    data[startIndex + 2],
    data[startIndex + 3],
  ];
  const replacement = hexToRgba(fillColor.value);

  if (target.every((channel, index) => channel === replacement[index])) {
    return;
  }

  const stack = [[startX, startY]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      continue;
    }

    const index = (y * canvas.width + x) * 4;
    if (!colorsMatch(data, index, target)) {
      continue;
    }

    data[index] = replacement[0];
    data[index + 1] = replacement[1];
    data[index + 2] = replacement[2];
    data[index + 3] = replacement[3];

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(image, 0, 0);
  saveHistory();
  setStatus("Аймақ боялды");
}

function showTextInput(point) {
  const canvasRect = canvas.getBoundingClientRect();
  const wrapRect = canvas.parentElement.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  textInput.style.display = "block";
  textInput.style.left = `${canvasRect.left - wrapRect.left + point.x * scaleX}px`;
  textInput.style.top = `${canvasRect.top - wrapRect.top + point.y * scaleY}px`;
  textInput.style.fontSize = `${Math.max(14, Number(brushSize.value) * 4)}px`;
  textInput.value = "";
  textInput.dataset.x = String(point.x);
  textInput.dataset.y = String(point.y);
  textInput.focus();
}

function commitText() {
  const text = textInput.value.trim();
  textInput.style.display = "none";
  if (!text) {
    return;
  }

  configureStroke();
  const fontSize = Math.max(14, Number(brushSize.value) * 4);
  ctx.fillStyle = primaryColor.value;
  ctx.font = `${fontSize}px "Segoe UI", sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(text, Number(textInput.dataset.x), Number(textInput.dataset.y));
  saveHistory();
  setStatus("Мәтін қосылды");
}

function startDrawing(event) {
  event.preventDefault();
  const point = getPointerPosition(event);

  if (state.tool === "bucket") {
    fillBucket(point);
    return;
  }

  if (state.tool === "text") {
    showTextInput(point);
    return;
  }

  state.drawing = true;
  state.start = point;
  state.last = point;
  state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  setStatus("Салынып жатыр");
}

function draw(event) {
  if (!state.drawing) {
    return;
  }

  event.preventDefault();
  const point = getPointerPosition(event);

  if (state.tool === "pencil" || state.tool === "eraser") {
    drawFreehand(state.last, point);
    state.last = point;
    return;
  }

  restore(state.snapshot);
  drawShape(state.start, point);
}

function stopDrawing(event) {
  if (!state.drawing) {
    return;
  }

  draw(event);
  state.drawing = false;
  saveHistory();
  setStatus("Дайын");
}

function setTool(tool) {
  state.tool = tool;
  canvas.style.cursor = tool === "text" ? "text" : "crosshair";
  tools.forEach((button) => {
    const isActive = button.dataset.tool === tool;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  setStatus(`${tools.find((button) => button.dataset.tool === tool)?.textContent.trim()} таңдалды`);
}

function undo() {
  if (state.undo.length <= 1) {
    return;
  }

  state.redo.push(state.undo.pop());
  restore(state.undo[state.undo.length - 1]);
  setStatus("Болдырмау орындалды");
}

function redo() {
  const next = state.redo.pop();
  if (!next) {
    return;
  }

  state.undo.push(next);
  restore(next);
  setStatus("Қайтару орындалды");
}

function clearCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveHistory();
  setStatus("Кенеп тазаланды");
}

function resizeCanvas() {
  const width = Math.min(2400, Math.max(320, Number(canvasWidth.value) || canvas.width));
  const height = Math.min(1800, Math.max(240, Number(canvasHeight.value) || canvas.height));
  const current = document.createElement("canvas");
  current.width = canvas.width;
  current.height = canvas.height;
  current.getContext("2d").drawImage(canvas, 0, 0);

  canvas.width = width;
  canvas.height = height;
  canvasWidth.value = width;
  canvasHeight.value = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(current, 0, 0);
  state.undo.length = 0;
  state.redo.length = 0;
  saveHistory();
  setStatus("Кенеп өлшемі өзгерді");
}

function saveImage() {
  const link = document.createElement("a");
  link.download = `mini-paint-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  setStatus("PNG файлы дайын");
}

function renderSwatches() {
  swatches.replaceChildren(
    ...palette.map((color) => {
      const button = document.createElement("button");
      button.className = "swatch";
      button.type = "button";
      button.title = color;
      button.style.background = color;
      button.addEventListener("click", () => {
        primaryColor.value = color;
        document.querySelectorAll(".swatch").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
      });
      return button;
    }),
  );
}

tools.forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});

brushSize.addEventListener("input", () => {
  brushSizeValue.value = brushSize.value;
});

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

textInput.addEventListener("blur", commitText);
textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    commitText();
  }
  if (event.key === "Escape") {
    textInput.style.display = "none";
  }
});

document.querySelector("#undo").addEventListener("click", undo);
document.querySelector("#undoTop").addEventListener("click", undo);
document.querySelector("#undoBottom").addEventListener("click", undo);
document.querySelector("#redo").addEventListener("click", redo);
document.querySelector("#clearCanvas").addEventListener("click", clearCanvas);
document.querySelector("#resizeCanvas").addEventListener("click", resizeCanvas);
document.querySelector("#newCanvas").addEventListener("click", clearCanvas);
document.querySelector("#saveImage").addEventListener("click", saveImage);

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
      return;
    }
    undo();
  }
});

renderSwatches();
prepareCanvas();
