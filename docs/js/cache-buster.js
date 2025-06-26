/**
 * Cache-buster utility for forcing browser refresh of static assets
 * Loads cache-buster timestamps and provides helper functions
 */

class CacheBuster {
    constructor() {
        this.timestamps = {};
        this.loaded = false;
    }

    /**
     * Load cache-buster timestamps from JSON file
     */
    async load() {
        try {
            const response = await fetch('cache-busters.json');
            if (response.ok) {
                this.timestamps = await response.json();
                this.loaded = true;
                console.log('Cache-busters loaded:', this.timestamps);
            } else {
                console.warn('Failed to load cache-busters.json, using fallback');
                this.useFallback();
            }
        } catch (error) {
            console.warn('Error loading cache-busters:', error);
            this.useFallback();
        }
    }

    /**
     * Fallback to current timestamp if cache-busters.json fails to load
     */
    useFallback() {
        const fallbackTimestamp = Date.now();
        this.timestamps = {
            'css/style.css': fallbackTimestamp,
            'js/app.js': fallbackTimestamp,
            'js/calculator.js': fallbackTimestamp,
            'js/personas.js': fallbackTimestamp,
            'js/ui.js': fallbackTimestamp,
            'predicted_energy_plans.json': fallbackTimestamp
        };
        this.loaded = true;
    }

    /**
     * Get cache-busted URL for an asset
     * @param {string} assetPath - Path to the asset (e.g., 'js/app.js')
     * @returns {string} - Cache-busted URL
     */
    getUrl(assetPath) {
        if (!this.loaded) {
            console.warn('Cache-buster not loaded yet, using original path');
            return assetPath;
        }

        const timestamp = this.timestamps[assetPath];
        if (timestamp) {
            const separator = assetPath.includes('?') ? '&' : '?';
            return `${assetPath}${separator}v=${timestamp}`;
        }
        
        return assetPath;
    }

    /**
     * Load a JavaScript file with cache-busting
     * @param {string} src - Script source path
     * @returns {Promise} - Promise that resolves when script loads
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.getUrl(src);
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Load a CSS file with cache-busting
     * @param {string} href - CSS file path
     * @returns {Promise} - Promise that resolves when CSS loads
     */
    loadCSS(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = this.getUrl(href);
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    /**
     * Fetch JSON data with cache-busting
     * @param {string} url - JSON file path
     * @returns {Promise} - Promise that resolves with JSON data
     */
    async fetchJSON(url) {
        const cacheBustedUrl = this.getUrl(url);
        const response = await fetch(cacheBustedUrl);
        return response.json();
    }
}

// Create global instance
window.cacheBuster = new CacheBuster();