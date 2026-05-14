class ImageDisplay {
    #images = new Map();

    addImage(id, src, settings = {}) {
        const img = new Image();
        img.src = src;
        this.#images.set(id, {
            img,
            ready: false,
            opacity: settings.opacity ?? 1,
            objectFit: settings.objectFit || 'contain'
        });
        img.addEventListener('load', () => {
            this.#images.get(id).ready = true;
        });
    }

    removeImage(id) {
        this.#images.delete(id);
    }

    draw(ctx) {
        for (const [id, data] of this.#images) {
            if (!data.ready) continue;
            ctx.save();
            ctx.globalAlpha = data.opacity;
            ctx.drawImage(data.img, 0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    }

    onMessage(data) {
        switch (data.Type) {
            case "AddImage":
                this.addImage(data.ID, data.Src, data.Settings);
                break;
            case "RemoveImage":
                this.removeImage(data.ID);
                break;
        }
    }
}

const imageDisplay = new ImageDisplay();

window.Modules.push({
    name: "image",
    draw: (ctx) => {
        imageDisplay.draw(ctx);
    },
    message: (data) => {
        imageDisplay.onMessage(data);
    }
});
