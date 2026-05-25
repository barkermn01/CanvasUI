class ColorPicker {
    static #activePopup = null;

    /**
     * Creates a color swatch element that opens an inline color picker on click.
     * @param {string} initialColor - Hex color value (#RGB, #RRGGBB, #RRGGBBAA, or rgba())
     * @param {function} onChange - Callback with new color string
     * @returns {HTMLElement} The swatch element
     */
    static create(initialColor, onChange) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = initialColor;
        swatch.dataset.color = initialColor;

        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            ColorPicker.#openPopup(swatch, onChange);
        });

        return swatch;
    }

    static #openPopup(swatch, onChange) {
        // Close any existing popup
        ColorPicker.#closePopup();

        const color = swatch.dataset.color || '#ffffff';
        const parsed = ColorPicker.#parseColor(color);
        const hsv = ColorPicker.#rgbToHsv(parsed.r, parsed.g, parsed.b);

        const popup = document.createElement('div');
        popup.className = 'color-picker-popup';
        popup.innerHTML = `
            <canvas class="cp-saturation" width="200" height="150"></canvas>
            <canvas class="cp-hue-bar" width="200" height="14"></canvas>
            <canvas class="cp-alpha-bar" width="200" height="14"></canvas>
            <div class="cp-hex-row">
                <span class="cp-preview-swatch"></span>
                <input type="text" class="cp-hex-input" value="${color}" maxlength="30">
            </div>
        `;

        // Position near the swatch, but keep within viewport
        const rect = swatch.getBoundingClientRect();
        const popupWidth = 220;
        const popupHeight = 240;

        let top = rect.bottom + 4;
        let left = rect.left;

        if (top + popupHeight > window.innerHeight) {
            top = rect.top - popupHeight - 4;
        }
        if (left + popupWidth > window.innerWidth) {
            left = rect.right - popupWidth;
        }
        if (left < 4) left = 4;
        if (top < 4) top = 4;

        popup.style.top = top + 'px';
        popup.style.left = left + 'px';

        document.body.appendChild(popup);
        ColorPicker.#activePopup = popup;

        const satCanvas = popup.querySelector('.cp-saturation');
        const hueCanvas = popup.querySelector('.cp-hue-bar');
        const alphaCanvas = popup.querySelector('.cp-alpha-bar');
        const hexInput = popup.querySelector('.cp-hex-input');
        const previewSwatch = popup.querySelector('.cp-preview-swatch');

        let currentHsv = { ...hsv };
        let currentAlpha = parsed.a;

        const update = () => {
            const rgb = ColorPicker.#hsvToRgb(currentHsv.h, currentHsv.s, currentHsv.v);
            const output = ColorPicker.#formatOutput(rgb.r, rgb.g, rgb.b, currentAlpha);
            const displayColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${currentAlpha})`;
            swatch.style.backgroundColor = displayColor;
            swatch.dataset.color = output;
            previewSwatch.style.backgroundColor = displayColor;
            hexInput.value = output;
            ColorPicker.#drawSaturation(satCanvas, currentHsv.h);
            ColorPicker.#drawSatCursor(satCanvas, currentHsv.s, currentHsv.v);
            ColorPicker.#drawHueBar(hueCanvas);
            ColorPicker.#drawBarCursor(hueCanvas, currentHsv.h);
            ColorPicker.#drawAlphaBar(alphaCanvas, rgb.r, rgb.g, rgb.b);
            ColorPicker.#drawBarCursor(alphaCanvas, currentAlpha);
            onChange(output);
        };

        // Draw initial state
        const initRgb = ColorPicker.#hsvToRgb(currentHsv.h, currentHsv.s, currentHsv.v);
        ColorPicker.#drawSaturation(satCanvas, currentHsv.h);
        ColorPicker.#drawSatCursor(satCanvas, currentHsv.s, currentHsv.v);
        ColorPicker.#drawHueBar(hueCanvas);
        ColorPicker.#drawBarCursor(hueCanvas, currentHsv.h);
        ColorPicker.#drawAlphaBar(alphaCanvas, initRgb.r, initRgb.g, initRgb.b);
        ColorPicker.#drawBarCursor(alphaCanvas, currentAlpha);
        previewSwatch.style.backgroundColor = `rgba(${parsed.r},${parsed.g},${parsed.b},${parsed.a})`;

        // Saturation/Value picker
        let satDragging = false;
        const pickSat = (e) => {
            const r = satCanvas.getBoundingClientRect();
            currentHsv.s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            currentHsv.v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
            update();
        };
        satCanvas.addEventListener('mousedown', (e) => { satDragging = true; pickSat(e); });
        document.addEventListener('mousemove', (e) => { if (satDragging) pickSat(e); });
        document.addEventListener('mouseup', () => { satDragging = false; });

        // Hue bar
        let hueDragging = false;
        const pickHue = (e) => {
            const r = hueCanvas.getBoundingClientRect();
            currentHsv.h = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            update();
        };
        hueCanvas.addEventListener('mousedown', (e) => { hueDragging = true; pickHue(e); });
        document.addEventListener('mousemove', (e) => { if (hueDragging) pickHue(e); });
        document.addEventListener('mouseup', () => { hueDragging = false; });

        // Alpha bar
        let alphaDragging = false;
        const pickAlpha = (e) => {
            const r = alphaCanvas.getBoundingClientRect();
            currentAlpha = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            currentAlpha = Math.round(currentAlpha * 100) / 100;
            update();
        };
        alphaCanvas.addEventListener('mousedown', (e) => { alphaDragging = true; pickAlpha(e); });
        document.addEventListener('mousemove', (e) => { if (alphaDragging) pickAlpha(e); });
        document.addEventListener('mouseup', () => { alphaDragging = false; });

        // Hex/rgba input
        hexInput.addEventListener('change', () => {
            const val = hexInput.value.trim();
            const parsed = ColorPicker.#parseColor(val);
            if (parsed) {
                currentHsv = ColorPicker.#rgbToHsv(parsed.r, parsed.g, parsed.b);
                currentAlpha = parsed.a;
                update();
            }
        });

        // Close on click outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popup.contains(e.target) && e.target !== swatch) {
                    ColorPicker.#closePopup();
                    document.removeEventListener('mousedown', closeHandler);
                }
            };
            document.addEventListener('mousedown', closeHandler);
        }, 0);
    }

    static #closePopup() {
        if (ColorPicker.#activePopup) {
            ColorPicker.#activePopup.remove();
            ColorPicker.#activePopup = null;
        }
    }

    static #drawSaturation(canvas, hue) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        const hueRgb = ColorPicker.#hsvToRgb(hue, 1, 1);
        const hueColor = `rgb(${hueRgb.r},${hueRgb.g},${hueRgb.b})`;

        const gradH = ctx.createLinearGradient(0, 0, w, 0);
        gradH.addColorStop(0, '#ffffff');
        gradH.addColorStop(1, hueColor);
        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, w, h);

        const gradV = ctx.createLinearGradient(0, 0, 0, h);
        gradV.addColorStop(0, 'rgba(0,0,0,0)');
        gradV.addColorStop(1, '#000000');
        ctx.fillStyle = gradV;
        ctx.fillRect(0, 0, w, h);
    }

    static #drawHueBar(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 6; i++) {
            grad.addColorStop(i / 6, `hsl(${i * 60}, 100%, 50%)`);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    static #drawAlphaBar(canvas, r, g, b) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Checkerboard background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#cccccc';
        const size = 7;
        for (let x = 0; x < w; x += size) {
            for (let y = 0; y < h; y += size) {
                if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
                    ctx.fillRect(x, y, size, size);
                }
            }
        }

        // Alpha gradient
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * Draw a vertical cursor line on a horizontal bar (hue or alpha)
     */
    static #drawBarCursor(canvas, position) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const x = Math.round(position * w);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 3, 0, 6, h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 2, 1, 4, h - 2);
    }

    /**
     * Draw a circle cursor on the saturation/value canvas
     */
    static #drawSatCursor(canvas, s, v) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const x = Math.round(s * w);
        const y = Math.round((1 - v) * h);

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /**
     * Parse any color format into {r, g, b, a} (0-255 for rgb, 0-1 for a)
     */
    static #parseColor(str) {
        if (!str) return { r: 255, g: 255, b: 255, a: 1 };

        // #RRGGBB
        if (/^#[0-9a-fA-F]{6}$/.test(str)) {
            return {
                r: parseInt(str.slice(1, 3), 16),
                g: parseInt(str.slice(3, 5), 16),
                b: parseInt(str.slice(5, 7), 16),
                a: 1
            };
        }

        // #RRGGBBAA
        if (/^#[0-9a-fA-F]{8}$/.test(str)) {
            return {
                r: parseInt(str.slice(1, 3), 16),
                g: parseInt(str.slice(3, 5), 16),
                b: parseInt(str.slice(5, 7), 16),
                a: Math.round((parseInt(str.slice(7, 9), 16) / 255) * 100) / 100
            };
        }

        // #RGB
        if (/^#[0-9a-fA-F]{3}$/.test(str)) {
            return {
                r: parseInt(str[1] + str[1], 16),
                g: parseInt(str[2] + str[2], 16),
                b: parseInt(str[3] + str[3], 16),
                a: 1
            };
        }

        // rgba(r, g, b, a)
        const rgbaMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]),
                g: parseInt(rgbaMatch[2]),
                b: parseInt(rgbaMatch[3]),
                a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
            };
        }

        return { r: 255, g: 255, b: 255, a: 1 };
    }

    /**
     * Format output — uses #RRGGBB if fully opaque, #RRGGBBAA if not
     */
    static #formatOutput(r, g, b, a) {
        const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
        if (a >= 1) {
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }
        const alphaHex = toHex(Math.round(a * 255));
        return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`;
    }

    static #rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let h = 0, s = max === 0 ? 0 : d / max, v = max;

        if (d !== 0) {
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }

        return { h, s, v };
    }

    static #hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // Keep old method for backwards compatibility
    static #hexToHsv(hex) {
        const parsed = ColorPicker.#parseColor(hex);
        return ColorPicker.#rgbToHsv(parsed.r, parsed.g, parsed.b);
    }

    static #hsvToHex(h, s, v) {
        const rgb = ColorPicker.#hsvToRgb(h, s, v);
        const toHex = (n) => n.toString(16).padStart(2, '0');
        return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
    }
}
