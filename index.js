const { createClient } = require('oicq');
const { GuildApp } = require("oicq-guild");

const config = require('./config.json');
const logger = require('./util/logger.js');
const components = {};
let guild = {};

logger.info('=================================');
logger.info('          clipcc-cutie');
logger.info('       作者：SinanGentoo');
logger.info('=================================');
logger.info('读取配置文件并尝试创建实例...');
if (config.debug_mode) {
    logger.warn('调试模式已开启！');
}
process.on("unhandledRejection", (reason, promise) => {
	logger.error('Unhandled Rejection at: ' + promise + ' reason:' + reason)
})

const client = createClient(config.qq, {
    log_level: config.debug_mode ? 'mark' : 'off',
    platform: config.platform
});

logger.info('初始化接口...');
initializeCoreApi();
if (config.use_guild) {
    logger.info('频道功能已启用！初始化相关 API 中');
    guild = GuildApp.bind(client);
    initializeGuildApi();
}

logger.info('尝试登录...');
login();

function login () {
    if (!config.password || config.password === null) {
        // 未设置密码，扫码登录
        client.on('system.login.qrcode', function (e) {
            //扫码后按回车登录
            process.stdin.once('data', () => login())
        }).login();
    } else {
        client.on('system.login.slider', function (e) {
            logger.info('本次登录需要滑动验证码，请在验证后输入ticket并回车。');
            logger.info(e.url);
            process.stdin.once('data', (ticket) => {
                client.sliderLogin(ticket);
            });
        }).on('system.login.device', function (e) {
            logger.info('本次登录需要设备锁验证，请在验证后输入短信验证码并回车。');
            logger.info(e.url);
            client.sendSMSCode();
            process.stdin.once('data', (code) => client.submitSMSCode(code));
        }).login(config.password);
    }
    
    client.on('system.online', () => {
        logger.info('已登录!开始加载组件...');
        if (guild instanceof GuildApp) guild.reloadGuilds();
        loadComponents();
    });
    
    client.on('system.login.error', (e) => {
        logger.error(e.message);
    });
}

function initializeCoreApi () {
    client.on('message.group', async (e) => {
        for (const id in components) {
            try {
                if (components[id].onGroupMessage) components[id].onGroupMessage(e);
            } catch (e) {
                logger.error(e);
            }
        }
    });
    client.on('message.private', async (e) => {
        for (const id in components) {
            try {
                if (components[id].onPrivateMessage) components[id].onPrivateMessage(e);
            } catch (e) {
                logger.error(e);
            }
        }
    });
    client.on('request.friend', async (e) => {
        for (const id in components) {
            try {
                if (components[id].onRequestFriend) components[id].onRequestFriend(e);
            } catch (e) {
                logger.error(e);
            }
        }
    });
}

function initializeGuildApi () {
    guild.on('ready', async () => {
        for (const id in components) {
            try {
                if (components[id].onGuildReady) components[id].onGuildReady();
            } catch (e) {
                logger.error(e);
            }
        }
    });
    guild.on('message', async (e) => {
        for (const id in components) {
            try {
                if (components[id].onGuildMessage) components[id].onGuildMessage(e);
            } catch (e) {
                logger.error(e);
            }
        }
    });
}

function loadComponents () {
    // 加载组件
    for (const componentId in config.components) {
        const name = config.components[componentId];
        try {
            const Component = require(`./components/${name}`);
            components[name] = new Component(client, guild);
            if (components[name].activate) components[name].activate();
            logger.info(`组件 ${name} 已被激活!`);
        } catch (e) {
            delete components[name];
            logger.error(`加载组件 ${name} 时发生错误:\n ${e}`);
        }
    }
}