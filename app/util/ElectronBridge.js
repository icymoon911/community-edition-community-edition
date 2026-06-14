/**
 * ElectronBridge - Adapter for Electron-specific API calls.
 *
 * Centralises all `require('electron').remote.*` calls so that
 * Electron version upgrades only need changes in this file.
 */
Ext.define('Rambox.util.ElectronBridge', {
	singleton: true

	/**
	 * Returns the Electron webContents object for a given webview element.
	 * @param {HTMLElement} webview The webview DOM element.
	 * @return {Electron.WebContents}
	 */
	,getWebContents: function(webview) {
		return require('electron').remote.webContents.fromId(webview.getWebContentsId());
	}

	/**
	 * Returns the Electron session for a given partition string.
	 * @param {string} partition
	 * @return {Electron.Session}
	 */
	,getSession: function(partition) {
		return require('electron').remote.session.fromPartition(partition);
	}

	/**
	 * Opens a URL in the system default browser.
	 * @param {string} url
	 */
	,openExternal: function(url) {
		require('electron').shell.openExternal(url);
	}

	/**
	 * Forwards a keyboard input event to the main window's webContents.
	 * @param {Object} inputEvent  The event descriptor ({type, keyCode, modifiers}).
	 */
	,sendInputEvent: function(inputEvent) {
		require('electron').remote.getCurrentWebContents().sendInputEvent(inputEvent);
	}

	/**
	 * Shows and focuses the current BrowserWindow.
	 */
	,showCurrentWindow: function() {
		require('electron').remote.getCurrentWindow().show();
	}

	/**
	 * Returns the current platform string ('darwin', 'win32', 'linux', etc.).
	 * @return {string}
	 */
	,getPlatform: function() {
		return require('electron').remote.process.platform;
	}

	/**
	 * Returns the app configuration object (synchronous IPC).
	 * @return {Object}
	 */
	,getConfig: function() {
		return ipc.sendSync('getConfig');
	}

	/**
	 * Sends an async IPC message.
	 * @param {string} channel
	 * @param {*} payload
	 */
	,send: function(channel, payload) {
		ipc.send(channel, payload);
	}

	/**
	 * Builds the partition string for a given service record and tab id.
	 * @param {Ext.data.Model} record The service record.
	 * @param {string} tabId The tab component id.
	 * @return {string}
	 */
	,buildPartition: function(record, tabId) {
		return 'persist:' + record.get('type') + '_' + tabId.replace('tab_', '') +
			(localStorage.getItem('id_token') ? '_' + Ext.decode(localStorage.getItem('profile')).sub : '');
	}

	/**
	 * Registers a certificate-error handler on the webContents.
	 * @param {Electron.WebContents} wc
	 * @param {Function} callback  Called with (event, url, error, certificate, cb).
	 */
	,onCertificateError: function(wc, callback) {
		wc.on('certificate-error', callback);
	}

	/**
	 * Registers a before-input-event handler on the webContents.
	 * @param {Electron.WebContents} wc
	 * @param {Function} callback
	 */
	,onBeforeInputEvent: function(wc, callback) {
		wc.on('before-input-event', callback);
	}

	/**
	 * Intercepts outgoing HTTP headers for a session (used for Google login UA override).
	 * @param {Electron.Session} session
	 * @param {Function} handler
	 */
	,onBeforeSendHeaders: function(session, handler) {
		session.webRequest.onBeforeSendHeaders(handler);
	}
});
