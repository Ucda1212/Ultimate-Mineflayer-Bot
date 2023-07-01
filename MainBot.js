var mineflayer = require('mineflayer');
var radarPlugin = require('mineflayer-radar')(mineflayer);
var bot = mineflayer.createBot({ username: 'Lucas', host: 'localhost', port: 56721});
const navigatePlugin = require('mineflayer-navigate')(mineflayer)
const autoeat = require('mineflayer-auto-eat').plugin
const pvp = require('mineflayer-pvp').plugin
const armorManager = require('mineflayer-armor-manager')
const pathfinder = require('mineflayer-pathfinder').pathfinder
const Movements = require('mineflayer-pathfinder').Movements
const { goals, GoalNear  } = require('mineflayer-pathfinder').goals
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
const { ucs2 } = require('punycode');


var options = {
  host: '0.0.0.0', // optional
  port: 61489,         // optional
}
// install the plugin
radarPlugin(bot, options);
bot.loadPlugin(require('mineflayer-collectblock').plugin)
bot.loadPlugin(autoeat)
bot.loadPlugin(pathfinder)
navigatePlugin(bot)
bot.loadPlugin(pvp)
bot.loadPlugin(armorManager)

bot.once('spawn', () => {
  const defaultMove = new Movements(bot)
  
  bot.on('chat', function(username, message) {
  
    if (username === bot.username) return

    const target = bot.players[username] ? bot.players[username].entity : null
    if (message === 'come') {
      if (!target) {
        bot.chat('I don\'t see you !')
        return
      }
      const p = target.position

      bot.pathfinder.setMovements(defaultMove)
      bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1))
    } 
  })
})

bot.loadPlugin(require('mineflayer-dashboard')({
  chatPattern: /^» \w+? » /
}))
// or
bot.loadPlugin(require('mineflayer-dashboard'))

bot.once('inject_allowed', () => {
  global.console.log = bot.dashboard.log
  global.console.error = bot.dashboard.log
})

bot.on('autoeat_started', (item, offhand) => {
  console.log(`Eating ${item.name} in ${offhand ? 'offhand' : 'hand'}`)
})

bot.on('autoeat_finished', (item, offhand) => {
  console.log(`Finished eating ${item.name} in ${offhand ? 'offhand' : 'hand'}`)
})

bot.on('autoeat_error', console.error)

bot.on('chat', (username, message) => {
  if (message === 'fight me') {
    const player = bot.players[username]

    if (!player) {
      bot.chat("I can't see you.")
      return
    }

    bot.pvp.attack(player.entity)
  }

  if (message === 'stop') {
    bot.pvp.stop()
  }
})

bot.on('chat', (username, message) => {
  if (username === bot.username) return
  switch (message) {
    case 'sleep':
      goToSleep()
      break
    case 'wakeup':
      wakeUp()
      break
  }
})

bot.on('sleep', () => {
  bot.chat('Good night!')
})
bot.on('wake', () => {
  bot.chat('Good morning!')
})

async function goToSleep () {
  const bed = bot.findBlock({
    matching: block => bot.isABed(block)
  })
  if (bed) {
    try {
      await bot.sleep(bed)
      bot.chat("I'm sleeping")
    } catch (err) {
      bot.chat(`I can't sleep: ${err.message}`)
    }
  } else {
    bot.chat('No nearby bed')
  }
}

async function wakeUp () {
  try {
    await bot.wake()
  } catch (err) {
    bot.chat(`I can't wake up: ${err.message}`)
  }
}

bot.once('resourcePack', () => { // resource pack sent by server
  bot.acceptResourcePack()
})

bot.once('spawn', () => {
  // Your code to drop items
});

bot.on('chat', (username, message) => {
  if (username === bot.username && message === 'drop') {
    dropItems();
  }
});

function dropItems() {
  const inventory = bot.inventory;
  
  // Iterate through the inventory slots
  for (const slot of inventory.slots) {
    if (slot && slot.name !== 'air') {
      // Drop the item in this slot
      bot.tossStack(slot, () => {
        // Confirmation message
        console.log(`Dropped ${slot.name}`);
      });
    }
  }
}

bot.on('chat', async (username, message) => {
  if (username === bot.username) return
  const command = message.split(' ')
  switch (true) {
    case message === 'loaded':
      await bot.waitForChunksToLoad()
      bot.chat('Ready!')
      break
    case /^list$/.test(message):
      sayItems()
      break
    case /^toss \d+ \w+$/.test(message):
      // toss amount name
      // ex: toss 64 diamond
      tossItem(command[2], command[1])
      break
    case /^toss \w+$/.test(message):
      // toss name
      // ex: toss diamond
      tossItem(command[1])
      break
    case /^equip [\w-]+ \w+$/.test(message):
      // equip destination name
      // ex: equip hand diamond
      equipItem(command[2], command[1])
      break
    case /^unequip \w+$/.test(message):
      // unequip testination
      // ex: unequip hand
      unequipItem(command[1])
      break
    case /^use$/.test(message):
      useEquippedItem()
      break
    case /^craft \d+ \w+$/.test(message):
      // craft amount item
      // ex: craft 64 stick
      craftItem(command[2], command[1])
      break
  }
})

function sayItems (items = null) {
  if (!items) {
    items = bot.inventory.items()
    if (bot.registry.isNewerOrEqualTo('1.9') && bot.inventory.slots[45]) items.push(bot.inventory.slots[45])
  }
  const output = items.map(itemToString).join(', ')
  if (output) {
    bot.chat(output)
  } else {
    bot.chat('empty')
  }
}

async function tossItem (name, amount) {
  amount = parseInt(amount, 10)
  const item = itemByName(name)
  if (!item) {
    bot.chat(`I have no ${name}`)
  } else {
    try {
      if (amount) {
        await bot.toss(item.type, null, amount)
        bot.chat(`tossed ${amount} x ${name}`)
      } else {
        await bot.tossStack(item)
        bot.chat(`tossed ${name}`)
      }
    } catch (err) {
      bot.chat(`unable to toss: ${err.message}`)
    }
  }
}

async function equipItem (name, destination) {
  const item = itemByName(name)
  if (item) {
    try {
      await bot.equip(item, destination)
      bot.chat(`equipped ${name}`)
    } catch (err) {
      bot.chat(`cannot equip ${name}: ${err.message}`)
    }
  } else {
    bot.chat(`I have no ${name}`)
  }
}

async function unequipItem (destination) {
  try {
    await bot.unequip(destination)
    bot.chat('unequipped')
  } catch (err) {
    bot.chat(`cannot unequip: ${err.message}`)
  }
}

function useEquippedItem () {
  bot.chat('activating item')
  bot.activateItem()
}

async function craftItem (name, amount) {
  amount = parseInt(amount, 10)
  const item = bot.registry.itemsByName[name]
  const craftingTableID = bot.registry.blocksByName.crafting_table.id

  const craftingTable = bot.findBlock({
    matching: craftingTableID
  })

  if (item) {
    const recipe = bot.recipesFor(item.id, null, 1, craftingTable)[0]
    if (recipe) {
      bot.chat(`I can make ${name}`)
      try {
        await bot.craft(recipe, amount, craftingTable)
        bot.chat(`did the recipe for ${name} ${amount} times`)
      } catch (err) {
        bot.chat(`error making ${name}`)
      }
    } else {
      bot.chat(`I cannot make ${name}`)
    }
  } else {
    bot.chat(`unknown item: ${name}`)
  }
}

function itemToString (item) {
  if (item) {
    return `${item.name} x ${item.count}`
  } else {
    return '(nothing)'
  }
}

function itemByName (name) {
  const items = bot.inventory.items()
  if (bot.registry.isNewerOrEqualTo('1.9') && bot.inventory.slots[45]) items.push(bot.inventory.slots[45])
  return items.filter(item => item.name === name)[0]
}

let following = false;
let targetPlayer;

bot.once('spawn', () => {
  mineflayerViewer(bot, { port: 3007, firstPerson: true }) // port is the minecraft server port, if first person is false, you get a bird's-eye view
})

bot.on('experience', () => {
  bot.chat(`I am level ${bot.experience.level}`)
})

bot.on('chat', (username, message) => {
  if (username === bot.username) return
  switch (true) {
    case /^list$/.test(message):
      sayItems()
      break
    case /^chest$/.test(message):
      watchChest(false, ['chest', 'ender_chest', 'trapped_chest'])
      break
    case /^furnace$/.test(message):
      watchFurnace()
      break
    case /^dispenser$/.test(message):
      watchChest(false, ['dispenser'])
      break
    case /^enchant$/.test(message):
      watchEnchantmentTable()
      break
    case /^chestminecart$/.test(message):
      watchChest(true)
      break
    case /^invsee \w+( \d)?$/.test(message): {
      // invsee Herobrine [or]
      // invsee Herobrine 1
      const command = message.split(' ')
      useInvsee(command[0], command[1])
      break
    }
  }
})

function sayItems (items = bot.inventory.items()) {
  const output = items.map(itemToString).join(', ')
  if (output) {
    bot.chat(output)
  } else {
    bot.chat('empty')
  }
}

async function watchChest (minecart, blocks = []) {
  let chestToOpen
  if (minecart) {
    chestToOpen = Object.keys(bot.entities)
      .map(id => bot.entities[id]).find(e => e.entityType === bot.registry.entitiesByName.chest_minecart &&
      e.objectData.intField === 1 &&
      bot.entity.position.distanceTo(e.position) < 3)
    if (!chestToOpen) {
      bot.chat('no chest minecart found')
      return
    }
  } else {
    chestToOpen = bot.findBlock({
      matching: blocks.map(name => bot.registry.blocksByName[name].id),
      maxDistance: 6
    })
    if (!chestToOpen) {
      bot.chat('no chest found')
      return
    }
  }
  const chest = await bot.openContainer(chestToOpen)
  sayItems(chest.containerItems())
  chest.on('updateSlot', (slot, oldItem, newItem) => {
    bot.chat(`chest update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
  })
  chest.on('close', () => {
    bot.chat('chest closed')
  })

  bot.on('chat', onChat)

  function onChat (username, message) {
    if (username === bot.username) return
    const command = message.split(' ')
    switch (true) {
      case /^close$/.test(message):
        closeChest()
        break
      case /^withdraw \d+ \w+$/.test(message):
        // withdraw amount name
        // ex: withdraw 16 stick
        withdrawItem(command[2], command[1])
        break
      case /^deposit \d+ \w+$/.test(message):
        // deposit amount name
        // ex: deposit 16 stick
        depositItem(command[2], command[1])
        break
    }
  }

  function closeChest () {
    chest.close()
    bot.removeListener('chat', onChat)
  }

  async function withdrawItem (name, amount) {
    const item = itemByName(chest.containerItems(), name)
    if (item) {
      try {
        await chest.withdraw(item.type, null, amount)
        bot.chat(`withdrew ${amount} ${item.name}`)
      } catch (err) {
        bot.chat(`unable to withdraw ${amount} ${item.name}`)
      }
    } else {
      bot.chat(`unknown item ${name}`)
    }
  }

  async function depositItem (name, amount) {
    const item = itemByName(chest.items(), name)
    if (item) {
      try {
        await chest.deposit(item.type, null, amount)
        bot.chat(`deposited ${amount} ${item.name}`)
      } catch (err) {
        bot.chat(`unable to deposit ${amount} ${item.name}`)
      }
    } else {
      bot.chat(`unknown item ${name}`)
    }
  }
}

async function watchFurnace () {
  const furnaceBlock = bot.findBlock({
    matching: ['furnace', 'lit_furnace'].filter(name => bot.registry.blocksByName[name] !== undefined).map(name => bot.registry.blocksByName[name].id),
    maxDistance: 6
  })
  if (!furnaceBlock) {
    bot.chat('no furnace found')
    return
  }
  const furnace = await bot.openFurnace(furnaceBlock)
  let output = ''
  output += `input: ${itemToString(furnace.inputItem())}, `
  output += `fuel: ${itemToString(furnace.fuelItem())}, `
  output += `output: ${itemToString(furnace.outputItem())}`
  bot.chat(output)

  furnace.on('updateSlot', (slot, oldItem, newItem) => {
    bot.chat(`furnace update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
  })
  furnace.on('close', () => {
    bot.chat('furnace closed')
  })
  furnace.on('update', () => {
    console.log(`fuel: ${Math.round(furnace.fuel * 100)}% progress: ${Math.round(furnace.progress * 100)}%`)
  })

  bot.on('chat', onChat)

  function onChat (username, message) {
    if (username === bot.username) return
    const command = message.split(' ')
    switch (true) {
      case /^close$/.test(message):
        closeFurnace()
        break
      case /^(input|fuel) \d+ \w+$/.test(message):
        // input amount name
        // ex: input 32 coal
        putInFurnace(command[0], command[2], command[1])
        break
      case /^take (input|fuel|output)$/.test(message):
        // take what
        // ex: take output
        takeFromFurnace(command[0])
        break
    }

    function closeFurnace () {
      furnace.close()
      bot.removeListener('chat', onChat)
    }

    async function putInFurnace (where, name, amount) {
      const item = itemByName(furnace.items(), name)
      if (item) {
        const fn = {
          input: furnace.putInput,
          fuel: furnace.putFuel
        }[where]
        try {
          await fn.call(furnace, item.type, null, amount)
          bot.chat(`put ${amount} ${item.name}`)
        } catch (err) {
          bot.chat(`unable to put ${amount} ${item.name}`)
        }
      } else {
        bot.chat(`unknown item ${name}`)
      }
    }

    async function takeFromFurnace (what) {
      const fn = {
        input: furnace.takeInput,
        fuel: furnace.takeFuel,
        output: furnace.takeOutput
      }[what]
      try {
        const item = await fn.call(furnace)
        bot.chat(`took ${item.name}`)
      } catch (err) {
        bot.chat('unable to take')
      }
    }
  }
}

async function watchEnchantmentTable () {
  const enchantTableBlock = bot.findBlock({
    matching: ['enchanting_table'].map(name => bot.registry.blocksByName[name].id),
    maxDistance: 6
  })
  if (!enchantTableBlock) {
    bot.chat('no enchantment table found')
    return
  }
  const table = await bot.openEnchantmentTable(enchantTableBlock)
  bot.chat(itemToString(table.targetItem()))

  table.on('updateSlot', (slot, oldItem, newItem) => {
    bot.chat(`enchantment table update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
  })
  table.on('close', () => {
    bot.chat('enchantment table closed')
  })
  table.on('ready', () => {
    bot.chat(`ready to enchant. choices are ${table.enchantments.map(o => o.level).join(', ')}`)
  })

  bot.on('chat', onChat)

  function onChat (username, message) {
    if (username === bot.username) return
    const command = message.split(' ')
    switch (true) {
      case /^close$/.test(message):
        closeEnchantmentTable()
        break
      case /^put \w+$/.test(message):
        // put name
        // ex: put diamondsword
        putItem(command[1])
        break
      case /^add lapis$/.test(message):
        addLapis()
        break
      case /^enchant \d+$/.test(message):
        // enchant choice
        // ex: enchant 2
        enchantItem(command[1])
        break
      case /^take$/.test(message):
        takeEnchantedItem()
        break
    }

    function closeEnchantmentTable () {
      table.close()
    }

    async function putItem (name) {
      const item = itemByName(table.window.items(), name)
      if (item) {
        try {
          await table.putTargetItem(item)
          bot.chat(`I put ${itemToString(item)}`)
        } catch (err) {
          bot.chat(`error putting ${itemToString(item)}`)
        }
      } else {
        bot.chat(`unknown item ${name}`)
      }
    }

    async function addLapis () {
      const item = itemByType(table.window.items(), ['dye', 'purple_dye', 'lapis_lazuli'].filter(name => bot.registry.itemByName[name] !== undefined)
        .map(name => bot.registry.itemByName[name].id))
      if (item) {
        try {
          await table.putLapis(item)
          bot.chat(`I put ${itemToString(item)}`)
        } catch (err) {
          bot.chat(`error putting ${itemToString(item)}`)
        }
      } else {
        bot.chat("I don't have any lapis")
      }
    }

    async function enchantItem (choice) {
      choice = parseInt(choice, 10)
      try {
        const item = await table.enchant(choice)
        bot.chat(`enchanted ${itemToString(item)}`)
      } catch (err) {
        bot.chat('error enchanting')
      }
    }

    async function takeEnchantedItem () {
      try {
        const item = await table.takeTargetItem()
        bot.chat(`got ${itemToString(item)}`)
      } catch (err) {
        bot.chat('error getting item')
      }
    }
  }
}

function useInvsee (username, showEquipment) {
  bot.once('windowOpen', (window) => {
    const count = window.containerItems().length
    const what = showEquipment ? 'equipment' : 'inventory items'
    if (count) {
      bot.chat(`${username}'s ${what}:`)
      sayItems(window.containerItems())
    } else {
      bot.chat(`${username} has no ${what}`)
    }
  })
  if (showEquipment) {
    // any extra parameter triggers the easter egg
    // and shows the other player's equipment
    bot.chat(`/invsee ${username} 1`)
  } else {
    bot.chat(`/invsee ${username}`)
  }
}

function itemToString (item) {
  if (item) {
    return `${item.name} x ${item.count}`
  } else {
    return '(nothing)'
  }
}

function itemByType (items, type) {
  let item
  let i
  for (i = 0; i < items.length; ++i) {
    item = items[i]
    if (item && item.type === type) return item
  }
  return null
}

function itemByName (items, name) {
  let item
  let i
  for (i = 0; i < items.length; ++i) {
    item = items[i]
    if (item && item.name === name) return item
  }
  return null
}
  
