/**
 * GroupController - manages group-related operations for the main tab panel.
 *
 * Holds all group management methods that previously cluttered MainController:
 *   toggleGroupCollapse, expandGroup, applyGroupCollapseState, renameGroup,
 *   changeGroupColor, muteGroupServices, deleteGroup, openGroupManager,
 *   rebuildTabBar.
 *
 * MainController (or any other view controller) can obtain a reference to
 * this controller via `this.getController('group')` or by alias lookup.
 */
Ext.define('Rambox.view.main.GroupController', {
	 extend: 'Ext.app.ViewController'
	,alias: 'controller.group'

	/**
	 * Toggles the collapsed state of the group identified by `groupId`.
	 *
	 * @param {string} groupId  The group identifier (e.g. the align value or a custom id).
	 */
	,toggleGroupCollapse: function(groupId) {
		var tabPanel = Ext.cq1('app-main');
		if (!tabPanel) return;

		var state = this.getGroupCollapseState(groupId);
		this.setGroupCollapseState(groupId, !state);
		this.applyGroupCollapseState(groupId);
	}

	/**
	 * Expands a collapsed group.
	 *
	 * @param {string} groupId
	 */
	,expandGroup: function(groupId) {
		this.setGroupCollapseState(groupId, false);
		this.applyGroupCollapseState(groupId);
	}

	/**
	 * Reads the current collapsed state of a group from localStorage.
	 *
	 * @param {string} groupId
	 * @return {boolean}  `true` if the group is collapsed.
	 */
	,getGroupCollapseState: function(groupId) {
		try {
			var states = JSON.parse(localStorage.getItem('groupCollapseStates') || '{}');
			return !!states[groupId];
		} catch (e) {
			return false;
		}
	}

	/**
	 * Persists the collapsed state of a group to localStorage.
	 *
	 * @param {string} groupId
	 * @param {boolean} collapsed
	 */
	,setGroupCollapseState: function(groupId, collapsed) {
		var states = {};
		try {
			states = JSON.parse(localStorage.getItem('groupCollapseStates') || '{}');
		} catch (e) { /* ignore */ }

		states[groupId] = collapsed;
		localStorage.setItem('groupCollapseStates', JSON.stringify(states));
	}

	/**
	 * Applies the stored collapse state for a group to the tab panel UI.
	 *
	 * @param {string} groupId
	 */
	,applyGroupCollapseState: function(groupId) {
		var tabPanel = Ext.cq1('app-main');
		if (!tabPanel) return;

		var collapsed = this.getGroupCollapseState(groupId);
		// Iterate over tabs belonging to this group and show/hide them
		tabPanel.items.each(function(tab) {
			if (tab.record && tab.record.get('align') === groupId && tab.id !== 'ramboxTab') {
				if (collapsed) {
					tab.tab.hide();
				} else {
					tab.tab.show();
				}
			}
		});
	}

	/**
	 * Renames a group by updating all member service records.
	 *
	 * @param {string} oldName
	 * @param {string} newName
	 */
	,renameGroup: function(oldName, newName) {
		var store = Ext.getStore('Services');
		if (!store) return;

		store.each(function(rec) {
			if (rec.get('group') === oldName) {
				rec.set('group', newName);
				rec.save();
			}
		});
	}

	/**
	 * Changes the display colour of a group.
	 *
	 * @param {string} groupId
	 * @param {string} color  CSS colour value.
	 */
	,changeGroupColor: function(groupId, color) {
		try {
			var colors = JSON.parse(localStorage.getItem('groupColors') || '{}');
			colors[groupId] = color;
			localStorage.setItem('groupColors', JSON.stringify(colors));
		} catch (e) { /* ignore */ }
	}

	/**
	 * Mutes or unmutes all services in a group.
	 *
	 * @param {string} groupId
	 * @param {boolean} muted
	 */
	,muteGroupServices: function(groupId, muted) {
		var store = Ext.getStore('Services');
		if (!store) return;

		store.each(function(rec) {
			if (rec.get('align') === groupId && rec.get('enabled')) {
				rec.set('muted', muted);
				rec.save();

				var tab = Ext.getCmp('tab_' + rec.get('id'));
				if (tab && tab.setAudioMuted) {
					tab.setAudioMuted(muted);
				}
			}
		});
	}

	/**
	 * Deletes a group and optionally reassigns its member services to
	 * the default (left) group.
	 *
	 * @param {string} groupId
	 */
	,deleteGroup: function(groupId) {
		var store = Ext.getStore('Services');
		if (!store) return;

		store.each(function(rec) {
			if (rec.get('align') === groupId) {
				rec.set('align', 'left');
				rec.save();
			}
		});

		this.rebuildTabBar();
	}

	/**
	 * Opens the group manager dialog.
	 * (Stub - can be replaced with a real Ext.Window implementation.)
	 */
	,openGroupManager: function() {
		// Placeholder for a future group manager UI.
		console.info('GroupManager: openGroupManager called');
	}

	/**
	 * Rebuilds the entire tab bar from the Services store.
	 * Delegates to TabConfigBuilder for the actual construction.
	 */
	,rebuildTabBar: function() {
		var tabPanel = Ext.cq1('app-main');
		if (!tabPanel) return;

		// Remove all service tabs (keep ramboxTab and tbfill)
		var toRemove = [];
		tabPanel.items.each(function(tab) {
			if (tab.id !== 'ramboxTab' && tab.id !== 'tbfill') {
				toRemove.push(tab);
			}
		});
		Ext.Array.each(toRemove, function(tab) { tab.destroy(); });

		// Re-load the store, which triggers the load listener -> TabConfigBuilder
		var store = Ext.getStore('Services');
		if (store) {
			store.resumeEvent('load');
			store.load();
		}
	}
});
