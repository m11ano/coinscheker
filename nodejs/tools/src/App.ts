import {WebsocketClient} from './../../includes/';
import {DatabaseController}  from './../../includes/';
import {WebsocketServer}  from './../../includes/';
import {CoinAppNetworksFactory, NetworkProvidersApps, CoinAppAddressesFactory, AddressStatuses}  from './../../includes/';

class App {

    private _isDestroyed = false;

    constructor()
    {
        console.log('APP INIT');

    }
 
    async start()
    {
        console.log('APP STARTED');

        let wsClient = new WebsocketClient({
            url : 'ws://127.0.0.1:8081'
        });

        wsClient.event.on('connectNewInstance', (wsi, ready)=>{

            console.log('NEW Websocket instance connected', wsi.id);

            ready();
        });

        wsClient.event.on('message', (wsi, message, isJson)=>{

            console.log(wsi.id, message);

        });

        wsClient.event.on('error', (wsi, error)=>{
            console.log(error);
        });

        wsClient.event.on('close', (wsi)=>{
            console.log('Websocket disconnected');
        });

        wsClient.event.on('readyNewInstance', (wsi)=>{

            console.log('NEW Websocket instance ready to work', wsi.id);


            wsi.ws.send(JSON.stringify({
                method: "checkAddressIsCexIncoming",
                params: {
                    checkBy: 'format',
                    address: '0x8682072d94768182c8c66b1d273a24325bca9d52',
                    format: 'erc',
                },
                id: 1
            }));

        });

        wsClient.event.once('readyNewInstance', (wsi)=>{
            console.log('Start work App here...');
        });
        
        wsClient.startNewInstance();
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

            console.log('APP CLOSED');
        }
    }
}

export default App;