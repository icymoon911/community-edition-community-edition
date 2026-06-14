/**
 * WebViewEvents - centralised handler class for all webview lifecycle
 * and IPC events.
 *
 * Each public method receives the owning `Rambox.ux.WebView` instance
 * (`me`) as the first argument, so the handlers are stateless and can
 * be tested in isolation.
 *
 * The WebView's `onAfterRender` is now reduced to a thin registration
 * layer that simply binds each handler to the webview element.
 */
Ext.define('Rambox.ux.webview.WebViewEvents', {
	singleton: true

	,requires: [
		'Rambox.util.ElectronBridge'
	]

	// ----------------------------------------------------------------
	// Loading lifecycle
	// ----------------------------------------------------------------

	,onDidStartLoading: function(me) {
		console.info('Start loading...', me.src);

		var sb = me.down('statusbar');
		if (!sb.closed || !sb.keep) sb.show();
		sb.showBusy();
	}

	,onDidStopLoading: function(me) {
		var sb = me.down('statusbar');
		sb.clearStatus({ useDefaults: true });
		if (!sb.keep) sb.hide();
	}

	,onDidFinishLoad: function(me, webview) {
		Rambox.app.setTotalServicesLoaded(Rambox.app.getTotalServicesLoaded() + 1);

		// Apply saved zoom level
		var zoomLevel = me.record.get('zoomLevel');
		if (zoomLevel !== undefined && zoomLevel !== null) {
			webview.setZoomLevel(zoomLevel);
		}

		// Fix cursor sometimes disappearing
		var currentTab = Ext.cq1('app-main').getActiveTab();
		if (currentTab && currentTab.id === me.id) {
			webview.blur();
			webview.focus();
		}

		// Set special icon for some services (like Slack)
		Rambox.util.IconLoader.loadServiceIconUrl(me, webview);
	}

	// ----------------------------------------------------------------
	// Error handling
	// ----------------------------------------------------------------

	,onDidFailLoad: function(me, e) {
		console.info('The service fail at loading', me.src, e);

		if (me.record.get('disableAutoReloadOnFail') || !e.isMainFrame) return;
		me.errorCodeLog.push(e.errorCode);

		var attempt = me.errorCodeLog.filter(function(code) { return code === e.errorCode; });

		// Error codes: https://cs.chromium.org/chromium/src/net/base/net_error_list.h
		var msg = [];
		msg[-2]   = 'NET error: failed.';
		msg[-3]   = 'An operation was aborted (due to user action)';
		msg[-7]   = 'Connection timeout.';
		msg[-21]  = 'Network change.';
		msg[-100] = 'The connection was reset. Check your internet connection.';
		msg[-101] = 'The connection was reset. Check your internet connection.';
		msg[-105] = 'Name not resolved. Check your internet connection.';
		msg[-106] = 'There is no active internet connection.';
		msg[-118] = 'Connection timed out. Check your internet connection.';
		msg[-130] = 'Proxy connection failed. Please, check the proxy configuration.';
		msg[-300] = 'The URL is invalid.';
		msg[-324] = 'Empty response. Check your internet connection.';

		switch (e.errorCode) {
			case 0:
				break;
			case -3:
				// Aborted - some pages (Gmail, etc.) abort iframes frequently
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
				attempt.length > 4 ? me.onFailLoad(msg[e.errorCode]) : setTimeout(function() { me.reloadService(me); }, 2000);
				break;
			case -106:
				me.onFailLoad(msg[e.errorCode]);
				break;
			case -130:
			case -300:
				attempt.length > 4 ? me.onFailLoad(msg[e.errorCode]) : me.reloadService(me);
				break;
		}
	}

	// ----------------------------------------------------------------
	// Navigation
	// ----------------------------------------------------------------

	,onNewWindow: function(e) {
		e.preventDefault();
		var URL = require('url').URL;
		var url = new URL(e.url);
		var protocol = url.protocol;

		// Block some deep links to prevent opening native apps (e.g. Slack)
		if (['slack:'].includes(protocol)) return;

		// Allow specific deep links
		if (!['http:', 'https:', 'about:'].includes(protocol)) {
			return Rambox.util.ElectronBridge.openExternal(url.href);
		}
	}

	,onWillNavigate: function(e) {
		e.preventDefault();
	}

	,onDidNavigate: function(me, e) {
		var webview = me.getWebView();
		if (e.isMainFrame && me.record.get('type') === 'tweetdeck') {
			// Defer because sometimes TweetDeck doesn't redirect immediately (e.g. 2FA)
			Ext.defer(function() { webview.loadURL(e.newURL); }, 1000);
		}
	}

	,onUpdateTargetUrl: function(me, url) {
		me.down('statusbar #url').setText(url.url);
	}

	// ----------------------------------------------------------------
	// DOM Ready  (JS injection, certificate handling, keyboard forwarding)
	// ----------------------------------------------------------------

	,onDomReady: function(me, webview, eventsOnDomRef) {
		// Mute webview when locked or in DND mode
		if (me.record.get('muted') || localStorage.getItem('locked') || JSON.parse(localStorage.getItem('dontDisturb'))) {
			me.setAudioMuted(true, true);
		}

		var js_inject = '';

		// Injected code to detect new messages
		if (me.record) {
			var serviceListItem = Ext.getStore('ServicesList').getById(me.record.get('type'));
			var js_unread = serviceListItem ? serviceListItem.get('js_unread') : '';
			js_unread = js_unread + me.record.get('js_unread');
			if (js_unread !== '') {
				console.groupCollapsed(me.record.get('type').toUpperCase() + ' - JS Injected to Detect New Messages');
				console.info(me.type);
				console.log(js_unread);
				js_inject += js_unread;
			}
		}

		// Prevent title blinking (some services have it) - only allow when the title has an unread regex match: "(3) Title"
		var serviceListItem2 = Ext.getStore('ServicesList').getById(me.record.get('type'));
		if (serviceListItem2 ? serviceListItem2.get('titleBlink') : false) {
			var js_preventBlink = 'var originalTitle=document.title;Object.defineProperty(document,"title",{configurable:!0,set:function(a){null===a.match(new RegExp("[(]([0-9•]+)[)][ ](.*)","g"))&&a!==originalTitle||(document.getElementsByTagName("title")[0].innerHTML=a)},get:function(){return document.getElementsByTagName("title")[0].innerHTML}});';
			console.log(js_preventBlink);
			js_inject += js_preventBlink;
		}

		console.groupEnd();

		// Scroll always to top (bug fix)
		js_inject += 'document.body.scrollTop=0;';

		// Certificate error handling
		var wc = Rambox.util.ElectronBridge.getWebContents(webview);

		Rambox.util.ElectronBridge.onCertificateError(wc, function(event, url, error, certificate, callback) {
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

		// before-input-event (keyboard forwarding) - only register once
		if (!eventsOnDomRef.value) {
			Rambox.util.ElectronBridge.onBeforeInputEvent(wc, function(event, input) {
				if (input.type !== 'keyDown') return;

				var modifiers = [];
				if (input.shift)       modifiers.push('shift');
				if (input.control)     modifiers.push('control');
				if (input.alt)         modifiers.push('alt');
				if (input.meta)        modifiers.push('meta');
				if (input.isAutoRepeat) modifiers.push('isAutoRepeat');

				if (input.key === 'Tab' && !(modifiers && modifiers.length)) return;

				// Map special keys to fire the correct event on macOS
				if (Rambox.util.ElectronBridge.getPlatform() === 'darwin') {
					var keys = {};
					keys['ƒ'] = 'f';  // Search
					keys[' '] = 'l';  // Lock
					keys['∂'] = 'd';  // DND
					input.key = keys[input.key] ? keys[input.key] : input.key;
				}

				if (
					input.key === 'F11' ||
					input.key === 'a'   ||
					input.key === 'A'   ||
					input.key === 'F12' ||
					input.key === 'q'   ||
					(input.key === 'F1' && modifiers.includes('control'))
				) return;

				Rambox.util.ElectronBridge.sendInputEvent({
					 type: input.type
					,keyCode: input.key
					,modifiers: modifiers
				});
			});

			eventsOnDomRef.value = true;

			// Reload if current URL matches any configured Google login URL
			var currentURL = webview.getURL();
			Rambox.app.config.googleURLs.forEach(function(loginURL) {
				if (currentURL.indexOf(loginURL) > -1) webview.reload();
			});
		}

		webview.executeJavaScript(js_inject).then(function() {}).catch(function(err) { console.log(err); });
	}

	// ----------------------------------------------------------------
	// IPC messages (unread count, window activation)
	// ----------------------------------------------------------------

	,onIpcMessage: function(me, event) {
		var channel = event.channel;
		switch (channel) {
			case 'rambox.setUnreadCount':
				this.handleSetUnreadCount(me, event);
				break;
			case 'rambox.clearUnreadCount':
				this.handleClearUnreadCount(me);
				break;
			case 'rambox.showWindowAndActivateTab':
				this.handleShowWindowAndActivateTab(me);
				break;
		}
	}

	,handleClearUnreadCount: function(me) {
		me.tab.setBadgeText('');
		me.currentUnreadCount = 0;
		me.setUnreadCount(0);
	}

	,handleSetUnreadCount: function(me, event) {
		if (Array.isArray(event.args) && event.args.length > 0) {
			var count = event.args[0];
			if (count === parseInt(count, 10) || '•' === count) {
				if (count === 999999) count = '•';
				me.setUnreadCount(count);
			}
		}
	}

	,handleShowWindowAndActivateTab: function(me) {
		Rambox.util.ElectronBridge.showCurrentWindow();
		var tabPanel = Ext.cq1('app-main');
		// Temp fix for missing cursor after Electron 3.x+ upgrade
		tabPanel.setActiveTab(me);
		tabPanel.getActiveTab().getWebView().blur();
		tabPanel.getActiveTab().getWebView().focus();
	}

	// ----------------------------------------------------------------
	// Page title (for services without js_unread)
	// ----------------------------------------------------------------

	,onPageTitleUpdated: function(me, e) {
		var count = e.title.match(/\(([^)]+)\)/);  // Get text between (...)
		count = count ? count[1] : '0';
		count = count === '•' ? count : (Ext.isArray(count.match(/\d+/g)) ? count.match(/\d+/g).join('') : count.match(/\d+/g));
		count = count === null ? '0' : count;

		me.setUnreadCount(count);
	}

	// ----------------------------------------------------------------
	// Found-in-page (search result counter)
	// ----------------------------------------------------------------

	,onFoundInPage: function(me, e) {
		me.onSearchText(e.result);
	}
});
