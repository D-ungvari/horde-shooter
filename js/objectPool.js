// Generic object pool to avoid GC pressure
// Usage: const pool = createPool(() => ({ x:0, y:0, active:false }), 500);
//        const obj = pool.acquire(); obj.x = 10; ...
//        pool.release(obj);
//        pool.forEach(obj => update(obj)); // iterates only active

export function createPool(factory, maxSize) {
    const items = [];
    for (let i = 0; i < maxSize; i++) {
        const item = factory();
        item.active = false;
        item._poolIndex = i;
        items.push(item);
    }

    let activeCount = 0;

    function acquire() {
        for (let i = 0; i < items.length; i++) {
            if (!items[i].active) {
                items[i].active = true;
                activeCount++;
                return items[i];
            }
        }
        return null; // Pool exhausted
    }

    function release(item) {
        if (item.active) {
            item.active = false;
            activeCount--;
        }
    }

    function forEach(fn) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].active) fn(items[i], i);
        }
    }

    function clear() {
        for (let i = 0; i < items.length; i++) {
            items[i].active = false;
        }
        activeCount = 0;
    }

    function getActiveCount() { return activeCount; }

    // Get raw array (for spatial hash bulk insert)
    function getAll() { return items; }

    return { acquire, release, forEach, clear, getActiveCount, getAll };
}
