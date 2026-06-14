/**
 * ContextMenuBuilder - builds the right-click / tab context menu for a WebView.
 *
 * Keeps the menu definition out of WebView.initComponent so new items can be
 * added here without touching the view class.
 */
Ext.define('Rambox.util.ContextMenuBuilder', {
	singleton: true

	/**
	 * Builds the tab context-menu items array for the given WebView instance.
	 *
	 * @param {Rambox.ux.WebView} webView  The WebView panel instance.
	 * @return {Array}  Array of menu item configs.
	 */
	,build: function(webView) {
		var items = [];

		// Navigation group (Back / Forward)
		items.push({
			 xtype: 'toolbar'
			,items: [{
				 xtype: 'segmentedbutton'
				,allowToggle: false
				,flex: 1
				,items: [
					{
						 text: 'Back'
						,glyph: 'xf053@FontAwesome'
						,flex: 1
						,scope: webView
						,handler: webView.goBack
					}
					,{
						 text: 'Forward'
						,glyph: 'xf054@FontAwesome'
						,iconAlign: 'right'
						,flex: 1
						,scope: webView
						,handler: webView.goForward
					}
				]
			}]
		});

		items.push('-');

		// Zoom group
		items = items.concat(this.buildZoomItems(webView));

		items.push('-');

		// Reload
		items.push({
			 text: locale['app.webview[0]']
			,glyph: 'xf021@FontAwesome'
			,scope: webView
			,handler: webView.reloadService
		});

		items.push('-');

		// DevTools
		items.push({
			 text: locale['app.webview[3]']
			,glyph: 'xf121@FontAwesome'
			,scope: webView
			,handler: webView.toggleDevTools
		});

		return items;
	}

	/**
	 * Returns the zoom-related menu items.  Separated so they can be
	 * overridden / extended independently.
	 *
	 * @param {Rambox.ux.WebView} webView
	 * @return {Array}
	 */
	,buildZoomItems: function(webView) {
		return [
			{
				 text: 'Zoom In'
				,glyph: 'xf00e@FontAwesome'
				,scope: webView
				,handler: webView.zoomIn
			}
			,{
				 text: 'Zoom Out'
				,glyph: 'xf010@FontAwesome'
				,scope: webView
				,handler: webView.zoomOut
			}
			,{
				 text: 'Reset Zoom'
				,glyph: 'xf002@FontAwesome'
				,scope: webView
				,handler: webView.resetZoom
			}
		];
	}
});
