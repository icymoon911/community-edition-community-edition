Ext.define('Rambox.view.main.HealthOverview', {
	 extend: 'Ext.window.Window'

	,title: '服务健康概览 (Service Health Overview)'
	,width: 720
	,height: 520
	,modal: true
	,closable: true
	,minimizable: false
	,maximizable: false
	,draggable: true
	,resizable: true
	,layout: 'fit'

	,initComponent: function() {
		var me = this;

		Ext.apply(me, {
			items: [{
				 xtype: 'grid'
				,store: 'Services'
				,forceFit: true
				,stripeRows: true
				,columns: [
					{
						 text: 'Service'
						,dataIndex: 'name'
						,flex: 2
					}
					,{
						 text: 'Status'
						,dataIndex: 'loadStatus'
						,width: 90
						,align: 'center'
						,renderer: function(value, metaData, record) {
							if (!record.get('enabled')) return '<span style="color:#999;font-weight:bold;">Disabled</span>';
							if (value === 'failed') return '<span style="color:#f44336;font-weight:bold;">Failed</span>';
							if (value === 'loading') return '<span style="color:#ff9800;font-weight:bold;">Loading</span>';
							return '<span style="color:#4caf50;font-weight:bold;">Ready</span>';
						}
					}
					,{
						 text: 'Last Failure'
						,dataIndex: 'lastFailTime'
						,width: 170
						,renderer: function(value) {
							if (!value) return '<span style="color:#999;">Never</span>';
							try {
								var d = new Date(value);
								return d.toLocaleString();
							} catch(e) {
								return '<span style="color:#999;">Never</span>';
							}
						}
					}
					,{
						 text: 'Fail Count'
						,dataIndex: 'failCount'
						,width: 85
						,align: 'center'
						,renderer: function(value) {
							var count = value || 0;
							var style = count > 0 ? 'color:#f44336;font-weight:bold;' : 'color:#999;';
							return '<span style="' + style + '">' + count + '</span>';
						}
					}
					,{
						 xtype: 'actioncolumn'
						,text: 'Action'
						,width: 90
						,align: 'center'
						,items: [{
							 glyph: 0xf021
							,tooltip: 'Reload this service'
							,handler: function(grid, rowIndex, colIndex) {
								var record = grid.getStore().getAt(rowIndex);
								me.reloadServiceFromOverview(record);
							}
							,getClass: function(value, metaData, record) {
								if (!record.get('enabled')) return 'x-hidden';
								return '';
							}
						}]
					}
				]
				,bbar: [
					'->'
					,{
						 xtype: 'button'
						,text: 'Reload All Failed Services'
						,glyph: 'xf021@FontAwesome'
						,handler: function() {
							Ext.getStore('Services').each(function(record) {
								if (record.get('enabled') && record.get('loadStatus') === 'failed') {
									me.reloadServiceFromOverview(record);
								}
							});
						}
					}
					,{
						 xtype: 'button'
						,text: 'Close'
						,handler: function() { me.close(); }
					}
				]
			}]
		});

		me.callParent(arguments);
	}

	,reloadServiceFromOverview: function(record) {
		var serviceId = record.get('id');
		var tab = Ext.getCmp('tab_' + serviceId);

		if (tab && tab.getWebView && record.get('enabled')) {
			tab.reloadService(tab);
		}
	}
});
