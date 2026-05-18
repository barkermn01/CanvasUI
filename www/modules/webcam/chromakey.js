/**
 * ChromaKey — WebGL-based chroma key (green/blue screen) removal.
 * Processes a video element through a GPU shader and outputs to an offscreen canvas.
 * 
 * Usage:
 *   const ck = new ChromaKey();
 *   ck.setKey('#00ff00', 0.4, 0.08);
 *   const output = ck.process(videoElement);
 *   // output is a canvas element with transparent background where the key color was
 */

class ChromaKey {
    #gl = null;
    #canvas = null;
    #program = null;
    #texture = null;
    #ready = false;

    // Uniform locations
    #uTexture = null;
    #uKeyColor = null;
    #uSimilarity = null;
    #uSmoothness = null;
    #uSpillReduction = null;

    // Current settings
    #keyColor = [0, 1, 0]; // RGB normalized
    #similarity = 0.4;
    #smoothness = 0.08;
    #spillReduction = 0.1;

    constructor() {
        this.#canvas = document.createElement('canvas');
        this.#canvas.style.display = 'none';

        const gl = this.#canvas.getContext('webgl', {
            premultipliedAlpha: false,
            alpha: true,
            preserveDrawingBuffer: true
        });

        if (!gl) {
            console.warn('[ChromaKey] WebGL not available');
            return;
        }

        this.#gl = gl;
        this.#initShaders();
        this.#initGeometry();
        this.#texture = gl.createTexture();
        this.#ready = true;
    }

    get isAvailable() { return this.#ready; }
    get canvas() { return this.#canvas; }

    #initShaders() {
        const gl = this.#gl;

        const vsSource = `
            attribute vec2 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            void main() {
                gl_Position = vec4(aPosition, 0.0, 1.0);
                vTexCoord = aTexCoord;
            }
        `;

        // Chroma key fragment shader using color distance in YCbCr space
        // YCbCr gives better results than RGB for chroma keying because it
        // separates luminance from chrominance
        const fsSource = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            uniform vec3 uKeyColor;
            uniform float uSimilarity;
            uniform float uSmoothness;
            uniform float uSpillReduction;

            // Convert RGB to YCbCr
            vec2 rgbToCbCr(vec3 rgb) {
                float cb = 0.5 + (-0.168736 * rgb.r - 0.331264 * rgb.g + 0.5 * rgb.b);
                float cr = 0.5 + (0.5 * rgb.r - 0.418688 * rgb.g - 0.081312 * rgb.b);
                return vec2(cb, cr);
            }

            void main() {
                vec4 pixel = texture2D(uTexture, vTexCoord);
                vec2 pixelCbCr = rgbToCbCr(pixel.rgb);
                vec2 keyCbCr = rgbToCbCr(uKeyColor);

                // Distance in CbCr space
                float dist = distance(pixelCbCr, keyCbCr);

                // Compute alpha with smooth falloff
                float alpha = smoothstep(uSimilarity, uSimilarity + uSmoothness, dist);

                // Spill reduction — desaturate pixels near the key color
                if (uSpillReduction > 0.0) {
                    float spillFactor = 1.0 - smoothstep(uSimilarity, uSimilarity + uSmoothness * 4.0, dist);
                    float luminance = dot(pixel.rgb, vec3(0.299, 0.587, 0.114));
                    pixel.rgb = mix(pixel.rgb, vec3(luminance), spillFactor * uSpillReduction);
                }

                gl_FragColor = vec4(pixel.rgb * alpha, alpha);
            }
        `;

        const vs = this.#compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.#compileShader(gl.FRAGMENT_SHADER, fsSource);

        this.#program = gl.createProgram();
        gl.attachShader(this.#program, vs);
        gl.attachShader(this.#program, fs);
        gl.linkProgram(this.#program);

        if (!gl.getProgramParameter(this.#program, gl.LINK_STATUS)) {
            console.error('[ChromaKey] Shader link error:', gl.getProgramInfoLog(this.#program));
            this.#ready = false;
            return;
        }

        gl.useProgram(this.#program);

        // Get uniform locations
        this.#uTexture = gl.getUniformLocation(this.#program, 'uTexture');
        this.#uKeyColor = gl.getUniformLocation(this.#program, 'uKeyColor');
        this.#uSimilarity = gl.getUniformLocation(this.#program, 'uSimilarity');
        this.#uSmoothness = gl.getUniformLocation(this.#program, 'uSmoothness');
        this.#uSpillReduction = gl.getUniformLocation(this.#program, 'uSpillReduction');
    }

    #compileShader(type, source) {
        const gl = this.#gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('[ChromaKey] Shader compile error:', gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    #initGeometry() {
        const gl = this.#gl;

        // Full-screen quad (two triangles)
        const positions = new Float32Array([
            -1, -1,  1, -1,  -1, 1,
            -1,  1,  1, -1,   1, 1
        ]);
        const texCoords = new Float32Array([
            0, 1,  1, 1,  0, 0,
            0, 0,  1, 1,  1, 0
        ]);

        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const aPosition = gl.getAttribLocation(this.#program, 'aPosition');
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

        const texBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        const aTexCoord = gl.getAttribLocation(this.#program, 'aTexCoord');
        gl.enableVertexAttribArray(aTexCoord);
        gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     * Update chroma key settings.
     * @param {string} hexColor - Key color as hex string (e.g. '#00ff00')
     * @param {number} similarity - How close a color must be to the key to be removed (0-1, default 0.4)
     * @param {number} smoothness - Edge softness (0-1, default 0.08)
     * @param {number} spillReduction - How much to desaturate spill near edges (0-1, default 0.1)
     */
    setKey(hexColor, similarity, smoothness, spillReduction) {
        if (hexColor) {
            this.#keyColor = this.#hexToRgb(hexColor);
        }
        if (similarity !== undefined) this.#similarity = similarity;
        if (smoothness !== undefined) this.#smoothness = smoothness;
        if (spillReduction !== undefined) this.#spillReduction = spillReduction;
    }

    #hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return [
            parseInt(hex.substring(0, 2), 16) / 255,
            parseInt(hex.substring(2, 4), 16) / 255,
            parseInt(hex.substring(4, 6), 16) / 255
        ];
    }

    /**
     * Process a video frame through the chroma key shader.
     * @param {HTMLVideoElement} video - Source video element
     * @returns {HTMLCanvasElement} - The WebGL canvas with the keyed result
     */
    process(video) {
        if (!this.#ready || !video || video.readyState < 2) return null;

        const gl = this.#gl;
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // Resize canvas to match video
        if (this.#canvas.width !== vw || this.#canvas.height !== vh) {
            this.#canvas.width = vw;
            this.#canvas.height = vh;
            gl.viewport(0, 0, vw, vh);
        }

        // Upload video frame to texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        // Set uniforms
        gl.useProgram(this.#program);
        gl.uniform1i(this.#uTexture, 0);
        gl.uniform3fv(this.#uKeyColor, this.#keyColor);
        gl.uniform1f(this.#uSimilarity, this.#similarity);
        gl.uniform1f(this.#uSmoothness, this.#smoothness);
        gl.uniform1f(this.#uSpillReduction, this.#spillReduction);

        // Clear and draw
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        return this.#canvas;
    }

    dispose() {
        if (this.#gl) {
            this.#gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
        this.#gl = null;
        this.#ready = false;
    }
}

window.ChromaKey = ChromaKey;
