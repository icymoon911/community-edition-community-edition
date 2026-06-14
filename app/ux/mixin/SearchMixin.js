/**
 * SearchMixin - extracted search functionality for WebView.
 *
 * Provides showSearchBox, doSearchText, and onSearchText methods.
 * These are purely UI-search concerns and have nothing to do with
 * the core webview lifecycle, so they live in their own mixin.
 */
Ext.define('Rambox.ux.mixin.SearchMixin', {
	extend: 'Ext.Mixin'

	,mixinConfig: {
		id: 'webviewSearch'
	}

	/**
	 * Shows or hides the search bar.
	 * When showing, focuses the text field after a short delay.
	 *
	 * @param {boolean} v  `true` to show, `false` to hide.
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
	 * Triggers a find-in-page search on the webview.
	 *
	 * @param {Ext.form.field.Text} field  The search text field.
	 * @param {string} newValue            The current search string.
	 * @param {*} oldValue                  Unused.
	 * @param {*} eOpts                     Unused.
	 * @param {boolean} [forward=true]     Search direction.
	 */
	,doSearchText: function(field, newValue, oldValue, eOpts, forward) {
		if (forward === undefined) forward = true;

		var me = this;
		var webview = me.getWebView();

		if (newValue === '') {
			webview.stopFindInPage('clearSelection');
			me.down('#searchBar displayfield').setValue('');
			return;
		}

		webview.findInPage(newValue, {
			 forward: forward
			,findNext: false
			,matchCase: false
		});
	}

	/**
	 * Called when the webview fires `found-in-page`; updates the match
	 * counter in the search bar.
	 *
	 * @param {Object} result  The `found-in-page` event result object.
	 */
	,onSearchText: function(result) {
		this.down('#searchBar displayfield').setValue(result.activeMatchOrdinal + '/' + result.matches);
	}
});
