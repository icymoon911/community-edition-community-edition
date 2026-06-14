Ext.define('Rambox.store.Services', {
     extend: 'Ext.data.Store'
    ,alias: 'store.services'

    ,requires: [
         'Ext.data.proxy.LocalStorage'
        ,'Rambox.util.TabConfigBuilder'
    ]

    ,model: 'Rambox.model.Service'

    ,autoLoad: false
    ,autoSync: true
    ,pageSize: 0

    ,groupField: 'align'
    ,sorters: [
        {
             property: 'position'
            ,direction: 'ASC'
        }
    ]

    ,listeners: {
         load: function(store, records, successful) {
            // Delegate all tab-building and active-tab restoration to TabConfigBuilder
            Rambox.util.TabConfigBuilder.applyToTabPanel(store);
        }
        ,datachanged: function(store, eOpts) {
            var isEmpty = store.getCount() > 0 ? false : true;
            Ext.cq1('app-main').getViewModel().set('emptyServices', isEmpty);
        }
    }
});
