import {DatabaseController}  from './../../includes/';
import {WebsocketServer}  from './../../includes/';
import {CoinAppNetworksFactory, NetworkProvidersApps}  from './../../includes/';
import {CoinAppAddressesFactory, AddressStatuses}  from './../../includes/';
import {queueWithDelay} from './../../includes/';

import { RowDataPacket, FieldPacket } from 'mysql2';
import mysql from 'mysql2';

import axios from 'axios';

class App {

    private _isDestroyed = false;
    private _DB : DatabaseController;
    private _wSServer : WebsocketServer;

    private _networksFactory : CoinAppNetworksFactory;
    private _addressesFactory : CoinAppAddressesFactory;

    private _cexHotWallets : {
        [format : string] : {
            [address : string] : number
        }
    } = {};

    private _networksCheckQueue : {
        [network : string] : {
            [keyId : string] : queueWithDelay<{address : string}, number | undefined>
        }
    } = {};

    constructor()
    {
        console.log('APP INIT');

        const dbConOpts = DatabaseController.parseConnectionOptions(process.env.DATABASE_CONNECTION || '');
        dbConOpts.connectionLimit = 1;

        this._DB = new DatabaseController(dbConOpts);

        this._wSServer = new WebsocketServer({
            port : parseInt(process.env.WS_SERVER_PORT || '8081')

        }, {
            checkConnection : (ws, req)=>{
                return new Promise((resolve, reject)=>{
                    
                    //reject({error:{code:403, message:'Connection is denied'}});
                    resolve(true);
                });
            }
        });

        this._networksFactory = new CoinAppNetworksFactory(this._DB, null, null);
        this._addressesFactory = new CoinAppAddressesFactory(this._DB, this._networksFactory);
    }
 
    async start()
    {
        console.log('APP STARTED');

        try {
            await this._networksFactory.loadData();
        }
        catch (e)
        {
            console.log(e);
            this.exit();
        }

        try {
            this._cexHotWallets = await this._addressesFactory.getAddressesByStatus(AddressStatuses.cexHotWallet);
        }
        catch (e)
        {
            console.log(e);
            this.exit();
        }


        try {
            let [data] = await this._DB.pool.promise().query<Array<RowDataPacket>>("\
                SELECT *\
                FROM `addresses_checker_api_keys` as m\
            ");

            if (data.length > 0)
            {
                for (let it of data)
                {
                    const thisNetwork = this._networksFactory.getNetwork(it.network);

                    if (thisNetwork === undefined)
                    {
                        continue;
                    }

                    if (this._networksCheckQueue[it.network] === undefined)
                    {
                        this._networksCheckQueue[it.network] = {};
                    }

                    //ETH STANDART NETWORKS
                    if (thisNetwork.format.value == 'erc') 
                    {
                        this._networksCheckQueue[it.network][it.keyId] = new queueWithDelay<{address : string}, number | undefined>(250, (item, ready, error, triesCount, repeat)=>{
                            return new Promise((nextQueueItem)=>
                            {
                                this.goToErcEtherscanAndCheckIsAddressCexIncoming(it.network, it.apiKeyValue, item.address)
                                .then((result)=>{
                                    ready(result);
                                    nextQueueItem();
                                })
                                .catch((e)=>{
                                    if (e.message == 'No answer from server')
                                    {
                                        if (triesCount < 3)
                                        {
                                            setTimeout(()=>{
                                                repeat(false);
                                            }, triesCount == 0 ? 1000 : 3000);
                                        }
                                        else
                                        {
                                            error(e);
                                            nextQueueItem();
                                        }
                                    }
                                    else
                                    {
                                        error(e);
                                        nextQueueItem();
                                    }
                                });
                            });
                        });
                    }
                }
            }
            
        }
        catch(e)
        {
            throw e;
        }

        try {
            let result = await this._networksCheckQueue['eth']['default'].add({
                address : '0x8682072d94768182c8c66b1d273a24325bca9d52'
            });

            console.log(result);
        }
        catch (e : any)
        {
            /*
            if (e.message == 'Bad answer from server')
            {
                console.log('!!!!!!!!!!')
            }
            */
            console.log(e);
        }
        
        try {
            let result = await this._networksCheckQueue['eth']['default'].add({
                address : '0x8682072d94768182c8c66b1d273a24325bca9d51'
            });

            console.log(result);
        }
        catch (e : any)
        {
            /*
            if (e.message == 'Bad answer from server')
            {
                console.log('!!!!!!!!!!')
            }
            */
            console.log(e);
        }



        this._wSServer.event.on('message', (wsId, message, isJson)=>
        {
            if (isJson)
            {
                const params = typeof message.params == 'object' ? message.params : {};
                const id = typeof message.id == 'string' || typeof message.id == 'number' ? message.id : null;

                if (message.method === 'checkAddressIsCexIncoming')
                {
                    if (typeof params.checkBy != 'string' || ['format', 'network'].includes(params.checkBy) == false)
                    {
                        this._wSServer.sendJsonRPC(wsId, false, 'Param "checkBy" is incorrect', id);
                        return;
                    }

                    if (typeof params.address != 'string')
                    {
                        this._wSServer.sendJsonRPC(wsId, false, 'Param "address" is incorrect', id);
                        return;
                    }

                    if (params.checkBy == 'format')
                    {
                        if (typeof params.format != 'string')
                        {
                            this._wSServer.sendJsonRPC(wsId, false, 'Param "format" is incorrect', id);
                            return;
                        }

                        const checkFormat = this._networksFactory.getFormat(params.format);

                        if (checkFormat === undefined)
                        {
                            this._wSServer.sendJsonRPC(wsId, false, 'Requested format is incorrect', id);
                            return;
                        }
                    }

                    if (params.checkBy == 'network')
                    {
                        if (typeof params.network != 'string')
                        {
                            this._wSServer.sendJsonRPC(wsId, false, 'Param "network" is incorrect', id);
                            return;
                        }

                        const checkNetwork = this._networksFactory.getNetwork(params.network);

                        if (checkNetwork === undefined)
                        {
                            this._wSServer.sendJsonRPC(wsId, false, 'Requested network is incorrect', id);
                            return;
                        }
                    }

                    this._wSServer.sendJsonRPC(wsId, true, 'OK', id);
                }
                else
                {
                    this._wSServer.sendJsonRPC(wsId, false, 'Unknown method', id);
                }
            }
            else
            {
                this._wSServer.sendJsonRPC(wsId, false, 'Incorrect request');
            }
        });

        this._wSServer.start();
    }


    //Пойти на etherscan или аналог, проверка принадлежит ли адрес одной из бирж.
    //Undefined - нет
    //Number - ID биржи

    goToErcEtherscanAndCheckIsAddressCexIncoming(network : string, apiKeyValue : string, address : string) : Promise<undefined | number>
    {
        if (address.length == 40)
        {
            address = '0x' + address;
        }

        return new Promise((ready, error)=>
        {
            const thisNetwork = this._networksFactory.getNetwork(network);
            if (thisNetwork)
            {
                let url = '';

                if (network == 'eth')
                {
                    url = 'https://api.etherscan.io/api?module=account&action=txlist&address='+address+'&startblock=0&endblock=99999999&page=1&offset=0&sort=asc&apikey='+apiKeyValue;
                }

                axios.get(url)
                .then((res) => 
                {
                    if (typeof res.data == 'object' && res.data.status === '1' && typeof res.data.result == 'object')
                    {
                        for (let trx of res.data.result)
                        {
                            if (typeof trx.to == 'string' && this._cexHotWallets[thisNetwork.format.value][trx.to.slice(2).toLocaleLowerCase()] !== undefined)
                            {
                                ready(this._cexHotWallets[thisNetwork.format.value][trx.to.slice(2).toLocaleLowerCase()]);
                                return;
                            }
                        }

                        ready(undefined);
                    }
                    else if (typeof res.data == 'object' && res.data.status === '0')
                    {
                        ready(undefined);
                    }

                    error(new Error('Bad answer from server'));
                })
                .catch((error) =>
                {
                    error(new Error('No answer from server'));
                });
            }
            else
            {
                error(new Error('Bad arg: network'));
            }
        });
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