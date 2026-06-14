/**
 * GroupController - Dedicated controller for group management operations.
 *
 * Extracted from MainController to separate concerns. MainController delegates
 * group-related operations to this controller via getController('group').
 *
 * Current group operations (ready for implementation as features are added):
 *   - toggleGroupCollapse
 *   - expandGroup
 *   - applyGroupCollapseState
 *   - renameGroup
 *   - changeGroupColor
 *   - muteGroupServices
 *   - deleteGroup
 *   - openGroupManager
 *   - rebuildTabBar
 */
Ext.define('Rambox.view.main.GroupController', {
    singleton: true

    /**
     * Toggles the collapsed state of a tab group.
     *
     * @param {String} groupName - The group identifier.
     */
    ,toggleGroupCollapse: function(groupName) {
        var tabPanel = Ext.cq1('app-main');
        var tabs = this._getTabsInGroup(groupName);

        Ext.Array.each(tabs, function(tab) {
            if (tab.id !== 'ramboxTab' && tab.id !== 'tbfill') {
                tab.setVisible(!tab.isVisible());
            }
        });
    }

    /**
     * Expands a collapsed group, making all its tabs visible.
     *
     * @param {String} groupName - The group identifier.
     */
    ,expandGroup: function(groupName) {
        var tabs = this._getTabsInGroup(groupName);

        Ext.Array.each(tabs, function(tab) {
            if (tab.id !== 'ramboxTab' && tab.id !== 'tbfill') {
                tab.setVisible(true);
            }
        });
    }

    /**
     * Applies persisted collapse state to all groups on startup.
     */
    ,applyGroupCollapseState: function() {
        var state = Ext.decode(localStorage.getItem('groupCollapseState') || '{}');
        var me = this;

        Ext.Object.each(state, function(groupName, collapsed) {
            if (collapsed) {
                me.toggleGroupCollapse(groupName);
            }
        });
    }

    /**
     * Renames a group.
     *
     * @param {String} oldName - Current group name.
     * @param {String} newName - New group name.
     */
    ,renameGroup: function(oldName, newName) {
        var store = Ext.getStore('Services');
        store.each(function(record) {
            if (record.get('group') === oldName) {
                record.set('group', newName);
                record.save();
            }
        });
    }

    /**
     * Changes the display color of a group.
     *
     * @param {String} groupName - The group identifier.
     * @param {String} color - CSS color value.
     */
    ,changeGroupColor: function(groupName, color) {
        var state = Ext.decode(localStorage.getItem('groupColors') || '{}');
        state[groupName] = color;
        localStorage.setItem('groupColors', Ext.encode(state));

        this.rebuildTabBar();
    }

    /**
     * Mutes or unmutes all services within a group.
     *
     * @param {String} groupName - The group identifier.
     * @param {Boolean} muted - true to mute, false to unmute.
     */
    ,muteGroupServices: function(groupName, muted) {
        var tabs = this._getTabsInGroup(groupName);

        Ext.Array.each(tabs, function(tab) {
            if (tab.setAudioMuted) {
                tab.setAudioMuted(muted);
            }
        });
    }

    /**
     * Deletes a group and optionally reassigns its services.
     *
     * @param {String} groupName - The group identifier.
     */
    ,deleteGroup: function(groupName) {
        var store = Ext.getStore('Services');
        store.each(function(record) {
            if (record.get('group') === groupName) {
                record.set('group', '');
                record.save();
            }
        });

        this.rebuildTabBar();
    }

    /**
     * Opens the group manager dialog.
     * Placeholder for future group management UI.
     */
    ,openGroupManager: function() {
        // Placeholder – to be implemented when group manager UI is added
        console.info('GroupManager: openGroupManager called (not yet implemented)');
    }

    /**
     * Rebuilds the tab bar to reflect current group configuration.
     */
    ,rebuildTabBar: function() {
        var tabPanel = Ext.cq1('app-main');
        var store = Ext.getStore('Services');

        // Suspend events during rebuild
        tabPanel.suspendEvent('add');
        tabPanel.suspendEvent('remove');

        // Re-apply collapse state after rebuild
        this.applyGroupCollapseState();

        tabPanel.resumeEvent('add');
        tabPanel.resumeEvent('remove');
    }

    /**
     * Returns all tab panel items belonging to a given group.
     *
     * @param {String} groupName
     * @return {Ext.Component[]}
     * @private
     */
    ,_getTabsInGroup: function(groupName) {
        var tabPanel = Ext.cq1('app-main');
        var tabs = [];

        tabPanel.items.each(function(tab) {
            if (tab.record && tab.record.get('group') === groupName) {
                tabs.push(tab);
            }
        });

        return tabs;
    }
});
