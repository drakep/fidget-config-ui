const FX_NAMES = [
    'Rainbow', 'Pulse', 'Solid', 'Ripple', 'Sparkle',
    'Rain', 'Fire', 'Spiral', 'Breathe', 'Glitch', 'Scroll',
    'Keys', 'Key Ripple', 'Key Rain'
];

const ble = new FidgetBLE();

const $ = id => document.getElementById(id);

// Populate effect dropdown
const effectSel = $('effect');
FX_NAMES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    effectSel.appendChild(opt);
});

// Debounce helper
function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// UI state
function setConnected(connected) {
    $('btn-connect').textContent = connected ? 'Disconnect' : 'Connect';
    $('ble-status').textContent = connected ? 'Connected' : 'Disconnected';
    $('ble-status').className = connected ? 'connected' : '';
    $('controls').className = connected ? '' : 'disabled';
}

// HSV to CSS color for hue preview
function hueToCSS(h) {
    return `hsl(${Math.round(h * 360)}, 100%, 50%)`;
}

function updateHuePreview() {
    const h = parseInt($('hue').value) / 1000;
    $('hue-preview').style.background = hueToCSS(h);
}

// Connect / disconnect
$('btn-connect').addEventListener('click', async () => {
    if (ble.connected) {
        ble.disconnect();
        return;
    }
    try {
        $('ble-status').textContent = 'Connecting...';
        await ble.connect();
        setConnected(true);

        // Read current values
        const vals = await ble.readAll();
        $('brightness').value = vals.brightness;
        $('brightness-val').textContent = vals.brightness;
        $('speed').value = vals.speed;
        $('speed-val').textContent = vals.speed;
        effectSel.value = vals.effect;
        $('hue').value = Math.round(vals.hue * 1000);
        updateHuePreview();
        $('scroll-msg').value = vals.scrollMsg;
    } catch (err) {
        console.error(err);
        $('ble-status').textContent = 'Failed: ' + err.message;
    }
});

ble.onDisconnect = () => setConnected(false);

ble.onStatus = (st) => {
    $('st-effect').textContent = FX_NAMES[st.effect] || st.effect;
    $('st-energy').textContent = Math.round(st.energy * 100);
    $('st-bri').textContent = st.brightness;
    $('st-spd').textContent = st.speed;

    // Update energy bar
    const pct = Math.round(st.energy * 100);
    $('energy-bar-fill').style.width = pct + '%';
};

// Slider handlers
const writeBri = debounce(v => ble.writeBrightness(v), 150);
$('brightness').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    $('brightness-val').textContent = v;
    if (ble.connected) writeBri(v);
});

const writeSpd = debounce(v => ble.writeSpeed(v), 150);
$('speed').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    $('speed-val').textContent = v;
    if (ble.connected) writeSpd(v);
});

effectSel.addEventListener('change', (e) => {
    if (ble.connected) ble.writeEffect(parseInt(e.target.value));
});

const writeHue = debounce(v => ble.writeHue(v), 150);
$('hue').addEventListener('input', (e) => {
    updateHuePreview();
    if (ble.connected) writeHue(parseInt(e.target.value) / 1000);
});

// Scroll message
function sendMsg() {
    if (ble.connected) {
        ble.writeScrollMsg($('scroll-msg').value);
    }
}
$('btn-send-msg').addEventListener('click', sendMsg);
$('scroll-msg').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMsg();
});

// Init
setConnected(false);
updateHuePreview();
