/**
 * TabConfigBuilder - builds the tab panel items from the Services store.
 *
 * Extracts the ~60 lines of tab-config construction that used to live
 * inside the store's `load` listener, plus the left / right grouping
 * and default-active-tab logic.
 */
Ext.define('Rambox.util.TabConfigBuilder', {
	singleton: true

	/**
	 * Builds a tab config object for a single service record.
	 *
	 * @param {Rambox.model.Service} service  The service record.
	 * @return {Object}  A config object suitable for `Ext.cq1('app-main').add()`.
	 */
	,buildTabConfig: function(service) {
		return {
			 xtype: 'webview'
			,id: 'tab_' + service.get('id')
			,title: service.get('name')
			,icon: service.get('type') !== 'custom'
				? 'resources/icons/' + service.get('logo')
				: (service.get('logo') === '' ? 'resources/icons/custom.png' : service.get('logo'))
			,src: service.get('url')
			,type: service.get('type')
			,muted: service.get('muted')
			,includeInGlobalUnreadCounter: service.get('includeInGlobalUnreadCounter')
			,displayTabUnreadCounter: service.get('displayTabUnreadCounter')
			,enabled: service.get('enabled')
			,record: service
			,useragent: ipc.sendSync('getConfig').user_agent
			,tabConfig: {
				service: service
			}
		};
	}

	/**
	 * Applies rebranding fixes to a service record if necessary.
	 * (e.g. the old "spark" service was renamed to "webexteams".)
	 *
	 * @param {Rambox.model.Service} service
	 */
	,applyRebranding: function(service) {
		if (service.get('type') === 'spark') {
			service.set('type', 'webexteams');
			service.set('logo', 'webexteams.png');
		}
	}

	/**
	 * Iterates the store and returns two arrays: left-aligned and right-aligned
	 * tab configs.
	 *
	 * @param {Rambox.store.Services} store
	 * @return {{ left: Array, right: Array }}
	 */
	,buildGroupedTabs: function(store) {
		var me = this;
		var servicesLeft = [];
		var servicesRight = [];

		store.each(function(service) {
			// Skip disabled services - they are not added to the tab bar
			if (!service.get('enabled')) return;

			me.applyRebranding(service);

			var cfg = me.buildTabConfig(service);
			if (service.get('align') === 'left') {
				servicesLeft.push(cfg);
			} else {
				servicesRight.push(cfg);
			}
		});

		return { left: servicesLeft, right: servicesRight };
	}

	/**
	 * Inserts the grouped tabs into the main tab panel and sets the default
	 * active tab based on the user's config preference.
	 *
	 * @param {Rambox.store.Services} store
	 */
	,applyToTabPanel: function(store) {
		var tabPanel = Ext.cq1('app-main');

		tabPanel.suspendEvent('add');

		var groups = this.buildGroupedTabs(store);

		if (!Ext.isEmpty(groups.left))  tabPanel.insert(1, groups.left);
		if (!Ext.isEmpty(groups.right)) tabPanel.add(groups.right);

		// Set default active service
		var config = ipc.sendSync('getConfig');
		switch (config.default_service) {
			case 'last':
				tabPanel.setActiveTab(localStorage.getItem('last_active_service'));
				break;
			case 'ramboxTab':
				// Do nothing - ramboxTab is the default first tab
				break;
			default:
				if (Ext.getCmp('tab_' + config.default_service)) {
					tabPanel.setActiveTab('tab_' + config.default_service);
				}
				break;
		}

		store.suspendEvent('load');
		tabPanel.resumeEvent('add');
	}
});
