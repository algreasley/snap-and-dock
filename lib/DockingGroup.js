export default class DockingGroup {
    constructor() {
        this.children = [];
    }

    add(window) {
        if (window.group === this) {
            return;
        }

        this.children.push(window);
        window.group = this;
    }

    remove(window) {
        const index = this.children.indexOf(window);
        if (index >= 0) {
            this.children.splice(index, 1);
            window.group = null;
        }
    }
}
