/**
 * WebViewEvents Mixin - Extracts all webview event listener logic from
 * WebView.onAfterRender into named, testable handler methods.
 *
 * The WebView's onAfterRender now only wires up addEventListener calls that
 * delegate to these handler methods, keeping the registration code flat and
 * easy to read.
 */
Ext.define('Rambox.ux.mixin.WebViewEvents', {
    extend: 'Ext.Mixin'

    ,requires: [
        'Rambox.util.ElectronBridge'
    ]

    ,mixinConfig: {
        id: 'webviewEvents'
    }

    // ──────────────────────────────────────────────
    // Loading lifecycle
    // ──────────────────────────────────────────────

    /**
     * Handler for webview "did-start-loading" event.
     * Shows the status bar spinner.
     */
    ,handleDidStartLoading: function() {
        var me = this;
        console.info('Start loading...', me.src);

        var sb = me.down('statusbar');
        if (!sb.closed || !sb.keep) sb.show();
        sb.showBusy();
    }

    /**
     * Handler for webview "did-stop-loading" event.
     * Clears the status bar and hides it if not pinned.
     */
    ,handleDidStopLoading: function() {
        var me = this;
        var sb = me.down('statusbar');
        sb.clearStatus({ useDefaults: true });
        if (!sb.keep) sb.hide();
    }

    /**
     * Handler for webview "did-finish-load" event.
     * Applies stored zoom, fixes cursor, loads service icons.
     *
     * @param {Event} e
     */
    ,handleDidFinishLoad: function(e) {
        var me = this;
        var webview = me.getWebView();

        Rambox.app.setTotalServicesLoaded(Rambox.app.getTotalServicesLoaded() + 1);

        // Apply stored zoom level via the Zoom mixin
        me.applyStoredZoomLevel();

        // Fix cursor sometimes disappearing
        var currentTab = Ext.cq1('app-main').getActiveTab();
        if (currentTab.id === me.id) {
            webview.blur();
            webview.focus();
        }

        // Set special icon for some services (like Slack)
        Rambox.util.IconLoader.loadServiceIconUrl(me, webview);
    }

    // ──────────────────────────────────────────────
    // Error handling
    // ──────────────────────────────────────────────

    /**
     * Error code → human-readable message map.
     * @private
     */
    ,_errorMessages: {
        '-2':   'NET error: failed.'
        ,'-3':  'An operation was aborted (due to user action)'
        ,'-7':  'Connection timeout.'
        ,'-21': 'Network change.'
        ,'-100':'The connection was reset. Check your internet connection.'
        ,'-101':'The connection was reset. Check your internet connection.'
        ,'-105':'Name not resolved. Check your internet connection.'
        ,'-106':'There is no active internet connection.'
        ,'-118':'Connection timed out. Check your internet connection.'
        ,'-130':'Proxy connection failed. Please, check the proxy configuration.'
        ,'-300':'The URL is invalid.'
        ,'-324':'Empty response. Check your internet connection.'
    }

    /**
     * Handler for webview "did-fail-load" event.
     * Implements retry logic with attempt counting per error code.
     *
     * @param {Event} e
     */
    ,handleDidFailLoad: function(e) {
        var me = this;
        console.info('The service fail at loading', me.src, e);

        if (me.record.get('disableAutoReloadOnFail') || !e.isMainFrame) return;

        me.errorCodeLog.push(e.errorCode);

        var attempt = me.errorCodeLog.filter(function(code) { return code === e.errorCode; });
        var msg = me._errorMessages;

        switch (e.errorCode) {
            case 0:
                break;
            case -3:
                if (attempt.length <= 4) return;
                setTimeout(function() { me.reloadService(me); }, 200);
                me.errorCodeLog = [];
                break;
            case -2:
            case -7:
            case -21:
            case -118:
            case -324:
            case -100:
            case -101:
            case -105:
                if (attempt.length > 4) {
                    me.onFailLoad(msg[e.errorCode]);
                } else {
                    setTimeout(function() { me.reloadService(me); }, 2000);
                }
                break;
            case -106:
                me.onFailLoad(msg[e.errorCode]);
                break;
            case -130:
            case -300:
                if (attempt.length > 4) {
                    me.onFailLoad(msg[e.errorCode]);
                } else {
                    me.reloadService(me);
                }
                break;
        }
    }

    // ──────────────────────────────────────────────
    // Navigation
    // ──────────────────────────────────────────────

    /**
     * Handler for webview "new-window" event.
     * Opens links in the system default browser, blocks certain deep-link protocols.
     *
     * @param {Event} e
     */
    ,handleNewWindow: function(e) {
        e.preventDefault();
        var URL = require('url').URL;
        var url = new URL(e.url);
        var protocol = url.protocol;

        // Block some deep links to prevent opening their app (Ex: Slack)
        if (['slack:'].indexOf(protocol) !== -1) return;

        // Allow non-http deep links to open externally
        if (['http:', 'https:', 'about:'].indexOf(protocol) === -1) {
            return Rambox.util.ElectronBridge.openExternal(url.href);
        }
    }

    /**
     * Handler for webview "will-navigate" event.
     * Prevents navigation inside the webview.
     *
     * @param {Event} e
     */
    ,handleWillNavigate: function(e) {
        e.preventDefault();
    }

    /**
     * Handler for webview "did-navigate" event.
     * Special handling for TweetDeck 2FA redirects.
     *
     * @param {Event} e
     */
    ,handleDidNavigate: function(e) {
        var me = this;
        var webview = me.getWebView();

        if (e.isMainFrame && me.record.get('type') === 'tweetdeck') {
            Ext.defer(function() { webview.loadURL(e.newURL); }, 1000);
        }
    }

    // ──────────────────────────────────────────────
    // DOM Ready – injection, certificate errors, keyboard forwarding
    // ──────────────────────────────────────────────

    /**
     * Handler for webview "dom-ready" event.
     * Orchestrates mute, JS injection, certificate-error registration,
     * keyboard forwarding and Google login URL reload.
     */
    ,handleDomReady: function() {
        var me = this;
        var webview = me.getWebView();

        // Mute webview if needed
        if (me.record.get('muted') || localStorage.getItem('locked') || JSON.parse(localStorage.getItem('dontDisturb'))) {
            me.setAudioMuted(true, true);
        }

        // Build JS injection payload
        var js_inject = me._buildJsInjectionPayload();

        // Register Electron-level handlers (only once per webview lifetime)
        if (!me._electronHandlersRegistered) {
            me._registerElectronHandlers(webview);
            me._electronHandlersRegistered = true;

            // Reload if current URL is a Google login URL
            Rambox.app.config.googleURLs.forEach(function(loginURL) {
                if (webview.getURL().indexOf(loginURL) > -1) webview.reload();
            });
        }

        webview.executeJavaScript(js_inject).then(function() {}).catch(function(err) { console.log(err); });
    }

    /**
     * Builds the JavaScript payload to inject on dom-ready.
     * Includes unread-count detection and title-blink prevention.
     *
     * @return {String}
     * @private
     */
    ,_buildJsInjectionPayload: function() {
        var me = this;
        var js_inject = '';

        if (me.record) {
            var serviceListRec = Ext.getStore('ServicesList').getById(me.record.get('type'));
            var js_unread = (serviceListRec ? serviceListRec.get('js_unread') : '') + me.record.get('js_unread');
            if (js_unread !== '') {
                console.groupCollapsed(me.record.get('type').toUpperCase() + ' - JS Injected to Detect New Messages');
                console.info(me.type);
                console.log(js_unread);
                js_inject += js_unread;
            }
        }

        // Prevent title blinking (only allow "(3) Title" pattern updates)
        var serviceListRec2 = Ext.getStore('ServicesList').getById(me.record.get('type'));
        if (serviceListRec2 ? serviceListRec2.get('titleBlink') : false) {
            var js_preventBlink = 'var originalTitle=document.title;Object.defineProperty(document,"title",{configurable:!0,set:function(a){null===a.match(new RegExp("[(]([0-9•]+)[)][ ](.*)","g"))&&a!==originalTitle||(document.getElementsByTagName("title")[0].innerHTML=a)},get:function(){return document.getElementsByTagName("title")[0].innerHTML}});';
            console.log(js_preventBlink);
            js_inject += js_preventBlink;
        }

        console.groupEnd();

        // Scroll always to top (bug workaround)
        js_inject += 'document.body.scrollTop=0;';

        return js_inject;
    }

    /**
     * Registers Electron webContents-level handlers (certificate-error,
     * before-input-event) via the ElectronBridge adapter.
     *
     * @param {HTMLElement} webview
     * @private
     */
    ,_registerElectronHandlers: function(webview) {
        var me = this;
        var bridge = Rambox.util.ElectronBridge;
        var wc = bridge.getWebContentsFromWebView(webview);

        // Certificate error handler
        bridge.onCertificateError(wc, function(event, url, error, certificate, callback) {
            if (me.record.get('trust')) {
                event.preventDefault();
                callback(true);
            } else {
                callback(false);
            }

            var sb = me.down('statusbar');
            sb.keep = true;
            sb.show();
            sb.setStatus({
                text: '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> Certification Warning'
            });
            sb.down('button').show();
        });

        // Keyboard forwarding handler
        bridge.onBeforeInputEvent(wc, function(event, input) {
            if (input.type !== 'keyDown') return;

            var modifiers = [];
            if (input.shift) modifiers.push('shift');
            if (input.control) modifiers.push('control');
            if (input.alt) modifiers.push('alt');
            if (input.meta) modifiers.push('meta');
            if (input.isAutoRepeat) modifiers.push('isAutoRepeat');

            if (input.key === 'Tab' && !(modifiers && modifiers.length)) return;

            // Map special keys on macOS
            if (bridge.getPlatform() === 'darwin') {
                var keys = {};
                keys['ƒ'] = 'f';  // Search
                keys[' '] = 'l';  // Lock
                keys['∂'] = 'd';  // DND
                input.key = keys[input.key] ? keys[input.key] : input.key;
            }

            // Skip keys handled at app level
            if (
                input.key === 'F11' ||
                input.key === 'a' ||
                input.key === 'A' ||
                input.key === 'F12' ||
                input.key === 'q' ||
                (input.key === 'F1' && modifiers.indexOf('control') !== -1)
            ) return;

            bridge.sendInputEvent({
                type: input.type,
                keyCode: input.key,
                modifiers: modifiers
            });
        });
    }

    // ──────────────────────────────────────────────
    // IPC Messages
    // ──────────────────────────────────────────────

    /**
     * Handler for webview "ipc-message" event.
     * Dispatches to specific sub-handlers based on channel name.
     *
     * @param {Event} event
     */
    ,handleIpcMessage: function(event) {
        var me = this;
        var channel = event.channel;

        switch (channel) {
            case 'rambox.setUnreadCount':
                me._handleSetUnreadCount(event);
                break;
            case 'rambox.clearUnreadCount':
                me._handleClearUnreadCount(event);
                break;
            case 'rambox.showWindowAndActivateTab':
                me._handleShowWindowAndActivateTab(event);
                break;
        }
    }

    /**
     * Handles 'rambox.clearUnreadCount' IPC messages.
     * @private
     */
    ,_handleClearUnreadCount: function() {
        var me = this;
        me.tab.setBadgeText('');
        me.currentUnreadCount = 0;
        me.setUnreadCount(0);
    }

    /**
     * Handles 'rambox.setUnreadCount' IPC messages.
     * Sets the badge text if the event contains an integer or '•'.
     *
     * @param {Event} event
     * @private
     */
    ,_handleSetUnreadCount: function(event) {
        var me = this;
        if (Array.isArray(event.args) === true && event.args.length > 0) {
            var count = event.args[0];
            if (count === parseInt(count, 10) || '•' === count) {
                if (count === 999999) count = '•';
                me.setUnreadCount(count);
            }
        }
    }

    /**
     * Handles 'rambox.showWindowAndActivateTab' IPC messages.
     * Brings the window to front and focuses the correct tab.
     *
     * @param {Event} event
     * @private
     */
    ,_handleShowWindowAndActivateTab: function() {
        var me = this;
        Rambox.util.ElectronBridge.getCurrentWindow().show();
        var tabPanel = Ext.cq1('app-main');
        // Temp fix for missing cursor after Electron 3.x+
        tabPanel.setActiveTab(me);
        tabPanel.getActiveTab().getWebView().blur();
        tabPanel.getActiveTab().getWebView().focus();
    }

    // ──────────────────────────────────────────────
    // Title-based unread detection
    // ──────────────────────────────────────────────

    /**
     * Handler for webview "page-title-updated" event.
     * Extracts unread count from title pattern "(N) Title".
     *
     * @param {Event} e
     */
    ,handlePageTitleUpdated: function(e) {
        var me = this;
        var count = e.title.match(/\(([^)]+)\)/);
        count = count ? count[1] : '0';
        count = count === '•' ? count : (Ext.isArray(count.match(/\d+/g)) ? count.match(/\d+/g).join('') : count.match(/\d+/g));
        count = count === null ? '0' : count;

        me.setUnreadCount(count);
    }

    // ──────────────────────────────────────────────
    // Status bar URL update
    // ──────────────────────────────────────────────

    /**
     * Handler for webview "update-target-url" event.
     * Updates the URL displayed in the status bar.
     *
     * @param {Object} url
     */
    ,handleUpdateTargetUrl: function(url) {
        var me = this;
        me.down('statusbar #url').setText(url.url);
    }

    // ──────────────────────────────────────────────
    // Found-in-page (search)
    // ──────────────────────────────────────────────

    /**
     * Handler for webview "found-in-page" event.
     * Delegates to the Search mixin's onSearchText.
     *
     * @param {Event} e
     */
    ,handleFoundInPage: function(e) {
        var me = this;
        me.onSearchText(e.result);
    }
});
