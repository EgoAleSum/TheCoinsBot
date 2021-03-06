'use strict'

const moment = require('moment')
const FormatNumber = require('../lib/FormatNumber')

// Answer to questions asking for the price
module.exports = (state) => {
    const {bot, telemetry, config, coins} = state

    const allProducts = config.get('products')

    // This generates the function that answers messages
    const currencySymbols = config.get('currencySymbols')
    const sendPriceFunc = (product) => {
        return async (ctx) => {
            telemetry.info({action: 'replied', reply: 'price', from: ctx.from.id, query: ctx.message.text})

            // What products do we need?
            let products
            if(product) {
                // Check if we have a full product name (e.g. "BTC-USD" or part of it only, without the destination currency)
                if(product.length == 7) {
                    products = [product]
                }
                else {
                    // Get the user, so we can know their region
                    const user = await ctx.user(ctx)
                    let fiat = config.get('regions.' + user.region + '.fiat')

                    // We might have multiple options for fiat currencies
                    fiat = (Array.isArray(fiat)) ? fiat : [fiat]
                    products = []
                    fiat.forEach((el) => {
                        const prod = product + '-' + el
                        // Does the product exist?
                        if(~allProducts.indexOf(prod)) {
                            products.push(prod)
                        }
                    })
                }
            }
            else {
                // Get the user, so we can know their region
                const user = await ctx.user(ctx)

                products = config.get('regions.' + user.region + '.products')
            }

            // Send prices
            const allResponses = []
            products.forEach((el) => {
                const [source, dest] = el.split('-')
                let response = '*' + el + '*\n'
                const price = coins.price(el)
                if(!price) {
                    // Price might not be available if we haven't received a ticker for that coin yet
                    response += 'Price not yet available. Please try again in a few moments.'
                }
                else {
                    let lastUpdate = 'n/a'
                    if(price.time) {
                        const updateMoment = price.time ? moment(price.time) : 0
                        const nowMoment = price.time ? moment() : 0

                        // If difference is less than 5 seconds, display "just now" for last update
                        lastUpdate = (nowMoment.diff(updateMoment) < 5000) ? 'just now' : updateMoment.fromNow()
                    }

                    let decimalDigits = config.get('decimalDigits.' + el)
                    if(decimalDigits === undefined) {
                        decimalDigits = 2
                    }
                    response += 'Price: ' + currencySymbols[dest] + FormatNumber(price.price.toFixed(decimalDigits))
                    response += '\n24hr Change: ' + price.change_percent.toFixed(2) + '%'
                    response += '\n24hr Volume: ' + currencySymbols[source] + FormatNumber(price.volume_24h.toFixed(0))
                    response += '\n24hr Low: ' + currencySymbols[dest] + FormatNumber(price.low_24h.toFixed(decimalDigits))
                    response += '\n24hr High: ' + currencySymbols[dest] + FormatNumber(price.high_24h.toFixed(decimalDigits))
                    response += '\nLast update: ' + lastUpdate
                }
                allResponses.push(response)
            })

            if(allResponses.length) {
                ctx.replyWithMarkdown(allResponses.join('\n\n'))
            }
        }
    }

    // Register multiple commands to send prices for individual products
    const triggers = []

    // Answer with specific products, full name
    allProducts.forEach((product) => {
        // Match coin symbol, with and without the dash
        const alternatives = [
            product.replace('-', '\\-'),
            product.replace('-', '')
        ]

        // Create trigger (case-insensitive)
        triggers.push({
            match: new RegExp('^\\s*(' + alternatives.join('|')  + ')\\s*$', 'i'),
            arg: product
        })
    })

    // Anser with specific products, but without specifying destination currency
    // First, get the list of coins (without destination currency)
    allProducts.map((val) => {
        // Return coin name, first 3 chars
        return val.substr(0, 3)
    }).filter((value, index, self) => {
        // Filter out duplicates
        return self.indexOf(value) === index
    }).forEach((coin) => {
        // Create a trigger for each coin
        const alternatives = [coin]

        // Match aliases
        const aliases = config.get('aliases.' + coin)
        if(aliases) {
            aliases.forEach((alias) => {
                alternatives.push(alias)
            })
        }

        // Create trigger (case-insensitive)
        triggers.push({
            match: new RegExp('^\\s*(' + alternatives.join('|')  + ')\\s*$', 'i'),
            arg: coin
        })
    })

    // Register all triggers
    triggers.forEach((trigger) => {
        bot.hears(trigger.match, sendPriceFunc(trigger.arg))
    })

    // Treat the \price command the same way we treat messages without that
    bot.command('price', (ctx) => {
        // Find the match in the list of triggers
        // Strip "/price" from the text
        const text = ctx.message.text.substr(6).trim()

        // If text is empty, show all prices
        if(!text) {
            return sendPriceFunc()(ctx)
        }

        // Find the first one matching
        let i = 0
        while(i < triggers.length && !text.match(triggers[i].match)) {
            i++
        }

        // Did we find a match? Otherwise, do nothing
        if(i < triggers.length) {
            return sendPriceFunc(triggers[i].arg)(ctx)
        }
    })

    // Answer with all products
    // This needs to go last
    bot.hears(/^\s*(price|quote|all|coins)/i, sendPriceFunc())

}
