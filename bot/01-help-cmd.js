'use strict'

const pkg = require('../package.json')
const fs = require('fs')
const Markup = require('telegraf/markup')

// Responds to /help and to "help" messages
module.exports = (state) => {
    const {bot, telemetry} = state

    // Help message
    const helpMessage = fs.readFileSync('./extra/HelpText.md', 'utf8').replace('{Version}', pkg.version)

    const sendHelp = (ctx) => {
        telemetry.info({action: 'replied', reply: 'help', from: ctx.from.id})

        return ctx.replyWithMarkdown(helpMessage, Markup.inlineKeyboard([
            Markup.urlButton('Project on GitHub', 'https://github.com/EgoAleSum/TheCoinsBot'),
          ]).extra())
    }
    bot.command('help', sendHelp)
    bot.hears('help', sendHelp)
}
