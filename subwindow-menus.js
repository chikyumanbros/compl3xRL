/**
 * Sub-window: food, potion, pickup, throw, drop, and quantity-selection menus.
 */

(function (SubWindow) {
    'use strict';

    SubWindow.prototype.showFoodMenu = function (player) {
        this.title.textContent = 'Select food to eat';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        var inventory = player.getInventorySummary();
        var foodItems = inventory.filter(function (item) {
            var letter = item.charAt(0);
            var invItem = player.getInventoryItem(letter);
            if (!invItem || (invItem.type !== 'food' && !invItem.nutrition)) return false;
            if (typeof FoodItem !== 'undefined' && invItem instanceof FoodItem && !invItem.isEdible()) return false;
            return true;
        });

        if (foodItems.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">No edible food in inventory.</div>';
            this.input.style.display = 'none';
        } else {
            foodItems.forEach(function (item) {
                var letter = item.charAt(0);
                var invItem = player.getInventoryItem(letter);
                var itemDiv = document.createElement('div');
                var nutritionInfo = '';
                if (invItem.nutrition) {
                    nutritionInfo += ' (' + invItem.nutrition + ' nutrition';
                    if (invItem.healDice) {
                        nutritionInfo += ', ' + invItem.healDice + ' HP';
                    } else if (invItem.healAmount && invItem.healAmount > 0) {
                        nutritionInfo += ', +' + invItem.healAmount + ' HP';
                    }
                    nutritionInfo += ')';
                }
                var freshnessInfo = '';
                if (typeof FoodItem !== 'undefined' && invItem instanceof FoodItem && invItem.perishable) {
                    if (invItem.freshness <= 0) freshnessInfo = ' [rotten]';
                    else if (invItem.freshness >= 80) freshnessInfo = ' [fresh]';
                    else if (invItem.freshness >= 50) freshnessInfo = ' [aging]';
                    else if (invItem.freshness >= 20) freshnessInfo = ' [stale]';
                    else freshnessInfo = ' [spoiling]';
                }
                itemDiv.textContent = item + nutritionInfo + freshnessInfo;
                this.content.appendChild(itemDiv);
            }.bind(this));
        }

        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                var letter = choice.toLowerCase();
                var invItem = player.getInventoryItem(letter);
                if (invItem && (invItem.type === 'food' || invItem.nutrition)) {
                    var success = player.eat(invItem, letter);
                    if (success && window.game) {
                        window.game.processTurn();
                        window.game.render();
                    }
                    return true;
                }
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('That is not edible food!');
                }
                return false;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.showPotionMenu = function (player) {
        this.title.textContent = 'Select potion to drink';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        var inventory = player.getInventorySummary();
        var potionItems = inventory.filter(function (item) {
            var letter = item.charAt(0);
            var invItem = player.getInventoryItem(letter);
            return invItem && invItem.type === 'potion';
        });

        if (potionItems.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">No potions in inventory.</div>';
            this.input.style.display = 'none';
        } else {
            potionItems.forEach(function (item) {
                var letter = item.charAt(0);
                var invItem = player.getInventoryItem(letter);
                var itemDiv = document.createElement('div');
                var healingInfo = '';
                if (invItem.healDice) healingInfo = ' (' + invItem.healDice + ' HP)';
                else if (invItem.healAmount && invItem.healAmount > 0) healingInfo = ' (+' + invItem.healAmount + ' HP)';
                itemDiv.textContent = item + healingInfo;
                this.content.appendChild(itemDiv);
            }.bind(this));
        }

        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                var letter = choice.toLowerCase();
                var invItem = player.getInventoryItem(letter);
                if (invItem && invItem.type === 'potion') {
                    var success = player.drinkPotion(invItem, letter);
                    if (success && window.game) {
                        window.game.processTurn();
                        window.game.render();
                    }
                    return true;
                }
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('That is not a potion!');
                }
                return false;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.showItemSelectionMenu = function (items, playerX, playerY) {
        this.title.textContent = 'Pick up item (a-z to select, * for all, Escape to cancel)';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or * for all';
        this.textInput.value = '';

        if (items.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">There is nothing here to pick up.</div>';
            this.input.style.display = 'none';
        } else {
            items.forEach(function (item, index) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                var displayText = item.getDisplayName ? item.getDisplayName() : item.name;
                if (item.stackable && item.quantity > 1) displayText = item.name + ' (' + item.quantity + ')';
                var letter = String.fromCharCode(97 + index);
                itemDiv.textContent = letter + ' - ' + displayText;
                this.content.appendChild(itemDiv);
            }.bind(this));
            var lastLetter = String.fromCharCode(97 + items.length - 1);
            var instructionDiv = document.createElement('div');
            instructionDiv.style.cssText = 'color: #808080; font-size: 0.9em; margin-top: 10px;';
            instructionDiv.textContent = 'Enter a letter (a-' + lastLetter + ') or "*" to pick up all items';
            this.content.appendChild(instructionDiv);
        }

        var self = this;
        this.callback = function (choice) {
            if (choice === '*') {
                self.pickupAllItems(items, playerX, playerY);
                return true;
            }
            if (choice && /^[a-z]$/.test(choice)) {
                var index = choice.charCodeAt(0) - 97;
                if (index >= 0 && index < items.length) {
                    var selectedItem = items[index];
                    if (window.game && window.game.pickupSpecificItem) {
                        var success = window.game.pickupSpecificItem(selectedItem, playerX, playerY);
                        if (success) {
                            self.refreshItemSelectionMenu(playerX, playerY);
                            return false;
                        }
                    }
                    return false;
                }
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('No such item.');
                }
                return false;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.refreshItemSelectionMenu = function (playerX, playerY) {
        if (!window.game || !window.game.itemManager) return;
        var currentItems = window.game.itemManager.getItemsAt(playerX, playerY);
        if (currentItems.length === 0) {
            if (window.game.renderer) {
                window.game.renderer.addLogMessage('You have picked up everything here.');
            }
            this.close();
            return;
        }
        this.showItemSelectionMenu(currentItems, playerX, playerY);
        this.textInput.value = '';
    };

    SubWindow.prototype.showThrowSelectionMenu = function (player) {
        this.title.textContent = 'Throw which item? (a-z, Escape to cancel)';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z)';
        this.textInput.value = '';

        var inventory = player.getInventorySummary();
        var extraEntries = [];

        if (inventory.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Your pack is empty.</div>';
            this.input.style.display = 'none';
        } else {
            inventory.forEach(function (item) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                itemDiv.textContent = item;
                this.content.appendChild(itemDiv);
            }.bind(this));
            var startCode = 97 + inventory.length;
            if (player.equipment && player.equipment.weapon) {
                extraEntries.push({
                    letter: String.fromCharCode(startCode + extraEntries.length),
                    slot: 'weapon',
                    item: player.equipment.weapon
                });
            }
            if (player.equipment && player.equipment.shield) {
                extraEntries.push({
                    letter: String.fromCharCode(startCode + extraEntries.length),
                    slot: 'shield',
                    item: player.equipment.shield
                });
            }
            extraEntries.forEach(function (entry) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                var displayName = entry.item.getDisplayName ? entry.item.getDisplayName() : entry.item.name;
                itemDiv.textContent = entry.letter + ' - ' + displayName + ' (equipped ' + entry.slot + ')';
                this.content.appendChild(itemDiv);
            }.bind(this));
            var helpDiv = document.createElement('div');
            helpDiv.style.cssText = 'margin-top: 10px; color: #808080; font-size: 0.9em;';
            helpDiv.textContent = 'Throw one unit for stackable items';
            this.content.appendChild(helpDiv);
        }

        var self = this;
        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                var letter = choice.toLowerCase();
                var extra = extraEntries.find(function (e) { return e.letter === letter; });
                if (extra) {
                    self.close();
                    if (window.game && typeof window.game.beginThrowDirectionSelection === 'function') {
                        window.game.beginThrowDirectionSelection({ equipSlot: extra.slot });
                    }
                    return true;
                }
                var item = player.getInventoryItem(letter);
                if (!item) {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addBattleLogMessage('No such item.', 'normal');
                    }
                    return false;
                }
                self.close();
                if (window.game && typeof window.game.beginThrowDirectionSelection === 'function') {
                    window.game.beginThrowDirectionSelection(letter);
                }
                return true;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.pickupAllItems = function (items, playerX, playerY) {
        if (!window.game) return;
        var pickupCount = 0;
        var failedCount = 0;
        var itemsCopy = items.slice();
        for (var i = 0; i < itemsCopy.length; i++) {
            var success = window.game.pickupSpecificItem(itemsCopy[i], playerX, playerY);
            if (success) pickupCount++;
            else failedCount++;
        }
        if (window.game.renderer) {
            if (pickupCount > 0 && failedCount === 0) {
                window.game.renderer.addLogMessage('You pick up all ' + pickupCount + ' items.');
            } else if (pickupCount > 0 && failedCount > 0) {
                window.game.renderer.addLogMessage('You pick up ' + pickupCount + ' items. ' + failedCount + ' items couldn\'t be picked up.');
            } else if (failedCount > 0) {
                window.game.renderer.addLogMessage('You couldn\'t pick up any items. Your pack might be full.');
            }
        }
    };

    SubWindow.prototype.showBuryMenu = function () {
        if (!window.game || !window.game.getBuryOptions) return;
        var options = window.game.getBuryOptions();
        this.title.textContent = 'Bury (Shift+B) – choose target';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter key (1-9 or a-z) or Escape to cancel';
        this.textInput.value = '';

        if (options.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Nothing to bury here or in inventory.</div>';
            this.input.style.display = 'none';
        } else {
            options.forEach(function (opt) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                itemDiv.textContent = opt.key + ') ' + opt.label;
                this.content.appendChild(itemDiv);
            }.bind(this));
        }

        var self = this;
        this.callback = function (choice) {
            if (!choice || choice.length === 0) return false;
            var k = choice.trim().charAt(0);
            var key = (k >= 'a' && k <= 'z') || (k >= 'A' && k <= 'Z') ? k.toLowerCase() : k;
            var opt = options.find(function (o) { return o.key === key; });
            if (!opt) {
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('Invalid choice.');
                }
                return false;
            }
            var success = window.game.executeBuryChoice(key);
            if (success) {
                window.game.processTurn();
                window.game.render();
            }
            return true;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.showDropMenu = function (player) {
        this.title.textContent = 'Drop item (a-z to select, Enter to confirm, Escape to cancel)';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        var inventory = player.getInventorySummary();
        if (inventory.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Your pack is empty.</div>';
            this.input.style.display = 'none';
        } else {
            inventory.forEach(function (item, index) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                itemDiv.textContent = item;
                this.content.appendChild(itemDiv);
            }.bind(this));
        }

        var self = this;
        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                var letter = choice.toLowerCase();
                var index = letter.charCodeAt(0) - 97;
                if (index >= 0 && index < player.inventory.length) {
                    var selectedItem = player.inventory[index];
                    if (selectedItem.stackable && selectedItem.quantity > 1) {
                        self.showQuantitySelectionMenu(selectedItem, index, 'drop');
                        return false;
                    }
                    if (window.game && window.game.dropSpecificItem) {
                        var success = window.game.dropSpecificItem(selectedItem, index);
                        if (success) {
                            self.refreshDropMenu(player);
                            return false;
                        }
                    }
                    return true;
                }
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('No such item.');
                }
                return false;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.refreshDropMenu = function (player) {
        this.content.innerHTML = '';
        var inventory = player.getInventorySummary();
        if (inventory.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Your pack is empty.</div>';
            this.input.style.display = 'none';
        } else {
            this.input.style.display = 'flex';
            inventory.forEach(function (item) {
                var itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                itemDiv.textContent = item;
                this.content.appendChild(itemDiv);
            }.bind(this));
        }
        this.textInput.value = '';
    };

    SubWindow.prototype.showQuantitySelectionMenu = function (item, itemIndex, action) {
        action = action || 'drop';
        this.textInput.value = '';
        this.title.textContent = (action.charAt(0).toUpperCase() + action.slice(1)) + ' how many ' + item.name + '? (1-' + item.quantity + ', * for all)';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter quantity (1-' + item.quantity + ') or * for all';

        var itemInfo = document.createElement('div');
        itemInfo.className = 'item-line';
        itemInfo.textContent = (item.getDisplayName ? item.getDisplayName() : item.name) + ' - Available: ' + item.quantity;
        this.content.appendChild(itemInfo);

        var instructions = document.createElement('div');
        instructions.style.cssText = 'color: #808080; font-size: 0.9em; margin-top: 10px;';
        instructions.textContent = 'Enter a number (1-' + item.quantity + ') or "*" for all items';
        this.content.appendChild(instructions);

        var self = this;
        this.callback = function (choice) {
            if (!choice) return false;
            var quantity;
            if (choice === '*') {
                quantity = item.quantity;
            } else {
                var numChoice = parseInt(choice, 10);
                if (isNaN(numChoice) || numChoice < 1 || numChoice > item.quantity) {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage('Invalid quantity. Please enter 1-' + item.quantity + ' or *.');
                    }
                    return false;
                }
                quantity = numChoice;
            }
            if (action === 'drop' && window.game && window.game.dropSpecificItem) {
                var success = window.game.dropSpecificItem(item, itemIndex, quantity);
                if (success) {
                    self.showDropMenu(window.game.player);
                    return false;
                }
            }
            return true;
        };

        this.show();
        var me = this;
        setTimeout(function () {
            me.textInput.value = '';
            me.textInput.focus();
        }, 100);
    };

})(window.SubWindow);
