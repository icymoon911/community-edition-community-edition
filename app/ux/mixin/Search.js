/**
 * Search Mixin - Provides in-page text search functionality for WebView panels.
 *
 * Extracts showSearchBox, doSearchText and onSearchText from the main WebView
 * class so they can be maintained and tested independently.
 */
Ext.define('Rambox.ux.mixin.Search', {
    extend: 'Ext.Mixin'

    ,mixinConfig: {
        id: 'search'
    }

    /**
     * Shows or hides the search bar.
     *
     * @param {Boolean} v - true to show, false to hide.
     */
    ,showSearchBox: function(v) {
        var me = this;
        if (!me.record.get('enabled')) return;
        var webview = me.getWebView();

        webview.stopFindInPage('keepSelection');
        if (v) {
            me.down('#searchBar').show();
            setTimeout(function() { me.down('#searchBar textfield').focus(); }, 100);
        } else {
            me.down('#searchBar').hide();
            me.down('#searchBar textfield').setValue('');
        }

        me.down('#searchBar displayfield').setValue('');
    }

    /**
     * Performs a find-in-page search for the given text.
     *
     * @param {Ext.form.field.Text} field - The search text field.
     * @param {String} newValue - The text to search for.
     * @param {String} oldValue - Previous value (unused).
     * @param {Object} eOpts - Event options (unused).
     * @param {Boolean} [forward=true] - Direction of search.
     */
    ,doSearchText: function(field, newValue, oldValue, eOpts, forward) {
        var me = this;
        var webview = me.getWebView();

        if (forward === undefined) forward = true;

        if (newValue === '') {
            webview.stopFindInPage('clearSelection');
            me.down('#searchBar displayfield').setValue('');
            return;
        }

        webview.findInPage(newValue, {
            forward: forward,
            findNext: false,
            matchCase: false
        });
    }

    /**
     * Callback for the webview `found-in-page` event.
     * Updates the match counter displayed in the search bar.
     *
     * @param {Object} result - The result object from the found-in-page event.
     */
    ,onSearchText: function(result) {
        var me = this;

        me.down('#searchBar displayfield').setValue(result.activeMatchOrdinal + '/' + result.matches);
    }
});
