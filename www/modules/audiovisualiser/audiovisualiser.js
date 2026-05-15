if (!window.AudioVisualiser) {

window.AudioVisualiser = class AudioVisualiser {
    constructor() {
        this.name = "audiovisualiser";
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.mediaStream = null;
        this.initialized = false;
        this.error = null;
        this.devices = [];
        this.permissionGranted = false;
        this.permissionRequested = false;


        // Get the microphone — check config first, then URL param as fallback
        const urlParams = new URLSearchParams(window.location.search);
        this.selectedDeviceName = Config.AudioVisualiser?.device 
            || decodeURIComponent(urlParams.get('microphone') || '');

        // Initialize audio
        this.initAudio();
    }

    async requestPermissions() {
        try {
            this.permissionRequested = true;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the temporary stream
            this.permissionGranted = true;
            this.initAudio(); // Reinitialize with actual device
        } catch (error) {
            console.error("Permission request failed:", error);
            this.permissionGranted = false;
        }
    }

    calculateArea(ctx) {
        const config = Config.AudioVisualiser;
        const area = { x: 0, y: 0, width: 0, height: 0 };
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
    
        // Handle horizontal positioning
        if (config.area.left !== null && config.area.right !== null) {
            const left = this.parsePosition(config.area.left, canvasWidth);
            const right = this.parsePosition(config.area.right, canvasWidth);
            area.x = left;
            area.width = canvasWidth - left - right;
        } else if (config.area.left !== null) {
            area.x = this.parsePosition(config.area.left, canvasWidth);
            area.width = canvasWidth - area.x;
        } else if (config.area.right !== null) {
            const right = this.parsePosition(config.area.right, canvasWidth);
            area.width = canvasWidth - right;
        } else {
            area.width = canvasWidth;
        }
    
        // Handle vertical positioning
        if (config.area.top !== null && config.area.bottom !== null) {
            const top = this.parsePosition(config.area.top, canvasHeight);
            const bottom = this.parsePosition(config.area.bottom, canvasHeight);
            area.y = top;
            area.height = canvasHeight - top - bottom;
        } else if (config.area.height) {
            area.y = config.area.top ? this.parsePosition(config.area.top, canvasHeight) : 0;
            area.height = this.parsePosition(config.area.height, canvasHeight);
        } else {
            area.height = canvasHeight;
        }
    
        return area;
    }
    
    parsePosition(value, dimension) {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return 0;
        
        if (value.endsWith('px')) {
            return parseInt(value);
        }
        if (value.endsWith('%')) {
            return (parseInt(value) / 100) * dimension;
        }
        return parseInt(value) || 0;
    }

    async initAudio() {
        try {
            // Check if we have permission
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            
            if (permissionStatus.state === 'granted') {
                this.permissionGranted = true;
            } else if (permissionStatus.state === 'prompt' && !this.permissionRequested) {
                await this.requestPermissions();
                return;
            } else if (permissionStatus.state === 'denied') {
                this.permissionGranted = false;
                this.error = "permission";
                return;
            }

            if (!this.permissionGranted) {
                this.error = "permission";
                return;
            }

            // Get list of audio devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'audioinput');

            if (!this.selectedDeviceName) {
                this.error = "missing";
                return;
            }

            // Find device by name
            const selectedDevice = this.devices.find(d => d.label === this.selectedDeviceName);
            if (!selectedDevice) {
                this.error = "invalid";
                return;
            }

            // Set up audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 1024;
            
            // Get audio stream with persistent settings
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: selectedDevice.deviceId },
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false,
                    channelCount: 1,
                    sampleRate: 44100
                }
            });

            // Make the track persistent
            stream.getTracks().forEach(track => {
                track.contentHint = 'music';  // Hint that this is for music/audio visualization
                track.applyConstraints({
                    suppressLocalAudioPlayback: true,  // Prevent audio feedback
                    deviceId: { exact: selectedDevice.deviceId },
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false
                });
            });

            this.mediaStream = stream;
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.initialized = true;

        } catch (error) {
            console.error("Audio initialization error:", error);
            this.error = "error";
        }
    }

    getColor(value) {
        const colors = Config.AudioVisualiser.colors;
        if (value < 25) return colors.level1;
        if (value < 50) return colors.level2;
        if (value < 75) return colors.level3;
        return colors.level4;
    }

    createBarGradient(ctx, x, y, width, height) {
        const config = Config.AudioVisualiser;
        const isVertical = config.direction === 'right-left' || config.direction === 'left-right';
        
        // Gradient runs along the bar's length (bottom-to-top for vertical, left-to-right for horizontal)
        let gradient;
        if (isVertical) {
            gradient = ctx.createLinearGradient(x, y + height, x, y);
        } else {
            gradient = ctx.createLinearGradient(x, y, x + width, y);
        }

        const stops = config.colors.gradient.stops;
        stops.forEach(stop => {
            gradient.addColorStop(stop.position, stop.color);
        });

        return gradient;
    }

    drawBars(ctx, sceneArea) {
        const config = Config.AudioVisualiser;
        const area = sceneArea || this.calculateArea(ctx);
        const isVertical = config.direction === 'right-left' || config.direction === 'left-right';
        const barSize = isVertical ? config.barWidth : config.barHeight;
        const spacing = config.barSpacing;
        const availableSpace = isVertical ? area.width : area.height;
        const maxBars = Math.floor(availableSpace / (barSize + spacing));
        const maxBarLength = isVertical ? area.height : area.width;
        const halfLength = config.mirrored ? maxBarLength / 2 : maxBarLength;
        const center = isVertical ? area.y + (area.height / 2) : area.x + (area.width / 2);
        const useGradient = config.colors.mode === "gradient";

        // Draw background only for the visualization area
        if (config.backgroundColor && config.backgroundColor !== 'transparent') {
            ctx.fillStyle = config.backgroundColor;
            ctx.fillRect(area.x, area.y, area.width, area.height);
        }
    
        for (let i = 0; i < maxBars; i++) {
            const value = this.dataArray[i] / 255 * 100;
            const size = (value / 100) * halfLength;
            const position = i * (barSize + spacing);

            // Calculate bar coordinates based on direction before setting fill
            let barX, barY, barW, barH;
            
            switch(config.direction) {
                case 'right-left':
                    barX = area.x + area.width - position - barSize;
                    if (config.mirrored) {
                        barY = center - size;
                        barW = barSize;
                        barH = size;
                    } else {
                        barY = area.y + area.height - size;
                        barW = barSize;
                        barH = size;
                    }
                    break;
                case 'left-right':
                    barX = area.x + position;
                    if (config.mirrored) {
                        barY = center - size;
                        barW = barSize;
                        barH = size;
                    } else {
                        barY = area.y + area.height - size;
                        barW = barSize;
                        barH = size;
                    }
                    break;
                case 'top-down':
                    barY = area.y + position;
                    if (config.mirrored) {
                        barX = center - size;
                        barW = size;
                        barH = barSize;
                    } else {
                        barX = area.x;
                        barW = size;
                        barH = barSize;
                    }
                    break;
                case 'bottom-up':
                    barY = area.y + position;
                    if (config.mirrored) {
                        barX = center - size;
                        barW = size;
                        barH = barSize;
                    } else {
                        barX = area.x + area.width - size;
                        barW = size;
                        barH = barSize;
                    }
                    break;
            }

            // Set fill style based on mode
            if (useGradient) {
                ctx.fillStyle = this.createBarGradient(ctx, barX, barY, barW, barH);
            } else {
                ctx.fillStyle = this.getColor(value);
            }

            // Draw the bar(s)
            ctx.fillRect(barX, barY, barW, barH);

            // Draw mirrored half if applicable
            if (config.mirrored) {
                if (isVertical) {
                    // Mirror below center
                    const mirrorY = center;
                    if (useGradient) {
                        ctx.fillStyle = this.createBarGradient(ctx, barX, mirrorY, barW, barH);
                    }
                    ctx.fillRect(barX, mirrorY, barW, barH);
                } else {
                    // Mirror to the right of center
                    const mirrorX = center;
                    if (useGradient) {
                        ctx.fillStyle = this.createBarGradient(ctx, mirrorX, barY, barW, barH);
                    }
                    ctx.fillRect(mirrorX, barY, barW, barH);
                }
            }
        }
    }
    
    drawDeviceList(ctx, width, height, headerText) {
        let y = height / 3;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';

        ctx.fillText(headerText, width/2, y);
        y += 40;

        // Draw each device option as a clickable area
        this.devices.forEach((device, index) => {
            const text = `${device.label}`;
            const metrics = ctx.measureText(text);
            
            // Calculate text bounds
            const textHeight = 30;
            const textWidth = metrics.width;
            const textX = width/2 - textWidth/2;
            const textY = y;

            // Store clickable area if not already stored
            if (!this.clickableAreas) {
                this.clickableAreas = [];
            }
            this.clickableAreas[index] = {
                x: textX,
                y: textY - 20,
                width: textWidth,
                height: textHeight,
                deviceLabel: device.label
            };

            // Draw text
            ctx.fillText(text, width/2, y);
            
            // Draw underline to indicate clickable
            ctx.beginPath();
            ctx.moveTo(textX, textY + 2);
            ctx.lineTo(textX + textWidth, textY + 2);
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();

            y += 30;
        });

        // Add click handler if not already added
        if (!this.deviceClickListener) {
            this.deviceClickListener = (e) => {
                const rect = ctx.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                this.clickableAreas?.forEach(area => {
                    if (x >= area.x && x <= area.x + area.width &&
                        y >= area.y && y <= area.y + area.height) {
                        const url = new URL(window.location.href);
                        url.searchParams.set('microphone', area.deviceLabel);
                        url.searchParams.set('allowaudio', 'true');
                        url.searchParams.set('ENABLE_OBS_WEBSOCKET_DEBUG', '1');
                        window.location.href = url.toString();
                    }
                });
            };
            ctx.canvas.addEventListener('click', this.deviceClickListener);
        }
    }

    draw(ctx, sceneArea) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
    
        // Clear previous clickable areas
        this.clickableAreas = null;
    
        if (this.error === "permission") {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            let y = height / 3;
    
            if (!this.permissionRequested) {
                ctx.fillText("Click anywhere to grant microphone access", width/2, y);
                
                // Add click listener if not already added
                if (!this.clickListener) {
                    this.clickListener = () => {
                        ctx.canvas.removeEventListener('click', this.clickListener);
                        this.clickListener = null;
                        this.requestPermissions();
                    };
                    ctx.canvas.addEventListener('click', this.clickListener);
                }
            } else {
                ctx.fillText("Microphone access denied. Please enable microphone access in your browser settings.", width/2, y);
            }
            return;
        }
    
        if (this.error === "missing") {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, 0, width, height);
            
            this.drawDeviceList(ctx, width, height, 
                "You have audio visualiser enabled. Please update your browser source to include one of the following:");
            return;
        }
    
        if (this.error === "invalid") {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, 0, width, height);
            
            this.drawDeviceList(ctx, width, height, 
                "Invalid audio device. Please update your browser source to include one of the following:");
            return;
        }
    
        if (!this.initialized) return;
    
        // Remove click listener when not needed
        if (this.deviceClickListener) {
            ctx.canvas.removeEventListener('click', this.deviceClickListener);
            this.deviceClickListener = null;
        }
    
        this.analyser.getByteFrequencyData(this.dataArray);
        this.drawBars(ctx, sceneArea);
    }
    
};

if (document.getElementById('canvas')) {
    const system = new window.AudioVisualiser();
    window.Modules.push({
        name: "AudioVisualiser",
        draw: (ctx, settings, area) => {
            system.draw(ctx, area);
        }
    });
}

} // end if (!window.AudioVisualiser)