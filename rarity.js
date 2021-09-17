const Config = require('./config.json')
const Web3 = require('web3')
const EthereumTx = require('ethereumjs-tx').Transaction
const Common = require('ethereumjs-common').default
const fs = require('fs')
const parse = require('csv-parse/lib/sync')

const web3 = new Web3(Config.network.endpoint)

const CHAIN_ID = Config.network.chain_id
const RARITY_ABI = require('./rarity_abi.json')
const RARITY = new web3.eth.Contract(RARITY_ABI, Config.rarity_contract)

const MULTIPLE_RARITY_ABI = require('./multiple_rarity_abi.json')
const MULTIPLE_RARITY = new web3.eth.Contract(MULTIPLE_RARITY_ABI, Config.multiple_rarity_contract)

const RARITY_GOLD_ABI = require('./rarity_gold_abi.json')
const RARITY_GOLD = new web3.eth.Contract(RARITY_GOLD_ABI, Config.rarity_gold_contract)

const classes = {1: 'Barbarian', 2: 'Bard', 3: 'Cleric', 4: 'Druid', 5: 'Fighter', 6: 'Monk', 7: 'Paladin', 8: 'Ranger', 9: 'Rogue', 10: 'Sorcerer', 11: 'Wizard'}
const invertClasses = Object.keys(classes).reduce((ret, key) => { ret[classes[key]] = parseInt(key); return ret}, {})

// 0.
// test()

// 1. 
// batchSummon(1, 2)

// 2. 
// parseSummoners()

// 3. 

main()

async function main() {
    await multipleLevelUp()
    await multipleAdventure()
    await multipleCraftingMaterials()
}

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

    const dir = './data'
    fs.rmdirSync(dir, { recursive: true })
    !fs.existsSync(dir) && fs.mkdirSync(dir)

    for (var i = 0; i < tokenIds.length; i++) {
        const rawClass = await RARITY.methods.class(tokenIds[i]).call()
        console.log(rawClass)
        const summonerClass = classes[rawClass]
        fs.appendFileSync(`${dir}/${summonerClass}`, `${tokenIds[i]}\n`)
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
    const rawTx = await signTx(RARITY, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Summon ${classes[summonerClass]} failed!`)
    } else {
        console.log(`Summon ${classes[summonerClass]} succeed!`)
    }
}

async function batchClaimGold() {
    var summoners = getSummoners()
    for (var i = 0; i < summoners.length; i++) {
        try {
            if (await RARITY_GOLD.methods.claimable(summoners[i]).call({from: Config.account.address}) != 0) {
                await claimGold(summoners[i])
            } else {
                console.log(`${summoners[i]} cann't claim gold now.`)
            }
        } catch (e) { console.log(e) }
    } 
}

async function claimGold(summonerId) {
    const encodedABI = RARITY_GOLD.methods.claim(summonerId).encodeABI()
    const rawTx = await signTx(RARITY_GOLD, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Claim gold failed! summonerId: ${summonerId} error: ${error}`)
    } else {
        console.log(`Claim gold succeed! summonerId: ${summonerId} txid: ${res['transactionHash']}`)
    }
}

async function batchApproveToMultipleRarity() {
    var summoners = getSummoners()
    for (var i = 0; i < summoners.length; i++) {
        try {
            if (await RARITY.methods.getApproved(summoners[i]).call() != Config.multiple_rarity_contract) {
                await approveToMultipleRarity(summoners[i])
            } else {
                console.log(`${summoners[i]} has already approved to multipleRarity`)
            }
        } catch (e) { console.log(e) }
    }
}

async function approveToMultipleRarity(summonerId) {
    const encodedABI = RARITY.methods.approve(Config.multiple_rarity_contract, summonerId).encodeABI()
    const rawTx = await signTx(RARITY, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Approve failed! summonerId: ${summonerId} error: ${error}`)
    } else {
        console.log(`Approve succeed! summonerId: ${summonerId} txid: ${res['transactionHash']}`)
    }
}

async function multipleLevelUp() {
    const summoners = getSummoners()
    const encodedABI = MULTIPLE_RARITY.methods.multiple_level_up(summoners).encodeABI()
    const rawTx = await signTx(MULTIPLE_RARITY, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`LevelUp failed! error: ${error}`)
    } else {
        console.log(`LevelUp succeed! txid: ${res['transactionHash']}`)
    }
}

async function multipleClaimGold() {
    const summoners = getSummoners()
    const encodedABI = MULTIPLE_RARITY.methods.multiple_claim_gold(summoners).encodeABI()
    const rawTx = await signTx(MULTIPLE_RARITY, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Adventure failed! error: ${error}`)
    } else {
        console.log(`Adventure succeed! txid: ${res['transactionHash']}`)
    }
}

async function multipleCraftingMaterials() {
    const summoners = getSummoners()
    const encodedABI = MULTIPLE_RARITY.methods.multiple_adventure_crafting_materials(summoners).encodeABI()
    const rawTx = await signTx(MULTIPLE_RARITY, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Crafting failed! error: ${error}`)
    } else {
        console.log(`Crafting succeed! txid: ${res['transactionHash']}`)
    }
}

async function multipleAdventure() {
    const summoners = getSummoners()
    const encodedABI = MULTIPLE_RARITY.methods.multiple_adventure(summoners).encodeABI()
    const rawTx = await signTx(MULTIPLE_RARITY, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Adventure failed! error: ${error}`)
    } else {
        console.log(`Adventure succeed! txid: ${res['transactionHash']}`)
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
    const rawTx = await signTx(RARITY, encodedABI)
    const [ res, error ] = await safePromise(web3.eth.sendSignedTransaction(rawTx))
    if (error) {
        console.log(`Adventure failed! summoner: ${summonerId} error: ${error}`)
    } else {
        console.log(`Adventure succeed! summoner: ${summonerId} txid: ${res['transactionHash']}`)
    }
}

async function levelUp() {
    var summoners = getSummoners()
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
    const rawTx = await signTx(RARITY, encodedABI)
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
        const ids = String(content).trim().split('\n').map((v) => parseInt(v))
        summoners = summoners.concat(ids)
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

async function signTx(contract, encodedABI) {
    var nonce = await web3.eth.getTransactionCount(Config.account.address)

    const common = Common.forCustomChain('mainnet', {
        name: 'ftm',
        networkId: CHAIN_ID,
        chainId: CHAIN_ID, 
    }, 'petersburg');

    let params = {
        'to': contract.options.address, 
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


