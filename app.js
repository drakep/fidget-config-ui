const FX_NAMES = [
    'Rainbow', 'Pulse', 'Solid', 'Ripple', 'Sparkle',
    'Rain', 'Fire', 'Spiral', 'Breathe', 'Glitch', 'Scroll',
    'Keys', 'Key Ripple', 'Key Rain', 'Draw'
];
const FX_DRAW_ID = 14;

const ble = new FidgetBLE();
const $ = id => document.getElementById(id);

/* ── Config Tab ── */
const effectSel = $('effect');
FX_NAMES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    effectSel.appendChild(opt);
});

function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function setConnected(on) {
    $('btn-connect').textContent = on ? 'Disconnect' : 'Connect';
    $('ble-status').textContent = on ? 'Connected' : 'Disconnected';
    $('ble-status').className = on ? 'connected' : '';
    $('controls').className = on ? '' : 'disabled';
}

function updateHuePreview() {
    $('hue-preview').style.background = `hsl(${parseInt($('hue').value) / 1000 * 360}, 100%, 50%)`;
}

$('btn-connect').addEventListener('click', async () => {
    if (ble.connected) { ble.disconnect(); return; }
    try {
        $('ble-status').textContent = 'Connecting...';
        await ble.connect();
        setConnected(true);
        const v = await ble.readAll();
        $('brightness').value = v.brightness;
        $('brightness-val').textContent = v.brightness;
        $('speed').value = v.speed;
        $('speed-val').textContent = v.speed;
        effectSel.value = v.effect;
        $('hue').value = Math.round(v.hue * 1000);
        updateHuePreview();
        $('scroll-msg').value = v.scrollMsg;
    } catch (e) {
        console.error(e);
        $('ble-status').textContent = 'Failed: ' + e.message;
    }
});

ble.onDisconnect = () => setConnected(false);
ble.onStatus = (st) => {
    $('st-effect').textContent = FX_NAMES[st.effect] || st.effect;
    $('st-energy').textContent = Math.round(st.energy * 100);
    $('st-bri').textContent = st.brightness;
    $('st-spd').textContent = st.speed;
    $('energy-bar-fill').style.width = Math.round(st.energy * 100) + '%';
};

const writeBri = debounce(v => ble.writeBrightness(v), 150);
$('brightness').addEventListener('input', e => {
    $('brightness-val').textContent = e.target.value;
    if (ble.connected) writeBri(parseInt(e.target.value));
});
const writeSpd = debounce(v => ble.writeSpeed(v), 150);
$('speed').addEventListener('input', e => {
    $('speed-val').textContent = e.target.value;
    if (ble.connected) writeSpd(parseInt(e.target.value));
});
effectSel.addEventListener('change', e => {
    if (ble.connected) ble.writeEffect(parseInt(e.target.value));
});
const writeHue = debounce(v => ble.writeHue(v), 150);
$('hue').addEventListener('input', () => {
    updateHuePreview();
    if (ble.connected) writeHue(parseInt($('hue').value) / 1000);
});
function sendMsg() { if (ble.connected) ble.writeScrollMsg($('scroll-msg').value); }
$('btn-send-msg').addEventListener('click', sendMsg);
$('scroll-msg').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

/* ── Tabs ── */
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        $('tab-' + btn.dataset.tab).classList.add('active');
    });
});

/* ── Draw Tab ── */
const COLS = 32, ROWS = 8, PX = 16;
const MAX_FRAMES = 8;
const canvas = $('draw-canvas');
canvas.width = COLS * PX;
canvas.height = ROWS * PX;
const ctx = canvas.getContext('2d');

let frames = [new Array(COLS * ROWS).fill(null)];  // null = off, [r,g,b]
let curFrame = 0;
let erasing = false;

function drawGrid() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const f = frames[curFrame];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const c = f[y * COLS + x];
            if (c) {
                ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
            } else {
                ctx.fillStyle = '#1a1a2e';
            }
            ctx.fillRect(x * PX + 1, y * PX + 1, PX - 2, PX - 2);
        }
    }
    // Block dividers
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    for (let bx = 1; bx < 4; bx++) {
        ctx.beginPath();
        ctx.moveTo(bx * 8 * PX, 0);
        ctx.lineTo(bx * 8 * PX, canvas.height);
        ctx.stroke();
    }
    $('frame-label').textContent = `${curFrame + 1} / ${frames.length}`;
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function canvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / PX);
    const y = Math.floor((e.clientY - rect.top) * scaleY / PX);
    return [x, y];
}

let painting = false;
let paintErase = false;

function paint(e) {
    const [x, y] = canvasXY(e);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    if (paintErase || erasing) {
        frames[curFrame][y * COLS + x] = null;
    } else {
        frames[curFrame][y * COLS + x] = hexToRgb($('draw-color').value);
    }
    drawGrid();
}

canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    painting = true;
    paintErase = (e.button === 2);
    paint(e);
});
canvas.addEventListener('mousemove', e => { if (painting) paint(e); });
canvas.addEventListener('mouseup', () => painting = false);
canvas.addEventListener('mouseleave', () => painting = false);
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Touch support
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    painting = true;
    paintErase = erasing;
    paint(e.touches[0]);
});
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (painting) paint(e.touches[0]);
});
canvas.addEventListener('touchend', () => painting = false);

$('btn-eraser').addEventListener('click', () => {
    erasing = !erasing;
    $('btn-eraser').classList.toggle('active', erasing);
});

$('btn-clear-frame').addEventListener('click', () => {
    frames[curFrame].fill(null);
    drawGrid();
});

$('btn-prev-frame').addEventListener('click', () => {
    if (curFrame > 0) { curFrame--; drawGrid(); }
});
$('btn-next-frame').addEventListener('click', () => {
    if (curFrame < frames.length - 1) { curFrame++; drawGrid(); }
});
$('btn-add-frame').addEventListener('click', () => {
    if (frames.length < MAX_FRAMES) {
        frames.push(new Array(COLS * ROWS).fill(null));
        curFrame = frames.length - 1;
        drawGrid();
    }
});
$('btn-dup-frame').addEventListener('click', () => {
    if (frames.length < MAX_FRAMES) {
        frames.push([...frames[curFrame]].map(c => c ? [...c] : null));
        curFrame = frames.length - 1;
        drawGrid();
    }
});
$('btn-del-frame').addEventListener('click', () => {
    if (frames.length > 1) {
        frames.splice(curFrame, 1);
        if (curFrame >= frames.length) curFrame = frames.length - 1;
        drawGrid();
    }
});

/* Animation preview */
let previewing = false;
let previewTimer = null;

function startPreview() {
    if (frames.length < 2) return;
    previewing = true;
    $('btn-preview').textContent = 'Stop';
    $('btn-preview').classList.add('active');
    let fi = 0;
    function tick() {
        curFrame = fi;
        drawGrid();
        fi = (fi + 1) % frames.length;
        const fps = parseInt($('draw-fps').value) || 4;
        previewTimer = setTimeout(tick, 1000 / fps);
    }
    tick();
}

function stopPreview() {
    previewing = false;
    $('btn-preview').textContent = 'Preview';
    $('btn-preview').classList.remove('active');
    if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
}

$('btn-preview').addEventListener('click', () => {
    if (previewing) stopPreview(); else startPreview();
});

$('draw-fps').addEventListener('input', e => {
    $('draw-fps-val').textContent = e.target.value + ' fps';
    if (previewing) { stopPreview(); startPreview(); }
});

$('btn-upload').addEventListener('click', async () => {
    if (!ble.connected) return;
    const btn = $('btn-upload');
    btn.textContent = 'Uploading...';
    btn.disabled = true;
    try {
        // Clear all frames on device
        await ble.drawClear(0xFF);
        await sleep(50);

        // Upload each frame pixel by pixel (only non-black pixels)
        // Pace writes to avoid overwhelming BLE stack
        let writeCount = 0;
        for (let fi = 0; fi < frames.length; fi++) {
            const f = frames[fi];
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const c = f[y * COLS + x];
                    if (c) {
                        await ble.drawSetPixel(fi, x, y, c[0], c[1], c[2]);
                        writeCount++;
                        if (writeCount % 8 === 0) await sleep(20);
                    }
                }
            }
            btn.textContent = `Frame ${fi + 1}/${frames.length}...`;
        }
        // Set config
        const fps = parseInt($('draw-fps').value);
        const speed = Math.max(1, Math.round(60 / fps));
        await ble.drawSetConfig(frames.length, speed);
        btn.textContent = 'Uploaded!';
        setTimeout(() => { btn.textContent = 'Upload to Device'; btn.disabled = false; }, 1500);
    } catch (e) {
        console.error(e);
        btn.textContent = 'Error: ' + e.message;
        setTimeout(() => { btn.textContent = 'Upload to Device'; btn.disabled = false; }, 2000);
    }
});

$('btn-activate-draw').addEventListener('click', async () => {
    if (ble.connected) {
        await ble.writeEffect(FX_DRAW_ID);
        effectSel.value = FX_DRAW_ID;
    }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Init
setConnected(false);
updateHuePreview();
drawGrid();
