//const { Message, escapeMarkdown, splitMessage } = require('discord.js'),
const { Message, MessageEmbed, Util: { escapeMarkdown, splitMessage } } = require("discord.js"),
	{ oneLine } = require('common-tags'),
	register = (name, value) => Message.prototype[name] = value;;


for (const name of ["isCommand", "command", "argString", "patternMatches", "responses", "responsePositions"]) register(name, null);

register("initCommand", function (command, argString, patternMatches) {
	this.isCommand = true;
	this.command = command;
	this.argString = argString;
	this.patternMatches = patternMatches;
	return this;
})

register("usage", function (argString, prefix, user = this.client.user) {
	if (typeof prefix === 'undefined') {
		if (this.guild) prefix = this.guild.commandPrefix;
		else prefix = this.client.commandPrefix;
	}
	return this.command.usage(argString, prefix, user);
})


register("anyUsage", function (command, prefix, user = this.client.user) {
	if (typeof prefix === 'undefined') {
		if (this.guild) prefix = this.guild.commandPrefix;
		else prefix = this.client.commandPrefix;
	}
	return Command.usage(command, prefix, user);
})

register("parseArgs", function () {
	switch (this.command.argsType) {
		case 'single': return this.argString.trim().replace(this.command.argsSingleQuotes ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g, '$2');
		case 'multiple': return parseArgs(this.argString, this.command.argsCount, this.command.argsSingleQuotes);
		default: throw new RangeError(`Unknown argsType "${this.argsType}".`);
	}
});

register("inlineReply", async function (content, options) {
	if (!options && typeof content === 'object' && !(content instanceof Array)) {
		options = content;
		content = null;
	}
	if (typeof options !== "object") options = {};
	if (content && typeof content === "string") options.content = content;
	if (options?.reply === true) options.allowedMentions = { ...options.allowedMentions, repliedUser: false };
	delete options["reply"];
	if (options.embed) {
		if (options.embeds) options.embeds.push(options.embed);
		else options.embeds = [options.embed];
	}
	return this.channel.send({ ...options, reply: { messageReference: this, failIfNotExists: false } })
		.catch((e) => global.log(`[MESSAGE:INLINE_REPLY:ERROR]: ${global.__filename}`, e));
});

register("run", async function () {
	// Obtain the member if we don't have it
	if (this.channel.type === 'text' && !this.guild.members.cache.has(this.author.id) && !this.webhookID) {
		this.member = await this.guild.members.fetch(this.author);
	}

	// Obtain the member for the ClientUser if it doesn't already exist
	if (this.channel.type === 'text' && !this.guild.members.cache.has(this.client.user.id)) {
		await this.guild.members.fetch(this.client.user.id);
	}

	// Make sure the command is usable in this context
	if (this.command.guildOnly && !this.guild) {
		this.client.emit('commandBlock', this, 'guildOnly');
		return this.command.onBlock(this, 'guildOnly');
	}

	// Ensure the channel is a NSFW one if required
	if (this.command.nsfw && !this.channel.nsfw) {
		this.client.emit('commandBlock', this, 'nsfw');
		return this.command.onBlock(this, 'nsfw');
	}

	// Ensure the user has permission to use the command
	const hasPermission = this.command.hasPermission(this);
	if (!hasPermission || typeof hasPermission === 'string') {
		const data = { response: typeof hasPermission === 'string' ? hasPermission : undefined };
		this.client.emit('commandBlock', this, 'permission', data);
		return this.command.onBlock(this, 'permission', data);
	}

	// Ensure the client user has the required permissions
	if (this.guild) {
		if (this.command.clientPermissions) {
			const missing = this.channel.permissionsFor(this.client.user).missing(this.command.clientPermissions);
			if (missing.length > 0) {
				this.client.emit('commandBlock', this, 'clientPermissions', { missing });
				return this.command.onBlock(this, 'clientPermissions', { missing });
			}
		};
		if (this.command.clientGuildPermissions) {
			const missing = this.guild.me.permissions.missing(this.command.clientGuildPermissions);
			if (missing.length !== 0) {
				this.client.emit('commandBlock', this, 'clientPermissions', { missing })
				return this.command.onBlock(this, 'clientPermissions', { missing });
			}
		};
	};

	// Throttle the command
	const throttle = this.command.throttle(this.author.id);
	if (throttle && throttle.usages + 1 > this.command.throttling.usages) {
		const remaining = (throttle.start + (this.command.throttling.duration * 1000) - Date.now()) / 1000;
		const data = { throttle, remaining };
		this.client.emit('commandBlock', this, 'throttling', data);
		return this.command.onBlock(this, 'throttling', data);
	}

	// Figure out the command arguments
	let args = this.patternMatches;
	let collResult = null;
	if (!args && this.command.argsCollector) {
		const collArgs = this.command.argsCollector.args;
		const count = collArgs[collArgs.length - 1].infinite ? Infinity : collArgs.length;
		const provided = parseArgs(this.argString.trim(), count, this.command.argsSingleQuotes);

		collResult = await this.command.argsCollector.obtain(this, provided);
		if (collResult.cancelled) {
			if (collResult.prompts.length === 0 || collResult.cancelled === 'promptLimit') {
				this.client.emit('commandCancel', this.command, collResult.cancelled, this, collResult);
				//const err = new CommandFormatError(this);
				//return this.reply(err.message);
			}
			/**
			 * Emitted when a command is cancelled (either by typing 'cancel' or not responding in time)
			 * @event CommandoClient#commandCancel
			 * @param {Command} command - Command that was cancelled
			 * @param {string} reason - Reason for the command being cancelled
			 * @param {CommandoMessage} message - Command message that the command ran from (see {@link Command#run})
			 * @param {?ArgumentCollectorResult} result - Result from obtaining the arguments from the collector
			 * (if applicable - see {@link Command#run})
			 */
			this.client.emit('commandCancel', this.command, collResult.cancelled, this, collResult);
			return this.reply('Cancelled command.');
		}
		args = collResult.values;
	}
	if (!args) args = this.parseArgs();
	const fromPattern = Boolean(this.patternMatches);

	// Run the command
	if (throttle) throttle.usages++;
	const typingCount = this.channel.typingCount;
	try {
		this.client.emit('debug', `Running command ${this.command.groupID}:${this.command.memberName}.`);
		const promise = this.command.run(this, args, fromPattern, collResult);
		/**
		 * Emitted when running a command
		 * @event CommandoClient#commandRun
		 * @param {Command} command - Command that is being run
		 * @param {Promise} promise - Promise for the command result
		 * @param {CommandoMessage} message - Command message that the command is running from (see {@link Command#run})
		 * @param {Object|string|string[]} args - Arguments for the command (see {@link Command#run})
		 * @param {boolean} fromPattern - Whether the args are pattern matches (see {@link Command#run})
		 * @param {?ArgumentCollectorResult} result - Result from obtaining the arguments from the collector
		 * (if applicable - see {@link Command#run})
		 */
		this.client.emit('commandRun', this.command, promise, this, args, fromPattern, collResult);
		const retVal = await promise;
		if (!(retVal instanceof Message || retVal instanceof Array || retVal === null || retVal === undefined)) {
			throw new TypeError(oneLine`
						Command ${this.command.name}'s run() resolved with an unknown type
						(${retVal !== null ? retVal && retVal.constructor ? retVal.constructor.name : typeof retVal : null}).
						Command run methods must return a Promise that resolve with a Message, Array of Messages, or null/undefined.
					`);
		}
		return retVal;
	} catch (err) {
		/**
		 * Emitted when a command produces an error while running
		 * @event CommandoClient#commandError
		 * @param {Command} command - Command that produced an error
		 * @param {Error} err - Error that was thrown
		 * @param {CommandoMessage} message - Command message that the command is running from (see {@link Command#run})
		 * @param {Object|string|string[]} args - Arguments for the command (see {@link Command#run})
		 * @param {boolean} fromPattern - Whether the args are pattern matches (see {@link Command#run})
		 * @param {?ArgumentCollectorResult} result - Result from obtaining the arguments from the collector
		 * (if applicable - see {@link Command#run})
		 */
		this.client.emit('commandError', this.command, err, this, args, fromPattern, collResult);
		if (this.channel.typingCount > typingCount) this.channel.stopTyping();
		return this.command.onError(err, this, args, fromPattern, collResult);
	}
})

register("finalize", function (responses) {
	const deleteRemainingResponses = () => {
		for (const id of Object.keys(this.responses)) {
			const responses = this.responses[id];
			for (let i = this.responsePositions[id] + 1; i < responses.length; i++) {
				const response = responses[i];
				if (response instanceof Array) for (const resp of response) resp.del();
				else response.del();
			}
		}
	};
	if (this.responses) deleteRemainingResponses();
	this.responses = {};
	this.responsePositions = {};

	if (responses instanceof Array) {
		for (const response of responses) {
			const channel = (response instanceof Array ? response[0] : response).channel;
			const id = channel.type === "dm" ? "dm" : channel.id;
			if (!this.responses[id]) {
				this.responses[id] = [];
				this.responsePositions[id] = -1;
			}
			this.responses[id].push(response);
		}
	} else if (responses) {
		const id = responses.channel ? responses.channel.type === "dm" ? "dm" : responses.channel.id : "dm"
		this.responses[id] = [responses];
		this.responsePositions[id] = -1;
	}
});

register("editCurrentResponse", function (id, options) {
	if (typeof this.responses[id] === 'undefined') this.responses[id] = [];
	if (typeof this.responsePositions[id] === 'undefined') this.responsePositions[id] = -1;
	this.responsePositions[id]++;
	const editResponse = (response, { type, content, options }) => {
		if (!response) return this.respond({ type, content, options, fromEdit: true });
		if (options && options.split) content = splitMessage(content, options.split);

		let prepend = '';
		if (type === 'reply') prepend = `${this.author}, `;

		if (content instanceof Array) {
			const promises = [];
			if (response instanceof Array) {
				for (let i = 0; i < content.length; i++) {
					if (response.length > i) promises.push(response[i].edit({ content: `${prepend}${content[i]}`, ...options }).catch(e => global.log(`[MESSAGE:EDIT:ERROR]: ${global.__filename}`, e)));
					else promises.push(response[0].channel.send({ content: `${prepend}${content[i]}` }).catch(e => global.log(`[MESSAGE:SEND:ERROR]: ${global.__filename}`, e)));
				}
			} else {
				promises.push(response.edit({ content: `${prepend}${content[0]}`, ...options }).catch(e => global.log(`[MESSAGE:EDIT:ERROR]: ${global.__filename}`, e)));
				for (let i = 1; i < content.length; i++) {
					promises.push(response.channel.send({ content: `${prepend}${content[i]}` }).catch(e => global.log(`[MESSAGE:SEND:ERROR]: ${global.__filename}`, e)));
				}
			}
			return Promise.all(promises);
		} else {
			if (response instanceof Array) { // eslint-disable-line no-lonely-if
				for (let i = response.length - 1; i > 0; i--) response[i].del().catch(() => null);
				return response[0].edit({ content: `${prepend}${content}`, ...options }).catch(e => global.log(`[MESSAGE:EDIT:ERROR]: ${global.__filename}`, e))
			} else {
				return response.edit({ content: `${prepend}${content}`, ...options }).catch(e => global.log(`[MESSAGE:EDIT:ERROR]: ${global.__filename}`, e))
			}
		}
	};
	return editResponse(this.responses[id][this.responsePositions[id]], options);
});

register("respond", function ({ type = 'reply', content, options, lang, fromEdit = false }) {
	const shouldEdit = this.responses && !fromEdit;
	if (shouldEdit) {
		if (options && options.split && typeof options.split !== 'object') options.split = {};
	}

	if (type === 'reply' && this.channel.type === 'dm') type = 'plain';
	if (type !== 'direct' && this.guild && !this.channel.permissionsFor(this.client.user).has(global.PERMS.messages.send)) type = "direct";

	content = typeof content === "string" ? content : null;
	content = content?.replace(new RegExp(this.client.token, "g"), "[N/A]");
	switch (type) {
		case 'plain':
			if (!shouldEdit) return this.channel.send({ content, ...options }).catch(e => global.log(`[MESSAGE:RESPOND:ERROR]: ${global.__filename}`, e))
			return this.editCurrentResponse(this.channel.type === "dm" ? "dm" : this.channel.id, { type, content, options });
		case 'reply':
			if (!shouldEdit) return this.channel.send({ content, ...options }).catch(e => global.log(`[MESSAGE:RESPOND:ERROR]: ${global.__filename}`, e))
			if (options && options.split && !options.split.prepend) options.split.prepend = `${this.author}, `;
			return this.editCurrentResponse(this.channel.type === "dm" ? "dm" : this.channel.id, { type, content, options });
		case 'direct':
			if (!shouldEdit) return this.author.send({ content, ...options }).catch(e => global.log(`[MESSAGE:RESPOND:ERROR]: ${global.__filename}`, e))
			return this.editCurrentResponse('dm', { type, content, options });
		case 'code':
			if (!shouldEdit) return this.channel.send({ content, ...options }).catch(e => global.log(`[MESSAGE:RESPOND:ERROR]: ${global.__filename}`, e))
			if (options && options.split) {
				if (!options.split.prepend) options.split.prepend = `\`\`\`${lang || ''}\n`;
				if (!options.split.append) options.split.append = '\n```';
			}
			content = `\`\`\`${lang || ''}\n${escapeMarkdown(content, true)}\n\`\`\``;
			return this.editCurrentResponse(this.channel.type === "dm" ? "dm" : this.channel.id, { type, content, options });
		default:
			throw new RangeError(`Unknown response type "${type}".`);
	}
});

function parseArgs(argString, argCount, allowSingleQuote = true) {
	const re = allowSingleQuote ? /\s*(?:("|')([^]*?)\1|(\S+))\s*/g : /\s*(?:(")([^]*?)"|(\S+))\s*/g;
	const result = [];
	let match = [];
	// Large enough to get all items
	argCount = argCount || argString.length;
	// Get match and push the capture group that is not null to the result
	while (--argCount && (match = re.exec(argString))) result.push(match[2] || match[3]);
	// If text remains, push it to the array as-is (except for wrapping quotes, which are removed)
	if (match && re.lastIndex < argString.length) {
		const re2 = allowSingleQuote ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g;
		result.push(argString.substr(re.lastIndex).replace(re2, '$2'));
	}
	return result;
}

module.exports = Message