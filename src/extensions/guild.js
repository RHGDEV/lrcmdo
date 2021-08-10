const { Guild } = require('discord.js'),
	register = (name, value) => Guild.prototype[name] = value;

register('_commandPrefix', null);
register('color', '');
register('currency', '$');

register('setPrefix', function(xxx) {
	this.commandPrefix = xxx;
	this._commandPrefix = xxx;
});

Reflect.defineProperty(Guild.prototype, 'commandPrefix', {
	get: function() {
		if(this._commandPrefix === null) return this.client.commandPrefix;
		return this._commandPrefix;
	},
	set: function(prefix) { this._commandPrefix = prefix; }
});

register('getColor', function() { return this.color || this.client.util.colors.default; });

register('setCommandEnabled', function(command, enabled) {
	command = this.client.registry.resolveCommand(command);
	if(command.guarded) throw new Error(`The command is guarded.`);
	if(typeof enabled === 'undefined') throw new TypeError(`Enabled must not be undefined.`);
	enabled = Boolean(enabled);
	if(!this._commandsEnabled) this._commandsEnabled = {};
	this._commandsEnabled[command.name] = enabled;
});

register('isCommandEnabled', function(command) {
	command = this.client.registry.resolveCommand(command);
	if(command.guarded) return true;
	if(!this._commandsEnabled) return command._globalEnabled;
	return this._commandsEnabled[command.name];
});

register('setGroupEnabled', function(group, enabled) {
	group = this.client.registry.resolveGroup(group);
	if(group.guarded) throw new Error(`The group is guarded.`);
	if(typeof enabled === 'undefined') throw new TypeError(`Enabled must not be undefined.`);
	enabled = Boolean(enabled);
	if(!this._groupsEnabled) this._groupsEnabled = {};
	return this._groupsEnabled[group.id] = enabled;
});

register('isGroupEnabled', function(group) {
	group = this.client.registry.resolveGroup(group);
	if(group.guarded) return true;
	if(!this._groupsEnabled) return group._globalEnabled;
	return this._groupsEnabled[group.id];
});

module.exports = Guild;
