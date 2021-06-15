const perm = {
	ADMINISTRATOR: 'Administrator',
	VIEW_AUDIT_LOG: 'View Audit Log',
	MANAGE_GUILD: 'Manage Server',
	MANAGE_ROLES: 'Manage Roles',
	MANAGE_CHANNELS: 'Manage Channels',
	VIEW_GUILD_INSIGHTS: 'View Server Insights',
	KICK_MEMBERS: 'Kick Members',
	BAN_MEMBERS: 'Ban Members',
	CREATE_INSTANT_INVITE: 'Create Instant Invite',
	CHANGE_NICKNAME: 'Change Nickname',
	MANAGE_NICKNAMES: 'Manage Nicknames',
	MANAGE_EMOJIS: 'Manage Emojis',
	MANAGE_WEBHOOKS: 'Manage Webhooks',
	VIEW_CHANNEL: 'View Channels',
	SEND_MESSAGES: 'Send Messages',
	SEND_TTS_MESSAGES: 'Send TTS Messages',
	MANAGE_MESSAGES: 'Manage Messages',
	EMBED_LINKS: 'Embed Links',
	ATTACH_FILES: 'Attach Files',
	READ_MESSAGE_HISTORY: 'Read Message History',
	MENTION_EVERYONE: 'Mention Everyone',
	USE_EXTERNAL_EMOJIS: 'Use External Emojis',
	EXTERNAL_EMOJIS: 'Use External Emojis',
	ADD_REACTIONS: 'Add Reactions',
	CONNECT: 'Connect',
	SPEAK: 'Speak',
	PRIORITY_SPEAKER: 'Priority Speaker',
	MUTE_MEMBERS: 'Mute Members',
	DEAFEN_MEMBERS: 'Deafen Members',
	MOVE_MEMBERS: 'Move Members',
	USE_VAD: 'Use Voice Activity',
	STREAM: "Stream",
	USE_SLASH_COMMANDS: "Use Slash Commands",
	REQUEST_TO_SPEAK: "Request To Speak",
	MANAGE_THREADS: "Manage Threads",
	USE_PUBLIC_THREADS: "Use Public Threads",
	USE_PRIVATE_THREADS: "Use Private Threads"
}

const isConstructorProxyHandler = { construct() { return Object.prototype; } };

module.exports = {
	escapeRegex: str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&'),
	disambiguation: (items, label, property = "name") => {
		const itemList = items.map(item => `"${(property ? item[property] : item).replace(/ /g, '\xa0')}"`).join(',   ');
		return `Multiple ${label} found, please be more specific: ${itemList}`;
	},
	isConstructor: (func, _class) => {
		try {
			// eslint-disable-next-line no-new
			new new Proxy(func, isConstructorProxyHandler)();
			if(!_class) return true;
			return func.prototype instanceof _class;
		} catch(err) {
			return false;
		}
	},
	paginate: (items, page = 1, pageLength = 10) => {
		const maxPage = Math.ceil(items.length / pageLength);
		if (page < 1) page = 1;
		if (page > maxPage) page = maxPage;
		const startIndex = (page - 1) * pageLength;
		return {
			items: items.length > pageLength ? items.slice(startIndex, startIndex + pageLength) : items,
			page,
			maxPage,
			pageLength
		};
	},
	permissions: perm,
	perms: perm,
	colors: {
		red: 0xFF0000,
		green: 0xFF000,
		yellow: 0xFAFF00,
		orange: 0xFF8300,
		cyan: 0x00ffe9,
		purple: 0xb28dff,
		default: 0x373dec
	},
	sysJoinMessages: [
		"%user% just joined the server - glhf!",
		"%user% just joined. Everyone, look busy!",
		"%user% just joined. Can I get a heal?",
		"%user% joined your party.",
		"%user% joined. You must construct additional pylons.",
		"Ermagherd. %user% is here.",
		"Welcome, %user%. Stay awhile and listen.",
		"Welcome, %user%. We were expecting you ( ͡° ͜ʖ ͡°)",
		"Welcome, %user%. We hope you brought pizza.",
		"Welcome %user%. Leave your weapons by the door.",
		"A wild %user% appeared.",
		"Swoooosh. %user% just landed.",
		"Brace yourselves. %user% just joined the server.",
		"%user% just joined... or did they?",
		"%user% just arrived. Seems OP - please nerf.",
		"%user% just slid into the server.",
		"A %user% has spawned in the server.",
		"Big %user% showed up!",
		"Where’s %user%? In the server!",
		"%user% hopped into the server. Kangaroo!!",
		"%user% just showed up. Hold my beer.",
		"Challenger approaching - %user% has appeared!",
		"It's a bird! It's a plane! Nevermind, it's just %user%.",
		"It's %user%! Praise the sun! \\\\[T]/",
		"Never gonna give %user% up. Never gonna let %user% down.",
		"%user% has joined the battle bus.",
		"Cheers, love! %user%'s here!",
		"Hey! Listen! %user% has joined!",
		"We've been expecting you %user%",
		"It's dangerous to go alone, take %user%!",
		"%user% has joined the server! It's super effective!",
		"Cheers, love! %user% is here!",
		"%user% is here, as the prophecy foretold.",
		"%user% has arrived. Party's over.",
		"Ready player %user%",
		"%user% is here to kick butt and chew bubblegum. And %user% is all out of gum.",
		"Hello. Is it %user% you're looking for?",
		"%user% has joined. Stay a while and listen!",
		"Roses are red, violets are blue, %user% joined this server with you"
	],
}