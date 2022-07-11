import Web3 from 'web3';

import { RowDataPacket, FieldPacket } from 'mysql2';

import WebsocketServer  from './includes/WebsocketServer';
import DatabaseController from './includes/DatabaseController';

import {CoinAppNetworksFactory, NetworkProvidersApps, CoinAppAddressesFactory, AddressStatuses}  from './includes/CoinApp';

class App {

    private _isDestroyed = false;
    private _DB : DatabaseController;
    private _wSServer : WebsocketServer;

    private networksFactory : CoinAppNetworksFactory;
    private addressesFactory : CoinAppAddressesFactory;

    constructor()
    {
        console.log('APP INIT');

        const dbConOpts = DatabaseController.parseConnectionOptions(process.env.DATABASE_CONNECTION || '');
        dbConOpts.connectionLimit = 1;

        this._DB = new DatabaseController(dbConOpts);

        this._wSServer = new WebsocketServer({
            port : parseInt(process.env.WS_SERVER_PORT || '8080')

        }, {
            checkConnection : (ws, req)=>{
                return new Promise((resolve, reject)=>{
                    
                    //reject({error:{code:403, message:'Connection is denied'}});
                    resolve(true);
                });
            }
        });

        this.networksFactory = new CoinAppNetworksFactory(this._DB, NetworkProvidersApps.CoinsAdder, null);
        this.addressesFactory = new CoinAppAddressesFactory(this._DB, this.networksFactory);
    }

    async start()
    {
        console.log('APP STARTED');

        try {
            await this.networksFactory.loadData();
        }
        catch (e)
        {
            console.log(e);
            this.exit();
        }

        /*
        let wallets = [
            
            '0x631fc1ea2270e98fbd9d92658ece0f5a269aa161',
            '0xb1256d6b31e4ae87da1d56e5890c66be7f1c038e',
            '0x17b692ae403a8ff3a3b2ed7676cf194310dde9af',
            '0x8ff804cc2143451f454779a40de386f913dcff20',
            '0xad9ffffd4573b642959d3b854027735579555cbc',
            '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
            '0xe2fc31f816a9b94326492132018c3aecc4a93ae1',
            '0x3c783c21a0383057d128bae431894a5c19f9cf06',
            '0xdccf3b77da55107280bd850ea519df3705d1a75a',
            '0x01c952174c24e1210d26961d456a77a39e1f0bb0',
            '0xeb2d2f1b8c558a40207669291fda468e50c8a0bb',
            '0x161ba15a5f335c9f06bb5bbb0a9ce14076fbb645',
            '0x515b72ed8a97f42c568d6a143232775018f133c8',
            '0xbd612a3f30dca67bf60a39fd0d35e39b7ab80774',
            '0x7a8a34db9acd10c3b6277473b192fe47192569ca',
            '0xa180fe01b906a1be37be6c534a3300785b20d947',
            '0x29bdfbf7d27462a2d115748ace2bd71a2646946c',
            '0x73f5ebe90f27b46ea12e5795d16c4b408b19cc6f',

        ];

        let start = 33;

        for (let wallet of wallets)
        {
            try {

                let result = await this.addressesFactory.addAddress(
                    'erc', 
                    wallet, 
                    undefined, 
                    {by : 'format'}, 
                    AddressStatuses.cexHotWallet, 
                    false, 
                    {
                        name : 'Binance Hot Wallet #'+start,
                        exchangeId : 1
                    }
                );

                //console.log(result);

            }
            catch (e)
            {
                console.log(e);
                break;
            }

            start++;
        }
        */

        /*
        try {

            let result = await this.addressesFactory.addAddress(
                'erc', 
                '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', 
                undefined, 
                {by : 'format'}, 
                AddressStatuses.cexAnother, 
                false,
                1,
                {
                    name : 'Binance: WBNB Token'
                }
            );

            console.log(result);

        }
        catch (e)
        {
            console.log(e);
        }

        */


        /*
        try {
            let n = await this.networksFactory.getNetwork('eth')?.provider?.eth.getBlockNumber();

            console.log(n);
        }
        catch (e)
        {
            console.log(e);
        }
        */

        /*
        let data;
        try {
            [data] = await this._DB.pool.promise().query<Array<RowDataPacket>>("\
                SELECT *\
                FROM `addresses` as m\
            ");
        }
        catch(e)
        {
            throw new Error('Cant load data networks');
        }

        let mapLenght = 2;
        let map = data[0].isSmartContractChecks[0].toString(2) as String;
        const dif = mapLenght - map.length;

        if (dif > 0)
        {
            for (let i = 0; i < dif; i++)
            {
                map = '0' + map;
            }
        }

        console.log(map);
        */


        /*
        try {
            let r = await this.addressesFactory.checkAdrressIsCexIncoming('0x8682072d94768182c8c66b1d273a24325bca9d52', 'eth');
            console.log(r);
        }
        catch (e)
        {
            console.log(e);
        }
        */



        this._wSServer.event.on('message', (wsId, message, isJson)=>
        {
            if (isJson)
            {
                const params = typeof message.params == 'object' ? message.params : {};

                if (message.method === 'makeCoinTransfers')
                {
                    
                }
            }
        });

        //this._wSServer.start();
    }

    exit(code : number = 5)
    {
        this.destroy();
        process.exit(code);
    }

    destroy()
    {
        if (this._isDestroyed == false)
        {
            this._isDestroyed = true;
            this._DB.destroy();
            this._wSServer.destroy();

            console.log('APP CLOSED');
        }
    }
}

export default App;