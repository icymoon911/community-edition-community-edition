/**
 * TabConfigBuilder - Factory class that builds tab panel configs from
 * Service records, replacing the inline logic previously embedded in
 * the Services store's load listener.
 *
 * Responsibilities:
 *   - Build a webview panel config from a Service model record
 *   - Split records into left-aligned and right-aligned groups
 *   - Insert the resulting configs into the main tab panel
 *   - Restore the default active service tab
 */
Ext.define('Rambox.util.TabConfigBuilder', {
    singleton: true

    /**
     * Builds a single webview panel config from a Service record.
     *
     * @param {Rambox.model.Service} service - The service model record.
     * @return {Object} Panel config suitable for Ext.tab.Panel.add/insert.
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
     * Iterates over all records in the store, applies legacy migrations,
     * builds tab configs and splits them into left/right arrays.
     *
     * @param {Rambox.store.Services} store - The Services store.
     * @return {{ left: Object[], right: Object[] }}
     */
    ,buildAllConfigs: function(store) {
        var me = this;
        var servicesLeft = [];
        var servicesRight = [];

        store.each(function(service) {
            // Skip disabled services – they are not added to the tab bar
            if (!service.get('enabled')) return;

            // Legacy migration: rebranded Spark → WebexTeams
            if (service.get('type') === 'spark') {
                service.set('type', 'webexteams');
                service.set('logo', 'webexteams.png');
            }

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
     * Inserts the built tab configs into the main tab panel and
     * restores the configured default active tab.
     *
     * @param {Rambox.store.Services} store - The Services store.
     */
    ,applyToTabPanel: function(store) {
        var me = this;
        var tabPanel = Ext.cq1('app-main');

        tabPanel.suspendEvent('add');

        var result = me.buildAllConfigs(store);

        if (!Ext.isEmpty(result.left))  tabPanel.insert(1, result.left);
        if (!Ext.isEmpty(result.right)) tabPanel.add(result.right);

        // Restore default active service
        me._restoreActiveTab();

        store.suspendEvent('load');
        tabPanel.resumeEvent('add');
    }

    /**
     * Restores the active tab based on the user's config preference.
     * @private
     */
    ,_restoreActiveTab: function() {
        var config = ipc.sendSync('getConfig');
        var tabPanel = Ext.cq1('app-main');

        switch (config.default_service) {
            case 'last':
                tabPanel.setActiveTab(localStorage.getItem('last_active_service'));
                break;
            case 'ramboxTab':
                break;
            default:
                if (Ext.getCmp('tab_' + config.default_service)) {
                    tabPanel.setActiveTab('tab_' + config.default_service);
                }
                break;
        }
    }
});
