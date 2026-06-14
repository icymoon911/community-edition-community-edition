/**
 * Zoom Mixin - Provides zoom in / out / reset functionality for WebView panels.
 *
 * Manages the zoomLevel state in a single place and syncs it to the service record.
 */
Ext.define('Rambox.ux.mixin.Zoom', {
    extend: 'Ext.Mixin'

    ,mixinConfig: {
        id: 'zoom'
    }

    ,config: {
        /**
         * Current zoom level. 0 = default (100%).
         * Each step is 0.25 (25%).
         */
        zoomLevel: 0
    }

    /**
     * Increases the zoom level by 0.25 (25%).
     * Debounced with a 100ms timeout to prevent rapid-fire changes.
     */
    ,zoomIn: function() {
        var me = this;

        if (me._zoomTimeout) clearTimeout(me._zoomTimeout);
        me._zoomTimeout = setTimeout(function() {
            var webview = me.getWebView();
            var current = me.getZoomLevel();
            current = current + 0.25;
            me.setZoomLevel(current);
            if (me.record && me.record.get('enabled')) {
                webview.setZoomLevel(current);
                me.record.set('zoomLevel', current);
            }
        }, 100);
    }

    /**
     * Decreases the zoom level by 0.25 (25%).
     * Debounced with a 100ms timeout.
     */
    ,zoomOut: function() {
        var me = this;

        if (me._zoomTimeout) clearTimeout(me._zoomTimeout);
        me._zoomTimeout = setTimeout(function() {
            var webview = me.getWebView();
            var current = me.getZoomLevel();
            current = current - 0.25;
            me.setZoomLevel(current);
            if (me.record && me.record.get('enabled')) {
                webview.setZoomLevel(current);
                me.record.set('zoomLevel', current);
            }
        }, 100);
    }

    /**
     * Resets the zoom level to 0 (100%).
     */
    ,resetZoom: function() {
        var me = this;
        var webview = me.getWebView();

        me.setZoomLevel(0);
        if (me.record && me.record.get('enabled')) {
            webview.setZoomLevel(0);
            me.record.set('zoomLevel', 0);
        }
    }

    /**
     * Applies the stored zoom level from the service record to the webview.
     * Called after webview finishes loading.
     */
    ,applyStoredZoomLevel: function() {
        var me = this;
        var webview = me.getWebView();

        if (me.record) {
            var storedLevel = me.record.get('zoomLevel') || 0;
            me.setZoomLevel(storedLevel);
            webview.setZoomLevel(storedLevel);
        }
    }
});
