/**
 * Sub-window: inventory list and item detail view.
 */

(function (SubWindow) {
    'use strict';

    SubWindow.prototype.showInventory = function (player) {
        this.title.textContent = 'Inventory';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) for details, Escape to close';
        this.textInput.value = '';

        const inventory = player.getInventorySummary();

        if (inventory.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Your pack is empty.</div>';
            this.input.style.display = 'none';
        } else {
            inventory.forEach(function (item) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                itemDiv.textContent = item;
                this.content.appendChild(itemDiv);
            }.bind(this));

            const helpDiv = document.createElement('div');
            helpDiv.style.cssText = 'margin-top: 10px; color: #808080; font-size: 0.9em;';
            helpDiv.textContent = 'Enter item letter (a-z) to see description';
            this.content.appendChild(helpDiv);
        }

        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                const letter = choice.toLowerCase();
                const item = player.getInventoryItem(letter);
                if (item) {
                    const index = letter.charCodeAt(0) - 97;
                    this.showItemDetails(player, index);
                    return false;
                }
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('No item at that position.');
                }
                return false;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.showItemDetails = function (player, itemIndex) {
        const letter = String.fromCharCode(97 + itemIndex);
        const item = player.getInventoryItem(letter);
        if (!item) return;

        this.title.textContent = 'Item Details: ' + item.name;
        this.content.innerHTML = '';
        this.input.style.display = 'none';

        const propertyList = SubWindow.buildItemPropertyList(item, { includeStack: true, forEquipment: false });
        this.appendItemDetailBlock(item, propertyList);

        const backDiv = document.createElement('div');
        backDiv.style.cssText = 'margin-top: 20px; color: #808080; font-size: 0.9em; text-align: center; padding: 5px; border: 1px solid #555;';
        backDiv.textContent = 'Press Escape to return to inventory';
        this.content.appendChild(backDiv);

        this.callback = function () {
            this.showInventory(player);
            return false;
        };

        this.show();
    };

})(window.SubWindow);
