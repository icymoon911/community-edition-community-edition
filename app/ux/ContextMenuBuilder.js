/**
 * ContextMenuBuilder - Builds the right-click context menu config for a WebView tab.
 *
 * Instead of having the menu items hard-coded inside WebView.initComponent,
 * this builder provides a clean API and supports dynamic registration of
 * additional menu items.
 */
Ext.define('Rambox.ux.ContextMenuBuilder', {
    singleton: true

    /**
     * Internal registry of extra menu items added at runtime.
     * Each entry: { text, glyph, handler, scope, weight }
     * @private
     */
    ,_extraItems: []

    /**
     * Registers an additional menu item that will be included in every
     * context menu built after this call.
     *
     * @param {Object} cfg - Menu item config.
     * @param {String} cfg.text - Display label.
     * @param {String} [cfg.glyph] - FontAwesome glyph.
     * @param {Function} cfg.handler - Click handler.
     * @param {Object} [cfg.scope] - Handler scope.
     * @param {Number} [cfg.weight=100] - Sorting weight (lower = higher in menu).
     */
    ,registerItem: function(cfg) {
        this._extraItems.push(Ext.apply({ weight: 100 }, cfg));
    }

    /**
     * Removes all dynamically registered items.
     */
    ,clearExtraItems: function() {
        this._extraItems = [];
    }

    /**
     * Builds the full tabConfig.menu config for a given WebView panel.
     *
     * @param {Rambox.ux.WebView} webView - The WebView panel instance.
     * @return {Object} The menu config object to assign to tabConfig.menu.
     */
    ,build: function(webView) {
        var me = this;

        var baseItems = [
            {
                 xtype: 'toolbar'
                ,items: [
                    {
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
                    }
                ]
            }
            ,'-'
            ,{
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
            ,'-'
            ,{
                 text: locale['app.webview[0]']
                ,glyph: 'xf021@FontAwesome'
                ,scope: webView
                ,handler: webView.reloadService
            }
            ,'-'
            ,{
                 text: locale['app.webview[3]']
                ,glyph: 'xf121@FontAwesome'
                ,scope: webView
                ,handler: webView.toggleDevTools
            }
        ];

        // Merge dynamically registered items (sorted by weight)
        var extraItems = Ext.Array.sort(
            Ext.Array.map(me._extraItems, function(item) { return Ext.apply({}, item); }),
            function(a, b) { return (a.weight || 100) - (b.weight || 100); }
        );

        var allItems = baseItems.concat(extraItems);

        return {
             plain: true
            ,items: allItems
        };
    }
});
