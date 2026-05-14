class VideoDisplay {
    #videos = new Map();

    addVideo(id, src, settings = {}) {
        const video = document.createElement('video');
        video.src = src;
        video.muted = settings.muted ?? true;
        video.loop = settings.loop ?? true;
        video.playsInline = true;
        video.style.display = 'none';
        document.body.appendChild(video);

        this.#videos.set(id, {
            video,
            ready: false,
            opacity: settings.opacity ?? 1
        });

        video.addEventListener('canplay', () => {
            this.#videos.get(id).ready = true;
            video.play();
        });
    }

    removeVideo(id) {
        const data = this.#videos.get(id);
        if (data) {
            data.video.pause();
            data.video.remove();
            this.#videos.delete(id);
        }
    }

    draw(ctx) {
        for (const [id, data] of this.#videos) {
            if (!data.ready || data.video.paused) continue;
            ctx.save();
            ctx.globalAlpha = data.opacity;
            ctx.drawImage(data.video, 0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    }

    onMessage(data) {
        switch (data.Type) {
            case "AddVideo":
                this.addVideo(data.ID, data.Src, data.Settings);
                break;
            case "RemoveVideo":
                this.removeVideo(data.ID);
                break;
        }
    }
}

const videoDisplay = new VideoDisplay();

window.Modules.push({
    name: "video",
    draw: (ctx) => {
        videoDisplay.draw(ctx);
    },
    message: (data) => {
        videoDisplay.onMessage(data);
    }
});
