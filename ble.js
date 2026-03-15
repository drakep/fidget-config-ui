const SERVICE_UUID    = 'f1d6e7c0-0001-4f69-6467-65746f766572';
const CHAR_BRIGHTNESS = 'f1d6e7c0-0002-4f69-6467-65746f766572';
const CHAR_SPEED      = 'f1d6e7c0-0003-4f69-6467-65746f766572';
const CHAR_EFFECT     = 'f1d6e7c0-0004-4f69-6467-65746f766572';
const CHAR_HUE        = 'f1d6e7c0-0005-4f69-6467-65746f766572';
const CHAR_SCROLL_MSG = 'f1d6e7c0-0006-4f69-6467-65746f766572';
const CHAR_STATUS     = 'f1d6e7c0-0007-4f69-6467-65746f766572';
const CHAR_DRAW       = 'f1d6e7c0-0008-4f69-6467-65746f766572';

class FidgetBLE {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.chars = {};
        this.onDisconnect = null;
        this.onStatus = null;
    }

    async connect() {
        this.device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'Fidget' }],
            optionalServices: [SERVICE_UUID]
        });

        this.device.addEventListener('gattserverdisconnected', () => {
            this.chars = {};
            this.server = null;
            this.service = null;
            if (this.onDisconnect) this.onDisconnect();
        });

        this.server = await this.device.gatt.connect();
        this.service = await this.server.getPrimaryService(SERVICE_UUID);

        this.chars.brightness = await this.service.getCharacteristic(CHAR_BRIGHTNESS);
        this.chars.speed      = await this.service.getCharacteristic(CHAR_SPEED);
        this.chars.effect     = await this.service.getCharacteristic(CHAR_EFFECT);
        this.chars.hue        = await this.service.getCharacteristic(CHAR_HUE);
        this.chars.scrollMsg  = await this.service.getCharacteristic(CHAR_SCROLL_MSG);
        this.chars.status     = await this.service.getCharacteristic(CHAR_STATUS);
        this.chars.draw       = await this.service.getCharacteristic(CHAR_DRAW);

        await this.chars.status.startNotifications();
        this.chars.status.addEventListener('characteristicvaluechanged', (ev) => {
            const dv = ev.target.value;
            if (dv.byteLength >= 7 && this.onStatus) {
                this.onStatus({
                    effect:     dv.getUint8(0),
                    energy:     dv.getFloat32(1, true),
                    brightness: dv.getUint8(5),
                    speed:      dv.getUint8(6)
                });
            }
        });
    }

    async readAll() {
        const bri = await this.chars.brightness.readValue();
        const spd = await this.chars.speed.readValue();
        const fx  = await this.chars.effect.readValue();
        const hue = await this.chars.hue.readValue();
        const msg = await this.chars.scrollMsg.readValue();
        const decoder = new TextDecoder();
        return {
            brightness: bri.getUint8(0),
            speed:      spd.getUint8(0),
            effect:     fx.getUint8(0),
            hue:        hue.getFloat32(0, true),
            scrollMsg:  decoder.decode(msg.buffer)
        };
    }

    async writeBrightness(val) {
        await this.chars.brightness.writeValueWithoutResponse(new Uint8Array([val & 0xFF]));
    }
    async writeSpeed(val) {
        await this.chars.speed.writeValueWithoutResponse(new Uint8Array([val & 0xFF]));
    }
    async writeEffect(val) {
        await this.chars.effect.writeValueWithoutResponse(new Uint8Array([val & 0xFF]));
    }
    async writeHue(val) {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, val, true);
        await this.chars.hue.writeValueWithoutResponse(new Uint8Array(buf));
    }
    async writeScrollMsg(str) {
        await this.chars.scrollMsg.writeValueWithoutResponse(new TextEncoder().encode(str.substring(0, 63)));
    }

    /* Draw commands: [cmd, ...args] */
    async drawSetPixel(frame, x, y, r, g, b) {
        await this.chars.draw.writeValueWithoutResponse(new Uint8Array([0, frame, x, y, r, g, b]));
    }
    async drawClear(frame) {
        await this.chars.draw.writeValueWithoutResponse(new Uint8Array([1, frame]));
    }
    async drawSetConfig(frameCount, speed) {
        await this.chars.draw.writeValueWithoutResponse(new Uint8Array([2, frameCount, speed]));
    }

    disconnect() {
        if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
    }
    get connected() {
        return this.server && this.server.connected;
    }
}
