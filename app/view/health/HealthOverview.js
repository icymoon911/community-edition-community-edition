Ext.define('Rambox.view.health.HealthOverview', {
	 extend: 'Ext.window.Window'
	,xtype: 'healthoverview'

	,title: 'Service Health Overview'
	,width: 620
	,height: 450
	,modal: true
	,closable: true
	,minimizable: false
	,maximizable: false
	,draggable: true
	,resizable: false
	,scrollable: 'vertical'
	,itemId: 'healthOverviewWindow'

	,initComponent: function() {
		var me = this;

		me.items = [{
			 xtype: 'container'
			,itemId: 'healthContent'
			,style: 'padding:15px;'
			,autoScroll: true
			,html: me.buildHTML()
		}];

		me.buttons = [{
			 text: 'Close'
			,handler: function() { me.close(); }
		}];

		me.callParent();

		me.on('afterrender', function() {
			me.attachReloadHandlers();
		});
	}

	,buildHTML: function() {
		var store = Ext.getStore('Services');
		var html = '<style>'
			+ '.health-table { width:100%; border-collapse:collapse; font-size:13px; }'
			+ '.health-table th { text-align:left; padding:8px; border-bottom:2px solid #ddd; font-weight:bold; }'
			+ '.health-table td { padding:8px; border-bottom:1px solid #eee; vertical-align:middle; }'
			+ '.health-table tr:hover { background:#f5f5f5; }'
			+ '.status-dot { width:12px; height:12px; border-radius:50%; display:inline-block; vertical-align:middle; }'
			+ '.status-ready { background:#4caf50; }'
			+ '.status-loading { background:#ff9800; }'
			+ '.status-error { background:#f44336; }'
			+ '.status-disabled { background:#9e9e9e; }'
			+ '.reload-btn { cursor:pointer; padding:4px 12px; background:#2196f3; color:#fff; border:none; border-radius:3px; font-size:12px; }'
			+ '.reload-btn:hover { background:#1976d2; }'
			+ '.no-fail { color:#999; font-style:italic; }'
			+ '</style>';

		html += '<table class="health-table">';
		html += '<tr><th>Service</th><th>Status</th><th>Last Fail Time</th><th>Fail Count</th><th>Action</th></tr>';

		store.each(function(rec) {
			var enabled = rec.get('enabled');
			var status = enabled ? (rec.get('healthStatus') || 'ready') : 'disabled';
			var statusClass = 'status-' + status;
			var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
			var lastFail = rec.get('lastFailTime') || '';
			var failCount = rec.get('failCount') || 0;

			html += '<tr>';
			html += '<td><b>' + Ext.htmlEncode(rec.get('name')) + '</b><br/><small style="color:#888;">' + Ext.htmlEncode(rec.get('type')) + '</small></td>';
			html += '<td><span class="status-dot ' + statusClass + '"></span> ' + statusLabel + '</td>';
			html += '<td>' + (lastFail || '<span class="no-fail">Never</span>') + '</td>';
			html += '<td>' + failCount + '</td>';
			html += '<td>' + (status === 'error' && enabled ? '<button class="reload-btn" data-service-id="' + rec.get('id') + '">Reload</button>' : '-') + '</td>';
			html += '</tr>';
		});

		html += '</table>';

		if (store.getCount() === 0) {
			html += '<p style="text-align:center;color:#888;padding:20px;">No services added.</p>';
		}

		return html;
	}

	,attachReloadHandlers: function() {
		var me = this;
		var container = me.down('#healthContent');
		if (!container || !container.getEl()) return;

		var buttons = container.getEl().query('.reload-btn');
		Ext.each(buttons, function(btn) {
			var serviceId = btn.getAttribute('data-service-id');
			Ext.get(btn).on('click', function() {
				me.reloadService(parseInt(serviceId));
			});
		});
	}

	,reloadService: function(serviceId) {
		var tab = Ext.getCmp('tab_' + serviceId);
		if (tab && tab.record.get('enabled')) {
			var webview = tab.getWebView();
			if (webview) {
				webview.reload();
				tab.record.set('healthStatus', 'loading');
			}
		}
		Ext.toast({
			 html: 'Reloading service...'
			,title: 'Service Reload'
			,width: 200
			,align: 't'
			,closable: false
		});
	}

	,refreshContent: function() {
		var me = this;
		var container = me.down('#healthContent');
		if (container) {
			container.update(me.buildHTML());
			me.attachReloadHandlers();
		}
	}
});
