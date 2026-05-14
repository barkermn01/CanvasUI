class Palette {
    constructor() {
        document.querySelectorAll('.palette-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('module-type', item.dataset.module);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
    }
}
