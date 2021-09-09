const Config = require('./config.json')
const Web3 = require('web3')
const EthereumTx = require('ethereumjs-tx').Transaction
const Common = require('ethereumjs-common').default
const fs = require('fs')
const parse = require('csv-parse/lib/sync')

const web3 = new Web3(Config.network.endpoint)

const CHAIN_ID = Config.network.chain_id
const RARITY_ABI = require('./rarity_abi.json')
const RARITY = new web3.eth.Contract(RARITY_ABI, Config.contract)

const classes = {1: 'Barbarian', 2: 'Bard', 3: 'Cleric', 4: 'Druid', 5: 'Fighter', 6: 'Monk', 7: 'Paladin', 8: 'Ranger', 9: 'Rogue', 10: 'Sorcerer', 11: 'Wizard'}

// adventure()
// test()

// parseSummoners()
// getSummoners()
levelUp()


async function test() {
    const [rawClass, error] = await safePromise(RARITY.methods.class(13098).call())
    if (error) {
        console.log(error)
    } else {
        console.log(rawClass)
    }
}

async function parseSummoners() {
    const content = await fs.promises.readFile(`erc721_txns.csv`)
    const records = parse(content)
    const tokenIds = records
        .filter( record => 
            (record[3] == '0x0000000000000000000000000000000000000000') && (record[4] == Config.account.address.toLowerCase())
        )
        .map( record => parseInt(record[6]) )

    tokenIds.shift()

    for (var i = 0; i < tokenIds.length; i++) {
        const rawClass = await RARITY.methods.class(tokenIds[i]).call()
        const summonerClass = classes[rawClass]
        const dir = './data'
        !fs.existsSync(dir) && fs.mkdirSync(dir)
        fs.writeFileSync(`${dir}/${summonerClass}`, `${tokenIds[i]}`)
    }
}

async function batchSummon(summonerClass, amount) {
    for (var i = 0; i < amount; i++) {
        try {
            await summon(summonerClass)
        } catch (e) { console.log(e) }
    }
}

async function summon(summonerClass) {
    const encodedABI = RARITY.methods.summon(summonerClass).encodeABI()
    const rawTx = await signTx(encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Summon ${classes[summonerClass]} failed!`)
    } else {
        console.log(`Summon ${classes[summonerClass]} succeed!`)
    }
}

async function adventure() {
    var summoners = getSummoners()
    for (var i = 0; i < summoners.length; i++) {
        try {
            if (await isAvailableForAdventure(summoners[i]) == true) {
                await goAdventure(summoners[i])
            } else {
                console.log(`${summoners[i]} is unavailable for adventuring now`)
            }
        } catch (e) { console.log(e) }
    }
}

async function goAdventure(summonerId) {
    const encodedABI = RARITY.methods.adventure(summonerId).encodeABI()
    const rawTx = await signTx(encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Adventure failed! summoner: ${summonerId} error: ${error}`)
    } else {
        console.log(`Adventure succeed! summoner: ${summonerId} txid: ${res['transactionHash']}`)
    }
}

async function levelUp() {
    var summoners = getSummoners(['Barbarian'])
    for (var i = 0; i < summoners.length; i++) {
        try {
            if (await canLevelUp(summoners[i]) == true) {
                await doLevelUp(summoners[i])
            } else {
                console.log(`${summoners[i]} can't level up now!`)
            }
        } catch (e) { console.log(e) }
    }
}

async function doLevelUp(summonerId) {
    const encodedABI = RARITY.methods.level_up(summonerId).encodeABI()
    const rawTx = await signTx(encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Levelup failed! summoner: ${summonerId} error: ${error}`)
    } else {
        console.log(`Levelup succeed! summoner: ${summonerId} txid: ${res['transactionHash']}`)
    } 
}

// 

function getSummoners(summonerClasses = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Wizard']) {
    var summoners = []
    for (var i = 0; i < summonerClasses.length; i++) {
        const path = `./data/${summonerClasses[i]}`
        const content = fs.readFileSync(path)
        summoners.push(parseInt(content))
    }

    return summoners
}

async function isAvailableForAdventure(summonerId) {
    const lastTime = await RARITY.methods.adventurers_log(summonerId).call()
    const currentTime = Math.floor(Date.now() / 1000)
    return currentTime > lastTime
}

async function canLevelUp(summonerId) {
    const level = await RARITY.methods.level(summonerId).call()
    const xpRequired = getXpRequired(level)
    const xp = await RARITY.methods.xp(summonerId).call()

    return (xp - xpRequired) >= 0
}


// Get from RM contract
function getXpRequired(currentLevel) {
    xpToNextLevel = currentLevel * 1000e18
    for (var i = 1; i < currentLevel; i++) {
        xpToNextLevel += i * 1000e18;
    }
    return xpToNextLevel
}


// Utils

function safePromise(promise) {
    return promise.then(data => [ data ]).catch(error => [ null, error ]);
}

async function signTx(encodedABI) {
    var nonce = await web3.eth.getTransactionCount(Config.account.address)

    const common = Common.forCustomChain('mainnet', {
        name: 'ftm',
        networkId: CHAIN_ID,
        chainId: CHAIN_ID, 
    }, 'petersburg');

    let params = {
        'to': RARITY.options.address, 
        'value': "0x", 
        'gas': Config.transaction.gas_limit,
        'gasPrice': Config.transaction.gas_price * 1000000000,
        'nonce': nonce,
        'data': encodedABI
    }

    let tx = new EthereumTx(params, {common})
    tx.sign(Buffer.from(Config.account.privkey, 'hex'))

    return `0x${tx.serialize().toString('hex')}`
}


