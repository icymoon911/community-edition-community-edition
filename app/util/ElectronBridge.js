/**
 * ElectronBridge - Adapter class that encapsulates all Electron-specific API calls.
 *
 * WebView.js and other components should use this bridge instead of calling
 * `require('electron').remote.*` directly. This makes it easier to upgrade
 * Electron versions or swap implementations in one central place.
 */
Ext.define('Rambox.util.ElectronBridge', {
    singleton: true

    /**
     * Returns the Electron remote module reference.
     * @return {Object}
     */
    ,getRemote: function() {
        return require('electron').remote;
    }

    /**
     * Returns the webContents object for a given webview element.
     * @param {HTMLElement} webview - The webview DOM element.
     * @return {Electron.WebContents}
     */
    ,getWebContentsFromWebView: function(webview) {
        return require('electron').remote.webContents.fromId(webview.getWebContentsId());
    }

    /**
     * Returns the session for a given partition string.
     * @param {String} partition - The partition identifier.
     * @return {Electron.Session}
     */
    ,getSessionFromPartition: function(partition) {
        return require('electron').remote.session.fromPartition(partition);
    }

    /**
     * Returns the current BrowserWindow.
     * @return {Electron.BrowserWindow}
     */
    ,getCurrentWindow: function() {
        return require('electron').remote.getCurrentWindow();
    }

    /**
     * Returns the current webContents (main renderer).
     * @return {Electron.WebContents}
     */
    ,getCurrentWebContents: function() {
        return require('electron').remote.getCurrentWebContents();
    }

    /**
     * Sends an input event to the current (main renderer) webContents.
     * @param {Object} inputEvent - The input event descriptor.
     */
    ,sendInputEvent: function(inputEvent) {
        require('electron').remote.getCurrentWebContents().sendInputEvent(inputEvent);
    }

    /**
     * Opens a URL in the system's default browser.
     * @param {String} url
     */
    ,openExternal: function(url) {
        require('electron').shell.openExternal(url);
    }

    /**
     * Returns the current platform string.
     * @return {String} e.g. 'darwin', 'win32', 'linux'
     */
    ,getPlatform: function() {
        return require('electron').remote.process.platform;
    }

    /**
     * Sends a synchronous IPC message and returns the result.
     * @param {String} channel
     * @param {...*} args
     * @return {*}
     */
    ,sendSync: function(channel) {
        var args = Array.prototype.slice.call(arguments);
        return ipc.sendSync.apply(ipc, args);
    }

    /**
     * Sends an asynchronous IPC message.
     * @param {String} channel
     * @param {...*} args
     */
    ,send: function(channel) {
        var args = Array.prototype.slice.call(arguments);
        ipc.send.apply(ipc, args);
    }

    /**
     * Registers a certificate-error handler on a webContents.
     * @param {Electron.WebContents} webContents
     * @param {Function} handler - function(event, url, error, certificate, callback)
     */
    ,onCertificateError: function(webContents, handler) {
        webContents.on('certificate-error', handler);
    }

    /**
     * Registers a before-input-event handler on a webContents.
     * @param {Electron.WebContents} webContents
     * @param {Function} handler - function(event, input)
     */
    ,onBeforeInputEvent: function(webContents, handler) {
        webContents.on('before-input-event', handler);
    }

    /**
     * Registers an onBeforeSendHeaders handler on a session's webRequest.
     * @param {String} partition
     * @param {Function} handler - function(details, callback)
     */
    ,onBeforeSendHeaders: function(partition, handler) {
        require('electron').remote.session.fromPartition(partition)
            .webRequest.onBeforeSendHeaders(handler);
    }
});
