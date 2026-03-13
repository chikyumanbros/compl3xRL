/**
 * Temperature system - tile heat/cold for fire, steam, and future freeze.
 * Tiles use tile.temperature (0–100). Fire logic uses heat; freeze can use cold later.
 */
const Temperature = (function() {
    const AMBIENT = 20;
    const MIN = 0;
    const MAX = 100;

    /** Threshold above which tile is "hot" (display, steam from liquid). */
    const HOT_DISPLAY = 35;
    /** Threshold above which entities take fire damage and flammables burn. */
    const FIRE_THRESHOLD = 50;
    /** Threshold for "high" fire display. */
    const FIRE_HIGH = 65;
    /** Future: below this, cold/freeze effects. */
    const COLD_THRESHOLD = 10;

    function clamp(v) {
        return Math.max(MIN, Math.min(MAX, Math.floor(v)));
    }

    function getTemperature(tile) {
        if (!tile || typeof tile.temperature !== 'number') return AMBIENT;
        return clamp(tile.temperature);
    }

    function setTemperature(tile, value) {
        if (!tile) return;
        tile.temperature = clamp(value);
    }

    /**
     * Add heat to a tile (ignition, fuel, explosion).
     * @param {Object} dungeon
     * @param {number} x
     * @param {number} y
     * @param {number} amount
     */
    function addHeat(dungeon, x, y, amount) {
        if (!dungeon || !dungeon.isInBounds || !dungeon.isInBounds(x, y)) return false;
        const tile = dungeon.getTile(x, y);
        if (!tile || tile.type !== 'floor') return false;
        const cur = getTemperature(tile);
        setTemperature(tile, cur + Math.max(0, Math.floor(amount)));
        return true;
    }

    /**
     * Reduce heat (e.g. liquid suppression).
     */
    function removeHeat(dungeon, x, y, amount) {
        if (!dungeon || !dungeon.isInBounds || !dungeon.isInBounds(x, y)) return false;
        const tile = dungeon.getTile(x, y);
        if (!tile || tile.type !== 'floor') return false;
        const cur = getTemperature(tile);
        setTemperature(tile, cur - Math.max(0, Math.floor(amount)));
        return true;
    }

    /** Convert temperature to a 0–10 "fire level" for damage/display scaling. */
    function temperatureToFireLevel(tile) {
        const t = getTemperature(tile);
        if (t < FIRE_THRESHOLD) return 0;
        return Math.min(10, Math.floor((t - FIRE_THRESHOLD) / 5) + 1);
    }

    /**
     * Temperature above which this item ignites (burns). Tile temp >= this → item is affected.
     * Lower = more flammable. Override via item.ignitionTemp if set.
     */
    function getItemIgnitionTemp(item) {
        if (!item) return 999;
        if (typeof item.ignitionTemp === 'number') return item.ignitionTemp;
        if (item.type === 'corpse') return 40;
        if (item.type === 'food') return 45;
        if (item.material === 'wood') return 45;
        if (item.material === 'leather') return 50;
        return 55;
    }

    /**
     * Temperature below which this item freezes (shatters / is affected). Tile temp <= this → freeze effect.
     * Higher = freezes more easily. Override via item.freezeTemp if set.
     */
    function getItemFreezeTemp(item) {
        if (!item) return -999;
        if (typeof item.freezeTemp === 'number') return item.freezeTemp;
        if (item.type === 'potion') return 5;
        if (item.type === 'food') return 15;
        return -999;
    }

    return {
        AMBIENT,
        MIN,
        MAX,
        HOT_DISPLAY,
        FIRE_THRESHOLD,
        FIRE_HIGH,
        COLD_THRESHOLD,
        getTemperature,
        setTemperature,
        addHeat,
        removeHeat,
        temperatureToFireLevel,
        getItemIgnitionTemp,
        getItemFreezeTemp,
        clamp
    };
})();
