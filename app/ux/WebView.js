/**
 * Default config for all webviews created.
 *
 * After refactoring the following concerns were extracted:
 *  - Search:        Rambox.ux.mixin.SearchMixin
 *  - Zoom:          Rambox.ux.mixin.ZoomMixin
 *  - Events:        Rambox.ux.webview.WebViewEvents
 *  - Electron API:  Rambox.util.ElectronBridge
 *  - Context menu:  Rambox.util.ContextMenuBuilder
 */

Ext.define('Rambox.ux.WebView', {
	 extend: 'Ext.panel.Panel'
	,xtype: 'webview'

	,requires: [
		 'Rambox.util.Format'
		,'Rambox.util.Notifier'
		,'Rambox.util.UnreadCounter'
		,'Rambox.util.IconLoader'
		,'Rambox.util.ElectronBridge'
		,'Rambox.util.ContextMenuBuilder'
		,'Rambox.ux.webview.WebViewEvents'
	]

	,mixins: [
		 'Rambox.ux.mixin.SearchMixin'
		,'Rambox.ux.mixin.ZoomMixin'
	]

	// private
	,zoomLevel: 0
	,currentUnreadCount: 0

	// CONFIG
	,hideMode: 'offsets'

	,initComponent: function(config) {
		var me = this;

		const prefConfig = Rambox.util.ElectronBridge.getConfig();
		Ext.apply(me, {
			 items: me.webViewConstructor()
			,title: prefConfig.hide_tabbar_labels ? '' : (me.record.get('tabname') ? me.record.get('name') : '')
			,icon: me.record.get('type') === 'custom'
				? (me.record.get('logo') === '' ? 'resources/icons/custom.png' : me.record.get('logo'))
				: 'resources/icons/' + me.record.get('logo')
			,src: me.record.get('url')
			,type: me.record.get('type')
			,align: me.record.get('align')
			,notifications: me.record.get('notifications')
			,muted: me.record.get('muted')
			,tabConfig: {
				 listeners: {
					 afterrender: function(btn) {
						 btn.el.on('contextmenu', function(e) {
							 btn.showMenu('contextmenu');
							 e.stopEvent();
						 });
					 }
					,scope: me
				 }
				,clickEvent: ''
				,style: !me.record.get('enabled') ? '-webkit-filter: grayscale(1)' : ''
				,menu: {
					 plain: true
					,items: Rambox.util.ContextMenuBuilder.build(me)
				}
			}
			,tbar: {
				 itemId: 'searchBar'
				,hidden: true
				,items: ['->', {
					 xtype: 'textfield'
					,emptyText: 'Search...'
					,listeners: {
						 scope: me
						,change: me.doSearchText
						,specialkey: function(field, e) {
							if (e.getKey() === e.ENTER) return me.doSearchText(field, field.getValue(), null, null, true);
							if (e.getKey() === e.ESC)   return me.showSearchBox(false);
						}
					}
				}, {
					 xtype: 'displayfield'
				}, {
					 xtype: 'segmentedbutton'
					,allowMultiple: false
					,allowToggle: false
					,items: [{
						 glyph: 'xf053@FontAwesome'
						,handler: function() {
							var field = this.up('toolbar').down('textfield');
							me.doSearchText(field, field.getValue(), null, null, false);
						}
					}, {
						 glyph: 'xf054@FontAwesome'
						,handler: function() {
							var field = this.up('toolbar').down('textfield');
							me.doSearchText(field, field.getValue(), null, null, true);
						}
					}]
				}, {
					 xtype: 'button'
					,glyph: 'xf00d@FontAwesome'
					,handler: function() { me.showSearchBox(false); }
				}]
			}
			,listeners: {
				 afterrender: me.onAfterRender
				,beforedestroy: me.onBeforeDestroy
			}
		});

		if (me.record.get('statusbar')) {
			Ext.apply(me, {
				bbar: me.statusBarConstructor(false)
			});
		} else {
			me.items.push(me.statusBarConstructor(true));
		}

		me.callParent(config);
	}

	,onBeforeDestroy: function() {
		this.setUnreadCount(0);
	}

	,webViewConstructor: function(enabled) {
		var me = this;
		var cfg;
		enabled = enabled || me.record.get('enabled');

		if (!enabled) {
			cfg = {
				 xtype: 'container'
				,html: '<h3>Service Disabled</h3>'
				,style: 'text-align:center;'
				,padding: 100
			};
		} else {
			var partition = Rambox.util.ElectronBridge.buildPartition(me.record, me.id);
			cfg = [{
				 xtype: 'component'
				,cls: 'webview'
				,hideMode: 'offsets'
				,autoRender: true
				,autoShow: true
				,autoEl: {
					 tag: 'webview'
					,src: me.record.get('url')
					,style: 'width:100%;height:100%;visibility:visible;'
					,partition: partition
					,plugins: 'true'
					,allowtransparency: 'on'
					,autosize: 'on'
					,webpreferences: 'nativeWindowOpen=yes, spellcheck=no, contextIsolation=no'
					,allowpopups: 'on'
					,useragent: me.getUserAgent()
					,preload: './resources/js/rambox-service-api.js'
				}
			}];
		}

		return cfg;
	}

	,getUserAgent: function() {
		var cfg = Rambox.util.ElectronBridge.getConfig();
		var ua = cfg.user_agent
			? cfg.user_agent
			: (Ext.getStore('ServicesList').getById(this.record.get('type'))
				? Ext.getStore('ServicesList').getById(this.record.get('type')).get('userAgent')
				: '');

		return ua.length === 0
			? window.clientNavigator.userAgent.replace(/Rambox\/([0-9]\.?)+\s/ig, '').replace(/Electron\/([0-9]\.?)+\s/ig, '')
			: ua;
	}

	,statusBarConstructor: function(floating) {
		var me = this;

		return {
			 xtype: 'statusbar'
			,id: me.id + 'statusbar'
			,hidden: !me.record.get('statusbar')
			,keep: me.record.get('statusbar')
			,y: floating ? '-18px' : 'auto'
			,height: 19
			,dock: 'bottom'
			,defaultText: '<i class="fa fa-check fa-fw" aria-hidden="true"></i> Ready'
			,busyIconCls: ''
			,busyText: '<i class="fa fa-circle-o-notch fa-spin fa-fw"></i> ' + locale['app.webview[4]']
			,items: [
				{
					 xtype: 'tbtext'
					,itemId: 'url'
				}
				,{
					 xtype: 'button'
					,glyph: 'xf00d@FontAwesome'
					,scale: 'small'
					,ui: 'decline'
					,padding: 0
					,scope: me
					,hidden: floating
					,handler: me.closeStatusBar
					,tooltip: {
						 text: 'Close statusbar until next time'
						,mouseOffset: [0, -60]
					}
				}
			]
		};
	}

	/**
	 * Thin registration layer. All actual handler logic lives in
	 * `Rambox.ux.webview.WebViewEvents`.
	 */
	,onAfterRender: function() {
		var me = this;

		if (!me.record.get('enabled')) return;

		var webview = me.getWebView();
		var Events  = Rambox.ux.webview.WebViewEvents;
		me.errorCodeLog = [];

		// Notifications in webview
		me.setNotifications(
			localStorage.getItem('locked') || JSON.parse(localStorage.getItem('dontDisturb'))
				? false
				: me.record.get('notifications')
		);

		// Override User-Agent for Google accounts (via ElectronBridge)
		var partition = Rambox.util.ElectronBridge.buildPartition(me.record, me.id);
		var session   = Rambox.util.ElectronBridge.getSession(partition);
		Rambox.util.ElectronBridge.onBeforeSendHeaders(session, function(details, callback) {
			var change = details.url.match(/^https:\/\/accounts\.google\.com(\/|$)/);
			if (change) {
				details.requestHeaders['User-Agent'] =
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0';
			}
			callback({ cancel: false, requestHeaders: details.requestHeaders });
		});

		// Loading lifecycle
		webview.addEventListener('did-start-loading', function() {
			Events.onDidStartLoading(me);
		});

		webview.addEventListener('did-stop-loading', function() {
			Events.onDidStopLoading(me);
		});

		webview.addEventListener('did-finish-load', function() {
			Events.onDidFinishLoad(me, webview);
		});

		// Search
		webview.addEventListener('found-in-page', function(e) {
			Events.onFoundInPage(me, e);
		});

		// Error handling
		webview.addEventListener('did-fail-load', function(e) {
			Events.onDidFailLoad(me, e);
		});

		// Navigation
		webview.addEventListener('new-window', function(e) {
			Events.onNewWindow(e);
		});

		webview.addEventListener('will-navigate', function(e) {
			Events.onWillNavigate(e);
		});

		// DOM ready (uses a mutable ref object so WebViewEvents can flip it)
		var eventsOnDomRef = { value: false };
		webview.addEventListener('dom-ready', function() {
			Events.onDomReady(me, webview, eventsOnDomRef);
		});

		// IPC messages
		webview.addEventListener('ipc-message', function(event) {
			Events.onIpcMessage(me, event);
		});

		// Page title (only for services without js_unread)
		var serviceListItem = Ext.getStore('ServicesList').getById(me.record.get('type'));
		var hasJsUnread = serviceListItem ? serviceListItem.get('js_unread') === '' : false;
		if (hasJsUnread && me.record.get('js_unread') === '') {
			webview.addEventListener('page-title-updated', function(e) {
				Events.onPageTitleUpdated(me, e);
			});
		}

		// Navigation (TweetDeck redirect)
		webview.addEventListener('did-navigate', function(e) {
			Events.onDidNavigate(me, e);
		});

		// Status bar URL display
		webview.addEventListener('update-target-url', function(url) {
			Events.onUpdateTargetUrl(me, url);
		});
	}

	// ----------------------------------------------------------------
	// Unread count management (stays here - tightly coupled to tab badge)
	// ----------------------------------------------------------------

	,setUnreadCount: function(newUnreadCount) {
		var me = this;

		if (
			!isNaN(newUnreadCount) &&
			(function(x) { return (x | 0) === x; })(parseFloat(newUnreadCount)) &&
			me.record.get('includeInGlobalUnreadCounter') === true
		) {
			Rambox.util.UnreadCounter.setUnreadCountForService(me.record.get('id'), newUnreadCount);
		} else {
			Rambox.util.UnreadCounter.clearUnreadCountForService(me.record.get('id'));
		}

		me.setTabBadgeText(Rambox.util.Format.formatNumber(newUnreadCount));
		me.doManualNotification(parseInt(newUnreadCount));
	}

	,refreshUnreadCount: function() {
		this.setUnreadCount(this.currentUnreadCount);
	}

	/**
	 * Dispatches a manual notification when:
	 *  - the service supports manual notifications
	 *  - the count increased
	 *  - not in DND mode
	 *  - notifications are enabled
	 *
	 * @param {number} count
	 */
	,doManualNotification: function(count) {
		var me = this;
		var manualNotifications = Ext.getStore('ServicesList').getById(me.type)
			? Ext.getStore('ServicesList').getById(me.type).get('manual_notifications')
			: false;

		if (
			manualNotifications &&
			me.currentUnreadCount < count &&
			me.record.get('notifications') &&
			!JSON.parse(localStorage.getItem('dontDisturb'))
		) {
			Rambox.util.Notifier.dispatchNotification(me, count);
		}

		me.currentUnreadCount = count;
	}

	/**
	 * Sets the tab badge text depending on `displayTabUnreadCounter`.
	 *
	 * @param {string} badgeText
	 */
	,setTabBadgeText: function(badgeText) {
		var me = this;
		if (me.record.get('displayTabUnreadCounter') === true) {
			me.tab.setBadgeText(badgeText);
		} else {
			me.tab.setBadgeText('');
		}
	}

	/**
	 * Clears the unread counter for this view (badge + global counter).
	 */
	,clearUnreadCounter: function() {
		var me = this;
		me.tab.setBadgeText('');
		Rambox.util.UnreadCounter.clearUnreadCountForService(me.record.get('id'));
	}

	// ----------------------------------------------------------------
	// Misc. (kept here - small and view-specific)
	// ----------------------------------------------------------------

	,reloadService: function() {
		var me = this;
		var webview = me.getWebView();

		if (me.record.get('enabled')) {
			me.clearUnreadCounter();
			webview.loadURL(me.src);
		}
	}

	,onFailLoad: function(v) {
		var me = this;
		me.errorCodeLog = [];
		setTimeout(function() {
			Ext.getCmp(me.id + 'statusbar').setStatus({
				text: '<i class="fa fa-warning fa-fw" aria-hidden="true"></i> The service failed at loading, Error: ' + v
			});
		}, 1000);
	}

	,toggleDevTools: function() {
		var me = this;
		var webview = me.getWebView();

		if (me.record.get('enabled')) {
			webview.isDevToolsOpened() ? webview.closeDevTools() : webview.openDevTools();
		}
	}

	,setURL: function(url) {
		var me = this;
		var webview = me.getWebView();

		me.src = url;
		if (me.record.get('enabled')) webview.loadURL(url);
	}

	,setAudioMuted: function(muted, calledFromDisturb) {
		var me = this;
		var webview = me.getWebView();

		me.muted = muted;

		if (!muted && !calledFromDisturb && JSON.parse(localStorage.getItem('dontDisturb'))) return;

		if (me.record.get('enabled')) webview.setAudioMuted(muted);
	}

	,closeStatusBar: function() {
		var me = this;
		me.down('statusbar').hide();
		me.down('statusbar').closed = true;
		me.down('statusbar').keep = me.record.get('statusbar');
	}

	,setStatusBar: function(keep) {
		var me = this;
		me.removeDocked(me.down('statusbar'), true);

		if (keep) {
			me.addDocked(me.statusBarConstructor(false));
		} else {
			me.add(me.statusBarConstructor(true));
		}
		me.down('statusbar').keep = keep;
	}

	,setNotifications: function(notification, calledFromDisturb) {
		var me = this;
		var webview = me.getWebView();

		me.notifications = notification;

		if (notification && !calledFromDisturb && JSON.parse(localStorage.getItem('dontDisturb'))) return;

		if (me.record.get('enabled')) {
			ipc.send('setServiceNotifications', webview.partition, notification);
		}
	}

	,setEnabled: function(enabled) {
		var me = this;
		me.clearUnreadCounter();
		me.removeAll();
		me.add(me.webViewConstructor(enabled));
		if (enabled) {
			me.resumeEvent('afterrender');
			me.show();
			me.tab.setStyle('-webkit-filter', 'grayscale(0)');
			me.onAfterRender();
		} else {
			me.suspendEvent('afterrender');
			me.tab.setStyle('-webkit-filter', 'grayscale(1)');
		}
	}

	,goBack: function() {
		var me = this;
		var webview = me.getWebView();
		if (me.record.get('enabled')) webview.goBack();
	}

	,goForward: function() {
		var me = this;
		var webview = me.getWebView();
		if (me.record.get('enabled')) webview.goForward();
	}

	,getWebView: function() {
		if (this.record.get('enabled')) {
			return this.down('component[cls=webview]').el.dom;
		} else {
			return false;
		}
	}
});
