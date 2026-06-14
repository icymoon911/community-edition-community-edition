/**
 * Default config for all webviews created.
 *
 * Refactored to use mixins for separation of concerns:
 *   - Rambox.ux.mixin.Search       → search bar (showSearchBox, doSearchText, onSearchText)
 *   - Rambox.ux.mixin.Zoom         → zoom controls (zoomIn, zoomOut, resetZoom)
 *   - Rambox.ux.mixin.WebViewEvents → webview event handlers (loading, errors, DOM-ready, IPC)
 *   - Rambox.ux.ContextMenuBuilder → context menu construction
 *   - Rambox.util.ElectronBridge   → Electron API adapter
 */

Ext.define('Rambox.ux.WebView',{
     extend: 'Ext.panel.Panel'
    ,xtype: 'webview'

    ,requires: [
         'Rambox.util.Format'
        ,'Rambox.util.Notifier'
        ,'Rambox.util.UnreadCounter'
        ,'Rambox.util.IconLoader'
        ,'Rambox.util.ElectronBridge'
        ,'Rambox.ux.ContextMenuBuilder'
        ,'Rambox.ux.mixin.Search'
        ,'Rambox.ux.mixin.Zoom'
        ,'Rambox.ux.mixin.WebViewEvents'
    ]

    ,mixins: [
         'Rambox.ux.mixin.Search'
        ,'Rambox.ux.mixin.Zoom'
        ,'Rambox.ux.mixin.WebViewEvents'
    ]

    // private
    ,currentUnreadCount: 0

    // CONFIG
    ,hideMode: 'offsets'
    ,initComponent: function(config) {
        var me = this;

        function getLocation(href) {
            var match = href.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)(\/[^?#]*)(\?[^#]*|)(#.*|)$/);
            return match && {
                protocol: match[1],
                host: match[2],
                hostname: match[3],
                port: match[4],
                pathname: match[5],
                search: match[6],
                hash: match[7]
            };
        }

        var prefConfig = ipc.sendSync('getConfig');
        Ext.apply(me, {
             items: me.webViewConstructor()
            ,title: prefConfig.hide_tabbar_labels ? '' : (me.record.get('tabname') ? me.record.get('name') : '')
            ,icon: me.record.get('type') === 'custom' ? (me.record.get('logo') === '' ? 'resources/icons/custom.png' : me.record.get('logo')) : 'resources/icons/' + me.record.get('logo')
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
                ,menu: Rambox.ux.ContextMenuBuilder.build(me)
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
                            if (e.getKey() === e.ESC) return me.showSearchBox(false);
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
        var me = this;
        me.setUnreadCount(0);
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
                    ,partition: 'persist:' + me.record.get('type') + '_' + me.id.replace('tab_', '') + (localStorage.getItem('id_token') ? '_' + Ext.decode(localStorage.getItem('profile')).sub : '')
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
        var ua = ipc.sendSync('getConfig').user_agent
            ? ipc.sendSync('getConfig').user_agent
            : Ext.getStore('ServicesList').getById(this.record.get('type'))
                ? Ext.getStore('ServicesList').getById(this.record.get('type')).get('userAgent')
                : '';
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
     * onAfterRender – now only responsible for registering event listeners.
     * All handler logic lives in the WebViewEvents mixin.
     */
    ,onAfterRender: function() {
        var me = this;

        if (!me.record.get('enabled')) return;

        var webview = me.getWebView();
        me.errorCodeLog = [];

        // Notifications in webview
        me.setNotifications(
            localStorage.getItem('locked') || JSON.parse(localStorage.getItem('dontDisturb'))
                ? false
                : me.record.get('notifications')
        );

        // Register Google accounts User-Agent override via ElectronBridge
        var partition = 'persist:' + me.record.get('type') + '_' + me.id.replace('tab_', '') +
            (localStorage.getItem('id_token') ? '_' + Ext.decode(localStorage.getItem('profile')).sub : '');

        Rambox.util.ElectronBridge.onBeforeSendHeaders(partition, function(details, callback) {
            var change = details.url.match(/^https:\/\/accounts\.google\.com(\/|$)/);
            if (change) {
                details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0';
            }
            callback({ cancel: false, requestHeaders: details.requestHeaders });
        });

        // ── Register all webview event listeners ──
        // Each listener delegates to a named handler in the WebViewEvents mixin.

        webview.addEventListener('did-start-loading',  function()   { me.handleDidStartLoading(); });
        webview.addEventListener('did-stop-loading',   function()   { me.handleDidStopLoading(); });
        webview.addEventListener('did-finish-load',    function(e)  { me.handleDidFinishLoad(e); });
        webview.addEventListener('found-in-page',      function(e)  { me.handleFoundInPage(e); });
        webview.addEventListener('did-fail-load',      function(e)  { me.handleDidFailLoad(e); });
        webview.addEventListener('new-window',         function(e)  { me.handleNewWindow(e); });
        webview.addEventListener('will-navigate',      function(e)  { me.handleWillNavigate(e); });
        webview.addEventListener('dom-ready',          function()   { me.handleDomReady(); });
        webview.addEventListener('ipc-message',        function(e)  { me.handleIpcMessage(e); });
        webview.addEventListener('did-navigate',       function(e)  { me.handleDidNavigate(e); });
        webview.addEventListener('update-target-url',  function(url){ me.handleUpdateTargetUrl(url); });

        // Register page-title-updated only for services without js_unread
        var serviceListRec = Ext.getStore('ServicesList').getById(me.record.get('type'));
        var hasJsUnread = (serviceListRec ? serviceListRec.get('js_unread') : '') !== '' || me.record.get('js_unread') !== '';
        if (!hasJsUnread) {
            webview.addEventListener('page-title-updated', function(e) { me.handlePageTitleUpdated(e); });
        }
    }

    ,setUnreadCount: function(newUnreadCount) {
        var me = this;

        if (!isNaN(newUnreadCount) && (function(x) { return (x | 0) === x; })(parseFloat(newUnreadCount)) && me.record.get('includeInGlobalUnreadCounter') === true) {
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
     * Dispatches a manual notification when conditions are met:
     *   - Service supports manual notifications
     *   - Count increased
     *   - Not in DND mode
     *   - Notifications enabled
     *
     * @param {Number} count
     */
    ,doManualNotification: function(count) {
        var me = this;
        var manualNotifications = Ext.getStore('ServicesList').getById(me.type)
            ? Ext.getStore('ServicesList').getById(me.type).get('manual_notifications')
            : false;

        if (manualNotifications && me.currentUnreadCount < count && me.record.get('notifications') && !JSON.parse(localStorage.getItem('dontDisturb'))) {
            Rambox.util.Notifier.dispatchNotification(me, count);
        }

        me.currentUnreadCount = count;
    }

    /**
     * Sets the tab badge text based on the "displayTabUnreadCounter" config.
     * @param {String} badgeText
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
     * Clears the unread counter: badge text + global counter.
     */
    ,clearUnreadCounter: function() {
        var me = this;
        me.tab.setBadgeText('');
        Rambox.util.UnreadCounter.clearUnreadCountForService(me.record.get('id'));
    }

    ,reloadService: function(btn) {
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

    ,toggleDevTools: function(btn) {
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

        if (me.record.get('enabled')) ipc.send('setServiceNotifications', webview.partition, notification);
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
