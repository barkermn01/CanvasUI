class ColorPicker {
    static #activePopup = null;

    /**
     * Creates a color swatch element that opens an inline color picker on click.
     * @param {string} initialColor - Hex color value
     * @param {function} onChange - Callback with new hex color
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
        const hsv = ColorPicker.#hexToHsv(color);

        const popup = document.createElement('div');
        popup.className = 'color-picker-popup';
        popup.innerHTML = `
            <canvas class="cp-saturation" width="200" height="150"></canvas>
            <canvas class="cp-hue-bar" width="200" height="14"></canvas>
            <div class="cp-hex-row">
                <span class="cp-preview-swatch"></span>
                <input type="text" class="cp-hex-input" value="${color}" maxlength="7">
            </div>
        `;

        // Position near the swatch
        const rect = swatch.getBoundingClientRect();
        popup.style.top = (rect.bottom + 4) + 'px';
        popup.style.left = rect.left + 'px';

        document.body.appendChild(popup);
        ColorPicker.#activePopup = popup;

        const satCanvas = popup.querySelector('.cp-saturation');
        const hueCanvas = popup.querySelector('.cp-hue-bar');
        const hexInput = popup.querySelector('.cp-hex-input');
        const previewSwatch = popup.querySelector('.cp-preview-swatch');

        let currentHsv = { ...hsv };

        const update = () => {
            const hex = ColorPicker.#hsvToHex(currentHsv.h, currentHsv.s, currentHsv.v);
            swatch.style.backgroundColor = hex;
            swatch.dataset.color = hex;
            previewSwatch.style.backgroundColor = hex;
            hexInput.value = hex;
            ColorPicker.#drawSaturation(satCanvas, currentHsv.h);
            ColorPicker.#drawHueBar(hueCanvas);
            onChange(hex);
        };

        // Draw initial state
        ColorPicker.#drawSaturation(satCanvas, currentHsv.h);
        ColorPicker.#drawHueBar(hueCanvas);
        previewSwatch.style.backgroundColor = color;

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

        // Hex input
        hexInput.addEventListener('change', () => {
            let val = hexInput.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                currentHsv = ColorPicker.#hexToHsv(val);
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

        // Base hue color
        const hueColor = ColorPicker.#hsvToHex(hue, 1, 1);

        // White to hue gradient (horizontal)
        const gradH = ctx.createLinearGradient(0, 0, w, 0);
        gradH.addColorStop(0, '#ffffff');
        gradH.addColorStop(1, hueColor);
        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, w, h);

        // Black gradient (vertical)
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

    static #hexToHsv(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;

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

    static #hsvToHex(h, s, v) {
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

        const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}
