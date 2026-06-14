/**
 * ZoomMixin - extracted zoom functionality for WebView.
 *
 * Provides zoomIn, zoomOut, resetZoom, and centralises zoomLevel
 * state management so it only lives in one place (the service record).
 */
Ext.define('Rambox.ux.mixin.ZoomMixin', {
	extend: 'Ext.Mixin'

	,mixinConfig: {
		id: 'webviewZoom'
	}

	/**
	 * Returns the current zoom level, reading from the service record
	 * as the single source of truth.  Falls back to the instance
	 * `zoomLevel` property if the record is not yet available.
	 *
	 * @return {number}
	 */
	,getZoomLevel: function() {
		var me = this;
		if (me.record) {
			var stored = me.record.get('zoomLevel');
			return (stored !== undefined && stored !== null) ? stored : 0;
		}
		return me.zoomLevel || 0;
	}

	/**
	 * Persists the zoom level to both the instance property and the
	 * service record, then applies it to the webview element.
	 *
	 * @param {number} level
	 */
	,applyZoomLevel: function(level) {
		var me = this;
		var webview = me.getWebView();

		me.zoomLevel = level;
		if (me.record) me.record.set('zoomLevel', level);
		if (me.record && me.record.get('enabled') && webview) {
			webview.setZoomLevel(level);
		}
	}

	/**
	 * Increases zoom by 0.25 (debounced by 100 ms).
	 */
	,zoomIn: function() {
		var me = this;
		if (me.zoomTimeout) clearTimeout(me.zoomTimeout);
		me.zoomTimeout = setTimeout(function() {
			me.applyZoomLevel(me.getZoomLevel() + 0.25);
		}, 100);
	}

	/**
	 * Decreases zoom by 0.25 (debounced by 100 ms).
	 */
	,zoomOut: function() {
		var me = this;
		if (me.zoomTimeout) clearTimeout(me.zoomTimeout);
		me.zoomTimeout = setTimeout(function() {
			me.applyZoomLevel(me.getZoomLevel() - 0.25);
		}, 100);
	}

	/**
	 * Resets zoom to 0.
	 */
	,resetZoom: function() {
		this.applyZoomLevel(0);
	}
});
